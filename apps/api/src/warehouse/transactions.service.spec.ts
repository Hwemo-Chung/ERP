import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma/prisma.service';

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
