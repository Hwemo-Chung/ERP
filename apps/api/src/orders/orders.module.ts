import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { AttachmentsService } from './attachments.service';
import { OrderStateMachine } from './order-state-machine';
import { OrderQueryService } from './order-query.service';
import { OrderMutationService } from './order-mutation.service';
import { OrderAssignmentService } from './order-assignment.service';
import { OrderSplitService } from './order-split.service';
import { OrderLifecycleService } from './order-lifecycle.service';

@Module({
  controllers: [OrdersController],
  providers: [
    OrderQueryService,
    OrderMutationService,
    OrderAssignmentService,
    OrderSplitService,
    OrderLifecycleService,
    OrdersService,
    AttachmentsService,
    OrderStateMachine,
  ],
  exports: [OrdersService, AttachmentsService],
})
export class OrdersModule {}
