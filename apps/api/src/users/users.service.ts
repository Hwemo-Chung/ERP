import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find user by username with roles and branch
   *
   * NOTE: partner include 제거 (2026-02-22)
   * - 로그인/토큰갱신 flow에서 user.partner를 참조하는 곳 없음
   * - 주문 관련 서비스(order-assignment, order-query 등)는 자체 Prisma 쿼리로 partner 조회
   * - 불필요한 JOIN 제거로 로그인 응답시간 ~200ms 개선
   * - partner 데이터 필요 시 findByIdWithPartner() 별도 메서드 추가 권장
   */
  async findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
      include: {
        roles: true,
        branch: true,
        // partner: true, // 로그인 flow에서 미사용 — 불필요한 JOIN 제거 (2026-02-22)
      },
    });
  }

  /**
   * Find user by ID
   *
   * NOTE: partner include 제거 (2026-02-22)
   * - refreshTokens()에서 호출 시 user.partner 미참조
   * - GET /users/:id 응답에도 partner 객체 불필요 (partnerId 필드는 User 자체에 존재)
   */
  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: true,
        branch: true,
        // partner: true, // 인증/유저조회 flow에서 미사용 — 불필요한 JOIN 제거 (2026-02-22)
      },
    });

    if (!user) {
      throw new NotFoundException('error.user_not_found');
    }

    return user;
  }

  /**
   * Get all users (for admin)
   */
  async findAll(branchId?: string) {
    return this.prisma.user.findMany({
      where: branchId ? { branchId } : undefined,
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        locale: true,
        isActive: true,
        branchId: true,
        partnerId: true,
        createdAt: true,
        updatedAt: true,
        roles: true,
        branch: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create new user
   */
  async create(data: {
    username: string;
    passwordHash: string;
    fullName: string;
    email?: string;
    locale?: string;
    branchId?: string;
    partnerId?: string;
    roles: string[];
  }) {
    return this.prisma.user.create({
      data: {
        username: data.username,
        passwordHash: data.passwordHash,
        fullName: data.fullName,
        email: data.email,
        locale: data.locale || 'ko',
        branchId: data.branchId,
        partnerId: data.partnerId,
        roles: {
          create: data.roles.map((role) => ({
            role: role as Role,
          })),
        },
      },
      include: {
        roles: true,
        branch: true,
      },
    });
  }

  /**
   * Update user
   */
  async update(
    id: string,
    data: {
      fullName?: string;
      email?: string;
      locale?: string;
      isActive?: boolean;
    },
  ) {
    return this.prisma.user.update({
      where: { id },
      data,
      include: {
        roles: true,
        branch: true,
      },
    });
  }

  /**
   * Update password
   */
  async updatePassword(id: string, passwordHash: string) {
    return this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
  }
}
