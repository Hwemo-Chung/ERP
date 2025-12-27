import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get KPI summary by level (nation/branch/installer)
   */
  async getSummary(filters: {
    level: 'nation' | 'branch' | 'installer';
    branchCode?: string;
    installerId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const where: any = { deletedAt: null };

    if (filters.branchCode) {
      where.branch = { code: filters.branchCode };
    }
    if (filters.installerId) {
      where.installerId = filters.installerId;
    }
    if (filters.dateFrom || filters.dateTo) {
      where.appointmentDate = {};
      if (filters.dateFrom) where.appointmentDate.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.appointmentDate.lte = new Date(filters.dateTo);
    }

    // Get order counts by status
    const statusCounts = await this.prisma.order.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    });

    // Calculate KPIs
    const completedStatuses: OrderStatus[] = [OrderStatus.COMPLETED, OrderStatus.COLLECTED, OrderStatus.PARTIAL];
    const cancelledStatuses: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.REQUEST_CANCEL];
    const pendingStatuses: OrderStatus[] = [
      OrderStatus.UNASSIGNED,
      OrderStatus.ASSIGNED,
      OrderStatus.CONFIRMED,
      OrderStatus.RELEASED,
      OrderStatus.DISPATCHED,
      OrderStatus.POSTPONED,
      OrderStatus.ABSENT,
    ];

    const total = statusCounts.reduce((sum: number, s: { _count: { id: number } }) => sum + s._count.id, 0);
    const completed = statusCounts
      .filter((s: { status: OrderStatus }) => completedStatuses.includes(s.status))
      .reduce((sum: number, s: { _count: { id: number } }) => sum + s._count.id, 0);
    const cancelled = statusCounts
      .filter((s: { status: OrderStatus }) => cancelledStatuses.includes(s.status))
      .reduce((sum: number, s: { _count: { id: number } }) => sum + s._count.id, 0);
    const pending = statusCounts
      .filter((s: { status: OrderStatus }) => pendingStatuses.includes(s.status))
      .reduce((sum: number, s: { _count: { id: number } }) => sum + s._count.id, 0);

    // Waste pickup stats
    const wasteStats = await this.prisma.wastePickup.aggregate({
      where: {
        order: where,
      },
      _sum: { quantity: true },
      _count: { id: true },
    });

    return {
      summary: {
        total,
        completed,
        pending,
        cancelled,
        completionRate: total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0',
        cancellationRate: total > 0 ? ((cancelled / total) * 100).toFixed(1) : '0.0',
      },
      waste: {
        totalPickups: wasteStats._count.id,
        totalQuantity: wasteStats._sum.quantity || 0,
      },
      statusBreakdown: statusCounts.reduce(
        (acc, s) => ({ ...acc, [s.status]: s._count.id }),
        {},
      ),
    };
  }

  /**
   * Get progress report by grouping
   */
  async getProgress(filters: {
    groupBy: 'branch' | 'installer' | 'status' | 'date';
    branchCode?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const where: any = { deletedAt: null };

    if (filters.branchCode) {
      where.branch = { code: filters.branchCode };
    }
    if (filters.dateFrom || filters.dateTo) {
      where.appointmentDate = {};
      if (filters.dateFrom) where.appointmentDate.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.appointmentDate.lte = new Date(filters.dateTo);
    }

    // Different grouping based on parameter
    switch (filters.groupBy) {
      case 'branch':
        return this.prisma.order.groupBy({
          by: ['branchId'],
          where,
          _count: { id: true },
        });

      case 'installer':
        return this.prisma.order.groupBy({
          by: ['installerId'],
          where,
          _count: { id: true },
        });

      case 'status':
        return this.prisma.order.groupBy({
          by: ['status'],
          where,
          _count: { id: true },
        });

      case 'date':
        return this.prisma.order.groupBy({
          by: ['appointmentDate'],
          where,
          _count: { id: true },
          orderBy: { appointmentDate: 'asc' },
        });

      default:
        return [];
    }
  }

  /**
   * Get waste pickup summary (aggregated by waste code)
   */
  async getWasteSummary(filters: {
    branchCode?: string;
    dateFrom?: string;
    dateTo?: string;
    wasteCode?: string;
  }) {
    const where: any = {};

    // Branch filter through order relation
    const orderWhere: any = { deletedAt: null };
    if (filters.branchCode) {
      orderWhere.branch = { code: filters.branchCode };
    }

    // Date filter
    if (filters.dateFrom || filters.dateTo) {
      where.collectedAt = {};
      if (filters.dateFrom) where.collectedAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) {
        const endDate = new Date(filters.dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.collectedAt.lte = endDate;
      }
    }

    // Waste code filter
    if (filters.wasteCode) {
      where.code = filters.wasteCode;
    }

    // Get waste pickups
    const wastePickups = await this.prisma.wastePickup.findMany({
      where: {
        ...where,
        order: orderWhere,
      },
      include: {
        order: true,
      },
    });

    // Get waste codes for descriptions
    const wasteCodes = await this.prisma.wasteCode.findMany({
      where: { isActive: true },
    });
    const wasteCodeMap = new Map(wasteCodes.map(w => [w.code, w.descriptionKo]));

    // Aggregate by waste code
    const aggregateMap = new Map<string, {
      wasteCode: string;
      description: string;
      quantity: number;
      orderCount: number;
      orderIds: Set<string>;
    }>();

    wastePickups.forEach((pickup) => {
      const code = pickup.code;
      const existing = aggregateMap.get(code) || {
        wasteCode: code,
        description: wasteCodeMap.get(code) || code,
        quantity: 0,
        orderCount: 0,
        orderIds: new Set<string>(),
      };
      existing.quantity += pickup.quantity;
      existing.orderIds.add(pickup.orderId);
      existing.orderCount = existing.orderIds.size;
      aggregateMap.set(code, existing);
    });

    const items = Array.from(aggregateMap.values()).map(({ orderIds, ...rest }) => rest);

    return items.sort((a, b) => b.quantity - a.quantity);
  }

  /**
   * Search customer order history
   */
  async getCustomerHistory(filters: {
    customer?: string;
    vendorCode?: string;
    branchCode?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const where: any = { deletedAt: null };

    // Customer search (name or phone)
    if (filters.customer) {
      where.OR = [
        { customerName: { contains: filters.customer, mode: 'insensitive' } },
        { customerPhone: { contains: filters.customer } },
      ];
    }

    // Vendor code filter
    if (filters.vendorCode) {
      where.vendorCode = filters.vendorCode;
    }

    // Branch filter
    if (filters.branchCode) {
      where.branch = { code: filters.branchCode };
    }

    // Date filter
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) {
        const endDate = new Date(filters.dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    const orders = await this.prisma.order.findMany({
      where,
      include: {
        branch: { select: { code: true, name: true } },
        installer: { select: { name: true } },
        lines: {
          take: 3,
          select: { itemName: true, quantity: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return orders.map((order) => ({
      orderId: order.id,
      orderNo: order.orderNo,
      customerId: order.id,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerAddress: typeof order.address === 'object' ?
        (order.address as any)?.line1 || JSON.stringify(order.address) :
        String(order.address || ''),
      status: order.status,
      appointmentDate: order.appointmentDate?.toISOString() || null,
      createdAt: order.createdAt.toISOString(),
      branchCode: order.branch?.code,
      branchName: order.branch?.name,
      installerName: order.installer?.name,
      products: order.lines.map((l) => ({
        name: l.itemName,
        quantity: l.quantity,
      })),
    }));
  }

  /**
   * Get release summary by FDC/installer
   */
  async getReleaseSummary(filters: {
    branchCode?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const where: any = {
      deletedAt: null,
      status: OrderStatus.RELEASED,
    };

    // Branch filter
    if (filters.branchCode) {
      where.branch = { code: filters.branchCode };
    }

    // Date filter on release date (approximated by appointmentDate)
    if (filters.dateFrom || filters.dateTo) {
      where.appointmentDate = {};
      if (filters.dateFrom) where.appointmentDate.gte = new Date(filters.dateFrom);
      if (filters.dateTo) {
        const endDate = new Date(filters.dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.appointmentDate.lte = endDate;
      }
    }

    // Group by installer
    const orders = await this.prisma.order.findMany({
      where,
      include: {
        installer: true,
        branch: true,
      },
    });

    // Aggregate by installer
    const installerMap = new Map<string, {
      installerId: string;
      installerName: string;
      branchCode: string;
      branchName: string;
      releaseCount: number;
    }>();

    orders.forEach((order) => {
      if (!order.installer) return;
      const key = order.installer.id;
      const existing = installerMap.get(key) || {
        installerId: order.installer.id,
        installerName: order.installer.name,
        branchCode: order.branch?.code || '',
        branchName: order.branch?.name || '',
        releaseCount: 0,
      };
      existing.releaseCount++;
      installerMap.set(key, existing);
    });

    return Array.from(installerMap.values()).sort((a, b) => b.releaseCount - a.releaseCount);
  }

  /**
   * Generate raw data export
   */
  async generateExport(
    type: 'ecoas' | 'completed' | 'pending' | 'waste',
    filters: {
      branchCode?: string;
      dateFrom?: string;
      dateTo?: string;
    },
    userId: string,
  ) {
    // Create export record
    const exportRecord = await this.prisma.export.create({
      data: {
        type,
        filters: filters as any,
        createdBy: userId,
        status: 'PROCESSING',
      },
    });

    // TODO: Queue background job to generate file
    // For now, return the export ID for polling
    this.logger.log(`Export job created: ${exportRecord.id} type=${type}`);

    return {
      exportId: exportRecord.id,
      status: 'PROCESSING',
      message: 'Export is being generated. Poll /reports/export/:id for status.',
    };
  }

  /**
   * Get export status and download URL
   */
  async getExport(exportId: string) {
    const exportRecord = await this.prisma.export.findUnique({
      where: { id: exportId },
    });

    if (!exportRecord) {
      return null;
    }

    return {
      exportId: exportRecord.id,
      type: exportRecord.type,
      status: exportRecord.status,
      downloadUrl: exportRecord.fileUrl,
      expiresAt: exportRecord.expiresAt,
      createdAt: exportRecord.createdAt,
    };
  }

  /**
   * Generate installation confirmation certificate (PDF)
   */
  async generateInstallConfirmation(orderId: string, userId: string) {
    // Find order with completion details
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        branch: true,
        installer: true,
        lines: {
          include: {
            serialNumbers: true,
          },
        },
        wastePickups: true,
      },
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // Only generate confirmation for completed orders
    if (order.status !== 'COMPLETED' && order.status !== 'PARTIAL') {
      throw new Error(`Order ${orderId} is not completed (status: ${order.status})`);
    }

    // Create export record for the PDF
    const exportRecord = await this.prisma.export.create({
      data: {
        type: 'INSTALL_CONFIRMATION',
        filters: { orderId } as any,
        createdBy: userId,
        status: 'READY', // In real implementation, would be PROCESSING then READY
      },
    });

    // TODO: Generate actual PDF using a library like pdfkit or puppeteer
    // For now, return a placeholder response
    this.logger.log(`Install confirmation PDF requested for order ${orderId}`);

    const downloadUrl = `/api/reports/export/${exportRecord.id}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expire in 7 days

    return {
      exportId: exportRecord.id,
      status: 'READY',
      downloadUrl,
      expiresAt,
      order: {
        orderNumber: order.orderNo,
        customerName: order.customerName,
        branch: order.branch?.name,
        installer: order.installer?.name,
        completedAt: order.updatedAt, // Using updatedAt as proxy for completion time
      },
    };
  }

  /**
   * Get unreturned items list (미환입 현황)
   * Manual Reference: Slide 19 (2017.10.26 v0.9)
   */
  async getUnreturnedItems(filters: {
    branchCode?: string;
    dateFrom?: string;
    dateTo?: string;
    returnStatus?: 'all' | 'returned' | 'unreturned';
  }) {
    const where: any = {};

    // Date filter on cancellation date
    if (filters.dateFrom || filters.dateTo) {
      where.cancelledAt = {};
      if (filters.dateFrom) where.cancelledAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) {
        const endDate = new Date(filters.dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.cancelledAt.lte = endDate;
      }
    }

    // Return status filter
    if (filters.returnStatus === 'unreturned') {
      where.isReturned = false;
    } else if (filters.returnStatus === 'returned') {
      where.isReturned = true;
    }

    // Branch filter through order relation
    const orderWhere: any = { deletedAt: null };
    if (filters.branchCode) {
      orderWhere.branch = { code: filters.branchCode };
    }

    // Get cancellation records with order details
    const records = await this.prisma.cancellationRecord.findMany({
      where: {
        ...where,
        order: orderWhere,
      },
      include: {
        order: {
          include: {
            branch: true,
            lines: {
              take: 1, // Get first product for display
            },
          },
        },
        user: {
          select: { id: true, fullName: true },
        },
        returnUser: {
          select: { id: true, fullName: true },
        },
      },
      orderBy: { cancelledAt: 'desc' },
    });

    // Transform to response format
    const items = records.map((record) => ({
      orderId: record.orderId,
      orderNo: record.order.orderNo,
      customerId: record.order.id,
      customerName: record.order.customerName,
      customerPhone: record.order.customerPhone,
      productName: record.order.lines[0]?.itemName || null,
      productCode: record.order.lines[0]?.itemCode || null,
      cancelledAt: record.cancelledAt.toISOString(),
      cancelReason: record.reason,
      isReturned: record.isReturned,
      returnedAt: record.returnedAt?.toISOString() || null,
      returnedBy: record.returnUser?.fullName || null,
      branchCode: record.order.branch?.code || null,
      branchName: record.order.branch?.name || null,
    }));

    // Calculate summary
    const totalCount = items.length;
    const unreturnedCount = items.filter((item) => !item.isReturned).length;
    const returnedCount = items.filter((item) => item.isReturned).length;

    // Group by branch
    const branchMap = new Map<string, { branchCode: string; branchName: string; unreturnedCount: number; returnedCount: number }>();
    items.forEach((item) => {
      if (item.branchCode) {
        const existing = branchMap.get(item.branchCode) || {
          branchCode: item.branchCode,
          branchName: item.branchName || item.branchCode,
          unreturnedCount: 0,
          returnedCount: 0,
        };
        if (item.isReturned) {
          existing.returnedCount++;
        } else {
          existing.unreturnedCount++;
        }
        branchMap.set(item.branchCode, existing);
      }
    });

    return {
      items,
      totalCount,
      unreturnedCount,
      returnedCount,
      byBranch: Array.from(branchMap.values()).sort((a, b) => b.unreturnedCount - a.unreturnedCount),
    };
  }

  /**
   * Mark a cancelled order item as returned (환입 처리)
   */
  async markItemAsReturned(orderId: string, userId: string) {
    // Find the cancellation record
    const record = await this.prisma.cancellationRecord.findUnique({
      where: { orderId },
      include: { order: true },
    });

    if (!record) {
      throw new NotFoundException(`Cancellation record for order ${orderId} not found`);
    }

    if (record.isReturned) {
      return {
        success: false,
        message: 'Item is already marked as returned',
      };
    }

    // Update the record
    await this.prisma.cancellationRecord.update({
      where: { orderId },
      data: {
        isReturned: true,
        returnedAt: new Date(),
        returnedBy: userId,
      },
    });

    this.logger.log(`Order ${orderId} marked as returned by user ${userId}`);

    return {
      success: true,
      message: 'Item marked as returned successfully',
    };
  }
}
