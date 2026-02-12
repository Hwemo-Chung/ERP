import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStateMachine } from './order-state-machine';
import { CreateOrderEventDto } from './dto/create-order-event.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { RevertOrderDto } from './dto/revert-order.dto';
import {
  BatchSyncItemDto,
  BatchSyncResultDto,
  BatchSyncResponseDto,
  SyncOperationType,
} from './dto/batch-sync.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CANCELLABLE_STATUSES, EVENT_ALLOWED_STATUSES } from './orders.constants';
import { OrderMutationService } from './order-mutation.service';
import { OrderQueryService } from './order-query.service';

@Injectable()
export class OrderLifecycleService {
  private readonly logger = new Logger(OrderLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: OrderStateMachine,
    private readonly orderMutationService: OrderMutationService,
    private readonly orderQueryService: OrderQueryService,
  ) {}

  async addEvent(id: string, dto: CreateOrderEventDto, userId: string) {
    return this.prisma.executeTransaction(async (tx) => {
      const order = await this.orderQueryService.findAndValidateOrder<{
        id: string;
        orderNo: string;
        events: unknown[];
      }>(tx, id, {
        include: { events: true },
        expectedVersion: dto.expectedVersion,
        validStatuses: EVENT_ALLOWED_STATUSES,
        errorContext: 'add event to',
      });

      const event = await tx.orderEvent.create({
        data: { orderId: id, eventType: dto.eventType, note: dto.note.trim(), createdBy: userId },
        include: { user: { select: { id: true, username: true, fullName: true } } },
      });

      await tx.auditLog.create({
        data: {
          tableName: 'order_events',
          recordId: event.id,
          action: 'CREATE',
          diff: JSON.parse(
            JSON.stringify({
              event: { id: event.id, eventType: event.eventType, note: event.note },
            }),
          ),
          actor: userId,
        },
      });

      this.logger.log(`Event added to order ${order.orderNo}: ${dto.eventType}`);

      return {
        success: true,
        orderId: order.id,
        orderNo: order.orderNo,
        event: {
          id: event.id,
          eventType: event.eventType,
          note: event.note,
          createdBy: event.user,
          createdAt: event.createdAt,
        },
        totalEvents: order.events.length + 1,
      };
    });
  }

  async cancelOrder(id: string, dto: CancelOrderDto, userId: string) {
    return this.prisma.executeTransaction(async (tx) => {
      const existing = await tx.cancellationRecord.findUnique({ where: { orderId: id } });
      if (existing) {
        throw new ConflictException({ code: 'E2019', message: 'Order is already cancelled' });
      }

      const order = await this.orderQueryService.findAndValidateOrder<{
        id: string;
        orderNo: string;
        status: OrderStatus;
        cancellationRecord: unknown;
      }>(tx, id, {
        include: { cancellationRecord: true },
        expectedVersion: dto.expectedVersion,
        validStatuses: CANCELLABLE_STATUSES,
        errorContext: 'cancel',
      });

      const updatedOrder = await tx.order.update({
        where: { id },
        data: { status: OrderStatus.CANCELLED, version: { increment: 1 } },
      });

      const cancellationRecord = await tx.cancellationRecord.create({
        data: {
          orderId: id,
          reason: dto.reason,
          note: dto.note?.trim() || null,
          cancelledBy: userId,
          previousStatus: order.status,
          refundAmount: null,
          refundProcessed: false,
        },
        include: { user: { select: { id: true, username: true, fullName: true } } },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          previousStatus: order.status,
          newStatus: OrderStatus.CANCELLED,
          reasonCode: 'CANCEL',
          notes: dto.note?.trim() || `Cancelled for reason: ${dto.reason}`,
          changedBy: userId,
        },
      });

      await tx.auditLog.create({
        data: {
          tableName: 'orders',
          recordId: id,
          action: 'CANCEL',
          diff: JSON.parse(
            JSON.stringify({
              status: { old: order.status, new: OrderStatus.CANCELLED },
              cancellation: { reason: dto.reason, note: dto.note?.trim() || null },
            }),
          ),
          actor: userId,
        },
      });

      this.logger.log(`Order ${order.orderNo} cancelled by user ${userId}: ${dto.reason}`);

      return {
        success: true,
        orderId: order.id,
        orderNo: order.orderNo,
        previousStatus: order.status,
        newStatus: updatedOrder.status,
        cancellationRecord: {
          id: cancellationRecord.id,
          reason: cancellationRecord.reason,
          note: cancellationRecord.note,
          cancelledBy: cancellationRecord.user,
          cancelledAt: cancellationRecord.cancelledAt,
        },
      };
    });
  }

  async revertOrder(id: string, dto: RevertOrderDto, userId: string) {
    return this.prisma.executeTransaction(async (tx) => {
      type OrderWithCancellation = {
        id: string;
        orderNo: string;
        status: OrderStatus;
        completedAt: Date | null;
        promisedDate: Date;
        cancellationRecord: { reason: string; previousStatus: string } | null;
      };

      const order = await this.orderQueryService.findAndValidateOrder<OrderWithCancellation>(
        tx,
        id,
        {
          include: { cancellationRecord: true },
          expectedVersion: dto.expectedVersion,
          validStatuses: [OrderStatus.CANCELLED],
          errorContext: 'revert',
        },
      );

      if (!order.cancellationRecord) {
        throw new BadRequestException({
          code: 'E2022',
          message: 'No cancellation record found for this order',
        });
      }

      const targetStatus = (dto.targetStatus ||
        order.cancellationRecord.previousStatus) as OrderStatus;
      this.validateRevertTargetStatus(targetStatus);

      if (order.completedAt) {
        const revertValidation = this.stateMachine.canRevert(order.completedAt, order.promisedDate);
        if (!revertValidation.valid) {
          throw new BadRequestException({
            code: revertValidation.errorCode,
            message: revertValidation.error,
            details: revertValidation.details,
          });
        }
      }

      await tx.order.update({
        where: { id },
        data: { status: targetStatus, version: { increment: 1 } },
      });

      await tx.cancellationRecord.delete({ where: { orderId: id } });

      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          previousStatus: OrderStatus.CANCELLED,
          newStatus: targetStatus,
          reasonCode: 'REVERT',
          notes: dto.reason?.trim(),
          changedBy: userId,
        },
      });

      await tx.auditLog.create({
        data: {
          tableName: 'orders',
          recordId: id,
          action: 'REVERT',
          diff: JSON.parse(
            JSON.stringify({
              status: { old: OrderStatus.CANCELLED, new: targetStatus },
              revert: {
                reason: dto.reason?.trim(),
                previousCancellationReason: order.cancellationRecord.reason,
              },
            }),
          ),
          actor: userId,
        },
      });

      this.logger.log(
        `Order ${order.orderNo} reverted from CANCELLED to ${targetStatus} by user ${userId}`,
      );

      return {
        success: true,
        orderId: order.id,
        orderNo: order.orderNo,
        previousStatus: OrderStatus.CANCELLED,
        newStatus: targetStatus,
        revertReason: dto.reason,
        previousCancellationReason: order.cancellationRecord.reason,
      };
    });
  }

  async processBatchSync(items: BatchSyncItemDto[], userId: string): Promise<BatchSyncResponseDto> {
    const results: BatchSyncResultDto[] = [];

    for (const item of items) {
      const result = await this.processSyncItem(item, userId);
      results.push(result);
    }

    return this.buildBatchResponse(results);
  }

  private async processSyncItem(
    item: BatchSyncItemDto,
    userId: string,
  ): Promise<BatchSyncResultDto> {
    try {
      switch (item.type) {
        case SyncOperationType.CREATE:
          return await this.handleCreateOperation(item, userId);
        case SyncOperationType.UPDATE:
          return await this.handleUpdateOperation(item, userId);
        case SyncOperationType.DELETE:
          return await this.handleDeleteOperation(item, userId);
        default:
          return this.createErrorResult(
            item.entityId,
            'E2030',
            `Unknown operation type: ${item.type}`,
          );
      }
    } catch (error) {
      return this.handleSyncError(item.entityId, error);
    }
  }

  private async handleCreateOperation(
    item: BatchSyncItemDto,
    userId: string,
  ): Promise<BatchSyncResultDto> {
    const payload = item.payload as unknown as CreateOrderDto;

    try {
      const order = await this.orderMutationService.create(payload, userId);
      this.logger.log(`Batch sync CREATE: ${order.orderNo}`);

      return {
        entityId: order.id,
        success: true,
      };
    } catch (error) {
      return this.handleSyncError(item.entityId, error);
    }
  }

  private async handleUpdateOperation(
    item: BatchSyncItemDto,
    userId: string,
  ): Promise<BatchSyncResultDto> {
    const payload = item.payload as UpdateOrderDto;

    if (item.expectedVersion !== undefined) {
      payload.expectedVersion = item.expectedVersion;
    }

    try {
      const order = await this.orderMutationService.update(item.entityId, payload, userId);
      this.logger.log(`Batch sync UPDATE: ${order.orderNo}`);

      return {
        entityId: item.entityId,
        success: true,
      };
    } catch (error) {
      return this.handleSyncError(item.entityId, error);
    }
  }

  private async handleDeleteOperation(
    item: BatchSyncItemDto,
    userId: string,
  ): Promise<BatchSyncResultDto> {
    try {
      await this.orderMutationService.remove(item.entityId, userId);
      this.logger.log(`Batch sync DELETE: ${item.entityId}`);

      return {
        entityId: item.entityId,
        success: true,
      };
    } catch (error) {
      return this.handleSyncError(item.entityId, error);
    }
  }

  private handleSyncError(entityId: string, error: unknown): BatchSyncResultDto {
    if (error instanceof ConflictException) {
      const response = error.getResponse() as Record<string, unknown>;
      return {
        entityId,
        success: false,
        error: 'E2006',
        message: 'Version conflict - order was modified by another user',
        serverState: response.serverState || response,
      };
    }

    if (error instanceof NotFoundException) {
      return this.createErrorResult(entityId, 'E2001', 'Order not found');
    }

    if (error instanceof BadRequestException) {
      const response = error.getResponse() as Record<string, unknown>;
      return {
        entityId,
        success: false,
        error: (response.error as string) || 'E2000',
        message: (response.message as string) || 'Bad request',
      };
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    this.logger.error(`Batch sync error for ${entityId}: ${message}`);

    return this.createErrorResult(entityId, 'E5000', message);
  }

  private createErrorResult(entityId: string, error: string, message: string): BatchSyncResultDto {
    return {
      entityId,
      success: false,
      error,
      message,
    };
  }

  private buildBatchResponse(results: BatchSyncResultDto[]): BatchSyncResponseDto {
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return {
      totalProcessed: results.length,
      successCount,
      failureCount,
      results,
    };
  }

  private validateRevertTargetStatus(targetStatus: OrderStatus): void {
    const invalidTargetStatuses: OrderStatus[] = [
      OrderStatus.CANCELLED,
      OrderStatus.COMPLETED,
      OrderStatus.PARTIAL,
      OrderStatus.COLLECTED,
    ];

    if (invalidTargetStatuses.includes(targetStatus)) {
      throw new BadRequestException({
        code: 'E2023',
        message: `Cannot revert to status ${targetStatus}`,
        targetStatus,
      });
    }
  }
}
