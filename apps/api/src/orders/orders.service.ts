import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStateMachine, TransitionContext } from './order-state-machine';
import { GetOrdersDto } from './dto/get-orders.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { BulkStatusDto } from './dto/bulk-status.dto';
import { SplitOrderDto } from './dto/split-order.dto';
import { CreateOrderEventDto } from './dto/create-order-event.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { RevertOrderDto } from './dto/revert-order.dto';
import { ReassignOrderDto } from './dto/reassign-order.dto';
import {
  BatchSyncItemDto,
  BatchSyncResultDto,
  BatchSyncResponseDto,
  SyncOperationType,
} from './dto/batch-sync.dto';

const CANCELLABLE_STATUSES: OrderStatus[] = [
  OrderStatus.UNASSIGNED,
  OrderStatus.ASSIGNED,
  OrderStatus.CONFIRMED,
  OrderStatus.RELEASED,
  OrderStatus.DISPATCHED,
  OrderStatus.POSTPONED,
  OrderStatus.ABSENT,
];

const EVENT_ALLOWED_STATUSES: OrderStatus[] = [
  OrderStatus.UNASSIGNED,
  OrderStatus.ASSIGNED,
  OrderStatus.CONFIRMED,
  OrderStatus.RELEASED,
  OrderStatus.DISPATCHED,
  OrderStatus.POSTPONED,
  OrderStatus.ABSENT,
];

const REASSIGN_ALLOWED_STATUSES: OrderStatus[] = [
  OrderStatus.ASSIGNED,
  OrderStatus.CONFIRMED,
  OrderStatus.RELEASED,
  OrderStatus.DISPATCHED,
  OrderStatus.POSTPONED,
  OrderStatus.ABSENT,
];

const SPLIT_ALLOWED_STATUSES: OrderStatus[] = [
  OrderStatus.UNASSIGNED,
  OrderStatus.ASSIGNED,
  OrderStatus.CONFIRMED,
];

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: OrderStateMachine,
  ) {}

  async findAll(dto: GetOrdersDto, branchCode?: string) {
    const where = this.buildWhereClause(dto, branchCode);
    const { take, skip, cursor } = this.buildPagination(dto);

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        take: take + 1,
        skip,
        cursor,
        orderBy: [{ appointmentDate: dto.sortDirection || 'asc' }, { createdAt: 'desc' }],
        include: {
          branch: { select: { code: true, name: true } },
          partner: { select: { code: true, name: true } },
          installer: { select: { id: true, name: true, phone: true } },
          lines: true,
          _count: { select: { attachments: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return this.buildPaginationResult(orders, total, take, dto.page);
  }

  async getStats(branchCode?: string) {
    const where = this.buildBranchFilter(branchCode);

    const [total, unassigned, assigned, confirmed, released, dispatched, completed, cancelled] =
      await Promise.all([
        this.prisma.order.count({ where }),
        this.prisma.order.count({ where: { ...where, status: OrderStatus.UNASSIGNED } }),
        this.prisma.order.count({ where: { ...where, status: OrderStatus.ASSIGNED } }),
        this.prisma.order.count({ where: { ...where, status: OrderStatus.CONFIRMED } }),
        this.prisma.order.count({ where: { ...where, status: OrderStatus.RELEASED } }),
        this.prisma.order.count({ where: { ...where, status: OrderStatus.DISPATCHED } }),
        this.prisma.order.count({ where: { ...where, status: OrderStatus.COMPLETED } }),
        this.prisma.order.count({ where: { ...where, status: OrderStatus.CANCELLED } }),
      ]);

    return {
      total,
      unassigned,
      assigned,
      confirmed,
      released,
      dispatched,
      completed,
      cancelled,
      pending: unassigned,
    };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, deletedAt: null },
      include: {
        branch: true,
        partner: true,
        installer: true,
        lines: {
          include: {
            serialNumbers: true,
          },
        },
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          take: 20,
          include: { user: { select: { fullName: true } } },
        },
        appointments: {
          orderBy: { changedAt: 'desc' },
          take: 10,
        },
        wastePickups: true,
        attachments: true,
      },
    });

    if (!order) {
      throw new NotFoundException('error.order_not_found');
    }

    return order;
  }

  async create(dto: CreateOrderDto, userId: string) {
    return this.prisma.executeTransaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNo: dto.orderNo,
          customerName: dto.customerName,
          customerPhone: dto.customerPhone,
          address: JSON.parse(JSON.stringify(dto.address)),
          vendor: dto.vendor,
          branchId: dto.branchId,
          appointmentDate: new Date(dto.appointmentDate),
          promisedDate: new Date(dto.promisedDate || dto.appointmentDate),
          remarks: dto.remarks,
          lines: {
            create: dto.lines.map((line) => ({
              itemCode: line.itemCode,
              itemName: line.itemName,
              quantity: line.quantity,
              weight: line.weight,
            })),
          },
        },
        include: { lines: true, branch: true },
      });

      await tx.auditLog.create({
        data: {
          tableName: 'orders',
          recordId: order.id,
          action: 'CREATE',
          diff: { order },
          actor: userId,
        },
      });

      this.logger.log(`Order created: ${order.orderNo}`);
      return order;
    });
  }

  async update(id: string, dto: UpdateOrderDto, userId: string) {
    return this.prisma.executeTransaction(async (tx) => {
      const existing = await this.findOrderForUpdate(tx, id);
      this.validateVersionForUpdate(existing, dto.expectedVersion);

      if (dto.status && dto.status !== existing.status) {
        await this.handleStatusTransition(tx, id, existing, dto, userId);
      }

      if (
        dto.appointmentDate &&
        dto.appointmentDate !== existing.appointmentDate.toISOString().split('T')[0]
      ) {
        await this.logAppointmentChange(
          tx,
          id,
          existing.appointmentDate,
          dto.appointmentDate,
          userId,
          dto.appointmentChangeReason,
        );
      }

      const updated = await this.applyOrderUpdate(tx, id, dto);

      await this.logUpdateAudit(tx, id, existing, updated, dto, userId);
      this.logger.log(`Order updated: ${updated.orderNo}`);
      return updated;
    });
  }

  private async findOrderForUpdate(tx: Prisma.TransactionClient, id: string) {
    const existing = await tx.order.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      throw new NotFoundException('error.order_not_found');
    }
    return existing;
  }

  private validateVersionForUpdate(existing: { version: number }, expectedVersion?: number): void {
    if (expectedVersion && existing.version !== expectedVersion) {
      throw new ConflictException({
        error: 'E2017',
        message: 'error.version_conflict',
        currentVersion: existing.version,
        serverState: existing,
      });
    }
  }

  private async handleStatusTransition(
    tx: Prisma.TransactionClient,
    orderId: string,
    existing: {
      status: OrderStatus;
      installerId: string | null;
      appointmentDate: Date;
      orderNo: string;
      absenceRetryCount: number;
      maxAbsenceRetries: number;
    },
    dto: UpdateOrderDto,
    userId: string,
  ): Promise<void> {
    const context: TransitionContext = {
      installerId: dto.installerId || existing.installerId || undefined,
      appointmentDate: existing.appointmentDate.toISOString().split('T')[0],
      serialsCaptured: dto.serialsCaptured,
      reasonCode: dto.reasonCode,
      wastePickupLogged: dto.wastePickupLogged,
    };

    const validation = this.stateMachine.validateTransition(existing.status, dto.status!, context);
    if (!validation.valid) {
      throw new BadRequestException({
        error: validation.errorCode,
        message: validation.error,
        details: validation.details,
      });
    }

    if (
      dto.status === OrderStatus.ABSENT &&
      existing.absenceRetryCount + 1 > existing.maxAbsenceRetries
    ) {
      this.logger.warn(
        `Order ${existing.orderNo} exceeded max absence retries (${existing.absenceRetryCount + 1}/${existing.maxAbsenceRetries})`,
      );
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        previousStatus: existing.status,
        newStatus: dto.status!,
        changedBy: userId,
        reasonCode: dto.reasonCode,
        notes: dto.notes,
      },
    });
  }

  private async logAppointmentChange(
    tx: Prisma.TransactionClient,
    orderId: string,
    oldDate: Date,
    newDate: string,
    userId: string,
    reason?: string,
  ): Promise<void> {
    await tx.appointment.create({
      data: { orderId, oldDate, newDate: new Date(newDate), changedBy: userId, reason },
    });
  }

  private async applyOrderUpdate(tx: Prisma.TransactionClient, id: string, dto: UpdateOrderDto) {
    return tx.order.update({
      where: { id },
      data: {
        ...(dto.installerId && { installerId: dto.installerId }),
        ...(dto.partnerId && { partnerId: dto.partnerId }),
        ...(dto.status && { status: dto.status }),
        ...(dto.appointmentDate && { appointmentDate: new Date(dto.appointmentDate) }),
        ...(dto.remarks !== undefined && { remarks: dto.remarks }),
        ...(dto.status === OrderStatus.ABSENT && { absenceRetryCount: { increment: 1 } }),
        version: { increment: 1 },
      },
      include: { branch: true, partner: true, installer: true, lines: true },
    });
  }

  private async logUpdateAudit(
    tx: Prisma.TransactionClient,
    recordId: string,
    previous: unknown,
    current: unknown,
    changes: unknown,
    userId: string,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        tableName: 'orders',
        recordId,
        action: 'UPDATE',
        diff: JSON.parse(JSON.stringify({ previous, current, changes })),
        actor: userId,
      },
    });
  }

  async bulkStatusUpdate(dto: BulkStatusDto, userId: string) {
    const results: Array<{ orderId: string; success: boolean; error?: string }> = [];

    for (const orderId of dto.orderIds) {
      try {
        await this.update(
          orderId,
          {
            status: dto.status,
            installerId: dto.installerId,
            reasonCode: dto.reasonCode,
            notes: dto.notes,
          },
          userId,
        );
        results.push({ orderId, success: true });
      } catch (error) {
        results.push({
          orderId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return {
      totalProcessed: dto.orderIds.length,
      successCount,
      failureCount,
      results,
    };
  }

  async remove(id: string, userId: string) {
    const order = await this.findOne(id);

    await this.prisma.order.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        tableName: 'orders',
        recordId: id,
        action: 'DELETE',
        diff: { order },
        actor: userId,
      },
    });

    this.logger.log(`Order soft deleted: ${order.orderNo}`);
  }

  async splitOrder(id: string, dto: SplitOrderDto, userId: string) {
    return this.prisma.executeTransaction(async (tx) => {
      const parentOrder = await this.findParentOrderForSplit(tx, id);
      this.validateSplitOrder(parentOrder, dto);

      const lineMap = new Map(parentOrder.lines.map((line) => [line.id, line]));
      const childOrders = await this.createChildOrders(tx, parentOrder, dto, lineMap, userId);
      const updatedParent = await this.cancelParentOrder(
        tx,
        parentOrder,
        childOrders.length,
        userId,
      );

      await this.logSplitAudit(tx, parentOrder.id, updatedParent, childOrders, dto.splits, userId);
      this.logger.log(`Order split: ${parentOrder.orderNo} -> ${childOrders.length} child orders`);

      return { success: true, parentOrder: updatedParent, childOrders };
    });
  }

  private async findParentOrderForSplit(tx: Prisma.TransactionClient, id: string) {
    const parentOrder = await tx.order.findFirst({
      where: { id, deletedAt: null },
      include: { lines: true, branch: true, partner: true },
    });

    if (!parentOrder) {
      throw new NotFoundException('error.order_not_found');
    }
    return parentOrder;
  }

  private validateSplitOrder(
    parentOrder: {
      version: number;
      status: OrderStatus;
      lines: { id: string; quantity: number }[];
    },
    dto: SplitOrderDto,
  ): void {
    if (parentOrder.version !== dto.version) {
      throw new ConflictException({
        error: 'E2017',
        message: 'error.version_conflict',
        currentVersion: parentOrder.version,
      });
    }

    if (!SPLIT_ALLOWED_STATUSES.includes(parentOrder.status)) {
      throw new BadRequestException({
        error: 'E2018',
        message: `Cannot split order with status ${parentOrder.status}`,
        allowedStatuses: SPLIT_ALLOWED_STATUSES,
      });
    }

    const lineMap = new Map(parentOrder.lines.map((line) => [line.id, line]));
    for (const splitLine of dto.splits) {
      const originalLine = lineMap.get(splitLine.lineId);
      if (!originalLine) {
        throw new BadRequestException({
          error: 'E2019',
          message: `Line ${splitLine.lineId} not found in order`,
        });
      }

      const totalAssigned = splitLine.assignments.reduce((sum, a) => sum + a.quantity, 0);
      if (totalAssigned !== originalLine.quantity) {
        throw new BadRequestException({
          error: 'E2020',
          message: `Quantity mismatch for line ${splitLine.lineId}. Expected ${originalLine.quantity}, got ${totalAssigned}`,
          expected: originalLine.quantity,
          actual: totalAssigned,
        });
      }
    }
  }

  private async createChildOrders(
    tx: Prisma.TransactionClient,
    parentOrder: {
      id: string;
      orderNo: string;
      customerName: string;
      customerPhone: string;
      address: Prisma.JsonValue;
      vendor: string;
      branchId: string;
      partnerId: string | null;
      appointmentDate: Date;
      appointmentTimeWindow: string | null;
      promisedDate: Date;
    },
    dto: SplitOrderDto,
    lineMap: Map<
      string,
      {
        id: string;
        itemCode: string;
        itemName: string;
        quantity: number;
        weight: Prisma.Decimal | null;
      }
    >,
    userId: string,
  ) {
    const childOrders: Awaited<ReturnType<typeof tx.order.create>>[] = [];

    for (const splitLine of dto.splits) {
      const originalLine = lineMap.get(splitLine.lineId)!;

      for (const assignment of splitLine.assignments) {
        const childOrder = await this.createSingleChildOrder(
          tx,
          parentOrder,
          originalLine,
          assignment,
          userId,
        );
        childOrders.push(childOrder);
      }
    }
    return childOrders;
  }

  private async createSingleChildOrder(
    tx: Prisma.TransactionClient,
    parentOrder: {
      id: string;
      orderNo: string;
      customerName: string;
      customerPhone: string;
      address: Prisma.JsonValue;
      vendor: string;
      branchId: string;
      partnerId: string | null;
      appointmentDate: Date;
      appointmentTimeWindow: string | null;
      promisedDate: Date;
    },
    originalLine: {
      id: string;
      itemCode: string;
      itemName: string;
      quantity: number;
      weight: Prisma.Decimal | null;
    },
    assignment: { installerId?: string; installerName: string; quantity: number },
    userId: string,
  ) {
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const childOrderNo = `${parentOrder.orderNo}-SPLIT-${random}`;
    const status = assignment.installerId ? OrderStatus.ASSIGNED : OrderStatus.UNASSIGNED;

    const childOrder = await tx.order.create({
      data: {
        orderNo: childOrderNo,
        customerName: parentOrder.customerName,
        customerPhone: parentOrder.customerPhone,
        address: JSON.parse(JSON.stringify(parentOrder.address)),
        vendor: parentOrder.vendor,
        branchId: parentOrder.branchId,
        partnerId: parentOrder.partnerId,
        installerId: assignment.installerId || null,
        status,
        appointmentDate: parentOrder.appointmentDate,
        appointmentTimeWindow: parentOrder.appointmentTimeWindow,
        promisedDate: parentOrder.promisedDate,
        remarks: `Split from ${parentOrder.orderNo} - Assigned to ${assignment.installerName}`,
        version: 1,
        lines: {
          create: {
            itemCode: originalLine.itemCode,
            itemName: originalLine.itemName,
            quantity: assignment.quantity,
            weight: originalLine.weight,
          },
        },
      },
      include: { lines: true, branch: true, partner: true, installer: true },
    });

    await tx.splitOrder.create({
      data: {
        parentOrderId: parentOrder.id,
        childOrderId: childOrder.id,
        lineId: originalLine.id,
        quantity: assignment.quantity,
        createdBy: userId,
      },
    });

    if (assignment.installerId) {
      await tx.orderStatusHistory.create({
        data: {
          orderId: childOrder.id,
          previousStatus: OrderStatus.UNASSIGNED,
          newStatus: OrderStatus.ASSIGNED,
          changedBy: userId,
          notes: `Created via split from ${parentOrder.orderNo}`,
        },
      });
    }

    return childOrder;
  }

  private async cancelParentOrder(
    tx: Prisma.TransactionClient,
    parentOrder: { id: string; status: OrderStatus },
    childCount: number,
    userId: string,
  ) {
    const updatedParent = await tx.order.update({
      where: { id: parentOrder.id },
      data: {
        status: OrderStatus.CANCELLED,
        version: { increment: 1 },
        remarks: `Split into ${childCount} child orders`,
      },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: parentOrder.id,
        previousStatus: parentOrder.status,
        newStatus: OrderStatus.CANCELLED,
        changedBy: userId,
        reasonCode: 'SPLIT',
        notes: `Parent order split into ${childCount} child orders`,
      },
    });

    return updatedParent;
  }

  private async logSplitAudit(
    tx: Prisma.TransactionClient,
    parentOrderId: string,
    updatedParent: unknown,
    childOrders: { id: string; orderNo: string }[],
    splitConfig: SplitOrderDto['splits'],
    userId: string,
  ) {
    await tx.auditLog.create({
      data: {
        tableName: 'orders',
        recordId: parentOrderId,
        action: 'SPLIT',
        diff: JSON.parse(
          JSON.stringify({
            parentOrder: updatedParent,
            childOrders: childOrders.map((c) => ({ id: c.id, orderNo: c.orderNo })),
            splitConfig,
          }),
        ),
        actor: userId,
      },
    });
  }

  private async findAndValidateOrder<T extends object>(
    tx: Prisma.TransactionClient,
    id: string,
    options: {
      include?: Prisma.OrderInclude;
      expectedVersion?: number;
      validStatuses?: OrderStatus[];
      invalidStatuses?: OrderStatus[];
      errorContext?: string;
    },
  ): Promise<T> {
    const order = await tx.order.findUnique({
      where: { id },
      include: options.include,
    });

    if (!order) {
      throw new NotFoundException({ code: 'E2001', message: 'Order not found' });
    }

    if (order.deletedAt) {
      throw new NotFoundException({ code: 'E2001', message: 'Order has been deleted' });
    }

    if (options.expectedVersion !== undefined && order.version !== options.expectedVersion) {
      throw new ConflictException({
        code: 'E2017',
        message: 'Order version mismatch',
        expectedVersion: options.expectedVersion,
        currentVersion: order.version,
      });
    }

    if (options.validStatuses && !options.validStatuses.includes(order.status)) {
      throw new BadRequestException({
        code: 'E2018',
        message: `Cannot ${options.errorContext || 'perform action on'} order with status ${order.status}`,
        currentStatus: order.status,
      });
    }

    if (options.invalidStatuses && options.invalidStatuses.includes(order.status)) {
      throw new BadRequestException({
        code: 'E2018',
        message: `Cannot ${options.errorContext || 'perform action on'} order with status ${order.status}`,
        currentStatus: order.status,
      });
    }

    return order as T;
  }

  async addEvent(id: string, dto: CreateOrderEventDto, userId: string) {
    return this.prisma.executeTransaction(async (tx) => {
      const order = await this.findAndValidateOrder<{
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

      const order = await this.findAndValidateOrder<{
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
        cancellationRecord: { reason: string; previousStatus: string } | null;
      };

      const order = await this.findAndValidateOrder<OrderWithCancellation>(tx, id, {
        include: { cancellationRecord: true },
        expectedVersion: dto.expectedVersion,
        validStatuses: [OrderStatus.CANCELLED],
        errorContext: 'revert',
      });

      if (!order.cancellationRecord) {
        throw new BadRequestException({
          code: 'E2022',
          message: 'No cancellation record found for this order',
        });
      }

      const targetStatus = (dto.targetStatus ||
        order.cancellationRecord.previousStatus) as OrderStatus;
      this.validateRevertTargetStatus(targetStatus);

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

  async reassignOrder(id: string, dto: ReassignOrderDto, userId: string) {
    return this.prisma.executeTransaction(async (tx) => {
      type OrderWithAssignment = {
        id: string;
        orderNo: string;
        status: OrderStatus;
        installer: { id: string; name: string; phone: string } | null;
        branch: { id: string; code: string; name: string } | null;
        partner: { id: string; code: string; name: string } | null;
      };

      const order = await this.findAndValidateOrder<OrderWithAssignment>(tx, id, {
        include: {
          installer: { select: { id: true, name: true, phone: true } },
          branch: { select: { id: true, code: true, name: true } },
          partner: { select: { id: true, code: true, name: true } },
        },
        expectedVersion: dto.expectedVersion,
        validStatuses: REASSIGN_ALLOWED_STATUSES,
        errorContext: 'reassign',
      });

      const newInstaller = await this.findInstaller(tx, dto.newInstallerId);
      const newBranch = dto.newBranchId ? await this.findBranch(tx, dto.newBranchId) : null;
      const newPartner = dto.newPartnerId ? await this.findPartner(tx, dto.newPartnerId) : null;

      const updateData = this.buildReassignUpdateData(dto);
      await tx.order.update({ where: { id }, data: updateData });

      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          previousStatus: order.status,
          newStatus: order.status,
          reasonCode: 'REASSIGN',
          notes: dto.reason?.trim(),
          changedBy: userId,
        },
      });

      await tx.auditLog.create({
        data: {
          tableName: 'orders',
          recordId: id,
          action: 'REASSIGN',
          diff: JSON.parse(
            JSON.stringify({
              installer: { old: order.installer, new: newInstaller },
              branch: dto.newBranchId ? { old: order.branch, new: newBranch } : null,
              partner: dto.newPartnerId ? { old: order.partner, new: newPartner } : null,
              reason: dto.reason?.trim(),
            }),
          ),
          actor: userId,
        },
      });

      this.logger.log(
        `Order ${order.orderNo} reassigned from installer ${order.installer?.name || 'none'} to ${newInstaller.name} by user ${userId}`,
      );

      return {
        success: true,
        orderId: order.id,
        orderNo: order.orderNo,
        previousAssignment: {
          installer: order.installer,
          branch: order.branch,
          partner: order.partner,
        },
        newAssignment: {
          installer: newInstaller,
          branch: newBranch || order.branch,
          partner: newPartner || order.partner,
        },
        reason: dto.reason,
      };
    });
  }

  private async findInstaller(tx: Prisma.TransactionClient, id: string) {
    const installer = await tx.installer.findUnique({
      where: { id },
      select: { id: true, name: true, phone: true },
    });
    if (!installer) {
      throw new NotFoundException({
        code: 'E2025',
        message: 'New installer not found',
        installerId: id,
      });
    }
    return installer;
  }

  private async findBranch(tx: Prisma.TransactionClient, id: string) {
    const branch = await tx.branch.findUnique({
      where: { id },
      select: { id: true, code: true, name: true },
    });
    if (!branch) {
      throw new NotFoundException({ code: 'E2026', message: 'New branch not found', branchId: id });
    }
    return branch;
  }

  private async findPartner(tx: Prisma.TransactionClient, id: string) {
    const partner = await tx.partner.findUnique({
      where: { id },
      select: { id: true, code: true, name: true },
    });
    if (!partner) {
      throw new NotFoundException({
        code: 'E2027',
        message: 'New partner not found',
        partnerId: id,
      });
    }
    return partner;
  }

  private buildReassignUpdateData(dto: ReassignOrderDto) {
    const data: {
      installerId: string;
      branchId?: string;
      partnerId?: string;
      version: { increment: number };
    } = {
      installerId: dto.newInstallerId,
      version: { increment: 1 },
    };
    if (dto.newBranchId) data.branchId = dto.newBranchId;
    if (dto.newPartnerId) data.partnerId = dto.newPartnerId;
    return data;
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
      const order = await this.create(payload, userId);
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
      const order = await this.update(item.entityId, payload, userId);
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
      await this.remove(item.entityId, userId);
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

  private buildWhereClause(dto: GetOrdersDto, branchCode?: string): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = { deletedAt: null };

    const effectiveBranchCode = dto.branchCode || branchCode;
    if (effectiveBranchCode && effectiveBranchCode !== 'ALL') {
      where.branch = { code: effectiveBranchCode };
    }

    if (dto.status) where.status = dto.status;
    if (dto.installerId) where.installerId = dto.installerId;
    if (dto.customerName) {
      where.customerName = { contains: dto.customerName, mode: 'insensitive' };
    }
    if (dto.vendor) where.vendor = dto.vendor;

    if (dto.appointmentDateFrom || dto.appointmentDateTo) {
      where.appointmentDate = {
        ...(dto.appointmentDateFrom && { gte: new Date(dto.appointmentDateFrom) }),
        ...(dto.appointmentDateTo && { lte: new Date(dto.appointmentDateTo) }),
      };
    }

    return where;
  }

  private buildBranchFilter(branchCode?: string): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = { deletedAt: null };
    if (branchCode && branchCode !== 'ALL') {
      where.branch = { code: branchCode };
    }
    return where;
  }

  private buildPagination(dto: GetOrdersDto): {
    take: number;
    skip: number;
    cursor: { id: string } | undefined;
  } {
    const take = dto.limit || 20;
    let skip = 0;
    let cursor: { id: string } | undefined;

    if (dto.cursor) {
      skip = 1;
      cursor = { id: dto.cursor };
    } else if (dto.page && dto.page > 1) {
      skip = (dto.page - 1) * take;
    }

    return { take, skip, cursor };
  }

  private buildPaginationResult<T extends { id: string }>(
    orders: T[],
    total: number,
    take: number,
    page?: number,
  ) {
    const hasMore = orders.length > take;
    const data = hasMore ? orders.slice(0, take) : orders;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return {
      data,
      pagination: {
        nextCursor,
        hasMore,
        totalCount: total,
        total,
        page: page || 1,
        limit: take,
      },
    };
  }
}
