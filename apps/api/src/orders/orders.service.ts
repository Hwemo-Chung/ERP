import { Injectable } from '@nestjs/common';
import { OrderQueryService } from './order-query.service';
import { OrderMutationService } from './order-mutation.service';
import { OrderAssignmentService } from './order-assignment.service';
import { OrderSplitService } from './order-split.service';
import { OrderLifecycleService } from './order-lifecycle.service';
import { GetOrdersDto } from './dto/get-orders.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { BulkStatusDto } from './dto/bulk-status.dto';
import { SplitOrderDto } from './dto/split-order.dto';
import { CreateOrderEventDto } from './dto/create-order-event.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { RevertOrderDto } from './dto/revert-order.dto';
import { ReassignOrderDto } from './dto/reassign-order.dto';
import { BatchSyncItemDto, BatchSyncResponseDto } from './dto/batch-sync.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly queryService: OrderQueryService,
    private readonly mutationService: OrderMutationService,
    private readonly assignmentService: OrderAssignmentService,
    private readonly splitService: OrderSplitService,
    private readonly lifecycleService: OrderLifecycleService,
  ) {}

  findAll(dto: GetOrdersDto, branchCode?: string) {
    return this.queryService.findAll(dto, branchCode);
  }

  findOne(id: string) {
    return this.queryService.findOne(id);
  }

  getStats(branchCode?: string) {
    return this.queryService.getStats(branchCode);
  }

  create(dto: CreateOrderDto, userId: string) {
    return this.mutationService.create(dto, userId);
  }

  update(id: string, dto: UpdateOrderDto, userId: string) {
    return this.mutationService.update(id, dto, userId);
  }

  remove(id: string, userId: string) {
    return this.mutationService.remove(id, userId);
  }

  bulkStatusUpdate(dto: BulkStatusDto, userId: string) {
    return this.assignmentService.bulkStatusUpdate(dto, userId);
  }

  reassignOrder(id: string, dto: ReassignOrderDto, userId: string) {
    return this.assignmentService.reassignOrder(id, dto, userId);
  }

  splitOrder(id: string, dto: SplitOrderDto, userId: string) {
    return this.splitService.splitOrder(id, dto, userId);
  }

  addEvent(id: string, dto: CreateOrderEventDto, userId: string) {
    return this.lifecycleService.addEvent(id, dto, userId);
  }

  cancelOrder(id: string, dto: CancelOrderDto, userId: string) {
    return this.lifecycleService.cancelOrder(id, dto, userId);
  }

  revertOrder(id: string, dto: RevertOrderDto, userId: string) {
    return this.lifecycleService.revertOrder(id, dto, userId);
  }

  processBatchSync(items: BatchSyncItemDto[], userId: string): Promise<BatchSyncResponseDto> {
    return this.lifecycleService.processBatchSync(items, userId);
  }
}
