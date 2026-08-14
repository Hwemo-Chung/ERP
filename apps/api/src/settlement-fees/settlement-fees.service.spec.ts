import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SettlementFeesService } from './settlement-fees.service';
import { PrismaService } from '../prisma/prisma.service';
import { RatesService } from '../master-data/rates.service';
import { SettlementInvoiceService } from './settlement-invoice.service';

// P0-3: a real (in-memory) fake store for settlement_records, not a plain jest.fn() stub.
// A stub that ignores its `where` argument would happily return superseded rows and make a
// "no double counting" test pass even if the service forgot the `supersededAt: null` filter —
// exactly the highest-risk bug this task calls out. This fake actually applies `where`, so a
// missing filter in the service surfaces as a real assertion failure (doubled totals).
let settlementRecordStore: any[] = [];
let settlementRecordIdSeq = 0;

function matchesWhere(record: any, where: any = {}): boolean {
  if (where.periodYearMonth !== undefined && record.periodYearMonth !== where.periodYearMonth)
    return false;
  if (where.partnerId !== undefined && record.partnerId !== where.partnerId) return false;
  if (where.transactionId !== undefined && record.transactionId !== where.transactionId)
    return false;
  if ('supersededAt' in where && where.supersededAt === null && record.supersededAt !== null)
    return false;
  return true;
}

const prismaMock: any = {
  warehouseTransaction: { findMany: jest.fn(), aggregate: jest.fn() },
  partner: { findMany: jest.fn() },
  product: { findMany: jest.fn() },
  storageContract: { findMany: jest.fn() },
  settlementRecord: {
    deleteMany: jest.fn(),
    updateMany: jest.fn((args: any) => {
      const matched = settlementRecordStore.filter((r) => matchesWhere(r, args.where));
      matched.forEach((r) => Object.assign(r, args.data));
      return Promise.resolve({ count: matched.length });
    }),
    createMany: jest.fn((args: any) => {
      const rows = args.data.map((d: any) => ({
        id: `sr-${settlementRecordIdSeq++}`,
        supersededAt: null,
        createdAt: new Date(),
        ...d,
      }));
      settlementRecordStore.push(...rows);
      return Promise.resolve({ count: rows.length });
    }),
    findMany: jest.fn((args: any) =>
      Promise.resolve(settlementRecordStore.filter((r) => matchesWhere(r, args?.where))),
    ),
    findFirst: jest.fn((args: any) =>
      Promise.resolve(settlementRecordStore.find((r) => matchesWhere(r, args?.where)) ?? null),
    ),
  },
  settlementPeriod: { upsert: jest.fn() },
  settlementInvoice: { findUnique: jest.fn() },
  productTransportRateHistory: { findMany: jest.fn() },
  partnerTransportRateHistory: { findMany: jest.fn() },
  vehicleRateHistory: { findMany: jest.fn() },
  auditLog: { create: jest.fn() },
  $queryRaw: jest.fn(),
  $transaction: jest.fn((fn: any) => fn(prismaMock)),
};
const ratesMock = {
  getPalletThreshold: jest.fn().mockResolvedValue(70),
  getVehicleRateMode: jest.fn().mockResolvedValue('REPLACE'),
};

function txFixture(over: object = {}) {
  return {
    id: 't1',
    type: 'OUTBOUND',
    partnerId: 'p1',
    productId: 'prod1',
    quantity: 1,
    transactionDate: new Date('2026-07-10'),
    vehicleRateId: null,
    product: { transportRate: '5000', maxUnitsPerPallet: 100, palletThreshold: null },
    partner: { defaultTransportRate: '3000' },
    vehicleRate: null,
    ...over,
  };
}

describe('SettlementFeesService', () => {
  let service: SettlementFeesService;
  beforeEach(async () => {
    jest.clearAllMocks();
    settlementRecordStore = [];
    settlementRecordIdSeq = 0;
    const module = await Test.createTestingModule({
      providers: [
        SettlementFeesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RatesService, useValue: ratesMock },
        { provide: SettlementInvoiceService, useValue: { createDrafts: jest.fn() } },
      ],
    }).compile();
    service = module.get(SettlementFeesService);
    prismaMock.partner.findMany.mockResolvedValue([{ id: 'p1' }]);
    prismaMock.storageContract.findMany.mockResolvedValue([
      {
        partnerId: 'p1',
        contractType: 'PALLET_DAILY',
        palletDailyRate: '1000',
        areaPyeong: null,
        areaRate: null,
      },
    ]);
    prismaMock.warehouseTransaction.aggregate.mockResolvedValue({ _sum: { quantity: null } });
    prismaMock.product.findMany.mockResolvedValue([
      { id: 'prod1', maxUnitsPerPallet: 100, palletThreshold: null },
    ]);
    prismaMock.productTransportRateHistory.findMany.mockResolvedValue([]);
    prismaMock.partnerTransportRateHistory.findMany.mockResolvedValue([]);
    prismaMock.vehicleRateHistory.findMany.mockResolvedValue([]);
    prismaMock.settlementInvoice.findUnique.mockResolvedValue(null);
    prismaMock.$queryRaw.mockResolvedValue([]); // P0-2: openingStock() default — no prior balance
  });

  it('collects E4108 errors for transactions without any rate', async () => {
    prismaMock.warehouseTransaction.findMany.mockResolvedValue([
      txFixture({
        product: { transportRate: null, maxUnitsPerPallet: 100, palletThreshold: null },
        partner: { defaultTransportRate: null },
      }),
    ]);
    const r = await service.previewMonth('2026-07');
    expect(r.partners[0].errors[0].code).toBe('E4108');
  });

  it('closeMonth throws E4109 when errors exist', async () => {
    prismaMock.warehouseTransaction.findMany.mockResolvedValue([
      txFixture({
        product: { transportRate: null, maxUnitsPerPallet: 100, palletThreshold: null },
        partner: { defaultTransportRate: null },
      }),
    ]);
    await expect(service.closeMonth('2026-07', 'u1')).rejects.toThrow(/E4109/);
  });

  it('closeMonth snapshots records (no delete) and locks period', async () => {
    prismaMock.warehouseTransaction.findMany.mockResolvedValue([txFixture()]);
    await service.closeMonth('2026-07', 'u1');
    // P0-3: re-close preserves history — deleteMany must never be called.
    expect(prismaMock.settlementRecord.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.settlementRecord.updateMany).toHaveBeenCalledWith({
      where: { periodYearMonth: '2026-07', supersededAt: null },
      data: { supersededAt: expect.any(Date) },
    });
    expect(prismaMock.settlementRecord.createMany).toHaveBeenCalled();
    const rows = prismaMock.settlementRecord.createMany.mock.calls[0][0].data;
    expect(rows.find((r: any) => r.feeType === 'TRANSPORT').amount).toBe('5000');
    expect(rows.find((r: any) => r.feeType === 'STORAGE')).toBeDefined();
    expect(prismaMock.settlementPeriod.upsert).toHaveBeenCalled();
  });

  it('collects E4111 when a partner has transactions but no active storage contract', async () => {
    prismaMock.storageContract.findMany.mockResolvedValue([]); // no contract for p1
    prismaMock.warehouseTransaction.findMany.mockResolvedValue([txFixture()]);
    const r = await service.previewMonth('2026-07');
    expect(r.partners[0].errors.find((e: any) => e.code === 'E4111')).toBeDefined();
    await expect(service.closeMonth('2026-07', 'u1')).rejects.toThrow(/E4109/);
  });

  it('collects E4112 and blocks close when an inactive partner has in-month transactions', async () => {
    // partner.findMany only returns active partners (p1); the tx below belongs to p2, which
    // is not in that active set (e.g. deactivated mid-month) — must not be silently unbilled.
    prismaMock.warehouseTransaction.findMany.mockResolvedValue([txFixture({ partnerId: 'p2' })]);
    const r = await service.previewMonth('2026-07');
    const p2Result = r.partners.find((p: any) => p.partnerId === 'p2');
    expect(p2Result?.errors[0]).toMatchObject({ code: 'E4112' });
    await expect(service.closeMonth('2026-07', 'u1')).rejects.toThrow(/E4109/);
  });

  it('fetches vehicle rate mode once per run and forwards it into calcTransportFee (ADD mode sums vehicle+product)', async () => {
    ratesMock.getVehicleRateMode.mockResolvedValueOnce('ADD');
    prismaMock.warehouseTransaction.findMany.mockResolvedValue([
      txFixture({ vehicleRateId: 'v1', vehicleRate: { rate: '100000' } }),
    ]);
    await service.closeMonth('2026-07', 'u1');
    expect(ratesMock.getVehicleRateMode).toHaveBeenCalledTimes(1);
    const rows = prismaMock.settlementRecord.createMany.mock.calls.at(-1)![0].data;
    const transportRow = rows.find((r: any) => r.feeType === 'TRANSPORT');
    expect(transportRow.amount).toBe('105000'); // 100000 (vehicle) + 5000 (product)
    expect(transportRow.calculationDetail.vehicleRateMode).toBe('ADD');
  });

  it('getStatement denies other partner for scoped caller', async () => {
    await expect(service.getStatement('OTHER', '2026-07', { partnerId: 'p1' })).rejects.toThrow(
      ForbiddenException,
    );
  });

  describe('P0-1 거래일 기준 요율 조회 (settlement-p0-report-P01.md 핵심 테스트)', () => {
    // 월중 요율 인상 시나리오: 7/1 ~ 7/14 구요율(5000), 7/15부터 신요율(8000).
    const midMonthHistory = [
      {
        productId: 'prod1',
        rate: '5000',
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: new Date('2026-07-15'),
      },
      {
        productId: 'prod1',
        rate: '8000',
        effectiveFrom: new Date('2026-07-15'),
        effectiveTo: null,
      },
    ];

    it('applies the old rate before the change and the new rate after it — same month, split by transactionDate', async () => {
      prismaMock.productTransportRateHistory.findMany.mockResolvedValue(midMonthHistory);
      prismaMock.warehouseTransaction.findMany.mockResolvedValue([
        txFixture({ id: 't-before', transactionDate: new Date('2026-07-10') }),
        txFixture({ id: 't-after', transactionDate: new Date('2026-07-20') }),
      ]);
      const r = await service.previewMonth('2026-07');
      expect(r.partners[0].transportTotal).toBe('13000'); // 5000 (old) + 8000 (new)
    });

    it('closing produces the identical result whether a later-dated history row already exists or not (no retroactive application)', async () => {
      // Scenario A: close BEFORE the rate change row exists — only the old rate is in the DB yet.
      prismaMock.productTransportRateHistory.findMany.mockResolvedValueOnce([
        {
          productId: 'prod1',
          rate: '5000',
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: null,
        },
      ]);
      prismaMock.warehouseTransaction.findMany.mockResolvedValue([
        txFixture({ id: 't-before', transactionDate: new Date('2026-07-10') }),
      ]);
      const early = await service.previewMonth('2026-07');

      // Scenario B: close AFTER the rate change row has been inserted (mid-month change closed
      // the old segment and opened the new one) — same transactionDate must resolve identically.
      prismaMock.productTransportRateHistory.findMany.mockResolvedValueOnce(midMonthHistory);
      const late = await service.previewMonth('2026-07');

      expect(early.partners[0].transportTotal).toBe(late.partners[0].transportTotal);
      expect(early.partners[0].transportTotal).toBe('5000');
    });

    it('falls back to the current cache column when history has no row covering the transaction date', async () => {
      // History exists for a different, disjoint window — the fixture's transactionDate
      // (2026-07-10) isn't covered by it, so resolution must fall back to product.transportRate.
      prismaMock.productTransportRateHistory.findMany.mockResolvedValue([
        {
          productId: 'prod1',
          rate: '9999',
          effectiveFrom: new Date('2020-01-01'),
          effectiveTo: new Date('2020-06-01'),
        },
      ]);
      prismaMock.warehouseTransaction.findMany.mockResolvedValue([txFixture()]); // product.transportRate cache = '5000'
      const r = await service.previewMonth('2026-07');
      expect(r.partners[0].transportTotal).toBe('5000');
    });

    it('queries history bulk-scoped to only the product/partner/vehicle ids present in the month (no N+1)', async () => {
      prismaMock.warehouseTransaction.findMany.mockResolvedValue([
        txFixture({ productId: 'prod1', partnerId: 'p1' }),
      ]);
      await service.previewMonth('2026-07');
      expect(prismaMock.productTransportRateHistory.findMany).toHaveBeenCalledTimes(1);
      expect(prismaMock.productTransportRateHistory.findMany).toHaveBeenCalledWith({
        where: { productId: { in: ['prod1'] } },
      });
      expect(prismaMock.partnerTransportRateHistory.findMany).toHaveBeenCalledWith({
        where: { partnerId: { in: ['p1'] } },
      });
      // no vehicle rate on this fixture — must not query with an empty `in` array
      expect(prismaMock.vehicleRateHistory.findMany).not.toHaveBeenCalled();
    });
  });

  describe('P0-2 openingStock — 누적 잔고 조회 (settlement-p0-report-P02.md 핵심 테스트)', () => {
    it('returns the latest pre-month balance per product; products with no prior rows are absent from the map', async () => {
      prismaMock.$queryRaw.mockResolvedValue([
        { productId: 'prod1', qtyAfterTransaction: 42 },
        { productId: 'prod2', qtyAfterTransaction: -5 },
      ]);
      const map = await (service as any).openingStock('p1', new Date('2026-07-01T00:00:00Z'));
      expect(map.get('prod1')).toBe(42);
      expect(map.get('prod2')).toBe(-5);
      expect(map.has('prod3')).toBe(false);
    });

    it('calls $queryRaw with bound parameters, not string-interpolated SQL (injection safety)', async () => {
      prismaMock.$queryRaw.mockResolvedValue([]);
      const hostilePartnerId = "p1'; DROP TABLE warehouse_transactions; --";
      await (service as any).openingStock(hostilePartnerId, new Date('2026-07-01T00:00:00Z'));
      const [sqlParts, partnerArg] = prismaMock.$queryRaw.mock.calls[0];
      expect(Array.isArray(sqlParts)).toBe(true); // tagged-template strings array, not a built string
      expect(sqlParts.some((s: string) => s.includes('DROP TABLE'))).toBe(false);
      expect(partnerArg).toBe(hostilePartnerId); // value passed as a separate bound parameter
    });

    it('full computeMonth run with a nonzero opening balance still produces correct, unchanged-shape settlement totals (regression)', async () => {
      prismaMock.$queryRaw.mockResolvedValue([{ productId: 'prod1', qtyAfterTransaction: 0 }]);
      prismaMock.warehouseTransaction.findMany.mockResolvedValue([txFixture()]);
      await service.closeMonth('2026-07', 'u1');
      const rows = prismaMock.settlementRecord.createMany.mock.calls.at(-1)![0].data;
      expect(rows.find((r: any) => r.feeType === 'TRANSPORT').amount).toBe('5000');
      expect(rows.find((r: any) => r.feeType === 'STORAGE')).toBeDefined();
    });
  });

  describe('P0-3 정산 재마감 버저닝 + 감사 추적 (settlement-p0-report-P03.md 핵심 테스트)', () => {
    it('first close writes no AuditLog (nothing superseded)', async () => {
      prismaMock.warehouseTransaction.findMany.mockResolvedValue([txFixture()]);
      await service.closeMonth('2026-07', 'u1');
      expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
    });

    it('re-closing the same month supersedes the old records, keeps them (not deleted), and getStatement returns ONLY the new totals — not doubled', async () => {
      prismaMock.warehouseTransaction.findMany.mockResolvedValue([txFixture()]);

      await service.closeMonth('2026-07', 'u1');
      const statementAfterFirstClose = await service.getStatement('p1', '2026-07');
      const firstCloseLiveCount = settlementRecordStore.filter(
        (r) => r.supersededAt === null,
      ).length;
      expect(firstCloseLiveCount).toBe(2); // 1 TRANSPORT + 1 STORAGE record

      await service.closeMonth('2026-07', 'u1');
      const statementAfterSecondClose = await service.getStatement('p1', '2026-07');

      // Same input twice -> same total each time, but if the reader forgot `supersededAt: null`
      // this would come back doubled (first-close + second-close rows both counted).
      expect(statementAfterSecondClose.grandTotal).toBe(statementAfterFirstClose.grandTotal);

      const allRowsForMonth = settlementRecordStore.filter((r) => r.periodYearMonth === '2026-07');
      expect(allRowsForMonth).toHaveLength(4); // 2 (first close) + 2 (second close), none deleted
      expect(allRowsForMonth.filter((r) => r.supersededAt === null)).toHaveLength(2); // only 2nd close live
      expect(allRowsForMonth.filter((r) => r.supersededAt !== null)).toHaveLength(2); // 1st close preserved
    });

    it('getBreakdown returns the live record, not a superseded one, after a rate-correcting re-close', async () => {
      prismaMock.warehouseTransaction.findMany.mockResolvedValue([txFixture()]); // transportRate '5000'
      await service.closeMonth('2026-07', 'u1');

      // Second close recalculates with a corrected rate for the same transaction (t1).
      prismaMock.warehouseTransaction.findMany.mockResolvedValue([
        txFixture({
          product: { transportRate: '9000', maxUnitsPerPallet: 100, palletThreshold: null },
        }),
      ]);
      await service.closeMonth('2026-07', 'u1');

      const breakdown = await service.getBreakdown('t1', {});
      expect(breakdown?.supersededAt).toBeNull();
      expect(breakdown?.amount).toBe('9000');
    });

    it('writes exactly one AuditLog on re-close with previous -> new grand totals and the superseded count', async () => {
      prismaMock.warehouseTransaction.findMany.mockResolvedValue([txFixture()]);
      await service.closeMonth('2026-07', 'u1');
      const firstTotal = (await service.getStatement('p1', '2026-07')).grandTotal;

      prismaMock.warehouseTransaction.findMany.mockResolvedValue([
        txFixture({
          product: { transportRate: '9000', maxUnitsPerPallet: 100, palletThreshold: null },
        }),
      ]);
      await service.closeMonth('2026-07', 'u1');
      const secondTotal = (await service.getStatement('p1', '2026-07')).grandTotal;

      expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
      const call = prismaMock.auditLog.create.mock.calls[0][0];
      expect(call.data.tableName).toBe('settlement_records');
      expect(call.data.action).toBe('SETTLEMENT_RECLOSE');
      expect(call.data.actor).toBe('u1');
      expect(call.data.diff).toMatchObject({
        yearMonth: '2026-07',
        supersededCount: 2,
        previousGrandTotal: firstTotal,
        newGrandTotal: secondTotal,
      });
      expect(firstTotal).not.toBe(secondTotal); // sanity: the rate correction actually changed the total
    });
  });
});
