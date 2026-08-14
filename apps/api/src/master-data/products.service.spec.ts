import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaMock = {
  product: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  auditLog: { create: jest.fn() },
  productTransportRateHistory: {
    create: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
};
// ponytail: matches partners.service.spec.ts's $transaction mock — fn receives the same prismaMock as tx.
prismaMock.$transaction.mockImplementation((fn: (tx: typeof prismaMock) => unknown) =>
  fn(prismaMock),
);

const dto = {
  name: '냉장고 RF85',
  categoryId: 'c1',
  partnerId: 'p1',
  unitPrice: '1200000',
  costPrice: '900000',
};

describe('ProductsService', () => {
  let service: ProductsService;
  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = module.get(ProductsService);
  });

  it('auto-generates I-00001 for first product without code', async () => {
    prismaMock.product.findFirst.mockResolvedValue(null);
    prismaMock.product.create.mockResolvedValue({});
    await service.create(dto);
    expect(prismaMock.product.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: 'I-00001' }) }),
    );
  });

  it('increments from last auto code', async () => {
    prismaMock.product.findFirst.mockResolvedValue({ code: 'I-00042' });
    prismaMock.product.create.mockResolvedValue({});
    await service.create(dto);
    expect(prismaMock.product.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: 'I-00043' }) }),
    );
  });

  it('rejects duplicate explicit code with E4102', async () => {
    prismaMock.product.findUnique.mockResolvedValue({ id: 'dup' });
    await expect(service.create({ ...dto, code: 'EX-001' })).rejects.toThrow(ConflictException);
  });

  it('rejects inventory thresholds that are not ordered min <= reorder <= max', async () => {
    await expect(
      service.create({ ...dto, minQuantity: 20, reorderQuantity: 10, maxQuantity: 30 }),
    ).rejects.toThrow(ConflictException);
  });

  it('records an AuditLog entry on update', async () => {
    const existing = { id: 'prod1', name: '냉장고 RF85', unitPrice: '1200000' };
    const updated = { id: 'prod1', name: '냉장고 RF90', unitPrice: '1200000' };
    prismaMock.product.findUnique.mockResolvedValue(existing);
    prismaMock.product.update.mockResolvedValue(updated);
    await service.update('prod1', { name: '냉장고 RF90' }, 'user1');
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tableName: 'products',
          recordId: 'prod1',
          action: 'UPDATE',
          actor: 'user1',
        }),
      }),
    );
  });

  it('throws NotFoundException when updating a missing product', async () => {
    prismaMock.product.findUnique.mockResolvedValue(null);
    await expect(service.update('missing', { name: 'x' }, 'user1')).rejects.toThrow(
      NotFoundException,
    );
  });

  describe('findAll — F1 role-aware projection (spec §2: no 단가/원가/요율 for staff)', () => {
    const rows = [
      {
        id: 'prod1',
        code: 'I-00001',
        name: '냉장고',
        unitPrice: '1200000',
        costPrice: '900000',
        transportRate: '5000',
      },
    ];

    beforeEach(() => {
      prismaMock.product.findMany.mockResolvedValue(rows);
      prismaMock.product.count.mockResolvedValue(1);
    });

    it('strips unitPrice/costPrice/transportRate for a WAREHOUSE_STAFF-only caller', async () => {
      const r = await service.findAll({}, [Role.WAREHOUSE_STAFF]);
      expect(r.data[0]).not.toHaveProperty('unitPrice');
      expect(r.data[0]).not.toHaveProperty('costPrice');
      expect(r.data[0]).not.toHaveProperty('transportRate');
      expect(r.data[0]).toMatchObject({ id: 'prod1', code: 'I-00001', name: '냉장고' });
    });

    it('keeps unitPrice/costPrice/transportRate for HQ_ADMIN', async () => {
      const r = await service.findAll({}, [Role.HQ_ADMIN]);
      expect(r.data[0]).toMatchObject({
        unitPrice: '1200000',
        costPrice: '900000',
        transportRate: '5000',
      });
    });

    it('keeps fields when the caller carries both roles', async () => {
      const r = await service.findAll({}, [Role.HQ_ADMIN, Role.WAREHOUSE_STAFF]);
      expect(r.data[0]).toHaveProperty('unitPrice');
    });
  });

  describe('P0-1 요율 히스토리 쓰기 경로', () => {
    it('create opens an initial history row when transportRate is set', async () => {
      prismaMock.product.findFirst.mockResolvedValue(null);
      prismaMock.product.create.mockResolvedValue({ id: 'prod1', transportRate: '5000' });
      await service.create({ ...dto, transportRate: '5000', rateEffectiveFrom: '2026-07-01' });
      expect(prismaMock.productTransportRateHistory.create).toHaveBeenCalledWith({
        data: {
          productId: 'prod1',
          rate: '5000',
          effectiveFrom: new Date('2026-07-01'),
          effectiveTo: null,
        },
      });
    });

    it('create does not touch history when no transportRate is given', async () => {
      prismaMock.product.findFirst.mockResolvedValue(null);
      prismaMock.product.create.mockResolvedValue({ id: 'prod1', transportRate: null });
      await service.create(dto);
      expect(prismaMock.productTransportRateHistory.create).not.toHaveBeenCalled();
    });

    it('update closes the previously-open history row and opens a new one when transportRate changes', async () => {
      const existing = { id: 'prod1', name: '냉장고 RF85', transportRate: '5000' };
      const updated = { id: 'prod1', name: '냉장고 RF85', transportRate: '8000' };
      prismaMock.product.findUnique.mockResolvedValue(existing);
      prismaMock.product.update.mockResolvedValue(updated);
      await service.update(
        'prod1',
        { transportRate: '8000', rateEffectiveFrom: '2026-07-15' },
        'user1',
      );

      expect(prismaMock.productTransportRateHistory.updateMany).toHaveBeenCalledWith({
        where: { productId: 'prod1', effectiveTo: null },
        data: { effectiveTo: new Date('2026-07-15') },
      });
      expect(prismaMock.productTransportRateHistory.create).toHaveBeenCalledWith({
        data: {
          productId: 'prod1',
          rate: '8000',
          effectiveFrom: new Date('2026-07-15'),
          effectiveTo: null,
        },
      });
      // rateEffectiveFrom must not leak into the Product row write
      expect(prismaMock.product.update).toHaveBeenCalledWith({
        where: { id: 'prod1' },
        data: { transportRate: '8000' },
      });
    });

    it('rejects (E4113) a rateEffectiveFrom at-or-before the currently open history row instead of a raw DB 500 (I-3)', async () => {
      prismaMock.product.findUnique.mockResolvedValue({ id: 'prod1', transportRate: '5000' });
      prismaMock.product.update.mockResolvedValue({ id: 'prod1', transportRate: '8000' });
      prismaMock.productTransportRateHistory.findFirst.mockResolvedValue({
        effectiveFrom: new Date('2026-07-15'),
      });

      await expect(
        service.update(
          'prod1',
          { transportRate: '8000', rateEffectiveFrom: '2026-07-01' },
          'user1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.productTransportRateHistory.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.productTransportRateHistory.create).not.toHaveBeenCalled();

      try {
        await service.update(
          'prod1',
          { transportRate: '8000', rateEffectiveFrom: '2026-07-01' },
          'user1',
        );
      } catch (e: any) {
        expect(e.response?.code).toBe('E4113');
      }
    });

    it('update leaves rate history untouched when transportRate is not part of the patch', async () => {
      prismaMock.product.findUnique.mockResolvedValue({ id: 'prod1', name: '냉장고 RF85' });
      prismaMock.product.update.mockResolvedValue({ id: 'prod1', name: '냉장고 RF90' });
      await service.update('prod1', { name: '냉장고 RF90' }, 'user1');
      expect(prismaMock.productTransportRateHistory.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.productTransportRateHistory.create).not.toHaveBeenCalled();
    });

    it('getRateHistory 404s on unknown product, otherwise lists ordered by effectiveFrom desc', async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);
      await expect(service.getRateHistory('missing')).rejects.toThrow(NotFoundException);

      prismaMock.product.findUnique.mockResolvedValue({ id: 'prod1' });
      prismaMock.productTransportRateHistory.findMany.mockResolvedValue([{ rate: '8000' }]);
      const history = await service.getRateHistory('prod1');
      expect(prismaMock.productTransportRateHistory.findMany).toHaveBeenCalledWith({
        where: { productId: 'prod1' },
        orderBy: { effectiveFrom: 'desc' },
      });
      expect(history).toEqual([{ rate: '8000' }]);
    });
  });
});
