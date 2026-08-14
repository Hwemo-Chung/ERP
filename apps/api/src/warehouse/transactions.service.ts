import { randomUUID } from 'node:crypto';
import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Role, TransactionSource } from '@prisma/client';
import { isStaffOnly } from '../common/staff-price-visibility.util';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { GetTransactionsDto } from './dto/get-transactions.dto';
import { WAREHOUSE_SETTLEMENT_BRANCH_ID } from './constants';
import { NotificationsService } from '../notifications/notifications.service';

export interface TransactionScope {
  partnerId?: string;
}

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: CreateTransactionDto, userId: string, source: TransactionSource = 'PWA') {
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product || product.partnerId !== dto.partnerId) {
      throw new BadRequestException({
        code: 'E4106',
        message: 'product does not belong to partner',
      });
    }

    const txDate = new Date(dto.transactionDate);
    // COUPLED INVARIANT with settlement-fees.service.ts (Task 11 closeMonth): periodEnd is
    // stored as an EXCLUSIVE boundary — the first instant of the month *after* the closed one
    // (e.g. a July close stores periodEnd = Aug 1st 00:00 UTC), not July's last instant. `gt`
    // (strictly greater) is the correct comparison for an exclusive boundary regardless of
    // whether Postgres/Prisma normalize @db.Date operands to date-only or keep full timestamp
    // precision. If the periodEnd write convention ever changes to inclusive, change this back
    // to `gte` — keep both sides in sync.
    const locked = await this.prisma.settlementPeriod.findFirst({
      where: {
        branchId: WAREHOUSE_SETTLEMENT_BRANCH_ID,
        status: 'LOCKED',
        periodStart: { lte: txDate },
        periodEnd: { gt: txDate },
      },
    });
    if (locked) {
      throw new ConflictException({
        code: 'E2002',
        message: 'settlement period is locked',
      });
    }

    // P0-2: running balance (qtyAfterTransaction), scoped to (partnerId, productId) —
    // docs/prd/2026-07-26-erp-benchmark-prd.md §3 P0-2. The id is pre-generated (rather than
    // left to the DB/Prisma default) so it can be used as the same-date tiebreaker in the
    // ordering key `(transactionDate, id)`, matching the backfill migration's
    // `ORDER BY transaction_date, id` window function exactly — see that migration for why.
    const id = randomUUID();
    const delta =
      dto.type === 'INBOUND' || dto.type === 'ADJUSTMENT_IN' ? dto.quantity : -dto.quantity;

    const created = await this.prisma.$transaction(
      async (tx) => {
        // Review fix I-1 (settlement-p0-review.md): under READ COMMITTED, two concurrent
        // create() calls for the SAME (partnerId, productId) can both read the same "previous
        // balance" row before either commits, silently corrupting the balance chain with no
        // self-healing (only scripts/verify-qty-after-transaction.mjs would ever catch it).
        // A transaction-scoped advisory lock keyed on the pair serializes the read-then-write
        // balance chain per (partner, product) — first statement in the transaction, before the
        // previous-balance lookup, so a second concurrent caller blocks until the first commits
        // and then reads the up-to-date balance.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dto.partnerId + ':' + dto.productId}))`;

        const prev = await tx.warehouseTransaction.findFirst({
          where: {
            partnerId: dto.partnerId,
            productId: dto.productId,
            OR: [{ transactionDate: { lt: txDate } }, { transactionDate: txDate, id: { lt: id } }],
          },
          orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
          select: { qtyAfterTransaction: true },
        });
        const qtyAfterTransaction = (prev?.qtyAfterTransaction ?? 0) + delta;

        const created = await tx.warehouseTransaction.create({
          data: {
            id,
            type: dto.type,
            partnerId: dto.partnerId,
            productId: dto.productId,
            quantity: dto.quantity,
            transactionDate: txDate,
            vehicleRateId: dto.vehicleRateId,
            source,
            createdBy: userId,
            qtyAfterTransaction,
            adjustmentReason: dto.adjustmentReason,
            adjustmentNote: dto.adjustmentNote,
          },
        });

        // Retroactive insert: any row already stored strictly after this one (same ordering key)
        // has a stale running balance and must be recomputed forward from here — PRD §3 P0-2
        // "소급 입력 처리". Same-day ties are broken by `id` for consistency with the lookup above.
        const laterRows = await tx.warehouseTransaction.findMany({
          where: {
            partnerId: dto.partnerId,
            productId: dto.productId,
            OR: [{ transactionDate: { gt: txDate } }, { transactionDate: txDate, id: { gt: id } }],
          },
          orderBy: [{ transactionDate: 'asc' }, { id: 'asc' }],
          select: { id: true, type: true, quantity: true },
        });

        if (laterRows.length > 0) {
          let running = qtyAfterTransaction;
          for (const row of laterRows) {
            running +=
              row.type === 'INBOUND' || row.type === 'ADJUSTMENT_IN' ? row.quantity : -row.quantity;
            await tx.warehouseTransaction.update({
              where: { id: row.id },
              data: { qtyAfterTransaction: running },
            });
          }
          // P0-3 pattern reused: one audit entry per retroactive recalculation, not one per row.
          await tx.auditLog.create({
            data: {
              tableName: 'warehouse_transactions',
              recordId: created.id,
              action: 'RETROACTIVE_QTY_RECALC',
              diff: {
                affectedRowCount: laterRows.length,
                insertedTransactionDate: txDate.toISOString(),
              },
              actor: userId,
            },
          });
        }

        return created;
      },
      // Review fix I-2 (settlement-p0-review.md): the retroactive-recalc loop above issues one
      // update() per later row inside this transaction. Prisma's default interactive-tx timeout
      // (5s) can be blown by a large retroactive insert (hundreds/thousands of later rows),
      // rolling back the whole insert with P2028. Same ceiling-raise as closeMonth's $transaction
      // in settlement-fees.service.ts.
      // ponytail: per-row update() loop, ceiling raised to 60s — switch to a single batched SQL
      // UPDATE (window function, like the backfill migration) if retroactive inserts routinely
      // affect enough rows to approach this ceiling.
      { timeout: 60_000, maxWait: 10_000 },
    );
    const latest = await this.prisma.warehouseTransaction.findFirst({
      where: { partnerId: dto.partnerId, productId: dto.productId },
      orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
      select: { qtyAfterTransaction: true },
    });
    await this.notifyInventoryThreshold(
      product,
      latest?.qtyAfterTransaction ?? created.qtyAfterTransaction,
      userId,
    );
    return created;
  }

  private async notifyInventoryThreshold(
    product: {
      id: string;
      code: string;
      name: string;
      minQuantity: number | null;
      reorderQuantity: number | null;
      maxQuantity: number | null;
    },
    quantity: number,
    actorId: string,
  ): Promise<void> {
    const level =
      quantity < (product.minQuantity ?? Number.NEGATIVE_INFINITY)
        ? 'MIN'
        : quantity <= (product.reorderQuantity ?? Number.NEGATIVE_INFINITY)
          ? 'REORDER'
          : quantity > (product.maxQuantity ?? Number.POSITIVE_INFINITY)
            ? 'MAX'
            : null;
    if (!level) return;
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
    const admins = await this.prisma.userRole.findMany({
      where: { role: 'HQ_ADMIN' },
      select: { userId: true },
    });
    await Promise.all(
      admins.map(({ userId }) =>
        this.notifications.createNotification({
          userId,
          category: 'inventory_threshold',
          dedupeKey: `inventory:${product.id}:${day}:${userId}`,
          payload: {
            productId: product.id,
            productCode: product.code,
            productName: product.name,
            quantity,
            level,
            actorId,
          },
        }),
      ),
    );
  }

  async findAll(q: GetTransactionsDto, scope: TransactionScope, callerRoles: Role[] = []) {
    const page = q.page ?? 1;
    const pageSize = Math.min(q.pageSize ?? 50, 200);
    const partnerId = scope.partnerId ?? q.partnerId; // 강제 스코프 우선
    const where = {
      ...(partnerId ? { partnerId } : {}),
      ...(q.productId ? { productId: q.productId } : {}),
      ...(q.dateFrom || q.dateTo
        ? {
            transactionDate: {
              ...(q.dateFrom ? { gte: new Date(q.dateFrom) } : {}),
              ...(q.dateTo ? { lte: new Date(q.dateTo) } : {}),
            },
          }
        : {}),
    };
    const [rows, totalCount] = await Promise.all([
      this.prisma.warehouseTransaction.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { transactionDate: 'desc' },
        include: { product: { select: { code: true, name: true } }, vehicleRate: true },
      }),
      this.prisma.warehouseTransaction.count({ where }),
    ]);
    // spec §2: WAREHOUSE_STAFF (without HQ_ADMIN) must not receive 요율 — vehicleRate stays for
    // its id/vehicleType/tonnage/containerSize/specialEquipment labels, minus `rate`.
    const data = isStaffOnly(callerRoles)
      ? rows.map((t) => (t.vehicleRate ? { ...t, vehicleRate: stripRate(t.vehicleRate) } : t))
      : rows;
    return { data, totalCount };
  }

  async adjustmentSummary(scope: TransactionScope) {
    const rows = await this.prisma.warehouseTransaction.groupBy({
      by: ['adjustmentReason'],
      where: {
        type: { in: ['ADJUSTMENT_IN', 'ADJUSTMENT_OUT'] },
        adjustmentReason: { not: null },
        ...(scope.partnerId ? { partnerId: scope.partnerId } : {}),
      },
      _count: true,
      _sum: { quantity: true },
    });
    return rows.map((row) => ({
      reason: row.adjustmentReason,
      count: row._count,
      quantity: row._sum?.quantity ?? 0,
    }));
  }
}

function stripRate<T extends { rate: unknown }>(vehicleRate: T): Omit<T, 'rate'> {
  const { rate: _rate, ...rest } = vehicleRate;
  return rest;
}
