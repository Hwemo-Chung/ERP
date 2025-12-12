import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { Role } from '@prisma/client';
import { LoginDto } from './dto/login.dto';

jest.mock('argon2');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$hashed',
    fullName: 'Test User',
    email: 'test@example.com',
    locale: 'ko',
    isActive: true,
    branchId: 'branch-001',
    partnerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    roles: [{ id: 'role-1', userId: 'user-123', role: Role.BRANCH_MANAGER, assignedAt: new Date() }],
    branch: { id: 'branch-001', code: 'BR01', name: 'Seoul Branch' },
  };

  const mockAccessToken = 'mock.access.token';
  const mockRefreshToken = 'mock.refresh.token';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByUsername: jest.fn(),
            findById: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService) as jest.Mocked<UsersService>;
    jwtService = module.get(JwtService) as jest.Mocked<JwtService>;
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;

    // Default mock implementations
    configService.get.mockImplementation((key: string) => {
      if (key === 'jwt.accessSecret') return 'access-secret-key';
      if (key === 'jwt.refreshSecret') return 'refresh-secret-key';
      return null;
    });

    jwtService.signAsync.mockImplementation(async (payload, options) => {
      if (options?.secret === 'access-secret-key') return mockAccessToken;
      if (options?.secret === 'refresh-secret-key') return mockRefreshToken;
      return 'mock.token';
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      username: 'testuser',
      password: 'password123',
    };

    it('should return access and refresh tokens on valid credentials', async () => {
      usersService.findByUsername.mockResolvedValue(mockUser as any);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.login(loginDto);

      expect(result).toEqual({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        expiresIn: 3600,
        user: {
          id: mockUser.id,
          username: mockUser.username,
          fullName: mockUser.fullName,
          roles: [Role.BRANCH_MANAGER],
          branchCode: 'BR01',
          locale: mockUser.locale,
        },
      });
      expect(usersService.findByUsername).toHaveBeenCalledWith(loginDto.username);
      expect(argon2.verify).toHaveBeenCalledWith(mockUser.passwordHash, loginDto.password);
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      usersService.findByUsername.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('error.invalid_credentials'),
      );
      expect(usersService.findByUsername).toHaveBeenCalledWith(loginDto.username);
    });

    it('should throw UnauthorizedException when user is inactive', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      usersService.findByUsername.mockResolvedValue(inactiveUser as any);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('error.account_disabled'),
      );
      expect(usersService.findByUsername).toHaveBeenCalledWith(loginDto.username);
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      usersService.findByUsername.mockResolvedValue(mockUser as any);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('error.invalid_credentials'),
      );
      expect(argon2.verify).toHaveBeenCalledWith(mockUser.passwordHash, loginDto.password);
    });

    it('should include user roles in JWT payload', async () => {
      usersService.findByUsername.mockResolvedValue(mockUser as any);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await service.login(loginDto);

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          sub: mockUser.id,
          username: mockUser.username,
          roles: [Role.BRANCH_MANAGER],
          branchId: 'branch-001',
          branchCode: 'BR01',
        },
        expect.objectContaining({
          secret: 'access-secret-key',
          expiresIn: '1h',
        }),
      );
    });

    it('should include branchCode in JWT payload when user has branch', async () => {
      usersService.findByUsername.mockResolvedValue(mockUser as any);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await service.login(loginDto);

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: 'branch-001',
          branchCode: 'BR01',
        }),
        expect.any(Object),
      );
    });

    it('should handle user without branch', async () => {
      const userWithoutBranch = { ...mockUser, branch: null, branchId: null };
      usersService.findByUsername.mockResolvedValue(userWithoutBranch as any);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.login(loginDto);

      expect(result.user.branchCode).toBeUndefined();
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          branchCode: undefined,
        }),
        expect.any(Object),
      );
    });

    it('should handle user with multiple roles', async () => {
      const multiRoleUser = {
        ...mockUser,
        roles: [
          { id: 'role-1', userId: 'user-123', role: Role.HQ_ADMIN, assignedAt: new Date() },
          { id: 'role-2', userId: 'user-123', role: Role.BRANCH_MANAGER, assignedAt: new Date() },
        ],
      };
      usersService.findByUsername.mockResolvedValue(multiRoleUser as any);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.login(loginDto);

      expect(result.user.roles).toEqual([Role.HQ_ADMIN, Role.BRANCH_MANAGER]);
    });

    it('should generate both access and refresh tokens', async () => {
      usersService.findByUsername.mockResolvedValue(mockUser as any);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await service.login(loginDto);

      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ expiresIn: '1h' }),
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ expiresIn: '7d' }),
      );
    });
  });

  describe('refreshTokens', () => {
    const userId = 'user-123';
    const refreshToken = 'valid.refresh.token';

    it('should return new tokens when user is valid and active', async () => {
      usersService.findById.mockResolvedValue(mockUser as any);

      const result = await service.refreshTokens(userId, refreshToken);

      expect(result).toEqual({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        expiresIn: 3600,
        user: {
          id: mockUser.id,
          username: mockUser.username,
          fullName: mockUser.fullName,
          roles: [Role.BRANCH_MANAGER],
          branchCode: 'BR01',
          locale: mockUser.locale,
        },
      });
      expect(usersService.findById).toHaveBeenCalledWith(userId);
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      usersService.findById.mockRejectedValue(new NotFoundException('error.user_not_found'));

      await expect(service.refreshTokens(userId, refreshToken)).rejects.toThrow(NotFoundException);
      expect(usersService.findById).toHaveBeenCalledWith(userId);
    });

    it('should throw UnauthorizedException when user is inactive', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      usersService.findById.mockResolvedValue(inactiveUser as any);

      await expect(service.refreshTokens(userId, refreshToken)).rejects.toThrow(
        new UnauthorizedException('error.token_expired'),
      );
    });

    it('should generate new access and refresh tokens', async () => {
      usersService.findById.mockResolvedValue(mockUser as any);

      await service.refreshTokens(userId, refreshToken);

      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          sub: mockUser.id,
          username: mockUser.username,
          roles: [Role.BRANCH_MANAGER],
          branchId: 'branch-001',
          branchCode: 'BR01',
        },
        expect.objectContaining({
          secret: 'access-secret-key',
          expiresIn: '1h',
        }),
      );
    });

    it('should include updated user information in response', async () => {
      const updatedUser = {
        ...mockUser,
        fullName: 'Updated User Name',
        locale: 'en',
      };
      usersService.findById.mockResolvedValue(updatedUser as any);

      const result = await service.refreshTokens(userId, refreshToken);

      expect(result.user.fullName).toBe('Updated User Name');
      expect(result.user.locale).toBe('en');
    });
  });

  describe('logout', () => {
    it('should log user logout', async () => {
      const userId = 'user-123';
      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service.logout(userId);

      expect(loggerSpy).toHaveBeenCalledWith(`User logged out: ${userId}`);
    });

    it('should complete without throwing errors', async () => {
      const userId = 'user-123';

      await expect(service.logout(userId)).resolves.toBeUndefined();
    });
  });

  describe('hashPassword', () => {
    it('should hash password using argon2', async () => {
      const password = 'password123';
      const hashedPassword = '$argon2id$v=19$m=65536,t=3,p=4$hashed';
      (argon2.hash as jest.Mock).mockResolvedValue(hashedPassword);

      const result = await service.hashPassword(password);

      expect(result).toBe(hashedPassword);
      expect(argon2.hash).toHaveBeenCalledWith(password);
    });

    it('should return different hashes for same password (salt)', async () => {
      const password = 'password123';
      (argon2.hash as jest.Mock)
        .mockResolvedValueOnce('$argon2id$hash1')
        .mockResolvedValueOnce('$argon2id$hash2');

      const hash1 = await service.hashPassword(password);
      const hash2 = await service.hashPassword(password);

      expect(hash1).not.toBe(hash2);
      expect(argon2.hash).toHaveBeenCalledTimes(2);
    });
  });

  describe('JWT token generation', () => {
    it('should use correct JWT secrets from config', async () => {
      usersService.findByUsername.mockResolvedValue(mockUser as any);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await service.login({ username: 'testuser', password: 'password123' });

      expect(configService.get).toHaveBeenCalledWith('jwt.accessSecret');
      expect(configService.get).toHaveBeenCalledWith('jwt.refreshSecret');
    });

    it('should set correct expiration times', async () => {
      usersService.findByUsername.mockResolvedValue(mockUser as any);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.login({ username: 'testuser', password: 'password123' });

      expect(result.expiresIn).toBe(3600); // 1 hour in seconds
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ expiresIn: '1h' }),
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ expiresIn: '7d' }),
      );
    });

    it('should include all required fields in JWT payload', async () => {
      usersService.findByUsername.mockResolvedValue(mockUser as any);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await service.login({ username: 'testuser', password: 'password123' });

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUser.id,
          username: mockUser.username,
          roles: expect.any(Array),
        }),
        expect.any(Object),
      );
    });
  });

  describe('error handling and logging', () => {
    it('should log warning on failed login attempt - user not found', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'warn');
      usersService.findByUsername.mockResolvedValue(null);

      await expect(
        service.login({ username: 'nonexistent', password: 'password' }),
      ).rejects.toThrow();

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Login attempt failed: user not found'),
      );
    });

    it('should log warning on failed login attempt - user inactive', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'warn');
      const inactiveUser = { ...mockUser, isActive: false };
      usersService.findByUsername.mockResolvedValue(inactiveUser as any);

      await expect(
        service.login({ username: 'testuser', password: 'password' }),
      ).rejects.toThrow();

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Login attempt failed: user inactive'),
      );
    });

    it('should log warning on failed login attempt - invalid password', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'warn');
      usersService.findByUsername.mockResolvedValue(mockUser as any);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ username: 'testuser', password: 'wrongpassword' }),
      ).rejects.toThrow();

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Login attempt failed: invalid password'),
      );
    });

    it('should log successful login', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');
      usersService.findByUsername.mockResolvedValue(mockUser as any);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await service.login({ username: 'testuser', password: 'password123' });

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('User logged in'));
    });
  });

  describe('edge cases', () => {
    it('should handle user with empty roles array', async () => {
      const userWithoutRoles = { ...mockUser, roles: [] };
      usersService.findByUsername.mockResolvedValue(userWithoutRoles as any);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.login({ username: 'testuser', password: 'password123' });

      expect(result.user.roles).toEqual([]);
    });

    it('should handle argon2 verification throwing an error', async () => {
      usersService.findByUsername.mockResolvedValue(mockUser as any);
      (argon2.verify as jest.Mock).mockRejectedValue(new Error('Invalid hash format'));

      await expect(
        service.login({ username: 'testuser', password: 'password123' }),
      ).rejects.toThrow('Invalid hash format');
    });

    it('should handle JWT signing failure', async () => {
      usersService.findByUsername.mockResolvedValue(mockUser as any);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      jwtService.signAsync.mockRejectedValue(new Error('JWT signing failed'));

      await expect(
        service.login({ username: 'testuser', password: 'password123' }),
      ).rejects.toThrow('JWT signing failed');
    });

    it('should handle missing config values gracefully', async () => {
      configService.get.mockReturnValue(undefined);
      usersService.findByUsername.mockResolvedValue(mockUser as any);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      // Should still attempt to sign JWT even with undefined secrets
      await service.login({ username: 'testuser', password: 'password123' });

      expect(jwtService.signAsync).toHaveBeenCalled();
    });
  });
});
