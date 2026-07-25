import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma/prisma.service';
import { WAREHOUSE_SETTLEMENT_BRANCH_ID } from './constants';

const prismaMock = {
  warehouseTransaction: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  product: { findUnique: jest.fn() },
  settlementPeriod: { findFirst: jest.fn() },
};

const dto = {
  type: 'OUTBOUND' as const, partnerId: 'p1', productId: 'prod1',
  quantity: 10, transactionDate: '2026-07-20T09:00:00Z',
};

describe('TransactionsService', () => {
  let service: TransactionsService;
  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [TransactionsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = module.get(TransactionsService);
  });

  it('rejects product not belonging to partner (E4106)', async () => {
    prismaMock.product.findUnique.mockResolvedValue({ id: 'prod1', partnerId: 'OTHER' });
    await expect(service.create(dto, 'u1')).rejects.toThrow(BadRequestException);

    try {
      await service.create(dto, 'u1');
      fail('Should have thrown BadRequestException');
    } catch (error: any) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.response?.code).toBe('E4106');
    }
  });

  it('rejects transaction in LOCKED period (E2002)', async () => {
    prismaMock.product.findUnique.mockResolvedValue({ id: 'prod1', partnerId: 'p1' });
    prismaMock.settlementPeriod.findFirst.mockResolvedValue({ status: 'LOCKED' });
    await expect(service.create(dto, 'u1')).rejects.toThrow(ConflictException);

    try {
      await service.create(dto, 'u1');
      fail('Should have thrown ConflictException');
    } catch (error: any) {
      expect(error).toBeInstanceOf(ConflictException);
      expect(error.response?.code).toBe('E2002');
    }

    expect(prismaMock.settlementPeriod.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: WAREHOUSE_SETTLEMENT_BRANCH_ID,
          status: 'LOCKED',
          periodEnd: { gt: new Date(dto.transactionDate) },
        }),
      }),
    );
  });

  it('blocks a transaction on the last day of a locked month (exclusive periodEnd boundary)', async () => {
    // periodEnd for a locked July period is stored as Aug-1 00:00 UTC (exclusive boundary,
    // see settlement-fees.service.ts monthRange). `gt` must still find the LOCKED row for a
    // tx timestamped anywhere on July 31st, including with a nonzero time-of-day.
    const lastDayDto = { ...dto, transactionDate: '2026-07-31T23:00:00Z' };
    prismaMock.product.findUnique.mockResolvedValue({ id: 'prod1', partnerId: 'p1' });
    prismaMock.settlementPeriod.findFirst.mockResolvedValue({ status: 'LOCKED' });
    await expect(service.create(lastDayDto, 'u1')).rejects.toThrow(ConflictException);
  });

  it('does not block a transaction on the 1st of the month after a locked month', async () => {
    // Real DB: periodEnd (Aug-1 00:00) is not strictly greater than a tx also at/after Aug-1,
    // so the gate query would return null. This test locks in the query shape (`gt`, not
    // `gte`) is what's forwarded to Prisma; the actual boundary comparison is DB behavior,
    // not something a fully-mocked unit test can exercise.
    const nextMonthDto = { ...dto, transactionDate: '2026-08-01T00:00:00Z' };
    prismaMock.product.findUnique.mockResolvedValue({ id: 'prod1', partnerId: 'p1' });
    prismaMock.settlementPeriod.findFirst.mockResolvedValue(null);
    prismaMock.warehouseTransaction.create.mockResolvedValue({ id: 't2' });
    await expect(service.create(nextMonthDto, 'u1')).resolves.toEqual({ id: 't2' });
    expect(prismaMock.settlementPeriod.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ periodEnd: { gt: new Date(nextMonthDto.transactionDate) } }),
      }),
    );
  });

  it('creates transaction with source PWA and creator', async () => {
    prismaMock.product.findUnique.mockResolvedValue({ id: 'prod1', partnerId: 'p1' });
    prismaMock.settlementPeriod.findFirst.mockResolvedValue(null);
    prismaMock.warehouseTransaction.create.mockResolvedValue({ id: 't1' });
    await service.create(dto, 'u1');
    expect(prismaMock.warehouseTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ source: 'PWA', createdBy: 'u1' }) }),
    );
  });

  it('scopes findAll to forced partnerId', async () => {
    prismaMock.warehouseTransaction.findMany.mockResolvedValue([]);
    prismaMock.warehouseTransaction.count.mockResolvedValue(0);
    await service.findAll({ partnerId: 'REQUESTED-OTHER' }, { partnerId: 'p1' });
    expect(prismaMock.warehouseTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ partnerId: 'p1' }) }),
    );
  });
});
