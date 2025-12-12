import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { AttachmentsService } from './attachments.service';
import { OrderStateMachine } from './order-state-machine';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, AttachmentsService, OrderStateMachine],
  exports: [OrdersService, AttachmentsService],
})
export class OrdersModule {}
