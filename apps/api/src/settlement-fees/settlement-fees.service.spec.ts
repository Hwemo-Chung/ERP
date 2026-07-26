import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SettlementFeesService } from './settlement-fees.service';
import { PrismaService } from '../prisma/prisma.service';
import { RatesService } from '../master-data/rates.service';

const prismaMock: any = {
  warehouseTransaction: { findMany: jest.fn(), aggregate: jest.fn() },
  partner: { findMany: jest.fn() },
  product: { findMany: jest.fn() },
  storageContract: { findMany: jest.fn() },
  settlementRecord: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
  settlementPeriod: { upsert: jest.fn() },
  productTransportRateHistory: { findMany: jest.fn() },
  partnerTransportRateHistory: { findMany: jest.fn() },
  vehicleRateHistory: { findMany: jest.fn() },
  $transaction: jest.fn((fn: any) => fn(prismaMock)),
};
const ratesMock = {
  getPalletThreshold: jest.fn().mockResolvedValue(70),
  getVehicleRateMode: jest.fn().mockResolvedValue('REPLACE'),
};

function txFixture(over: object = {}) {
  return {
    id: 't1', type: 'OUTBOUND', partnerId: 'p1', productId: 'prod1', quantity: 1,
    transactionDate: new Date('2026-07-10'), vehicleRateId: null,
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
    const module = await Test.createTestingModule({
      providers: [
        SettlementFeesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RatesService, useValue: ratesMock },
      ],
    }).compile();
    service = module.get(SettlementFeesService);
    prismaMock.partner.findMany.mockResolvedValue([{ id: 'p1' }]);
    prismaMock.storageContract.findMany.mockResolvedValue([
      { partnerId: 'p1', contractType: 'PALLET_DAILY', palletDailyRate: '1000', areaPyeong: null, areaRate: null },
    ]);
    prismaMock.warehouseTransaction.aggregate.mockResolvedValue({ _sum: { quantity: null } });
    prismaMock.product.findMany.mockResolvedValue([{ id: 'prod1', maxUnitsPerPallet: 100, palletThreshold: null }]);
    prismaMock.productTransportRateHistory.findMany.mockResolvedValue([]);
    prismaMock.partnerTransportRateHistory.findMany.mockResolvedValue([]);
    prismaMock.vehicleRateHistory.findMany.mockResolvedValue([]);
  });

  it('collects E4108 errors for transactions without any rate', async () => {
    prismaMock.warehouseTransaction.findMany.mockResolvedValue([
      txFixture({ product: { transportRate: null, maxUnitsPerPallet: 100, palletThreshold: null }, partner: { defaultTransportRate: null } }),
    ]);
    const r = await service.previewMonth('2026-07');
    expect(r.partners[0].errors[0].code).toBe('E4108');
  });

  it('closeMonth throws E4109 when errors exist', async () => {
    prismaMock.warehouseTransaction.findMany.mockResolvedValue([
      txFixture({ product: { transportRate: null, maxUnitsPerPallet: 100, palletThreshold: null }, partner: { defaultTransportRate: null } }),
    ]);
    await expect(service.closeMonth('2026-07', 'u1')).rejects.toThrow(/E4109/);
  });

  it('closeMonth snapshots records and locks period', async () => {
    prismaMock.warehouseTransaction.findMany.mockResolvedValue([txFixture()]);
    await service.closeMonth('2026-07', 'u1');
    expect(prismaMock.settlementRecord.deleteMany).toHaveBeenCalledWith({ where: { periodYearMonth: '2026-07' } });
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
    await expect(
      service.getStatement('OTHER', '2026-07', { partnerId: 'p1' }),
    ).rejects.toThrow(ForbiddenException);
  });

  describe('P0-1 거래일 기준 요율 조회 (settlement-p0-report-P01.md 핵심 테스트)', () => {
    // 월중 요율 인상 시나리오: 7/1 ~ 7/14 구요율(5000), 7/15부터 신요율(8000).
    const midMonthHistory = [
      { productId: 'prod1', rate: '5000', effectiveFrom: new Date('2026-01-01'), effectiveTo: new Date('2026-07-15') },
      { productId: 'prod1', rate: '8000', effectiveFrom: new Date('2026-07-15'), effectiveTo: null },
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
        { productId: 'prod1', rate: '5000', effectiveFrom: new Date('2026-01-01'), effectiveTo: null },
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
        { productId: 'prod1', rate: '9999', effectiveFrom: new Date('2020-01-01'), effectiveTo: new Date('2020-06-01') },
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
});
