import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStateMachine } from '../orders/order-state-machine';
import { SettlementService } from '../settlement/settlement.service';
import { OrderStatus } from '@prisma/client';

export interface SerialLine {
  lineId: string;
  serialNumber: string;
  quantity?: number;
}

export interface WasteEntry {
  code: string;
  quantity: number;
  date?: string;
}

export interface CompleteOrderDto {
  status: string;
  lines: SerialLine[];
  waste?: WasteEntry[];
  notes?: string;
}

export interface WastePickupDto {
  entries: WasteEntry[];
  notes?: string;
}

@Injectable()
export class CompletionService {
  private readonly logger = new Logger(CompletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: OrderStateMachine,
    private readonly settlementService: SettlementService,
  ) {}

  async completeOrder(
    orderId: string,
    dto: CompleteOrderDto,
    userId: string,
  ): Promise<{
    id: string;
    orderNumber: string;
    status: OrderStatus;
    version: number;
    serials: Array<{ lineId: string; serialNumber: string; id: string }>;
    wasteCount: number;
  }> {
    return this.prisma.executeTransaction(async (tx) => {
      // 1. Load order with version
      const order = await tx.order.findFirst({
        where: { id: orderId, deletedAt: null },
        include: { lines: { include: { serialNumbers: true } } },
      });

      if (!order) {
        throw new NotFoundException({ code: 'E3001', message: 'Order not found' });
      }

      // 2. Check settlement lock (SDD section 6.1) via SettlementService DB lookup
      const isLocked = await this.settlementService.isOrderLocked(orderId);

      if (isLocked) {
        throw new ConflictException({
          code: 'E2002',
          message: 'Settlement is locked, modification not allowed',
        });
      }

      // 3. Validate state transition
      const context = {
        serialsCaptured: true,
        wastePickupLogged: dto.waste && dto.waste.length > 0,
      };

      const validation = this.stateMachine.validateTransition(
        order.status,
        dto.status as OrderStatus,
        context,
      );

      if (!validation.valid) {
        throw new BadRequestException({
          code: validation.errorCode,
          message: validation.error,
          details: validation.details,
        });
      }

      // 4. Process serial numbers
      const serialResults = await this.processSerialNumbers(tx, order.lines, dto.lines, userId);

      // 5. Log waste pickup if provided
      if (dto.waste && dto.waste.length > 0) {
        await this.logWasteEntries(tx, orderId, dto.waste, userId);
      }

      // 6. Update order status
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: dto.status as OrderStatus,
          version: { increment: 1 },
        },
        include: {
          branch: { select: { code: true, name: true } },
          lines: { include: { serialNumbers: true } },
          wastePickups: true,
        },
      });

      // 7. Log status history
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          previousStatus: order.status,
          newStatus: dto.status as OrderStatus,
          changedBy: userId,
          notes: dto.notes,
        },
      });

      // 8. Create audit log
      await this.createCompletionAuditLog(tx, orderId, userId, serialResults, dto.waste, dto.notes);

      this.logger.log(`Order completed: ${order.orderNo} by ${userId}`);

      return {
        id: updated.id,
        orderNumber: order.orderNo,
        status: updated.status,
        version: updated.version,
        serials: serialResults,
        wasteCount: updated.wastePickups.length,
      };
    });
  }

  async logWastePickup(
    orderId: string,
    dto: WastePickupDto,
    userId: string,
  ): Promise<{
    orderId: string;
    wasteCount: number;
    entries: Array<{ code: string; quantity: number }>;
  }> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
    });

    if (!order) {
      throw new NotFoundException({ code: 'E3001', message: 'Order not found' });
    }

    // Check settlement lock via SettlementService DB lookup
    const isLocked = await this.settlementService.isOrderLocked(orderId);

    if (isLocked) {
      throw new ConflictException({
        code: 'E2002',
        message: 'Settlement is locked, modification not allowed',
      });
    }

    // Validate waste codes (P01-P21 per spec)
    const validCodePattern = /^P(0[1-9]|1[0-9]|2[01])$/;
    for (const entry of dto.entries) {
      if (!validCodePattern.test(entry.code)) {
        throw new BadRequestException({
          code: 'E3002',
          message: `Invalid waste code: ${entry.code}`,
        });
      }
    }

    // Create or update waste entries
    const wasteEntries = await Promise.all(
      dto.entries.map((entry) =>
        this.prisma.wastePickup.upsert({
          where: {
            orderId_code: {
              orderId,
              code: entry.code,
            },
          },
          create: {
            orderId,
            code: entry.code,
            quantity: entry.quantity,
            collectedAt: entry.date ? new Date(entry.date) : new Date(),
            collectedBy: userId,
          },
          update: {
            quantity: entry.quantity,
            collectedAt: entry.date ? new Date(entry.date) : new Date(),
            collectedBy: userId,
          },
        }),
      ),
    );

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        tableName: 'waste_pickups',
        recordId: orderId,
        action: 'CREATE',
        diff: JSON.parse(JSON.stringify({ waste: wasteEntries })),
        actor: userId,
      },
    });

    return {
      orderId,
      wasteCount: wasteEntries.length,
      entries: wasteEntries.map((w) => ({
        code: w.code,
        quantity: w.quantity,
      })),
    };
  }

  async getCompletionDetails(orderId: string): Promise<{
    id: string;
    orderNumber: string;
    status: OrderStatus;
    serials: Array<{
      lineId: string;
      itemName: string;
      serialNumber: string;
      recordedAt: Date;
    }>;
    waste: Array<{ code: string; quantity: number; collectedAt: Date | null }>;
  }> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      include: {
        lines: { include: { serialNumbers: true } },
        wastePickups: true,
      },
    });

    if (!order) {
      throw new NotFoundException({ code: 'E3001', message: 'Order not found' });
    }

    return {
      id: order.id,
      orderNumber: order.orderNo,
      status: order.status,
      serials: order.lines
        .flatMap(
          (line: {
            id: string;
            itemName: string;
            serialNumbers: Array<{ serial: string; recordedAt: Date }>;
          }) =>
            line.serialNumbers.map((sn) => ({
              lineId: line.id,
              itemName: line.itemName,
              serialNumber: sn.serial,
              recordedAt: sn.recordedAt,
            })),
        )
        .sort(
          (a: { recordedAt: Date }, b: { recordedAt: Date }) =>
            new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
        ),
      waste: order.wastePickups.map(
        (w: { code: string; quantity: number; collectedAt: Date | null }) => ({
          code: w.code,
          quantity: w.quantity,
          collectedAt: w.collectedAt,
        }),
      ),
    };
  }

  private async processSerialNumbers(
    tx: Parameters<Parameters<typeof this.prisma.executeTransaction>[0]>[0],
    orderLines: Array<{ id: string }>,
    serialLines: SerialLine[],
    userId: string,
  ): Promise<Array<{ lineId: string; serialNumber: string; id: string }>> {
    const results: Array<{ lineId: string; serialNumber: string; id: string }> = [];

    for (const serialLine of serialLines) {
      const line = orderLines.find((l) => l.id === serialLine.lineId);
      if (!line) {
        throw new BadRequestException({
          code: 'E3003',
          message: `Order line not found: ${serialLine.lineId}`,
        });
      }

      const serial = await tx.serialNumber.create({
        data: {
          orderLineId: serialLine.lineId,
          serial: serialLine.serialNumber,
          recordedBy: userId,
        },
      });

      results.push({
        lineId: serialLine.lineId,
        serialNumber: serialLine.serialNumber,
        id: serial.id,
      });
    }

    return results;
  }

  private async logWasteEntries(
    tx: Parameters<Parameters<typeof this.prisma.executeTransaction>[0]>[0],
    orderId: string,
    wasteEntries: WasteEntry[],
    userId: string,
  ): Promise<void> {
    for (const waste of wasteEntries) {
      await tx.wastePickup.upsert({
        where: {
          orderId_code: {
            orderId,
            code: waste.code,
          },
        },
        create: {
          orderId,
          code: waste.code,
          quantity: waste.quantity,
          collectedAt: waste.date ? new Date(waste.date) : new Date(),
          collectedBy: userId,
        },
        update: {
          quantity: waste.quantity,
          collectedAt: waste.date ? new Date(waste.date) : new Date(),
          collectedBy: userId,
        },
      });
    }
  }

  private async createCompletionAuditLog(
    tx: Parameters<Parameters<typeof this.prisma.executeTransaction>[0]>[0],
    orderId: string,
    userId: string,
    serials: Array<{ lineId: string; serialNumber: string; id: string }>,
    waste: WasteEntry[] | undefined,
    notes: string | undefined,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        tableName: 'orders',
        recordId: orderId,
        action: 'COMPLETE',
        diff: JSON.parse(
          JSON.stringify({
            serials,
            waste: waste || [],
            notes,
          }),
        ),
        actor: userId,
      },
    });
  }

  async amendCompletion(
    orderId: string,
    dto: {
      serials?: { lineId: string; serialNumber: string }[];
      waste?: { code: string; quantity: number }[];
      reason: string;
      notes?: string;
    },
    userId: string,
  ) {
    return this.prisma.executeTransaction(async (tx) => {
      const order = await this.findAmendableOrder(tx, orderId);
      const changes: Record<string, { count: number; updated: boolean }> = {};

      if (dto.serials && dto.serials.length > 0) {
        changes.serials = await this.replaceSerialNumbers(tx, dto.serials, userId);
      }

      if (dto.waste && dto.waste.length > 0) {
        changes.waste = await this.replaceWasteEntries(tx, order.id, dto.waste, userId);
      }

      await this.createAmendmentAuditLog(tx, order.id, userId, dto.reason, dto.notes, changes);

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          previousStatus: order.status,
          newStatus: order.status,
          changedBy: userId,
          reasonCode: 'AMEND',
          notes: `Completion amended: ${dto.reason}`,
        },
      });

      return {
        success: true,
        orderId: order.id,
        orderNo: order.orderNo,
        changes,
        reason: dto.reason,
        amendedAt: new Date(),
      };
    });
  }

  private async findAmendableOrder(
    tx: Parameters<Parameters<typeof this.prisma.executeTransaction>[0]>[0],
    orderId: string,
  ) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { lines: { include: { serialNumbers: true } } },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.status !== OrderStatus.COMPLETED && order.status !== OrderStatus.PARTIAL) {
      throw new BadRequestException(`Cannot amend order in status ${order.status}`);
    }

    return order;
  }

  private async replaceSerialNumbers(
    tx: Parameters<Parameters<typeof this.prisma.executeTransaction>[0]>[0],
    serials: { lineId: string; serialNumber: string }[],
    userId: string,
  ): Promise<{ count: number; updated: boolean }> {
    const lineIds = serials.map((s) => s.lineId);

    await tx.serialNumber.deleteMany({
      where: { orderLineId: { in: lineIds } },
    });

    const newSerials = await Promise.all(
      serials.map((line) =>
        tx.serialNumber.create({
          data: {
            orderLineId: line.lineId,
            serial: line.serialNumber,
            recordedAt: new Date(),
            recordedBy: userId,
          },
        }),
      ),
    );

    return { count: newSerials.length, updated: true };
  }

  private async replaceWasteEntries(
    tx: Parameters<Parameters<typeof this.prisma.executeTransaction>[0]>[0],
    orderId: string,
    waste: { code: string; quantity: number }[],
    userId: string,
  ): Promise<{ count: number; updated: boolean }> {
    await tx.wastePickup.deleteMany({
      where: { orderId },
    });

    const newWaste = await Promise.all(
      waste.map((entry) =>
        tx.wastePickup.create({
          data: {
            orderId,
            code: entry.code,
            quantity: entry.quantity,
            collectedAt: new Date(),
            collectedBy: userId,
          },
        }),
      ),
    );

    return { count: newWaste.length, updated: true };
  }

  private async createAmendmentAuditLog(
    tx: Parameters<Parameters<typeof this.prisma.executeTransaction>[0]>[0],
    orderId: string,
    userId: string,
    reason: string,
    notes: string | undefined,
    changes: Record<string, { count: number; updated: boolean }>,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        actor: userId,
        action: 'UPDATE',
        tableName: 'orders',
        recordId: orderId,
        diff: { reason, notes, amendments: changes },
      },
    });
  }
}
