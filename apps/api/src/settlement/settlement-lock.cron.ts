/**
 * Settlement Lock CRON Job
 * Per SDD section 6.1 - Settlement Lock Flow
 * Runs every Monday at 9:00 AM to lock the previous week's orders
 *
 * Lock prevents:
 * - Order editing
 * - Completion amendments
 * - Waste pickup changes
 *
 * Unlocks: Friday 5:00 PM (for final adjustments)
 */

import {
  Injectable,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { Redis } from 'ioredis';
import { REDIS_PROVIDER } from '../common/constants';

export interface SettlementLockStatus {
  locked: boolean;
  lockedAt: Date;
  unlocksAt: Date;
  week: string;
}

@Injectable()
export class SettlementLockCron {
  private readonly logger = new Logger(SettlementLockCron.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(REDIS_PROVIDER)
    private readonly redis?: Redis,
  ) {}

  /**
   * Lock settlement for previous week
   * Runs: Every Monday 9:00 AM
   */
  @Cron('0 9 * * MON')
  async lockPreviousWeek(): Promise<void> {
    this.logger.log('[Settlement Lock] Starting weekly settlement lock...');

    try {
      const today = new Date();
      const previousWeekStart = this.getWeekStart(
        new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
      );
      const previousWeekEnd = new Date(previousWeekStart);
      previousWeekEnd.setDate(previousWeekEnd.getDate() + 6);
      previousWeekEnd.setHours(23, 59, 59, 999);

      // Get all branches
      const branches = await this.prisma.branch.findMany();

      for (const branch of branches) {
        const lockKey = `settlement:${branch.id}:${previousWeekStart.toISOString().split('T')[0]}`;
        const unlocksAt = this.getUnlockTime();

        // 1. Mark settlement as locked in Redis
        if (this.redis) {
          await this.redis.setex(
            lockKey,
            Math.floor((unlocksAt.getTime() - Date.now()) / 1000),
            JSON.stringify({
              locked: true,
              lockedAt: new Date().toISOString(),
              unlocksAt: unlocksAt.toISOString(),
              branchId: branch.id,
            }),
          );
        }

        // 2. Invalidate KPI cache for this branch
        const cacheKey = `kpi:${branch.id}:*`;
        if (this.redis) {
          const keys = await this.redis.keys(cacheKey);
          if (keys.length > 0) {
            await this.redis.del(...keys);
          }
        }

        this.logger.log(
          `[Settlement Lock] ${branch.name} (${branch.code}) locked for week ${previousWeekStart.toLocaleDateString()}`,
        );
      }

      // 3. Send push notification to branch managers
      await this.notifyBranches(branches);

      this.logger.log('[Settlement Lock] Weekly lock completed successfully');
    } catch (error) {
      this.logger.error('[Settlement Lock] Failed:', error);
      // Don't throw - CRON shouldn't fail the app
    }
  }

  /**
   * Unlock settlement on Friday 5:00 PM (for final adjustments)
   * Runs: Every Friday 5:00 PM
   */
  @Cron('0 17 * * FRI')
  async unlockForAdjustments(): Promise<void> {
    this.logger.log('[Settlement Unlock] Starting Friday unlock for adjustments...');

    try {
      const today = new Date();
      const previousWeekStart = this.getWeekStart(
        new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
      );

      const branches = await this.prisma.branch.findMany();

      for (const branch of branches) {
        const lockKey = `settlement:${branch.id}:${previousWeekStart.toISOString().split('T')[0]}`;

        // Remove lock from Redis
        if (this.redis) {
          await this.redis.del(lockKey);
        }

        this.logger.log(`[Settlement Unlock] ${branch.name} unlocked for final adjustments`);
      }

      await this.notifyUnlock(branches);
      this.logger.log('[Settlement Unlock] Friday unlock completed');
    } catch (error) {
      this.logger.error('[Settlement Unlock] Failed:', error);
    }
  }

  /**
   * Get current settlement lock status for a branch
   */
  async getSettlementStatus(branchId: string): Promise<SettlementLockStatus | null> {
    if (!this.redis) return null;

    const today = new Date();
    const currentWeekStart = this.getWeekStart(today);
    const lockKey = `settlement:${branchId}:${currentWeekStart.toISOString().split('T')[0]}`;

    const data = await this.redis.get(lockKey);
    if (data) {
      return JSON.parse(data);
    }

    return null;
  }

  /**
   * Check if settlement is locked
   */
  async isSettlementLocked(branchId: string): Promise<boolean> {
    const status = await this.getSettlementStatus(branchId);
    return status?.locked || false;
  }

  /**
   * Get settlement unlock time
   */
  async getSettlementUnlockTime(branchId: string): Promise<Date | null> {
    const status = await this.getSettlementStatus(branchId);
    return status ? new Date(status.unlocksAt) : null;
  }

  /**
   * Private helpers
   */

  private getWeekStart(date: Date): Date {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private getUnlockTime(): Date {
    const now = new Date();
    const friday = new Date(now);

    // If today is Friday after 5 PM, unlock is next Friday
    const currentDay = now.getDay();
    const currentHour = now.getHours();

    if (currentDay === 5 && currentHour >= 17) {
      friday.setDate(friday.getDate() + 7);
    } else if (currentDay > 5 || (currentDay === 5 && currentHour < 17)) {
      // Calculate days until next Friday
      const daysUntilFriday = (5 - currentDay + 7) % 7 || 7;
      friday.setDate(friday.getDate() + daysUntilFriday);
    } else {
      // Still in current week
      const daysUntilFriday = 5 - currentDay;
      friday.setDate(friday.getDate() + daysUntilFriday);
    }

    friday.setHours(17, 0, 0, 0); // 5:00 PM
    return friday;
  }

  private async notifyBranches(branches: any[]): Promise<void> {
    // In production, send push notifications via FCM
    // Format: "Weekly settlement locked. Unlock: Friday 5:00 PM"
    this.logger.log(
      `[Settlement Lock] Notifying ${branches.length} branches via push`,
    );
  }

  private async notifyUnlock(branches: any[]): Promise<void> {
    // Send unlock notification
    this.logger.log(`[Settlement Unlock] Notifying ${branches.length} branches`);
  }
}
