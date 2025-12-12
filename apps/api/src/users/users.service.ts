import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find user by username with roles and branch
   */
  async findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
      include: {
        roles: true,
        branch: true,
        partner: true,
      },
    });
  }

  /**
   * Find user by ID
   */
  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: true,
        branch: true,
        partner: true,
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
      include: {
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
            role: role as any,
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
