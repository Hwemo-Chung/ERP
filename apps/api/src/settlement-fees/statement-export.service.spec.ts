import * as ExcelJS from 'exceljs';
import { Test } from '@nestjs/testing';
import { StatementExportService } from './statement-export.service';
import { SettlementFeesService } from './settlement-fees.service';
import { PrismaService } from '../prisma/prisma.service';

const settlementFeesMock = { getStatement: jest.fn() };
const prismaMock = {
  warehouseTransaction: { findMany: jest.fn() },
  settlementInvoice: { findUnique: jest.fn() },
};

describe('StatementExportService', () => {
  let service: StatementExportService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        StatementExportService,
        { provide: SettlementFeesService, useValue: settlementFeesMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(StatementExportService);
  });

  it('buildStatementXlsx returns a parseable workbook with the expected sheets/rows', async () => {
    settlementFeesMock.getStatement.mockResolvedValue({
      partnerId: 'p1',
      yearMonth: '2026-07',
      transport: {
        count: 1,
        total: '5000',
        records: [
          {
            amount: '5000',
            calculationDetail: { rateSource: 'PRODUCT', appliedRate: '5000', formula: 'x' },
            transaction: {
              transactionDate: new Date('2026-07-10'),
              quantity: 3,
              product: { code: 'I-00001', name: 'Widget' },
            },
          },
        ],
      },
      storage: {
        total: '10000',
        records: [
          {
            amount: '10000',
            calculationDetail: {
              contractType: 'PALLET_DAILY',
              palletDailyRate: '1000',
              totalPalletDays: 10,
              formula: '10 파렛트일 × 1000',
            },
          },
        ],
      },
      grandTotal: '15000',
    });
    prismaMock.settlementInvoice.findUnique.mockResolvedValue({
      status: 'ISSUED',
      subtotalAmount: { toFixed: () => '15000' },
      vatAmount: { toFixed: () => '1500' },
      totalAmount: { toFixed: () => '16500' },
    });

    const buf = await service.buildStatementXlsx('p1', '2026-07', {});

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(['운송료', '보관료', '합계']);
    expect(wb.getWorksheet('운송료')!.rowCount).toBe(2); // header + 1 record
    expect(wb.getWorksheet('보관료')!.rowCount).toBe(2);
    const summaryRows = wb.getWorksheet('합계')!;
    expect(summaryRows.getRow(4).getCell(3).value).toBe('15000');
    expect(summaryRows.getRow(5).getCell(3).value).toBe('1500');
    expect(summaryRows.getRow(6).getCell(3).value).toBe('16500');
    expect(settlementFeesMock.getStatement).toHaveBeenCalledWith('p1', '2026-07', {});
  });

  it('buildShipmentListXlsx returns a parseable workbook of outbound rows', async () => {
    prismaMock.warehouseTransaction.findMany.mockResolvedValue([
      {
        transactionDate: new Date('2026-07-05'),
        quantity: 7,
        product: { code: 'I-00001', name: 'Widget' },
      },
    ]);

    const buf = await service.buildShipmentListXlsx('p1', '2026-07-01', '2026-07-31');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    expect(wb.worksheets).toHaveLength(1);
    expect(wb.getWorksheet('출고명세서')!.rowCount).toBe(2); // header + 1 row
    expect(prismaMock.warehouseTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'OUTBOUND', partnerId: 'p1' }),
      }),
    );
  });
});
