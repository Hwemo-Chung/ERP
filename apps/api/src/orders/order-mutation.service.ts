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
import { RedisLockService } from '../common/services/redis-lock.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderQueryService } from './order-query.service';

@Injectable()
export class OrderMutationService {
  private readonly logger = new Logger(OrderMutationService.name);
  private static readonly ASSIGN_LOCK_TTL = 3000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: OrderStateMachine,
    private readonly redisLockService: RedisLockService,
    private readonly orderQueryService: OrderQueryService,
  ) {}

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
    const isAssignment = dto.status === OrderStatus.ASSIGNED;

    if (isAssignment) {
      return this.executeAssignmentWithLock(id, dto, userId);
    }

    return this.executeUpdate(id, dto, userId);
  }

  async remove(id: string, userId: string) {
    const order = await this.orderQueryService.findOne(id);

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

  private async executeAssignmentWithLock(id: string, dto: UpdateOrderDto, userId: string) {
    const lockKey = `order:assign:${id}`;
    const token = await this.redisLockService.acquireLock(
      lockKey,
      OrderMutationService.ASSIGN_LOCK_TTL,
    );

    if (!token) {
      throw new ConflictException({
        code: 'E2028',
        message: 'Order assignment is already in progress by another user',
      });
    }

    try {
      return await this.executeUpdate(id, dto, userId);
    } finally {
      await this.redisLockService.releaseLock(lockKey, token);
    }
  }

  private async executeUpdate(id: string, dto: UpdateOrderDto, userId: string) {
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
}
