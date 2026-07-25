import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from './transactions.service';

const TYPE_MAP: Record<string, 'INBOUND' | 'OUTBOUND'> = {
  입고: 'INBOUND',
  출고: 'OUTBOUND',
  INBOUND: 'INBOUND',
  OUTBOUND: 'OUTBOUND',
};

export interface InvalidRow {
  rowIndex: number;
  errors: string[];
  raw: object;
}

export interface ParseResult {
  validRows: object[];
  invalidRows: InvalidRow[];
}

export interface CommitResult {
  created: number;
  failed: { row: object; error: string }[];
}

@Injectable()
export class TransactionImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly txService: TransactionsService,
  ) {}

  async parse(buffer: Buffer, mapping: Record<string, string>): Promise<ParseResult> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];

    const partners = await this.prisma.partner.findMany({ select: { id: true, code: true } });
    const products = await this.prisma.product.findMany({ select: { id: true, code: true, partnerId: true } });
    const partnerByCode = new Map(partners.map((p) => [p.code, p.id]));
    const productByCode = new Map(products.map((p) => [p.code, p]));

    const validRows: object[] = [];
    const invalidRows: InvalidRow[] = [];

    ws.eachRow((row, rowIndex) => {
      if (rowIndex === 1) return; // header
      const raw: Record<string, string> = {};
      for (const [field, col] of Object.entries(mapping)) {
        const cell = row.getCell(col);
        raw[field] = cell.value == null ? '' : String(cell.text ?? cell.value).trim();
      }

      const errors: string[] = [];
      const partnerId = partnerByCode.get(raw.partnerCode);
      if (!partnerId) errors.push(`거래처 코드 없음: ${raw.partnerCode}`);
      const product = productByCode.get(raw.productCode);
      if (!product) errors.push(`품목 코드 없음: ${raw.productCode}`);
      else if (partnerId && product.partnerId !== partnerId) errors.push('품목이 해당 거래처 소속 아님');
      const type = TYPE_MAP[raw.type];
      if (!type) errors.push(`구분 값 오류: ${raw.type} (입고/출고)`);
      const quantity = Number(raw.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) errors.push(`수량 오류: ${raw.quantity}`);
      const date = new Date(raw.transactionDate);
      if (isNaN(date.getTime())) errors.push(`일자 파싱 실패: ${raw.transactionDate}`);

      if (errors.length) {
        invalidRows.push({ rowIndex, errors, raw });
      } else {
        validRows.push({
          partnerId,
          productId: product!.id,
          type,
          quantity,
          transactionDate: raw.transactionDate,
        });
      }
    });

    return { validRows, invalidRows };
  }

  /** 정상 행만 반영. 실패 행(E2002 락 등)은 결과에 수집해 반환 (부분 성공 허용). */
  async commit(rows: any[], userId: string): Promise<CommitResult> {
    const result: CommitResult = { created: 0, failed: [] };
    for (const row of rows) {
      try {
        await this.txService.create(row, userId, 'EXCEL');
        result.created++;
      } catch (e: any) {
        result.failed.push({ row, error: e.message });
      }
    }
    return result;
  }
}
