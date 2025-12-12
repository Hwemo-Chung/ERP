/**
 * Settlement Module
 * Manages settlement periods and locking mechanism
 *
 * Features:
 * - Weekly auto-lock via SettlementLockCron
 * - Manual lock/unlock via REST API
 * - Settlement period history tracking
 * - Order lock validation (E2002 error prevention)
 *
 * Dependencies:
 * - PrismaModule: Database access for SettlementPeriod table
 * - Redis: Fast lock status checks (via SettlementLockCron)
 */

import { Module } from '@nestjs/common';
import { SettlementService } from './settlement.service';
import { SettlementController } from './settlement.controller';
import { SettlementLockCron } from './settlement-lock.cron';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SettlementController],
  providers: [SettlementService, SettlementLockCron],
  exports: [SettlementService],
})
export class SettlementModule {}
