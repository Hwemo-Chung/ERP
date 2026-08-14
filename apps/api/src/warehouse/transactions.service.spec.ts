import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma/prisma.service';
import { WAREHOUSE_SETTLEMENT_BRANCH_ID } from './constants';
import { NotificationsService } from '../notifications/notifications.service';

// P0-2: a real (in-memory) fake store for warehouse_transactions, not a plain jest.fn() stub.
// The insert path's correctness hinges on the `(transactionDate, id)` ordering key used for both
// "find the previous balance" and "find later rows to recompute" — a stub that ignores `where`
// would happily return the wrong row and make a sequential/retroactive-insert test pass by
// accident. This fake actually filters by the OR/lt/gt shape the service sends, and sorts by the
// requested orderBy, so a wrong ordering key in the service surfaces as a real assertion failure.
let store: any[] = [];
const createNotification = jest.fn();

function matchesClause(row: any, clause: Record<string, any>): boolean {
  return Object.entries(clause).every(([key, val]) => {
    const rowVal = row[key];
    if (val && typeof val === 'object' && !(val instanceof Date)) {
      // relational comparison on two Dates coerces via valueOf (timestamp) per spec — works
      // directly, no manual .getTime() needed.
      if ('lt' in val) return rowVal < val.lt;
      if ('gt' in val) return rowVal > val.gt;
      return true;
    }
    if (val instanceof Date && rowVal instanceof Date) return rowVal.getTime() === val.getTime();
    return rowVal === val;
  });
}

function matchesWhere(row: any, where: Record<string, any> = {}): boolean {
  if (where.partnerId !== undefined && row.partnerId !== where.partnerId) return false;
  if (where.productId !== undefined && row.productId !== where.productId) return false;
  if (where.OR) return where.OR.some((clause: any) => matchesClause(row, clause));
  return true;
}

function sortByOrderBy(orderBy: { [k: string]: 'asc' | 'desc' }[] = []) {
  return (a: any, b: any) => {
    for (const ob of orderBy) {
      const [key, dir] = Object.entries(ob)[0];
      let av = a[key];
      let bv = b[key];
      if (av instanceof Date) av = av.getTime();
      if (bv instanceof Date) bv = bv.getTime();
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
    }
    return 0;
  };
}

function pick(row: any, select: Record<string, boolean>) {
  const out: any = {};
  for (const k of Object.keys(select)) out[k] = row[k];
  return out;
}

// productId -> owning partnerId, used by the product.findUnique fake to satisfy/violate the
// E4106 (product-partner mismatch) guard consistently across tests.
const productPartnerMap: Record<string, string> = { prod1: 'p1', prod2: 'p1', prod3: 'p2' };

function fakeCreate(args: any) {
  const row = { ...args.data };
  store.push(row);
  return Promise.resolve(row);
}
function fakeFindFirst(args: any) {
  const matched = store
    .filter((r) => matchesWhere(r, args.where))
    .sort(sortByOrderBy(args.orderBy));
  const top = matched[0];
  if (!top) return Promise.resolve(null);
  return Promise.resolve(args.select ? pick(top, args.select) : top);
}
function fakeFindMany(args: any) {
  const matched = store
    .filter((r) => matchesWhere(r, args?.where ?? {}))
    .sort(sortByOrderBy(args?.orderBy));
  return Promise.resolve(args?.select ? matched.map((r) => pick(r, args.select)) : matched);
}
function fakeUpdate(args: any) {
  const row = store.find((r) => r.id === args.where.id);
  Object.assign(row, args.data);
  return Promise.resolve(row);
}

const prismaMock: any = {
  warehouseTransaction: {
    create: jest.fn(fakeCreate),
    findFirst: jest.fn(fakeFindFirst),
    findMany: jest.fn(fakeFindMany),
    update: jest.fn(fakeUpdate),
    count: jest.fn(),
  },
  product: {
    findUnique: jest.fn((args: any) =>
      Promise.resolve({
        id: args.where.id,
        code: 'I-00001',
        name: '품목',
        partnerId: productPartnerMap[args.where.id],
        minQuantity: null,
        reorderQuantity: null,
        maxQuantity: null,
      }),
    ),
  },
  settlementPeriod: { findFirst: jest.fn() },
  auditLog: { create: jest.fn() },
  notification: { findMany: jest.fn().mockResolvedValue([]) },
  userRole: { findMany: jest.fn().mockResolvedValue([]) },
  $executeRaw: jest.fn().mockResolvedValue(1),
  $transaction: jest.fn((fn: any) => fn(prismaMock)),
};

const dto = {
  type: 'OUTBOUND' as const,
  partnerId: 'p1',
  productId: 'prod1',
  quantity: 10,
  transactionDate: '2026-07-20T09:00:00Z',
};

describe('TransactionsService', () => {
  let service: TransactionsService;
  beforeEach(async () => {
    jest.clearAllMocks();
    store = [];
    // Reset every fake back to its default implementation regardless of what a previous test's
    // `.mockResolvedValue(...)` override left behind — jest.clearAllMocks() clears call history
    // but not a previously-installed implementation.
    prismaMock.warehouseTransaction.create.mockImplementation(fakeCreate);
    prismaMock.warehouseTransaction.findFirst.mockImplementation(fakeFindFirst);
    prismaMock.warehouseTransaction.findMany.mockImplementation(fakeFindMany);
    prismaMock.warehouseTransaction.update.mockImplementation(fakeUpdate);
    prismaMock.product.findUnique.mockImplementation((args: any) =>
      Promise.resolve({
        id: args.where.id,
        code: 'I-00001',
        name: '품목',
        partnerId: productPartnerMap[args.where.id],
        minQuantity: null,
        reorderQuantity: null,
        maxQuantity: null,
      }),
    );
    prismaMock.settlementPeriod.findFirst.mockResolvedValue(null);
    prismaMock.$executeRaw.mockResolvedValue(1);

    const module = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: NotificationsService, useValue: { createNotification } },
      ],
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
    // guard order: E4106 must short-circuit before the lock check or any write.
    expect(prismaMock.settlementPeriod.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.warehouseTransaction.create).not.toHaveBeenCalled();
  });

  it('rejects transaction in LOCKED period (E2002)', async () => {
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
    // guard order: E2002 must short-circuit before any balance lookup/write.
    expect(prismaMock.warehouseTransaction.create).not.toHaveBeenCalled();
  });

  it('blocks a transaction on the last day of a locked month (exclusive periodEnd boundary)', async () => {
    // periodEnd for a locked July period is stored as Aug-1 00:00 UTC (exclusive boundary,
    // see settlement-fees.service.ts monthRange). `gt` must still find the LOCKED row for a
    // tx timestamped anywhere on July 31st, including with a nonzero time-of-day.
    const lastDayDto = { ...dto, transactionDate: '2026-07-31T23:00:00Z' };
    prismaMock.settlementPeriod.findFirst.mockResolvedValue({ status: 'LOCKED' });
    await expect(service.create(lastDayDto, 'u1')).rejects.toThrow(ConflictException);
  });

  it('does not block a transaction on the 1st of the month after a locked month', async () => {
    // Real DB: periodEnd (Aug-1 00:00) is not strictly greater than a tx also at/after Aug-1,
    // so the gate query would return null. This test locks in the query shape (`gt`, not
    // `gte`) is what's forwarded to Prisma; the actual boundary comparison is DB behavior,
    // not something a fully-mocked unit test can exercise.
    const nextMonthDto = { ...dto, transactionDate: '2026-08-01T00:00:00Z' };
    prismaMock.settlementPeriod.findFirst.mockResolvedValue(null);
    const created = await service.create(nextMonthDto, 'u1');
    expect(created).toMatchObject({
      partnerId: 'p1',
      productId: 'prod1',
      quantity: 10,
      type: 'OUTBOUND',
    });
    expect(prismaMock.settlementPeriod.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          periodEnd: { gt: new Date(nextMonthDto.transactionDate) },
        }),
      }),
    );
  });

  it('creates transaction with source PWA and creator', async () => {
    await service.create(dto, 'u1');
    expect(prismaMock.warehouseTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: 'PWA', createdBy: 'u1' }),
      }),
    );
  });

  it('applies adjustment direction to the running balance and persists its reason', async () => {
    const created = await service.create(
      {
        ...dto,
        type: 'ADJUSTMENT_IN',
        quantity: 7,
        adjustmentReason: 'STOCKTAKE_DIFF',
      },
      'u1',
    );
    expect(created).toMatchObject({ qtyAfterTransaction: 7, adjustmentReason: 'STOCKTAKE_DIFF' });
  });

  it('notifies each HQ admin once with a stable daily dedupe key when the balance breaches reorder quantity', async () => {
    prismaMock.product.findUnique.mockResolvedValue({
      id: 'prod1',
      code: 'I-00001',
      name: '품목',
      partnerId: 'p1',
      minQuantity: 5,
      reorderQuantity: 10,
      maxQuantity: 100,
    });
    prismaMock.userRole.findMany.mockResolvedValue([{ userId: 'admin-1' }]);

    await service.create({ ...dto, type: 'INBOUND', quantity: 8 }, 'u1');

    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        category: 'inventory_threshold',
        dedupeKey: expect.stringMatching(/^inventory:prod1:\d{4}-\d{2}-\d{2}:admin-1$/),
        payload: expect.objectContaining({ level: 'REORDER', quantity: 8 }),
      }),
    );
  });

  describe('P0-2 거래 누적 잔고 (qtyAfterTransaction, settlement-p0-report-P02.md 핵심 테스트)', () => {
    it('raises the $transaction timeout past the 5s default for the retroactive-recalc loop (I-2)', async () => {
      await service.create(dto, 'u1');
      expect(prismaMock.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ timeout: 60_000, maxWait: 10_000 }),
      );
    });

    it('computes correct cumulative balance across sequential inserts for the same (partner, product)', async () => {
      const t1 = await service.create(
        { ...dto, type: 'INBOUND', quantity: 100, transactionDate: '2026-07-01T00:00:00Z' },
        'u1',
      );
      expect((t1 as any).qtyAfterTransaction).toBe(100);

      const t2 = await service.create(
        { ...dto, type: 'OUTBOUND', quantity: 30, transactionDate: '2026-07-02T00:00:00Z' },
        'u1',
      );
      expect((t2 as any).qtyAfterTransaction).toBe(70);

      const t3 = await service.create(
        { ...dto, type: 'INBOUND', quantity: 5, transactionDate: '2026-07-03T00:00:00Z' },
        'u1',
      );
      expect((t3 as any).qtyAfterTransaction).toBe(75);
    });

    it('keeps an independent running total for a different product of the same partner', async () => {
      await service.create(
        {
          ...dto,
          productId: 'prod1',
          type: 'INBOUND',
          quantity: 100,
          transactionDate: '2026-07-01T00:00:00Z',
        },
        'u1',
      );
      const other = await service.create(
        {
          ...dto,
          productId: 'prod2',
          type: 'INBOUND',
          quantity: 9,
          transactionDate: '2026-07-01T00:00:00Z',
        },
        'u1',
      );
      expect((other as any).qtyAfterTransaction).toBe(9); // unaffected by prod1's 100
    });

    it('keeps an independent running total for a different partner', async () => {
      const forP1 = await service.create(
        {
          ...dto,
          partnerId: 'p1',
          productId: 'prod1',
          type: 'INBOUND',
          quantity: 100,
          transactionDate: '2026-07-01T00:00:00Z',
        },
        'u1',
      );
      const forP2 = await service.create(
        {
          ...dto,
          partnerId: 'p2',
          productId: 'prod3',
          type: 'INBOUND',
          quantity: 9,
          transactionDate: '2026-07-01T00:00:00Z',
        },
        'u1',
      );
      expect((forP1 as any).qtyAfterTransaction).toBe(100);
      expect((forP2 as any).qtyAfterTransaction).toBe(9);
    });

    it('allows OUTBOUND to drive the balance negative (no new guard) — negative stock recorded as-is', async () => {
      const t = await service.create(
        { ...dto, type: 'OUTBOUND', quantity: 15, transactionDate: '2026-07-01T00:00:00Z' },
        'u1',
      );
      expect((t as any).qtyAfterTransaction).toBe(-15);
    });

    it('takes the (partnerId, productId) advisory lock as the first statement, before the previous-balance lookup (I-1)', async () => {
      await service.create(
        { ...dto, type: 'INBOUND', quantity: 10, transactionDate: '2026-07-01T00:00:00Z' },
        'u1',
      );

      expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1);
      const [, keyArg] = prismaMock.$executeRaw.mock.calls[0];
      expect(keyArg).toBe('p1:prod1'); // keyed on partnerId + ':' + productId

      // Real call-order assertion (not a hand-rolled counter) — jest tracks a single global
      // invocation sequence across every mock function.
      const lockOrder = prismaMock.$executeRaw.mock.invocationCallOrder[0];
      const findFirstOrder = prismaMock.warehouseTransaction.findFirst.mock.invocationCallOrder[0];
      expect(lockOrder).toBeLessThan(findFirstOrder);
    });

    it('retroactively recomputes all later rows when inserting a transaction dated before them, and writes exactly one AuditLog entry', async () => {
      await service.create(
        { ...dto, type: 'INBOUND', quantity: 100, transactionDate: '2026-07-10T00:00:00Z' },
        'u1',
      ); // balance 100
      await service.create(
        { ...dto, type: 'OUTBOUND', quantity: 20, transactionDate: '2026-07-15T00:00:00Z' },
        'u1',
      ); // balance 80
      await service.create(
        { ...dto, type: 'INBOUND', quantity: 10, transactionDate: '2026-07-20T00:00:00Z' },
        'u1',
      ); // balance 90
      expect(prismaMock.auditLog.create).not.toHaveBeenCalled(); // no later rows existed yet for any of these

      const retro = await service.create(
        { ...dto, type: 'INBOUND', quantity: 5, transactionDate: '2026-07-12T00:00:00Z' },
        'u1',
      );
      // prior balance immediately before 07-12 is the 07-10 row's balance (100) -> 100 + 5 = 105
      expect((retro as any).qtyAfterTransaction).toBe(105);

      const byDate = (d: string) =>
        store.find((r) => r.transactionDate.toISOString().startsWith(d));
      expect(byDate('2026-07-15')!.qtyAfterTransaction).toBe(85); // 105 - 20
      expect(byDate('2026-07-20')!.qtyAfterTransaction).toBe(95); // 85 + 10
      expect(byDate('2026-07-10')!.qtyAfterTransaction).toBe(100); // unaffected, still before the retro insert

      expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
      const call = prismaMock.auditLog.create.mock.calls[0][0];
      expect(call.data.tableName).toBe('warehouse_transactions');
      expect(call.data.action).toBe('RETROACTIVE_QTY_RECALC');
      expect(call.data.actor).toBe('u1');
      expect(call.data.diff).toMatchObject({ affectedRowCount: 2 });
    });
  });

  it('scopes findAll to forced partnerId', async () => {
    prismaMock.warehouseTransaction.findMany.mockResolvedValue([]);
    prismaMock.warehouseTransaction.count.mockResolvedValue(0);
    await service.findAll({ partnerId: 'REQUESTED-OTHER' }, { partnerId: 'p1' });
    expect(prismaMock.warehouseTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ partnerId: 'p1' }) }),
    );
  });

  describe('findAll — F1 role-aware projection (spec §2: no 요율 for staff)', () => {
    const row = {
      id: 't1',
      partnerId: 'p1',
      vehicleRate: {
        id: 'r1',
        vehicleType: '트럭',
        tonnage: '5',
        containerSize: null,
        specialEquipment: null,
        rate: '50000',
      },
    };

    beforeEach(() => {
      prismaMock.warehouseTransaction.findMany.mockResolvedValue([row]);
      prismaMock.warehouseTransaction.count.mockResolvedValue(1);
    });

    it('strips vehicleRate.rate for a WAREHOUSE_STAFF-only caller, keeping id/type/tonnage labels', async () => {
      const r = await service.findAll({}, {}, [Role.WAREHOUSE_STAFF]);
      expect(r.data[0].vehicleRate).not.toHaveProperty('rate');
      expect(r.data[0].vehicleRate).toMatchObject({ id: 'r1', vehicleType: '트럭', tonnage: '5' });
    });

    it('keeps vehicleRate.rate for HQ_ADMIN', async () => {
      const r = await service.findAll({}, {}, [Role.HQ_ADMIN]);
      expect(r.data[0].vehicleRate).toHaveProperty('rate', '50000');
    });

    it('does not choke when vehicleRate is null', async () => {
      prismaMock.warehouseTransaction.findMany.mockResolvedValue([
        { id: 't2', partnerId: 'p1', vehicleRate: null },
      ]);
      const r = await service.findAll({}, {}, [Role.WAREHOUSE_STAFF]);
      expect(r.data[0].vehicleRate).toBeNull();
    });
  });
});
