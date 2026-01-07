/**
 * Completion Service
 * Handles order completion with serial number capture and waste tracking
 * Per API_SPEC /orders/{orderId}/complete and /orders/{orderId}/waste
 */

import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStateMachine } from '../orders/order-state-machine';
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
  ) {}

  /**
   * Complete order with serial numbers and waste pickup
   * Implements SDD section 5.3 - serialization & waste tracking
   */
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
        throw new NotFoundException('주문을 찾을 수 없습니다');
      }

      // 2. Check settlement lock (SDD section 6.1)
      const isLocked = await this.isSettlementLocked(
        order.branchId,
        order.appointmentDate,
      );

      if (isLocked) {
        throw new ConflictException({
          code: 'E2002',
          message: '정산이 마감되어 수정할 수 없습니다',
          lockedUntil: await this.getSettlementLockTime(order.branchId),
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

      // 4. Process serial numbers for each order line
      const serialResults: Array<{ lineId: string; serialNumber: string; id: string }> = [];

      for (const serialLine of dto.lines) {
        const line = order.lines.find((l: { id: string }) => l.id === serialLine.lineId);
        if (!line) {
          throw new BadRequestException(
            `주문 라인을 찾을 수 없습니다: ${serialLine.lineId}`,
          );
        }

        // Create serial number record
        const serial = await tx.serialNumber.create({
          data: {
            orderLineId: serialLine.lineId,
            serial: serialLine.serialNumber,
            recordedBy: userId,
          },
        });

        serialResults.push({
          lineId: serialLine.lineId,
          serialNumber: serialLine.serialNumber,
          id: serial.id,
        });
      }

      // 5. Log waste pickup if provided
      if (dto.waste && dto.waste.length > 0) {
        for (const waste of dto.waste) {
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

      // 8. Audit log
      await tx.auditLog.create({
        data: {
          tableName: 'orders',
          recordId: orderId,
          action: 'COMPLETE',
          diff: JSON.parse(JSON.stringify({
            serials: serialResults,
            waste: dto.waste || [],
            notes: dto.notes,
          })),
          actor: userId,
        },
      });

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

  /**
   * Log waste pickup (can be separate from completion)
   */
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
      throw new NotFoundException('주문을 찾을 수 없습니다');
    }

    // Check settlement lock
    const isLocked = await this.isSettlementLocked(
      order.branchId,
      order.appointmentDate,
    );

    if (isLocked) {
      throw new ConflictException({
        code: 'E2002',
        message: '정산이 마감되어 수정할 수 없습니다',
      });
    }

    // Validate waste codes (P01-P21 per spec)
    const validCodePattern = /^P(0[1-9]|1[0-9]|2[01])$/;
    for (const entry of dto.entries) {
      if (!validCodePattern.test(entry.code)) {
        throw new BadRequestException(`유효하지 않은 폐기 코드: ${entry.code}`);
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

  /**
   * Get completion details
   */
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
      throw new NotFoundException('주문을 찾을 수 없습니다');
    }

    return {
      id: order.id,
      orderNumber: order.orderNo,
      status: order.status,
      serials: order.lines
        .flatMap((line: { id: string; itemName: string; serialNumbers: Array<{ serial: string; recordedAt: Date }> }) =>
          line.serialNumbers.map((sn) => ({
            lineId: line.id,
            itemName: line.itemName,
            serialNumber: sn.serial,
            recordedAt: sn.recordedAt,
          })),
        )
        .sort((a: { recordedAt: Date }, b: { recordedAt: Date }) =>
          new Date(b.recordedAt).getTime() -
          new Date(a.recordedAt).getTime(),
        ),
      waste: order.wastePickups.map((w: { code: string; quantity: number; collectedAt: Date | null }) => ({
        code: w.code,
        quantity: w.quantity,
        collectedAt: w.collectedAt,
      })),
    };
  }

  /**
   * Check if settlement is locked for a branch on a date
   * Settlement typically locks at midnight on Monday (per SDD 6.1)
   */
  private async isSettlementLocked(
    branchId: string,
    appointmentDate: Date,
  ): Promise<boolean> {
    // Get settlement lock status from Redis cache
    // In production, check Redis
    // For now, check if appointment date is in previous week
    const today = new Date();
    const appointmentWeekStart = this.getWeekStart(appointmentDate);
    const currentWeekStart = this.getWeekStart(today);

    // If appointment is from previous week, settlement might be locked
    return appointmentWeekStart < currentWeekStart;
  }

  /**
   * Get settlement lock time for a branch
   */
  private async getSettlementLockTime(_branchId: string): Promise<Date> {
    // In production, get from settings
    const nextMonday = new Date();
    nextMonday.setDate(nextMonday.getDate() + ((1 + 7 - nextMonday.getDay()) % 7 || 7));
    nextMonday.setHours(9, 0, 0, 0);
    return nextMonday;
  }

  /**
   * Get week start (Monday)
   */
  private getWeekStart(date: Date): Date {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  /**
   * Amend completion data (serial numbers or waste)
   * Requires reason for audit trail
   * NOTE: This is a simplified implementation - actual schema may need adjustments
   */
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
      // Find order
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          lines: {
            include: {
              serialNumbers: true,
            },
          },
        },
      });

      if (!order) {
        throw new NotFoundException(`Order ${orderId} not found`);
      }

      // Only allow amendments for COMPLETED or PARTIAL orders
      if (
        order.status !== OrderStatus.COMPLETED &&
        order.status !== OrderStatus.PARTIAL
      ) {
        throw new BadRequestException(
          `Cannot amend order in status ${order.status}`,
        );
      }

      const changes: any = {};

      // Update serial numbers if provided
      if (dto.serials && dto.serials.length > 0) {
        // Find the affected order lines
        const lineIds = dto.serials.map((s) => s.lineId);

        // Delete existing serials for these lines
        await tx.serialNumber.deleteMany({
          where: { 
            orderLineId: { in: lineIds },
          },
        });

        // Create new serials
        const newSerials = await Promise.all(
          dto.serials.map((line) =>
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

        changes.serials = {
          count: newSerials.length,
          updated: true,
        };
      }

      // Update waste entries if provided
      if (dto.waste && dto.waste.length > 0) {
        // Delete existing waste for this order
        await tx.wastePickup.deleteMany({
          where: { orderId: order.id },
        });

        // Create new waste entries
        const newWaste = await Promise.all(
          dto.waste.map((entry) =>
            tx.wastePickup.create({
              data: {
                orderId: order.id,
                code: entry.code,
                quantity: entry.quantity,
                collectedAt: new Date(),
                collectedBy: userId,
              },
            }),
          ),
        );

        changes.waste = {
          count: newWaste.length,
          updated: true,
        };
      }

      // Create audit log for amendment
      await tx.auditLog.create({
        data: {
          actor: userId,
          action: 'UPDATE',
          tableName: 'orders',
          recordId: order.id,
          diff: {
            reason: dto.reason,
            notes: dto.notes,
            amendments: changes,
          },
        },
      });

      // Create order status history for amendment tracking
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          previousStatus: order.status,
          newStatus: order.status, // Status unchanged
          changedBy: userId,
          reasonCode: 'AMEND' as any,
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
}
