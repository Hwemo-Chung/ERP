import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RatesService } from '../master-data/rates.service';
import { WAREHOUSE_SETTLEMENT_BRANCH_ID } from '../warehouse/constants';
import { calcTransportFee } from './transport-fee';
import { buildDailyStock, calcStorageFeePalletDaily, calcStorageFeeArea } from './storage-fee';

interface CalcError {
  transactionId: string;
  code: string;
  message: string;
}

@Injectable()
export class SettlementFeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rates: RatesService,
  ) {}

  private monthRange(yearMonth: string) {
    const [y, m] = yearMonth.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    // `end` is the exclusive start of the *next* month, not the last instant of this one.
    // SettlementPeriod.periodEnd is @db.Date — Postgres truncates any time-of-day we write,
    // so persisting "this month's last day 23:59:59" collapses to that day's midnight anyway,
    // and the Task 7 lock gate (transactions.service.ts) checks `periodEnd: { gte: txDate }`
    // against a full DateTime. A same-day-with-time transaction on the last day would slip
    // past a midnight periodEnd. Using next-month's first instant as the (exclusive) boundary
    // for both the tx-range query and the persisted periodEnd closes that gap.
    const end = new Date(Date.UTC(y, m, 1));
    return { y, m, start, end };
  }

  /** 월 전체 계산. records는 생성하지 않고 결과만 반환 (preview/close 공용) */
  private async computeMonth(yearMonth: string) {
    const { y, m, start, end } = this.monthRange(yearMonth);
    const globalThreshold = await this.rates.getPalletThreshold();
    const partners = await this.prisma.partner.findMany({ where: { isActive: true } });
    const contracts = await this.prisma.storageContract.findMany({ where: { isActive: true } });
    const contractByPartner = new Map(contracts.map((c) => [c.partnerId, c]));

    const txs = await this.prisma.warehouseTransaction.findMany({
      where: { transactionDate: { gte: start, lt: end } },
      include: {
        product: { select: { id: true, transportRate: true, maxUnitsPerPallet: true, palletThreshold: true } },
        partner: { select: { defaultTransportRate: true } },
        vehicleRate: { select: { rate: true } },
      },
    });

    const records: Prisma.SettlementRecordCreateManyInput[] = [];
    const results: { partnerId: string; transportTotal: string; storageTotal: string; errors: CalcError[] }[] = [];

    for (const partner of partners) {
      const partnerTxs = txs.filter((t) => t.partnerId === partner.id);
      const errors: CalcError[] = [];
      let transportTotal = new Prisma.Decimal(0);

      // 운송료: 출고 건당
      for (const tx of partnerTxs.filter((t) => t.type === 'OUTBOUND')) {
        try {
          const fee = calcTransportFee({
            productRate: tx.product.transportRate?.toString() ?? null,
            partnerDefaultRate: tx.partner.defaultTransportRate?.toString() ?? null,
            vehicleRate: tx.vehicleRate?.rate?.toString() ?? null,
          });
          transportTotal = transportTotal.add(fee.amount);
          records.push({
            transactionId: tx.id,
            partnerId: partner.id,
            periodYearMonth: yearMonth,
            feeType: 'TRANSPORT',
            amount: fee.amount,
            calculationDetail: fee.detail as unknown as Prisma.InputJsonValue,
          });
        } catch (e: any) {
          errors.push({ transactionId: tx.id, code: e.message.slice(0, 5), message: e.message });
        }
      }

      // 보관료: 계약 유형 분기
      const contract = contractByPartner.get(partner.id);
      let storageTotal = new Prisma.Decimal(0);
      if (contract) {
        let storage: { amount: string; detail: object };
        if (contract.contractType === 'PALLET_DAILY') {
          const opening = await this.openingStock(partner.id, start);
          const dailyStock = buildDailyStock(
            partnerTxs.map((t) => ({
              productId: t.productId,
              type: t.type,
              quantity: t.quantity,
              transactionDate: t.transactionDate,
            })),
            opening,
            y,
            m,
          );
          const productIds = [...dailyStock.keys()];
          const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } });
          storage = calcStorageFeePalletDaily(
            dailyStock,
            new Map(
              products.map((p) => [
                p.id,
                {
                  maxUnitsPerPallet: p.maxUnitsPerPallet,
                  palletThreshold: p.palletThreshold ? Number(p.palletThreshold) : null,
                },
              ]),
            ),
            globalThreshold,
            contract.palletDailyRate!.toString(),
          );
        } else {
          storage = calcStorageFeeArea(
            contract.areaPyeong!.toString(),
            contract.areaRate!.toString(),
            contract.contractType as 'AREA_MONTHLY' | 'AREA_YEARLY',
            y,
            m,
          );
        }
        storageTotal = new Prisma.Decimal(storage.amount);
        records.push({
          transactionId: null,
          partnerId: partner.id,
          periodYearMonth: yearMonth,
          feeType: 'STORAGE',
          amount: storage.amount,
          calculationDetail: storage.detail as unknown as Prisma.InputJsonValue,
        });
      }

      results.push({
        partnerId: partner.id,
        transportTotal: transportTotal.toFixed(0),
        storageTotal: storageTotal.toFixed(0),
        errors,
      });
    }
    return { results, records, start, end };
  }

  /** 전월 이월 재고: 해당 월 이전 입고합 − 출고합 (품목별). 당월 거래가 없던 품목도 포함되도록
   * partner의 전체 이전 거래를 한 번에 조회 (mock에 groupBy가 없어 findMany로 직접 집계). */
  private async openingStock(partnerId: string, before: Date): Promise<Map<string, number>> {
    const prior = await this.prisma.warehouseTransaction.findMany({
      where: { partnerId, transactionDate: { lt: before } },
      select: { productId: true, type: true, quantity: true },
    });
    const map = new Map<string, number>();
    for (const t of prior) {
      const delta = t.type === 'INBOUND' ? t.quantity : -t.quantity;
      map.set(t.productId, (map.get(t.productId) ?? 0) + delta);
    }
    return map;
  }

  async previewMonth(yearMonth: string) {
    const { results } = await this.computeMonth(yearMonth);
    return { partners: results };
  }

  async closeMonth(yearMonth: string, userId: string) {
    const { results, records, start, end } = await this.computeMonth(yearMonth);
    const allErrors = results.flatMap((r) => r.errors);
    if (allErrors.length > 0) {
      throw new BadRequestException({
        code: 'E4109',
        message: 'E4109: unresolved calculation errors',
        errors: allErrors,
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.settlementRecord.deleteMany({ where: { periodYearMonth: yearMonth } });
      await tx.settlementRecord.createMany({ data: records });
      await tx.settlementPeriod.upsert({
        where: { branchId_periodStart: { branchId: WAREHOUSE_SETTLEMENT_BRANCH_ID, periodStart: start } },
        create: {
          branchId: WAREHOUSE_SETTLEMENT_BRANCH_ID,
          periodStart: start,
          periodEnd: end,
          status: 'LOCKED',
          lockedBy: userId,
          lockedAt: new Date(),
        },
        update: { status: 'LOCKED', lockedBy: userId, lockedAt: new Date() },
      });
    });
    return { yearMonth, partners: results };
  }

  async getBreakdown(transactionId: string, scope: { partnerId?: string }) {
    const record = await this.prisma.settlementRecord.findFirst({
      where: { transactionId },
      include: { transaction: { include: { product: true } } },
    });
    if (record && scope.partnerId && record.partnerId !== scope.partnerId) {
      throw new ForbiddenException({ code: 'E4110', message: 'E4110: access denied to other partner data' });
    }
    return record;
  }

  async getStatement(partnerId: string, yearMonth: string, scope: { partnerId?: string } = {}) {
    if (scope.partnerId && scope.partnerId !== partnerId) {
      throw new ForbiddenException({ code: 'E4110', message: 'E4110: access denied to other partner data' });
    }
    const records = await this.prisma.settlementRecord.findMany({
      where: { partnerId, periodYearMonth: yearMonth },
      include: { transaction: { include: { product: { select: { code: true, name: true } } } } },
    });
    const transport = records.filter((r) => r.feeType === 'TRANSPORT');
    const storage = records.filter((r) => r.feeType === 'STORAGE');
    const sum = (rs: typeof records) => rs.reduce((a, r) => a.add(r.amount), new Prisma.Decimal(0));
    return {
      partnerId,
      yearMonth,
      transport: { count: transport.length, total: sum(transport).toFixed(0), records: transport },
      storage: { total: sum(storage).toFixed(0), records: storage },
      grandTotal: sum(records).toFixed(0),
    };
  }
}
