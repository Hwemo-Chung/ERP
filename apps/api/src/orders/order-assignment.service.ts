import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BulkStatusDto } from './dto/bulk-status.dto';
import { ReassignOrderDto } from './dto/reassign-order.dto';
import { REASSIGN_ALLOWED_STATUSES } from './orders.constants';
import { OrderMutationService } from './order-mutation.service';
import { OrderQueryService } from './order-query.service';

@Injectable()
export class OrderAssignmentService {
  private readonly logger = new Logger(OrderAssignmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderMutationService: OrderMutationService,
    private readonly orderQueryService: OrderQueryService,
  ) {}

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

      const order = await this.orderQueryService.findAndValidateOrder<OrderWithAssignment>(tx, id, {
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

  async bulkStatusUpdate(dto: BulkStatusDto, userId: string) {
    const results: Array<{ orderId: string; success: boolean; error?: string }> = [];

    for (const orderId of dto.orderIds) {
      try {
        await this.orderMutationService.update(
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
}
