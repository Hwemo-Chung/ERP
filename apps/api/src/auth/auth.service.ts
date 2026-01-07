import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { Role } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Validate user credentials and return tokens
   */
  async login(dto: LoginDto): Promise<TokenResponseDto> {
    const user = await this.usersService.findByUsername(dto.username);

    if (!user) {
      this.logger.warn(`Login attempt failed: user not found - ${dto.username}`);
      throw new UnauthorizedException('error.invalid_credentials');
    }

    if (!user.isActive) {
      this.logger.warn(`Login attempt failed: user inactive - ${dto.username}`);
      throw new UnauthorizedException('error.account_disabled');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);

    if (!isPasswordValid) {
      this.logger.warn(`Login attempt failed: invalid password - ${dto.username}`);
      throw new UnauthorizedException('error.invalid_credentials');
    }

    const roles = user.roles.map((r: { role: Role }) => r.role);
    const tokens = await this.generateTokens({
      sub: user.id,
      username: user.username,
      roles,
      branchId: user.branchId ?? undefined,
      branchCode: user.branch?.code,
    });

    this.logger.log(`User logged in: ${user.username}`);

    return {
      ...tokens,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        roles,
        branchCode: user.branch?.code,
        locale: user.locale,
      },
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshTokens(userId: string, _refreshToken: string): Promise<TokenResponseDto> {
    const user = await this.usersService.findById(userId);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('error.token_expired');
    }

    const roles = user.roles.map((r: { role: Role }) => r.role);
    const tokens = await this.generateTokens({
      sub: user.id,
      username: user.username,
      roles,
      branchId: user.branchId ?? undefined,
      branchCode: user.branch?.code,
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        roles,
        branchCode: user.branch?.code,
        locale: user.locale,
      },
    };
  }

  /**
   * Logout - clears user session
   * Note: For enhanced security, implement Redis-based token blacklisting
   * to prevent refresh token reuse after logout
   */
  async logout(userId: string): Promise<void> {
    // In production: Store refresh token in Redis with TTL matching token expiry
    // On logout: Add token to blacklist or delete from Redis
    // On refresh: Check if token is blacklisted before issuing new tokens
    this.logger.log(`User logged out: ${userId}`);
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(payload: JwtPayload): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.accessSecret'),
        expiresIn: '1h' as const,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: '7d' as const,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: 3600, // 1 hour in seconds
    };
  }

  /**
   * Hash password using Argon2
   */
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password);
  }
}
