/**
 * Completion Module
 */

import { Module } from '@nestjs/common';
import { CompletionService } from './completion.service';
import { CompletionController } from './completion.controller';
import { OrderStateMachine } from '../orders/order-state-machine';
import { PrismaModule } from '../prisma/prisma.module';
import { SettlementModule } from '../settlement/settlement.module';

@Module({
  imports: [PrismaModule, SettlementModule],
  providers: [CompletionService, OrderStateMachine],
  controllers: [CompletionController],
  exports: [CompletionService],
})
export class CompletionModule {}
