import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RatesService } from '../master-data/rates.service';
import { WAREHOUSE_SETTLEMENT_BRANCH_ID } from '../warehouse/constants';
import { calcTransportFee } from './transport-fee';
import { buildDailyStock, calcStorageFeePalletDaily, calcStorageFeeArea } from './storage-fee';
import { resolveRateAt, RateHistoryRow } from './rate-resolution';

interface CalcError {
  transactionId?: string;
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
    // COUPLED INVARIANT with the Task 7 lock gate (warehouse/transactions.service.ts):
    // that gate compares `periodEnd: { gt: txDate }` (strictly greater — exclusive boundary).
    // periodEnd stored here MUST stay "next month's first instant" for that comparison to be
    // correct regardless of whether Postgres/Prisma normalize @db.Date operands to date-only
    // or keep full timestamp precision — `gt` on an exclusive boundary is correct either way
    // (see task-11-review.md Scenario A/B). If you change this to an inclusive "last day
    // 23:59:59" convention, you must also change the gate back to `gte` — keep both in sync.
    const end = new Date(Date.UTC(y, m, 1));
    return { y, m, start, end };
  }

  /** 월 전체 계산. records는 생성하지 않고 결과만 반환 (preview/close 공용) */
  private async computeMonth(yearMonth: string) {
    const { y, m, start, end } = this.monthRange(yearMonth);
    const globalThreshold = await this.rates.getPalletThreshold();
    const vehicleRateMode = await this.rates.getVehicleRateMode();
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

    // P0-1: 거래일 기준 요율 조회. 계산 시점(마감 실행 시각)의 "현재값"이 아니라 각 거래의
    // transactionDate 시점에 유효했던 요율을 조회해야, 마감을 언제 실행하든 결과가 동일하다.
    // 월 전체에 필요한 scope id만 모아 히스토리를 한 번에 벌크 조회(N+1 방지)하고, 이후
    // per-transaction 조회는 이 Map에서만 수행한다 — 트랜잭션 개수만큼 DB 왕복하지 않는다.
    const outboundTxs = txs.filter((t) => t.type === 'OUTBOUND');
    const productIds = [...new Set(outboundTxs.map((t) => t.productId))];
    const partnerIdsForRate = [...new Set(outboundTxs.map((t) => t.partnerId))];
    const vehicleRateIds = [...new Set(outboundTxs.map((t) => t.vehicleRateId).filter((id): id is string => !!id))];

    const [productHistoryRows, partnerHistoryRows, vehicleHistoryRows] = await Promise.all([
      productIds.length
        ? this.prisma.productTransportRateHistory.findMany({ where: { productId: { in: productIds } } })
        : Promise.resolve([]),
      partnerIdsForRate.length
        ? this.prisma.partnerTransportRateHistory.findMany({ where: { partnerId: { in: partnerIdsForRate } } })
        : Promise.resolve([]),
      vehicleRateIds.length
        ? this.prisma.vehicleRateHistory.findMany({ where: { rateCardId: { in: vehicleRateIds } } })
        : Promise.resolve([]),
    ]);
    const productHistoryMap = this.groupHistory(productHistoryRows, (r) => r.productId);
    const partnerHistoryMap = this.groupHistory(partnerHistoryRows, (r) => r.partnerId);
    const vehicleHistoryMap = this.groupHistory(vehicleHistoryRows, (r) => r.rateCardId);

    const records: Prisma.SettlementRecordCreateManyInput[] = [];
    const results: { partnerId: string; transportTotal: string; storageTotal: string; errors: CalcError[] }[] = [];

    for (const partner of partners) {
      const partnerTxs = txs.filter((t) => t.partnerId === partner.id);
      const errors: CalcError[] = [];
      let transportTotal = new Prisma.Decimal(0);

      // 운송료: 출고 건당
      for (const tx of partnerTxs.filter((t) => t.type === 'OUTBOUND')) {
        try {
          // Fallback rule: 히스토리에 거래일을 커버하는 행이 없으면(백필 시작일보다 이전 거래 등)
          // 현재값 캐시 컬럼으로 폴백한다 — 기존 데이터가 계속 동작하도록 하는 안전망. 둘 다
          // 없으면 기존 E4108 경로(calcTransportFee 내부)로 그대로 떨어진다.
          const productRate =
            resolveRateAt(productHistoryMap.get(tx.productId) ?? [], tx.transactionDate) ??
            tx.product.transportRate?.toString() ??
            null;
          const partnerDefaultRate =
            resolveRateAt(partnerHistoryMap.get(tx.partnerId) ?? [], tx.transactionDate) ??
            tx.partner.defaultTransportRate?.toString() ??
            null;
          const vehicleRate = tx.vehicleRateId
            ? (resolveRateAt(vehicleHistoryMap.get(tx.vehicleRateId) ?? [], tx.transactionDate) ??
              tx.vehicleRate?.rate?.toString() ??
              null)
            : null;

          const fee = calcTransportFee({ productRate, partnerDefaultRate, vehicleRate }, vehicleRateMode);
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
            contract.areaBillingMode ?? 'FULL_MONTH',
            contract.startDate,
            contract.endDate,
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
      } else if (partnerTxs.length > 0) {
        // 당월 거래는 있는데 활성 보관 계약이 없음 — 조용히 STORAGE를 건너뛰면 미청구 누락이 되므로 에러로 수집
        errors.push({ code: 'E4111', message: 'E4111: no active storage contract' });
      }

      results.push({
        partnerId: partner.id,
        transportTotal: transportTotal.toFixed(0),
        storageTotal: storageTotal.toFixed(0),
        errors,
      });
    }

    // 비활성 거래처인데 당월 거래가 있는 경우 — 위 루프가 isActive 파트너만 순회하므로
    // 조용히 건너뛰면 미청구 누락이 된다. E4111과 동일하게 에러로 수집해 E4109 경로로 마감 차단.
    const activePartnerIds = new Set(partners.map((p) => p.id));
    const inactivePartnerIdsWithTx = new Set(
      txs.filter((t) => !activePartnerIds.has(t.partnerId)).map((t) => t.partnerId),
    );
    for (const partnerId of inactivePartnerIdsWithTx) {
      results.push({
        partnerId,
        transportTotal: '0',
        storageTotal: '0',
        errors: [{ code: 'E4112', message: 'E4112: inactive partner has transactions in period' }],
      });
    }
    return { results, records, start, end };
  }

  /** scope id(productId/partnerId/rateCardId)별 히스토리 행 목록으로 그룹핑. Decimal → string 변환 포함. */
  private groupHistory<T extends { rate: Prisma.Decimal; effectiveFrom: Date; effectiveTo: Date | null }>(
    rows: T[],
    keyOf: (row: T) => string,
  ): Map<string, RateHistoryRow[]> {
    const map = new Map<string, RateHistoryRow[]>();
    for (const row of rows) {
      const key = keyOf(row);
      const list = map.get(key) ?? [];
      list.push({ rate: row.rate.toString(), effectiveFrom: row.effectiveFrom, effectiveTo: row.effectiveTo });
      map.set(key, list);
    }
    return map;
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
    await this.prisma.$transaction(
      async (tx) => {
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
      },
      // ponytail: 120s ceiling — Prisma's default interactive-tx timeout (5s) can't finish
      // deleteMany+createMany+upsert at spec scale (~30만 SettlementRecord/월). Raise further
      // if a close job ever needs more than 2 minutes on real hardware.
      { timeout: 120_000, maxWait: 10_000 },
    );
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
