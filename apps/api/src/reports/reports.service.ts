import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, Prisma, Branch, Installer, WastePickup } from '@prisma/client';
import PDFDocument from 'pdfkit';

/**
 * Order with all relations needed for PDF generation
 */
interface OrderWithRelations {
  id: string;
  orderNo: string;
  customerName: string;
  customerPhone: string;
  address: Prisma.JsonValue;
  status: OrderStatus;
  appointmentDate: Date;
  updatedAt: Date;
  branch: Branch | null;
  installer: Installer | null;
  lines: Array<{
    id: string;
    itemName: string;
    quantity: number;
    serialNumbers: Array<{ serial: string }>;
  }>;
  wastePickups: WastePickup[];
}

interface DateRangeFilter {
  gte?: Date;
  lte?: Date;
}

const COMPLETED_STATUSES: OrderStatus[] = [
  OrderStatus.COMPLETED,
  OrderStatus.COLLECTED,
  OrderStatus.PARTIAL,
];
const CANCELLED_STATUSES: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.REQUEST_CANCEL];
const PENDING_STATUSES: OrderStatus[] = [
  OrderStatus.UNASSIGNED,
  OrderStatus.ASSIGNED,
  OrderStatus.CONFIRMED,
  OrderStatus.RELEASED,
  OrderStatus.DISPATCHED,
  OrderStatus.POSTPONED,
  OrderStatus.ABSENT,
];

interface DateRange {
  dateFrom?: string;
  dateTo?: string;
}

interface BranchFilter {
  branchCode?: string;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private buildDateFilter(
    range: DateRange,
    field: 'appointmentDate' | 'createdAt' | 'collectedAt' | 'cancelledAt' = 'appointmentDate',
    endOfDay = false,
  ): Record<string, DateRangeFilter> {
    if (!range.dateFrom && !range.dateTo) return {};
    const filter: DateRangeFilter = {};
    if (range.dateFrom) filter.gte = new Date(range.dateFrom);
    if (range.dateTo) {
      const endDate = new Date(range.dateTo);
      if (endOfDay) endDate.setHours(23, 59, 59, 999);
      filter.lte = endDate;
    }
    return { [field]: filter };
  }

  private buildBranchFilter(filter: BranchFilter): Prisma.OrderWhereInput {
    return filter.branchCode ? { branch: { code: filter.branchCode } } : {};
  }

  private buildBaseOrderWhere(
    filters: DateRange & BranchFilter,
    dateField: 'appointmentDate' | 'createdAt' = 'appointmentDate',
    endOfDay = false,
  ): Prisma.OrderWhereInput {
    return {
      deletedAt: null,
      ...this.buildBranchFilter(filters),
      ...this.buildDateFilter(filters, dateField, endOfDay),
    };
  }

  private calculateRate(numerator: number, denominator: number): string {
    return denominator > 0 ? ((numerator / denominator) * 100).toFixed(1) : '0.0';
  }

  private sumByStatuses(
    statusCounts: Array<{ status: OrderStatus; _count: { id: number } }>,
    statuses: OrderStatus[],
  ): number {
    return statusCounts
      .filter((s) => statuses.includes(s.status))
      .reduce((sum, s) => sum + s._count.id, 0);
  }

  async getSummary(filters: {
    level: 'nation' | 'branch' | 'installer';
    branchCode?: string;
    installerId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const where: Prisma.OrderWhereInput = {
      ...this.buildBaseOrderWhere(filters),
      ...(filters.installerId && { installerId: filters.installerId }),
    };

    const statusCounts = await this.prisma.order.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    });

    const total = statusCounts.reduce((sum, s) => sum + s._count.id, 0);
    const completed = this.sumByStatuses(statusCounts, COMPLETED_STATUSES);
    const cancelled = this.sumByStatuses(statusCounts, CANCELLED_STATUSES);
    const pending = this.sumByStatuses(statusCounts, PENDING_STATUSES);

    const wasteStats = await this.prisma.wastePickup.aggregate({
      where: { order: where },
      _sum: { quantity: true },
      _count: { id: true },
    });

    return {
      summary: {
        total,
        completed,
        pending,
        cancelled,
        completionRate: this.calculateRate(completed, total),
        cancellationRate: this.calculateRate(cancelled, total),
      },
      waste: {
        totalPickups: wasteStats._count.id,
        totalQuantity: wasteStats._sum.quantity || 0,
      },
      statusBreakdown: statusCounts.reduce((acc, s) => ({ ...acc, [s.status]: s._count.id }), {}),
    };
  }

  async getProgress(filters: {
    groupBy: 'branch' | 'installer' | 'status' | 'date';
    branchCode?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const where = this.buildBaseOrderWhere(filters);

    const orders = await this.prisma.order.findMany({
      where,
      select: {
        id: true,
        status: true,
        branchId: true,
        installerId: true,
        appointmentDate: true,
        branch: { select: { id: true, code: true, name: true } },
        installer: { select: { id: true, name: true } },
      },
    });

    const aggregateMap = new Map<
      string,
      { key: string; name: string; total: number; completed: number }
    >();

    for (const order of orders) {
      const { key, name } = this.extractGroupKey(order, filters.groupBy);
      if (!key) continue;

      const existing = aggregateMap.get(key) || { key, name, total: 0, completed: 0 };
      existing.total++;
      if (COMPLETED_STATUSES.includes(order.status)) existing.completed++;
      aggregateMap.set(key, existing);
    }

    return Array.from(aggregateMap.values()).map((item) => ({
      ...item,
      pending: item.total - item.completed,
      completionRate: item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0,
    }));
  }

  private extractGroupKey(
    order: {
      branchId: string | null;
      installerId: string | null;
      status: OrderStatus;
      appointmentDate: Date | null;
      branch: { code: string; name: string } | null;
      installer: { name: string } | null;
    },
    groupBy: 'branch' | 'installer' | 'status' | 'date',
  ): { key: string; name: string } {
    switch (groupBy) {
      case 'branch':
        return {
          key: order.branchId || 'unknown',
          name: order.branch?.name || order.branch?.code || 'Unknown Branch',
        };
      case 'installer':
        return {
          key: order.installerId || 'unassigned',
          name: order.installer?.name || order.installerId || 'Unassigned',
        };
      case 'status':
        return { key: order.status, name: order.status };
      case 'date':
        const dateKey = order.appointmentDate?.toISOString().split('T')[0] || 'unknown';
        return { key: dateKey, name: dateKey };
    }
  }

  async getWasteSummary(filters: {
    branchCode?: string;
    dateFrom?: string;
    dateTo?: string;
    wasteCode?: string;
  }) {
    const orderWhere = this.buildBaseOrderWhere({ branchCode: filters.branchCode });
    const where: Prisma.WastePickupWhereInput = {
      ...this.buildDateFilter(filters, 'collectedAt', true),
      ...(filters.wasteCode && { code: filters.wasteCode }),
    };

    const wastePickups = await this.prisma.wastePickup.findMany({
      where: { ...where, order: orderWhere },
      include: { order: true },
    });

    const wasteCodes = await this.prisma.wasteCode.findMany({ where: { isActive: true } });
    const wasteCodeMap = new Map(wasteCodes.map((w) => [w.code, w.descriptionKo]));

    const aggregateMap = new Map<
      string,
      { wasteCode: string; description: string; quantity: number; orderIds: Set<string> }
    >();

    for (const pickup of wastePickups) {
      const existing = aggregateMap.get(pickup.code) || {
        wasteCode: pickup.code,
        description: wasteCodeMap.get(pickup.code) || pickup.code,
        quantity: 0,
        orderIds: new Set<string>(),
      };
      existing.quantity += pickup.quantity;
      existing.orderIds.add(pickup.orderId);
      aggregateMap.set(pickup.code, existing);
    }

    return Array.from(aggregateMap.values())
      .map(({ orderIds, ...rest }) => ({ ...rest, orderCount: orderIds.size }))
      .sort((a, b) => b.quantity - a.quantity);
  }

  async getCustomerHistory(filters: {
    customer?: string;
    vendorCode?: string;
    branchCode?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const where: Prisma.OrderWhereInput = {
      ...this.buildBaseOrderWhere(filters, 'createdAt', true),
      ...(filters.customer && {
        OR: [
          { customerName: { contains: filters.customer, mode: 'insensitive' } },
          { customerPhone: { contains: filters.customer } },
        ],
      }),
      ...(filters.vendorCode && { vendorCode: filters.vendorCode }),
    };

    const orders = await this.prisma.order.findMany({
      where,
      include: {
        branch: { select: { code: true, name: true } },
        installer: { select: { name: true } },
        lines: { take: 3, select: { itemName: true, quantity: true } },
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
      customerAddress: this.formatAddress(order.address),
      status: order.status,
      appointmentDate: order.appointmentDate?.toISOString() || null,
      createdAt: order.createdAt.toISOString(),
      branchCode: order.branch?.code,
      branchName: order.branch?.name,
      installerName: order.installer?.name,
      products: order.lines.map((l) => ({ name: l.itemName, quantity: l.quantity })),
    }));
  }

  async getReleaseSummary(filters: { branchCode?: string; dateFrom?: string; dateTo?: string }) {
    const where = {
      ...this.buildBaseOrderWhere(filters, 'appointmentDate', true),
      status: OrderStatus.RELEASED,
    };

    const orders = await this.prisma.order.findMany({
      where,
      include: { installer: true, branch: true },
    });

    const installerMap = new Map<
      string,
      {
        installerId: string;
        installerName: string;
        branchCode: string;
        branchName: string;
        releaseCount: number;
      }
    >();

    for (const order of orders) {
      if (!order.installer) continue;
      const existing = installerMap.get(order.installer.id) || {
        installerId: order.installer.id,
        installerName: order.installer.name,
        branchCode: order.branch?.code || '',
        branchName: order.branch?.name || '',
        releaseCount: 0,
      };
      existing.releaseCount++;
      installerMap.set(order.installer.id, existing);
    }

    return Array.from(installerMap.values()).sort((a, b) => b.releaseCount - a.releaseCount);
  }

  async generateExport(
    type: 'ecoas' | 'completed' | 'pending' | 'waste',
    filters: { branchCode?: string; dateFrom?: string; dateTo?: string },
    userId: string,
  ) {
    const exportRecord = await this.prisma.export.create({
      data: {
        type,
        filters: filters as Prisma.InputJsonValue,
        createdBy: userId,
        status: 'PROCESSING',
      },
    });

    this.logger.log(`Export job created: ${exportRecord.id} type=${type}`);

    return {
      exportId: exportRecord.id,
      status: 'PROCESSING',
      message: 'Export is being generated. Poll /reports/export/:id for status.',
    };
  }

  async getExport(exportId: string) {
    const exportRecord = await this.prisma.export.findUnique({ where: { id: exportId } });
    if (!exportRecord) return null;

    return {
      exportId: exportRecord.id,
      type: exportRecord.type,
      status: exportRecord.status,
      downloadUrl: exportRecord.fileUrl,
      expiresAt: exportRecord.expiresAt,
      createdAt: exportRecord.createdAt,
    };
  }

  async generateInstallConfirmation(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        branch: true,
        installer: true,
        lines: { include: { serialNumbers: true } },
        wastePickups: true,
      },
    });

    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    if (order.status !== 'COMPLETED' && order.status !== 'PARTIAL') {
      throw new Error(`Order ${orderId} is not completed (status: ${order.status})`);
    }

    const _pdfBuffer = await this.generatePdfBuffer(order);

    const exportRecord = await this.prisma.export.create({
      data: {
        type: 'INSTALL_CONFIRMATION',
        filters: { orderId } as Prisma.InputJsonValue,
        createdBy: userId,
        status: 'READY',
        fileUrl: `/api/v1/reports/export/${orderId}/download`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    this.logger.log(`Install confirmation PDF generated for order ${orderId}`);

    return {
      exportId: exportRecord.id,
      status: 'READY',
      downloadUrl: `/api/v1/reports/export/${exportRecord.id}/download`,
      expiresAt: exportRecord.expiresAt,
      order: {
        orderNumber: order.orderNo,
        customerName: order.customerName,
        branch: order.branch?.name,
        installer: order.installer?.name,
        completedAt: order.updatedAt,
      },
    };
  }

  private async generatePdfBuffer(order: OrderWithRelations): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ size: 'A4', margin: 50 });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.buildPdfHeader(doc);
      this.buildOrderInfoSection(doc, order);
      this.buildServiceProviderSection(doc, order);
      this.buildProductsSection(doc, order.lines);
      this.buildWasteSection(doc, order.wastePickups);
      this.buildSignatureSection(doc);
      this.buildPdfFooter(doc, order.id);

      doc.end();
    });
  }

  private buildPdfHeader(doc: PDFKit.PDFDocument): void {
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('Installation Confirmation Certificate', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).font('Helvetica').text('설치 확인서', { align: 'center' });
    doc.moveDown(2);
  }

  private addPdfSectionTitle(doc: PDFKit.PDFDocument, title: string): void {
    doc.fontSize(12).font('Helvetica-Bold').text(title);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);
    doc.font('Helvetica');
  }

  private buildOrderInfoSection(doc: PDFKit.PDFDocument, order: OrderWithRelations): void {
    this.addPdfSectionTitle(doc, 'Order Information');
    this.addPdfRow(doc, 'Order Number', order.orderNo);
    this.addPdfRow(doc, 'Customer Name', order.customerName);
    this.addPdfRow(doc, 'Customer Phone', order.customerPhone || '-');
    this.addPdfRow(doc, 'Installation Address', this.formatAddress(order.address));
    this.addPdfRow(
      doc,
      'Appointment Date',
      order.appointmentDate ? new Date(order.appointmentDate).toLocaleDateString('ko-KR') : '-',
    );
    doc.moveDown();
  }

  private buildServiceProviderSection(doc: PDFKit.PDFDocument, order: OrderWithRelations): void {
    this.addPdfSectionTitle(doc, 'Service Provider');
    this.addPdfRow(doc, 'Branch', order.branch?.name || '-');
    this.addPdfRow(doc, 'Installer', order.installer?.name || '-');
    this.addPdfRow(
      doc,
      'Completion Date',
      order.updatedAt ? new Date(order.updatedAt).toLocaleDateString('ko-KR') : '-',
    );
    doc.moveDown();
  }

  private buildProductsSection(
    doc: PDFKit.PDFDocument,
    lines: OrderWithRelations['lines'] | undefined,
  ): void {
    if (!lines || lines.length === 0) return;

    this.addPdfSectionTitle(doc, 'Installed Products');
    lines.forEach((line, index: number) => {
      doc.text(`${index + 1}. ${line.itemName} (Qty: ${line.quantity})`);
      if (line.serialNumbers && line.serialNumbers.length > 0) {
        const serials = line.serialNumbers.map((s) => s.serial).join(', ');
        doc.fontSize(10).text(`   S/N: ${serials}`);
        doc.fontSize(12);
      }
    });
    doc.moveDown();
  }

  private buildWasteSection(
    doc: PDFKit.PDFDocument,
    wastePickups: WastePickup[] | undefined,
  ): void {
    if (!wastePickups || wastePickups.length === 0) return;

    this.addPdfSectionTitle(doc, 'Waste Collected');
    wastePickups.forEach((waste) => {
      doc.text(`- ${waste.code}: ${waste.quantity} units`);
    });
    doc.moveDown();
  }

  private buildSignatureSection(doc: PDFKit.PDFDocument): void {
    doc.moveDown(2);
    doc.fontSize(12).font('Helvetica-Bold').text('Confirmation');
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1);

    doc.font('Helvetica').fontSize(10);
    doc.text('I confirm that the above products have been installed and are working properly.');
    doc.text('위 제품이 설치되었으며 정상 작동함을 확인합니다.');
    doc.moveDown(2);

    const signatureY = doc.y;
    doc.text('Customer Signature (고객 서명):', 50, signatureY);
    doc.rect(50, signatureY + 15, 200, 50).stroke();

    doc.text('Installer Signature (설치기사 서명):', 300, signatureY);
    doc.rect(300, signatureY + 15, 200, 50).stroke();
  }

  private buildPdfFooter(doc: PDFKit.PDFDocument, orderId: string): void {
    doc
      .fontSize(8)
      .text(
        `Generated on ${new Date().toISOString()} | Document ID: ${orderId}`,
        50,
        doc.page.height - 50,
        { align: 'center' },
      );
  }

  private addPdfRow(doc: PDFKit.PDFDocument, label: string, value: string) {
    doc.text(`${label}: ${value}`, { continued: false });
  }

  private formatAddress(address: Prisma.JsonValue): string {
    if (!address) return '-';
    if (typeof address === 'string') return address;
    if (typeof address === 'object' && !Array.isArray(address)) {
      const addr = address as Record<string, unknown>;
      return (
        [addr.line1, addr.line2, addr.city, addr.zipCode].filter(Boolean).join(', ') ||
        JSON.stringify(address)
      );
    }
    return String(address);
  }

  async getPdfBuffer(orderId: string): Promise<Buffer> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        branch: true,
        installer: true,
        lines: { include: { serialNumbers: true } },
        wastePickups: true,
      },
    });

    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    return this.generatePdfBuffer(order);
  }

  async getUnreturnedItems(filters: {
    branchCode?: string;
    dateFrom?: string;
    dateTo?: string;
    returnStatus?: 'all' | 'returned' | 'unreturned';
  }) {
    const orderWhere = this.buildBaseOrderWhere({ branchCode: filters.branchCode });
    const where: Prisma.CancellationRecordWhereInput = {
      ...this.buildDateFilter(filters, 'cancelledAt', true),
      ...(filters.returnStatus === 'unreturned' && { isReturned: false }),
      ...(filters.returnStatus === 'returned' && { isReturned: true }),
    };

    const records = await this.prisma.cancellationRecord.findMany({
      where: { ...where, order: orderWhere },
      include: {
        order: { include: { branch: true, lines: { take: 1 } } },
        user: { select: { id: true, fullName: true } },
        returnUser: { select: { id: true, fullName: true } },
      },
      orderBy: { cancelledAt: 'desc' },
    });

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

    return {
      items,
      totalCount: items.length,
      unreturnedCount: items.filter((item) => !item.isReturned).length,
      returnedCount: items.filter((item) => item.isReturned).length,
      byBranch: this.aggregateByBranch(items),
    };
  }

  private aggregateByBranch(
    items: Array<{ branchCode: string | null; branchName: string | null; isReturned: boolean }>,
  ) {
    const branchMap = new Map<
      string,
      { branchCode: string; branchName: string; unreturnedCount: number; returnedCount: number }
    >();

    for (const item of items) {
      if (!item.branchCode) continue;
      const existing = branchMap.get(item.branchCode) || {
        branchCode: item.branchCode,
        branchName: item.branchName || item.branchCode,
        unreturnedCount: 0,
        returnedCount: 0,
      };
      if (item.isReturned) existing.returnedCount++;
      else existing.unreturnedCount++;
      branchMap.set(item.branchCode, existing);
    }

    return Array.from(branchMap.values()).sort((a, b) => b.unreturnedCount - a.unreturnedCount);
  }

  async markItemAsReturned(orderId: string, userId: string) {
    const record = await this.prisma.cancellationRecord.findUnique({
      where: { orderId },
      include: { order: true },
    });

    if (!record) throw new NotFoundException(`Cancellation record for order ${orderId} not found`);
    if (record.isReturned) return { success: false, message: 'Item is already marked as returned' };

    await this.prisma.cancellationRecord.update({
      where: { orderId },
      data: { isReturned: true, returnedAt: new Date(), returnedBy: userId },
    });

    this.logger.log(`Order ${orderId} marked as returned by user ${userId}`);
    return { success: true, message: 'Item marked as returned successfully' };
  }
}
