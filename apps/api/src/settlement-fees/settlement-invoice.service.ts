import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SettlementInvoiceStatus } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettlementInvoiceService {
  constructor(private readonly prisma: PrismaService) {}

  async createDrafts(
    tx: Prisma.TransactionClient,
    yearMonth: string,
    results: readonly { partnerId: string; transportTotal: string; storageTotal: string }[],
  ) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'settlement-invoice:' + yearMonth}))`;
    let sequence = await tx.settlementInvoice.count({ where: { periodYearMonth: yearMonth } });
    for (const result of results) {
      const subtotal = new Prisma.Decimal(result.transportTotal).add(result.storageTotal);
      const vat = subtotal.mul('0.10');
      const existing = await tx.settlementInvoice.findUnique({
        where: {
          partnerId_periodYearMonth: { partnerId: result.partnerId, periodYearMonth: yearMonth },
        },
      });
      if (existing && existing.status !== 'DRAFT')
        throw new BadRequestException({
          code: 'E4122',
          message: 'issued invoice blocks settlement re-close',
        });
      sequence += existing ? 0 : 1;
      const invoice = existing
        ? await tx.settlementInvoice.update({
            where: { id: existing.id },
            data: { subtotalAmount: subtotal, vatAmount: vat, totalAmount: subtotal.add(vat) },
          })
        : await tx.settlementInvoice.create({
            data: {
              invoiceNo: `SI-${yearMonth.replace('-', '')}-${String(sequence).padStart(4, '0')}`,
              partnerId: result.partnerId,
              periodYearMonth: yearMonth,
              subtotalAmount: subtotal,
              vatAmount: vat,
              totalAmount: subtotal.add(vat),
            },
          });
      await tx.settlementRecord.updateMany({
        where: { partnerId: result.partnerId, periodYearMonth: yearMonth, supersededAt: null },
        data: { invoiceId: invoice.id },
      });
    }
  }

  async find(partnerId: string, yearMonth: string, scopePartnerId?: string) {
    if (scopePartnerId && scopePartnerId !== partnerId)
      throw new ForbiddenException({ code: 'E4110', message: 'access denied' });
    const invoice = await this.prisma.settlementInvoice.findUnique({
      where: { partnerId_periodYearMonth: { partnerId, periodYearMonth: yearMonth } },
      include: { partner: true },
    });
    return scopePartnerId && invoice && !['ISSUED', 'PAID'].includes(invoice.status)
      ? null
      : invoice;
  }

  async changeStatus(
    id: string,
    status: Exclude<SettlementInvoiceStatus, 'DRAFT'>,
    userId: string,
    cancelReason?: string,
  ) {
    const invoice = await this.prisma.settlementInvoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException({ code: 'E4120', message: 'invoice not found' });
    const allowed =
      (invoice.status === 'DRAFT' && status === 'ISSUED') ||
      (invoice.status === 'ISSUED' && status === 'PAID') ||
      (['DRAFT', 'ISSUED'].includes(invoice.status) && status === 'CANCELLED');
    if (!allowed)
      throw new BadRequestException({
        code: 'E4121',
        message: 'invalid invoice status transition',
      });
    return this.prisma.settlementInvoice.update({
      where: { id },
      data: {
        status,
        ...(status === 'ISSUED' ? { issuedAt: new Date(), issuedBy: userId } : {}),
        ...(status === 'PAID' ? { paidAt: new Date() } : {}),
        ...(status === 'CANCELLED' ? { cancelledAt: new Date(), cancelReason } : {}),
      },
    });
  }

  async pdf(id: string, scopePartnerId?: string): Promise<Buffer> {
    const invoice = await this.prisma.settlementInvoice.findUnique({
      where: { id },
      include: { partner: true, records: { where: { supersededAt: null } } },
    });
    if (
      !invoice ||
      (scopePartnerId &&
        (invoice.partnerId !== scopePartnerId || !['ISSUED', 'PAID'].includes(invoice.status)))
    )
      throw new NotFoundException({ code: 'E4120', message: 'invoice not found' });
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.fontSize(20).text('Settlement Invoice', { align: 'center' }).moveDown();
      for (const [label, value] of [
        ['Invoice No', invoice.invoiceNo],
        ['Period', invoice.periodYearMonth],
        ['Partner', invoice.partner.code],
        ['Subtotal', invoice.subtotalAmount.toFixed(0)],
        ['VAT (10%)', invoice.vatAmount.toFixed(0)],
        ['Total', invoice.totalAmount.toFixed(0)],
      ])
        doc.fontSize(12).text(`${label}: ${value}`);
      doc.end();
    });
  }
}
