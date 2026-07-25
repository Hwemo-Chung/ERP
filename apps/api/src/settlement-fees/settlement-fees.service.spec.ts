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
  $transaction: jest.fn((fn: any) => fn(prismaMock)),
};
const ratesMock = { getPalletThreshold: jest.fn().mockResolvedValue(70) };

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

  it('getStatement denies other partner for scoped caller', async () => {
    await expect(
      service.getStatement('OTHER', '2026-07', { partnerId: 'p1' }),
    ).rejects.toThrow(ForbiddenException);
  });
});
