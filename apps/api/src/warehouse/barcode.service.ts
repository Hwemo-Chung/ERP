import { createHash } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Resolver precedence follows InvenTree's identifier-first stock lookup concept.
// Source: https://github.com/inventree/InvenTree (MIT License), adapted for this schema.
@Injectable()
export class BarcodeService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(rawBarcode: string, actor: string) {
    const barcode = rawBarcode.trim();
    const internalMatch = /^(P|I):([0-9a-f-]{36})$/i.exec(barcode);
    if (internalMatch?.[1].toUpperCase() === 'P') {
      const product = await this.prisma.product.findUnique({ where: { id: internalMatch[2] } });
      if (product) return this.matched('PRODUCT', product, actor);
    }
    if (internalMatch?.[1].toUpperCase() === 'I') {
      const partner = await this.prisma.partner.findUnique({ where: { id: internalMatch[2] } });
      if (partner) return this.matched('PARTNER', partner, actor);
    }
    const product = await this.prisma.product.findUnique({ where: { code: barcode } });
    if (product) return this.matched('PRODUCT', product, actor);
    const partner = await this.prisma.partner.findUnique({ where: { code: barcode } });
    if (partner) return this.matched('PARTNER', partner, actor);
    await this.prisma.auditLog.create({
      data: {
        tableName: 'barcode_scan',
        recordId: createHash('sha256').update(barcode).digest('hex'),
        action: 'BARCODE_SCAN_MISS',
        diff: { matched: false },
        actor,
      },
    });
    throw new NotFoundException({ code: 'E4201', message: 'unregistered barcode' });
  }

  private async matched<T extends { id: string }>(
    type: 'PRODUCT' | 'PARTNER',
    entity: T,
    actor: string,
  ) {
    await this.prisma.auditLog.create({
      data: {
        tableName: 'barcode_scan',
        recordId: entity.id,
        action: 'BARCODE_SCAN_MATCH',
        diff: { matched: true, type },
        actor,
      },
    });
    return { type, entity };
  }
}
