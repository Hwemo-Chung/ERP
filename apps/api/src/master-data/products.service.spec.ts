import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaMock = {
  product: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn(),
};
// ponytail: matches partners.service.spec.ts's $transaction mock — fn receives the same prismaMock as tx.
prismaMock.$transaction.mockImplementation((fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));

const dto = { name: '냉장고 RF85', categoryId: 'c1', partnerId: 'p1', unitPrice: '1200000', costPrice: '900000' };

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

  it('records an AuditLog entry on update', async () => {
    const existing = { id: 'prod1', name: '냉장고 RF85', unitPrice: '1200000' };
    const updated = { id: 'prod1', name: '냉장고 RF90', unitPrice: '1200000' };
    prismaMock.product.findUnique.mockResolvedValue(existing);
    prismaMock.product.update.mockResolvedValue(updated);
    await service.update('prod1', { name: '냉장고 RF90' }, 'user1');
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tableName: 'products', recordId: 'prod1', action: 'UPDATE', actor: 'user1' }),
      }),
    );
  });

  it('throws NotFoundException when updating a missing product', async () => {
    prismaMock.product.findUnique.mockResolvedValue(null);
    await expect(service.update('missing', { name: 'x' }, 'user1')).rejects.toThrow(NotFoundException);
  });
});
