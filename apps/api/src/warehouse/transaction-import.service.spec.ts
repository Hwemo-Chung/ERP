import * as ExcelJS from 'exceljs';
import { Test } from '@nestjs/testing';
import { TransactionImportService } from './transaction-import.service';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma/prisma.service';

async function buildXlsx(rows: (string | number)[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('s');
  rows.forEach(r => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const prismaMock = {
  partner: { findMany: jest.fn() },
  product: { findMany: jest.fn() },
};
const txServiceMock = { create: jest.fn() };
const mapping = { partnerCode: 'A', productCode: 'B', type: 'C', quantity: 'D', transactionDate: 'E' };

describe('TransactionImportService', () => {
  let service: TransactionImportService;
  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.partner.findMany.mockResolvedValue([{ id: 'p1', code: 'KM001' }]);
    prismaMock.product.findMany.mockResolvedValue([{ id: 'prod1', code: 'I-00001', partnerId: 'p1' }]);
    const module = await Test.createTestingModule({
      providers: [
        TransactionImportService,
        { provide: TransactionsService, useValue: txServiceMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(TransactionImportService);
  });

  it('resolves codes and converts 한글 type', async () => {
    const buf = await buildXlsx([
      ['거래처', '품목', '구분', '수량', '일자'],
      ['KM001', 'I-00001', '출고', 5, '2026-07-20'],
    ]);
    const r = await service.parse(buf, mapping);
    expect(r.validRows[0]).toMatchObject({ partnerId: 'p1', productId: 'prod1', type: 'OUTBOUND', quantity: 5 });
  });

  it('collects unknown codes as invalid rows', async () => {
    const buf = await buildXlsx([
      ['거래처', '품목', '구분', '수량', '일자'],
      ['NOPE', 'I-00001', '입고', 5, '2026-07-20'],
    ]);
    const r = await service.parse(buf, mapping);
    expect(r.invalidRows[0].errors[0]).toContain('거래처');
  });

  it('commit passes rows to TransactionsService with EXCEL source', async () => {
    txServiceMock.create.mockResolvedValue({});
    const rows = [{ partnerId: 'p1', productId: 'prod1', type: 'OUTBOUND', quantity: 5, transactionDate: '2026-07-20' }];
    const r = await service.commit(rows as any, 'u1');
    expect(txServiceMock.create).toHaveBeenCalledWith(expect.anything(), 'u1', 'EXCEL');
    expect(r.created).toBe(1);
  });
});
