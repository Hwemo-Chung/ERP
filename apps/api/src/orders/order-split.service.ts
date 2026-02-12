import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SplitOrderDto } from './dto/split-order.dto';
import { SPLIT_ALLOWED_STATUSES } from './orders.constants';

@Injectable()
export class OrderSplitService {
  private readonly logger = new Logger(OrderSplitService.name);

  constructor(private readonly prisma: PrismaService) {}

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
}
