/**
 * Settlement Service
 * Manages settlement periods and locking mechanism per FR-12
 *
 * Settlement Lock Rules:
 * - Locked periods prevent order modifications (E2002 error)
 * - Only HQ_ADMIN can manually unlock
 * - Weekly auto-lock via SettlementLockCron
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettlementStatus, Role } from '@prisma/client';

export interface SettlementPeriodResponse {
  id: string;
  branchId: string;
  periodStart: Date;
  periodEnd: Date;
  status: SettlementStatus;
  lockedBy?: string;
  lockedAt?: Date;
  unlockedBy?: string;
  unlockedAt?: Date;
}

export interface PeriodHistoryResponse {
  data: SettlementPeriodResponse[];
  totalCount: number;
}

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get current settlement period for a branch
   * Returns the most recent period (may be OPEN or LOCKED)
   */
  async getCurrentPeriod(branchId: string): Promise<SettlementPeriodResponse | null> {
    const period = await this.prisma.settlementPeriod.findFirst({
      where: {
        branchId,
      },
      orderBy: {
        periodStart: 'desc',
      },
    });

    if (!period) {
      return null;
    }

    return this.mapToResponse(period);
  }

  /**
   * Get settlement period by ID
   */
  async getPeriodById(periodId: string): Promise<SettlementPeriodResponse> {
    const period = await this.prisma.settlementPeriod.findUnique({
      where: { id: periodId },
    });

    if (!period) {
      throw new NotFoundException(`Settlement period ${periodId} not found`);
    }

    return this.mapToResponse(period);
  }

  /**
   * Get settlement period history for a branch
   * Supports pagination via cursor
   */
  async getPeriodHistory(
    branchId: string,
    limit = 20,
    cursor?: string,
  ): Promise<PeriodHistoryResponse> {
    const where = { branchId };

    const [periods, totalCount] = await Promise.all([
      this.prisma.settlementPeriod.findMany({
        where,
        orderBy: {
          periodStart: 'desc',
        },
        take: limit,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      }),
      this.prisma.settlementPeriod.count({ where }),
    ]);

    return {
      data: periods.map(this.mapToResponse),
      totalCount,
    };
  }

  /**
   * Lock a settlement period
   * Transition: OPEN → LOCKED
   * Called by: SettlementLockCron (auto) or BRANCH_MANAGER+ (manual)
   */
  async lockPeriod(periodId: string, userId: string): Promise<SettlementPeriodResponse> {
    this.logger.log(`[Lock Period] Locking period ${periodId} by user ${userId}`);

    const period = await this.prisma.settlementPeriod.findUnique({
      where: { id: periodId },
    });

    if (!period) {
      throw new NotFoundException(`Settlement period ${periodId} not found`);
    }

    if (period.status === SettlementStatus.LOCKED) {
      throw new BadRequestException(`Period ${periodId} is already locked`);
    }

    const updated = await this.prisma.settlementPeriod.update({
      where: { id: periodId },
      data: {
        status: SettlementStatus.LOCKED,
        lockedBy: userId,
        lockedAt: new Date(),
      },
    });

    this.logger.log(`[Lock Period] Period ${periodId} locked successfully`);
    return this.mapToResponse(updated);
  }

  /**
   * Unlock a settlement period
   * Transition: LOCKED → OPEN
   * Requires: HQ_ADMIN role (verified in controller)
   */
  async unlockPeriod(periodId: string, userId: string): Promise<SettlementPeriodResponse> {
    this.logger.log(`[Unlock Period] Unlocking period ${periodId} by user ${userId}`);

    const period = await this.prisma.settlementPeriod.findUnique({
      where: { id: periodId },
    });

    if (!period) {
      throw new NotFoundException(`Settlement period ${periodId} not found`);
    }

    if (period.status === SettlementStatus.OPEN) {
      throw new BadRequestException(`Period ${periodId} is already unlocked`);
    }

    const updated = await this.prisma.settlementPeriod.update({
      where: { id: periodId },
      data: {
        status: SettlementStatus.OPEN,
        unlockedBy: userId,
        unlockedAt: new Date(),
      },
    });

    this.logger.log(`[Unlock Period] Period ${periodId} unlocked successfully`);
    return this.mapToResponse(updated);
  }

  /**
   * Check if an order belongs to a locked settlement period
   * Used in order update flow to prevent modifications (E2002)
   */
  async isOrderLocked(orderId: string): Promise<boolean> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        branchId: true,
        appointmentDate: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const lockedPeriod = await this.prisma.settlementPeriod.findFirst({
      where: {
        branchId: order.branchId,
        status: SettlementStatus.LOCKED,
        periodStart: {
          lte: order.appointmentDate,
        },
        periodEnd: {
          gte: order.appointmentDate,
        },
      },
    });

    return !!lockedPeriod;
  }

  /**
   * Create or get settlement period for a specific week
   * Called by: SettlementLockCron
   */
  async getOrCreatePeriod(
    branchId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<SettlementPeriodResponse> {
    const existing = await this.prisma.settlementPeriod.findFirst({
      where: {
        branchId,
        periodStart,
        periodEnd,
      },
    });

    if (existing) {
      return this.mapToResponse(existing);
    }

    const created = await this.prisma.settlementPeriod.create({
      data: {
        branchId,
        periodStart,
        periodEnd,
        status: SettlementStatus.OPEN,
      },
    });

    this.logger.log(
      `[Create Period] Created new period for branch ${branchId}: ${periodStart.toISOString()} - ${periodEnd.toISOString()}`,
    );

    return this.mapToResponse(created);
  }

  /**
   * Get all locked periods for a branch (for settlement validation)
   */
  async getLockedPeriods(branchId: string): Promise<SettlementPeriodResponse[]> {
    const periods = await this.prisma.settlementPeriod.findMany({
      where: {
        branchId,
        status: SettlementStatus.LOCKED,
      },
      orderBy: {
        periodStart: 'desc',
      },
    });

    return periods.map(this.mapToResponse);
  }

  /**
   * Map Prisma model to response DTO
   */
  private mapToResponse(period: any): SettlementPeriodResponse {
    return {
      id: period.id,
      branchId: period.branchId,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      status: period.status,
      lockedBy: period.lockedBy,
      lockedAt: period.lockedAt,
      unlockedBy: period.unlockedBy,
      unlockedAt: period.unlockedAt,
    };
  }
}
