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

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: OrderStateMachine,
  ) {}

  /**
   * Get orders with filtering and pagination
   */
  async findAll(dto: GetOrdersDto, branchCode?: string) {
    const where: Prisma.OrderWhereInput = {
      deletedAt: null,
    };

    // Branch filter (RBAC: branch users can only see their orders)
    // "ALL" is a special value meaning no branch filter (for HQ_ADMIN)
    if (dto.branchCode && dto.branchCode !== 'ALL') {
      where.branch = { code: dto.branchCode };
    } else if (branchCode && branchCode !== 'ALL') {
      where.branch = { code: branchCode };
    }

    // Status filter
    if (dto.status) {
      where.status = dto.status;
    }

    // Installer filter
    if (dto.installerId) {
      where.installerId = dto.installerId;
    }

    // Date filters
    if (dto.appointmentDateFrom || dto.appointmentDateTo) {
      where.appointmentDate = {};
      if (dto.appointmentDateFrom) {
        where.appointmentDate.gte = new Date(dto.appointmentDateFrom);
      }
      if (dto.appointmentDateTo) {
        where.appointmentDate.lte = new Date(dto.appointmentDateTo);
      }
    }

    // Customer name search
    if (dto.customerName) {
      where.customerName = { contains: dto.customerName, mode: 'insensitive' };
    }

    // Vendor filter
    if (dto.vendor) {
      where.vendor = dto.vendor;
    }

    // Pagination (supports both cursor-based and offset-based)
    const take = dto.limit || 20;
    let skip = 0;
    let cursor: { id: string } | undefined;

    if (dto.cursor) {
      // Cursor-based pagination
      skip = 1;
      cursor = { id: dto.cursor };
    } else if (dto.page && dto.page > 1) {
      // Offset-based pagination
      skip = (dto.page - 1) * take;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        take: take + 1, // Fetch one extra to check if there's more
        skip,
        cursor,
        orderBy: [
          { appointmentDate: dto.sortDirection || 'asc' },
          { createdAt: 'desc' },
        ],
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

    const hasMore = orders.length > take;
    const data = hasMore ? orders.slice(0, take) : orders;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return {
      data,
      pagination: {
        nextCursor,
        hasMore,
        totalCount: total,
        total, // Alias for frontend compatibility
        page: dto.page || 1,
        limit: take,
      },
    };
  }

  /**
   * Get order statistics by status
   * Returns counts for each status without loading full order data
   */
  async getStats(branchCode?: string) {
    const where: Prisma.OrderWhereInput = {
      deletedAt: null,
    };

    // Branch filter
    if (branchCode && branchCode !== 'ALL') {
      where.branch = { code: branchCode };
    }

    // Get counts for each status in parallel
    const [
      total,
      unassigned,
      assigned,
      confirmed,
      released,
      dispatched,
      completed,
      cancelled,
    ] = await Promise.all([
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
      pending: unassigned, // Alias for frontend compatibility
    };
  }

  /**
   * Get single order by ID
   */
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

  /**
   * Create new order
   */
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

      // Log creation in audit
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

  /**
   * Update order with optimistic locking
   */
  async update(id: string, dto: UpdateOrderDto, userId: string) {
    return this.prisma.executeTransaction(async (tx) => {
      // Find with version check
      const existing = await tx.order.findFirst({
        where: { id, deletedAt: null },
      });

      if (!existing) {
        throw new NotFoundException('error.order_not_found');
      }

      // Optimistic locking check
      if (dto.expectedVersion && existing.version !== dto.expectedVersion) {
        throw new ConflictException({
          error: 'E2017',
          message: 'error.version_conflict',
          currentVersion: existing.version,
          serverState: existing,
        });
      }

      // State transition validation if status is being changed
      if (dto.status && dto.status !== existing.status) {
        const context: TransitionContext = {
          installerId: dto.installerId || existing.installerId || undefined,
          appointmentDate: existing.appointmentDate.toISOString().split('T')[0],
          serialsCaptured: dto.serialsCaptured,
          reasonCode: dto.reasonCode,
          wastePickupLogged: dto.wastePickupLogged,
        };

        const validation = this.stateMachine.validateTransition(
          existing.status,
          dto.status,
          context,
        );

        if (!validation.valid) {
          throw new BadRequestException({
            error: validation.errorCode,
            message: validation.error,
            details: validation.details,
          });
        }

        // Track absence retry count (FR-04)
        if (dto.status === OrderStatus.ABSENT) {
          const newRetryCount = existing.absenceRetryCount + 1;

          // Check if max retries exceeded
          if (newRetryCount > existing.maxAbsenceRetries) {
            this.logger.warn(
              `Order ${existing.orderNo} exceeded max absence retries (${newRetryCount}/${existing.maxAbsenceRetries})`,
            );
            // Allow but log warning - business may want to auto-escalate later
          }
        }

        // Log status change
        await tx.orderStatusHistory.create({
          data: {
            orderId: id,
            previousStatus: existing.status,
            newStatus: dto.status,
            changedBy: userId,
            reasonCode: dto.reasonCode,
            notes: dto.notes,
          },
        });
      }

      // Log appointment change
      if (dto.appointmentDate && dto.appointmentDate !== existing.appointmentDate.toISOString().split('T')[0]) {
        await tx.appointment.create({
          data: {
            orderId: id,
            oldDate: existing.appointmentDate,
            newDate: new Date(dto.appointmentDate),
            changedBy: userId,
            reason: dto.appointmentChangeReason,
          },
        });
      }

      // Update order
      const updated = await tx.order.update({
        where: { id },
        data: {
          ...(dto.installerId && { installerId: dto.installerId }),
          ...(dto.partnerId && { partnerId: dto.partnerId }),
          ...(dto.status && { status: dto.status }),
          ...(dto.appointmentDate && { appointmentDate: new Date(dto.appointmentDate) }),
          ...(dto.remarks !== undefined && { remarks: dto.remarks }),
          // Increment absence retry count when transitioning to ABSENT (FR-04)
          ...(dto.status === OrderStatus.ABSENT && { absenceRetryCount: { increment: 1 } }),
          version: { increment: 1 },
        },
        include: {
          branch: true,
          partner: true,
          installer: true,
          lines: true,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          tableName: 'orders',
          recordId: id,
          action: 'UPDATE',
          diff: JSON.parse(JSON.stringify({
            previous: existing,
            current: updated,
            changes: dto,
          })),
          actor: userId,
        },
      });

      this.logger.log(`Order updated: ${updated.orderNo}`);
      return updated;
    });
  }

  /**
   * Bulk status update
   */
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

  /**
   * Soft delete order
   */
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

  /**
   * Split order into multiple child orders (FR-10)
   * Creates child orders inheriting metadata from parent
   */
  async splitOrder(id: string, dto: SplitOrderDto, userId: string) {
    return this.prisma.executeTransaction(async (tx) => {
      // 1. Find parent order with lines
      const parentOrder = await tx.order.findFirst({
        where: { id, deletedAt: null },
        include: {
          lines: true,
          branch: true,
          partner: true,
        },
      });

      if (!parentOrder) {
        throw new NotFoundException('error.order_not_found');
      }

      // 2. Optimistic locking check
      if (parentOrder.version !== dto.version) {
        throw new ConflictException({
          error: 'E2017',
          message: 'error.version_conflict',
          currentVersion: parentOrder.version,
        });
      }

      // 3. Validate order status (can only split UNASSIGNED, ASSIGNED, or CONFIRMED)
      const allowedStatuses: OrderStatus[] = [
        OrderStatus.UNASSIGNED,
        OrderStatus.ASSIGNED,
        OrderStatus.CONFIRMED,
      ];

      if (!allowedStatuses.includes(parentOrder.status)) {
        throw new BadRequestException({
          error: 'E2018',
          message: `Cannot split order with status ${parentOrder.status}`,
          allowedStatuses,
        });
      }

      // 4. Validate all line IDs exist and quantities sum correctly
      const lineMap = new Map(parentOrder.lines.map((line) => [line.id, line]));

      for (const splitLine of dto.splits) {
        const originalLine = lineMap.get(splitLine.lineId);
        if (!originalLine) {
          throw new BadRequestException({
            error: 'E2019',
            message: `Line ${splitLine.lineId} not found in order`,
          });
        }

        // Sum assignments for this line
        const totalAssigned = splitLine.assignments.reduce(
          (sum, assignment) => sum + assignment.quantity,
          0,
        );

        if (totalAssigned !== originalLine.quantity) {
          throw new BadRequestException({
            error: 'E2020',
            message: `Quantity mismatch for line ${splitLine.lineId}. Expected ${originalLine.quantity}, got ${totalAssigned}`,
            expected: originalLine.quantity,
            actual: totalAssigned,
          });
        }
      }

      // 5. Create child orders (one per unique installer + line combination)
      const childOrders: any[] = [];

      for (const splitLine of dto.splits) {
        const originalLine = lineMap.get(splitLine.lineId)!;

        for (const assignment of splitLine.assignments) {
          // Generate unique order number for child
          const timestamp = Date.now();
          const random = Math.random().toString(36).substring(2, 8).toUpperCase();
          const childOrderNo = `${parentOrder.orderNo}-SPLIT-${random}`;

          // Create child order inheriting parent metadata
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
              status: assignment.installerId ? OrderStatus.ASSIGNED : OrderStatus.UNASSIGNED,
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
            include: {
              lines: true,
              branch: true,
              partner: true,
              installer: true,
            },
          });

          // Record split relationship
          await tx.splitOrder.create({
            data: {
              parentOrderId: parentOrder.id,
              childOrderId: childOrder.id,
              lineId: originalLine.id,
              quantity: assignment.quantity,
              createdBy: userId,
            },
          });

          // Log status change for child if assigned
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

          childOrders.push(childOrder);
        }
      }

      // 6. Mark parent order as CANCELLED
      const updatedParent = await tx.order.update({
        where: { id: parentOrder.id },
        data: {
          status: OrderStatus.CANCELLED,
          version: { increment: 1 },
          remarks: `Split into ${childOrders.length} child orders`,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: parentOrder.id,
          previousStatus: parentOrder.status,
          newStatus: OrderStatus.CANCELLED,
          changedBy: userId,
          reasonCode: 'SPLIT',
          notes: `Parent order split into ${childOrders.length} child orders`,
        },
      });

      // 7. Audit log
      await tx.auditLog.create({
        data: {
          tableName: 'orders',
          recordId: parentOrder.id,
          action: 'SPLIT',
          diff: JSON.parse(JSON.stringify({
            parentOrder: updatedParent,
            childOrders: childOrders.map((c) => ({ id: c.id, orderNo: c.orderNo })),
            splitConfig: dto.splits,
          })),
          actor: userId,
        },
      });

      this.logger.log(
        `Order split: ${parentOrder.orderNo} -> ${childOrders.length} child orders`,
      );

      return {
        success: true,
        parentOrder: updatedParent,
        childOrders,
      };
    });
  }

  /**
   * Add event/note/remark to order (특이사항 추가)
   * Implements FR-[order-events] - POST /orders/{orderId}/events
   * Related to frontend addNote() functionality
   */
  async addEvent(id: string, dto: CreateOrderEventDto, userId: string) {
    return this.prisma.executeTransaction(async (tx) => {
      // 1. Find order
      const order = await tx.order.findUnique({
        where: { id },
        include: { events: true },
      });

      if (!order) {
        throw new NotFoundException({
          error: 'E2001',
          message: 'Order not found',
          orderId: id,
        });
      }

      // 2. Check soft delete
      if (order.deletedAt) {
        throw new NotFoundException({
          error: 'E2001',
          message: 'Order has been deleted',
        });
      }

      // 3. Validate expected version (optimistic locking) if provided
      if (dto.expectedVersion !== undefined && order.version !== dto.expectedVersion) {
        throw new ConflictException({
          error: 'E2017',
          message: 'Version mismatch - order was modified by another user',
          currentVersion: order.version,
          expectedVersion: dto.expectedVersion,
        });
      }

      // 4. Validate order status for adding events
      // Events can be added to any non-deleted order regardless of status
      const validStatuses: OrderStatus[] = [
        OrderStatus.UNASSIGNED,
        OrderStatus.ASSIGNED,
        OrderStatus.CONFIRMED,
        OrderStatus.RELEASED,
        OrderStatus.DISPATCHED,
        OrderStatus.POSTPONED,
        OrderStatus.ABSENT,
      ];

      if (!validStatuses.includes(order.status)) {
        throw new BadRequestException({
          error: 'E2018',
          message: 'Cannot add event to order in this status',
          status: order.status,
        });
      }

      // 5. Create order event
      const event = await tx.orderEvent.create({
        data: {
          orderId: id,
          eventType: dto.eventType,
          note: dto.note.trim(),
          createdBy: userId,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
        },
      });

      // 6. Create audit log
      await tx.auditLog.create({
        data: {
          tableName: 'order_events',
          recordId: event.id,
          action: 'CREATE',
          diff: JSON.parse(JSON.stringify({
            event: {
              id: event.id,
              eventType: event.eventType,
              note: event.note,
            },
          })),
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

  /**
   * Cancel an order with reason and optional note
   * Valid statuses for cancellation:
   * UNASSIGNED, ASSIGNED, CONFIRMED, RELEASED, DISPATCHED, POSTPONED, ABSENT
   */
  async cancelOrder(
    id: string,
    dto: CancelOrderDto,
    userId: string,
  ) {
    return this.prisma.executeTransaction(async (tx) => {
      // Check if already cancelled
      const existing = await tx.cancellationRecord.findUnique({
        where: { orderId: id },
      });

      if (existing) {
        throw new ConflictException({
          code: 'E2019',
          message: 'Order is already cancelled',
        });
      }

      // Find order
      const order = await tx.order.findUnique({
        where: { id },
        include: {
          cancellationRecord: true,
        },
      });

      if (!order) {
        throw new NotFoundException({
          code: 'E2001',
          message: 'Order not found',
        });
      }

      if (order.deletedAt) {
        throw new NotFoundException({
          code: 'E2001',
          message: 'Order has been deleted',
        });
      }

      // Version check for optimistic locking
      if (
        dto.expectedVersion !== undefined &&
        order.version !== dto.expectedVersion
      ) {
        throw new ConflictException({
          code: 'E2017',
          message: 'Order version mismatch',
          expectedVersion: dto.expectedVersion,
          currentVersion: order.version,
        });
      }

      // Valid statuses for cancellation
      const validStatuses: OrderStatus[] = [
        OrderStatus.UNASSIGNED,
        OrderStatus.ASSIGNED,
        OrderStatus.CONFIRMED,
        OrderStatus.RELEASED,
        OrderStatus.DISPATCHED,
        OrderStatus.POSTPONED,
        OrderStatus.ABSENT,
      ];

      if (!validStatuses.includes(order.status)) {
        throw new BadRequestException({
          code: 'E2020',
          message: `Cannot cancel order with status ${order.status}`,
          currentStatus: order.status,
        });
      }

      // Update order status to CANCELLED
      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.CANCELLED,
          version: { increment: 1 },
        },
      });

      // Create cancellation record
      const cancellationRecord = await tx.cancellationRecord.create({
        data: {
          orderId: id,
          reason: dto.reason,
          note: dto.note?.trim() || null,
          cancelledBy: userId,
          previousStatus: order.status,
          refundAmount: null, // Set by payment processing later
          refundProcessed: false,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
        },
      });

      // Create status history record
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

      // Create audit log
      await tx.auditLog.create({
        data: {
          tableName: 'orders',
          recordId: id,
          action: 'CANCEL',
          diff: JSON.parse(
            JSON.stringify({
              status: { old: order.status, new: OrderStatus.CANCELLED },
              cancellation: {
                reason: dto.reason,
                note: dto.note?.trim() || null,
              },
            }),
          ),
          actor: userId,
        },
      });

      this.logger.log(
        `Order ${order.orderNo} cancelled by user ${userId}: ${dto.reason}`,
      );

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

  /**
   * Revert a cancelled order back to processing state
   * Valid only for orders with status CANCELLED
   */
  async revertOrder(
    id: string,
    dto: RevertOrderDto,
    userId: string,
  ) {
    return this.prisma.executeTransaction(async (tx) => {
      // Find order with cancellation record
      const order = await tx.order.findUnique({
        where: { id },
        include: {
          cancellationRecord: true,
        },
      });

      if (!order) {
        throw new NotFoundException({
          code: 'E2001',
          message: 'Order not found',
        });
      }

      if (order.deletedAt) {
        throw new NotFoundException({
          code: 'E2001',
          message: 'Order has been deleted',
        });
      }

      // Version check for optimistic locking
      if (
        dto.expectedVersion !== undefined &&
        order.version !== dto.expectedVersion
      ) {
        throw new ConflictException({
          code: 'E2017',
          message: 'Order version mismatch',
          expectedVersion: dto.expectedVersion,
          currentVersion: order.version,
        });
      }

      // Must be cancelled to revert
      if (order.status !== OrderStatus.CANCELLED) {
        throw new BadRequestException({
          code: 'E2021',
          message: 'Only cancelled orders can be reverted',
          currentStatus: order.status,
        });
      }

      // No cancellation record found
      if (!order.cancellationRecord) {
        throw new BadRequestException({
          code: 'E2022',
          message: 'No cancellation record found for this order',
        });
      }

      // Determine target status
      const targetStatus: OrderStatus = (dto.targetStatus || order.cancellationRecord.previousStatus) as OrderStatus;

      // Validate target status is not CANCELLED or COMPLETED
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

      // Update order status
      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          status: targetStatus,
          version: { increment: 1 },
        },
      });

      // Delete cancellation record (order is no longer cancelled)
      await tx.cancellationRecord.delete({
        where: { orderId: id },
      });

      // Create status history record
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

      // Create audit log
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

  /**
   * Reassign order to a new installer, branch, or partner
   * Valid for orders with status ASSIGNED, CONFIRMED, RELEASED, DISPATCHED
   */
  async reassignOrder(
    id: string,
    dto: ReassignOrderDto,
    userId: string,
  ) {
    return this.prisma.executeTransaction(async (tx) => {
      // Find order
      const order = await tx.order.findUnique({
        where: { id },
        include: {
          installer: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
          branch: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          partner: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      });

      if (!order) {
        throw new NotFoundException({
          code: 'E2001',
          message: 'Order not found',
        });
      }

      if (order.deletedAt) {
        throw new NotFoundException({
          code: 'E2001',
          message: 'Order has been deleted',
        });
      }

      // Version check for optimistic locking
      if (
        dto.expectedVersion !== undefined &&
        order.version !== dto.expectedVersion
      ) {
        throw new ConflictException({
          code: 'E2017',
          message: 'Order version mismatch',
          expectedVersion: dto.expectedVersion,
          currentVersion: order.version,
        });
      }

      // Valid statuses for reassignment
      const validStatuses: OrderStatus[] = [
        OrderStatus.ASSIGNED,
        OrderStatus.CONFIRMED,
        OrderStatus.RELEASED,
        OrderStatus.DISPATCHED,
        OrderStatus.POSTPONED,
        OrderStatus.ABSENT,
      ];

      if (!validStatuses.includes(order.status)) {
        throw new BadRequestException({
          code: 'E2024',
          message: `Cannot reassign order with status ${order.status}`,
          currentStatus: order.status,
        });
      }

      // Verify new installer exists
      const newInstaller = await tx.installer.findUnique({
        where: { id: dto.newInstallerId },
        select: {
          id: true,
          name: true,
          phone: true,
        },
      });

      if (!newInstaller) {
        throw new NotFoundException({
          code: 'E2025',
          message: 'New installer not found',
          installerId: dto.newInstallerId,
        });
      }

      // Verify new branch if provided
      let newBranch = null;
      if (dto.newBranchId) {
        newBranch = await tx.branch.findUnique({
          where: { id: dto.newBranchId },
          select: {
            id: true,
            code: true,
            name: true,
          },
        });

        if (!newBranch) {
          throw new NotFoundException({
            code: 'E2026',
            message: 'New branch not found',
            branchId: dto.newBranchId,
          });
        }
      }

      // Verify new partner if provided
      let newPartner = null;
      if (dto.newPartnerId) {
        newPartner = await tx.partner.findUnique({
          where: { id: dto.newPartnerId },
          select: {
            id: true,
            code: true,
            name: true,
          },
        });

        if (!newPartner) {
          throw new NotFoundException({
            code: 'E2027',
            message: 'New partner not found',
            partnerId: dto.newPartnerId,
          });
        }
      }

      // Build update data
      const updateData: any = {
        installerId: dto.newInstallerId,
        version: { increment: 1 },
      };

      if (dto.newBranchId) {
        updateData.branchId = dto.newBranchId;
      }

      if (dto.newPartnerId) {
        updateData.partnerId = dto.newPartnerId;
      }

      // Update order
      const updatedOrder = await tx.order.update({
        where: { id },
        data: updateData,
      });

      // Create status history record
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          previousStatus: order.status,
          newStatus: order.status, // Status unchanged, only assignment changed
          reasonCode: 'REASSIGN',
          notes: dto.reason?.trim(),
          changedBy: userId,
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          tableName: 'orders',
          recordId: id,
          action: 'REASSIGN',
          diff: JSON.parse(
            JSON.stringify({
              installer: {
                old: order.installer,
                new: newInstaller,
              },
              branch: dto.newBranchId
                ? { old: order.branch, new: newBranch }
                : null,
              partner: dto.newPartnerId
                ? { old: order.partner, new: newPartner }
                : null,
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
}
