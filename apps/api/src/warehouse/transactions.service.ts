import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionSource } from '@prisma/client';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { GetTransactionsDto } from './dto/get-transactions.dto';
import { WAREHOUSE_SETTLEMENT_BRANCH_ID } from './constants';

export interface TransactionScope {
  partnerId?: string;
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.warehouseTransaction.create({
      data: {
        type: dto.type,
        partnerId: dto.partnerId,
        productId: dto.productId,
        quantity: dto.quantity,
        transactionDate: txDate,
        vehicleRateId: dto.vehicleRateId,
        source,
        createdBy: userId,
      },
    });
  }

  async findAll(q: GetTransactionsDto, scope: TransactionScope) {
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
    const [data, totalCount] = await Promise.all([
      this.prisma.warehouseTransaction.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { transactionDate: 'desc' },
        include: { product: { select: { code: true, name: true } }, vehicleRate: true },
      }),
      this.prisma.warehouseTransaction.count({ where }),
    ]);
    return { data, totalCount };
  }
}
