import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RatesService } from '../master-data/rates.service';
import { WAREHOUSE_SETTLEMENT_BRANCH_ID } from '../warehouse/constants';
import { calcTransportFee } from './transport-fee';
import { buildDailyStock, calcStorageFeePalletDaily, calcStorageFeeArea } from './storage-fee';
import { resolveRateAt, RateHistoryRow } from './rate-resolution';
import { SettlementInvoiceService } from './settlement-invoice.service';

export interface CalcError {
  transactionId?: string;
  code: string;
  message: string;
}

@Injectable()
export class SettlementFeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rates: RatesService,
    private readonly invoices: SettlementInvoiceService,
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
        product: {
          select: { id: true, transportRate: true, maxUnitsPerPallet: true, palletThreshold: true },
        },
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
    const vehicleRateIds = [
      ...new Set(outboundTxs.map((t) => t.vehicleRateId).filter((id): id is string => !!id)),
    ];

    const [productHistoryRows, partnerHistoryRows, vehicleHistoryRows] = await Promise.all([
      productIds.length
        ? this.prisma.productTransportRateHistory.findMany({
            where: { productId: { in: productIds } },
          })
        : Promise.resolve([]),
      partnerIdsForRate.length
        ? this.prisma.partnerTransportRateHistory.findMany({
            where: { partnerId: { in: partnerIdsForRate } },
          })
        : Promise.resolve([]),
      vehicleRateIds.length
        ? this.prisma.vehicleRateHistory.findMany({ where: { rateCardId: { in: vehicleRateIds } } })
        : Promise.resolve([]),
    ]);
    const productHistoryMap = this.groupHistory(productHistoryRows, (r) => r.productId);
    const partnerHistoryMap = this.groupHistory(partnerHistoryRows, (r) => r.partnerId);
    const vehicleHistoryMap = this.groupHistory(vehicleHistoryRows, (r) => r.rateCardId);

    const records: Prisma.SettlementRecordCreateManyInput[] = [];
    const results: {
      partnerId: string;
      transportTotal: string;
      storageTotal: string;
      errors: CalcError[];
    }[] = [];

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

          const fee = calcTransportFee(
            { productRate, partnerDefaultRate, vehicleRate },
            vehicleRateMode,
          );
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
          const products = await this.prisma.product.findMany({
            where: { id: { in: productIds } },
          });
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
  private groupHistory<
    T extends { rate: Prisma.Decimal; effectiveFrom: Date; effectiveTo: Date | null },
  >(rows: T[], keyOf: (row: T) => string): Map<string, RateHistoryRow[]> {
    const map = new Map<string, RateHistoryRow[]>();
    for (const row of rows) {
      const key = keyOf(row);
      const list = map.get(key) ?? [];
      list.push({
        rate: row.rate.toString(),
        effectiveFrom: row.effectiveFrom,
        effectiveTo: row.effectiveTo,
      });
      map.set(key, list);
    }
    return map;
  }

  /** 전월 이월 재고: 품목별 최신 누적 잔고 1행 조회 (P0-2, docs/prd/2026-07-26-erp-benchmark-prd.md
   * §3 P0-2). 과거엔 partner의 전체 이전 거래를 스캔해 러닝합을 계산했으나, 이제 각 행에
   * qtyAfterTransaction이 저장되어 있으므로 품목별 "월초 이전 가장 최근 1행"만 읽으면 된다.
   * DISTINCT ON은 Prisma 쿼리 빌더에 없어 $queryRaw 사용 — 파라미터는 태그드 템플릿으로 바인딩되어
   * SQL 문자열에 값이 직접 삽입되지 않는다(injection 안전). */
  private async openingStock(partnerId: string, before: Date): Promise<Map<string, number>> {
    const rows = await this.prisma.$queryRaw<{ productId: string; qtyAfterTransaction: number }[]>`
      SELECT DISTINCT ON (product_id) product_id AS "productId", qty_after_transaction AS "qtyAfterTransaction"
      FROM warehouse_transactions
      WHERE partner_id = ${partnerId} AND transaction_date < ${before}
      ORDER BY product_id, transaction_date DESC, id DESC
    `;
    return new Map(rows.map((r) => [r.productId, r.qtyAfterTransaction]));
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
        // P0-3: previous total must be read BEFORE marking supersededAt, or the sum would be
        // computed over rows already flagged (still correct data, but wrong sequencing intent —
        // read the "before" state while it's still the live state).
        const priorLiveRecords = await tx.settlementRecord.findMany({
          where: { periodYearMonth: yearMonth, supersededAt: null },
          select: { amount: true },
        });
        const previousGrandTotal = priorLiveRecords.reduce(
          (acc, r) => acc.add(r.amount),
          new Prisma.Decimal(0),
        );

        // Re-close: mark prior live records superseded instead of deleteMany — preserves the
        // audit trail for billing disputes (PRD §2.3 / P0-3).
        const { count: supersededCount } = await tx.settlementRecord.updateMany({
          where: { periodYearMonth: yearMonth, supersededAt: null },
          data: { supersededAt: new Date() },
        });
        await tx.settlementRecord.createMany({ data: records });
        await this.invoices.createDrafts(tx, yearMonth, results);
        await tx.settlementPeriod.upsert({
          where: {
            branchId_periodStart: { branchId: WAREHOUSE_SETTLEMENT_BRANCH_ID, periodStart: start },
          },
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

        if (supersededCount > 0) {
          // `records` is built by this method (line ~115/176 above) and always sets `amount` to
          // a string (calcTransportFee/calcStorageFeePalletDaily/calcStorageFeeArea all return
          // `{ amount: string }`) — narrower than the general CreateManyInput union type.
          const newGrandTotal = records.reduce(
            (acc, r) => acc.add(new Prisma.Decimal(r.amount as string)),
            new Prisma.Decimal(0),
          );
          await tx.auditLog.create({
            data: {
              tableName: 'settlement_records',
              recordId: yearMonth,
              action: 'SETTLEMENT_RECLOSE',
              diff: {
                yearMonth,
                supersededCount,
                previousGrandTotal: previousGrandTotal.toFixed(0),
                newGrandTotal: newGrandTotal.toFixed(0),
              },
              actor: userId,
            },
          });
        }
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
      where: { transactionId, supersededAt: null },
      include: { transaction: { include: { product: true } } },
    });
    if (record && scope.partnerId && record.partnerId !== scope.partnerId) {
      throw new ForbiddenException({
        code: 'E4110',
        message: 'E4110: access denied to other partner data',
      });
    }
    return record;
  }

  async getStatement(partnerId: string, yearMonth: string, scope: { partnerId?: string } = {}) {
    if (scope.partnerId && scope.partnerId !== partnerId) {
      throw new ForbiddenException({
        code: 'E4110',
        message: 'E4110: access denied to other partner data',
      });
    }
    const invoice = await this.prisma.settlementInvoice.findUnique({
      where: { partnerId_periodYearMonth: { partnerId, periodYearMonth: yearMonth } },
      select: { status: true },
    });
    if (scope.partnerId) {
      if (!invoice || !['ISSUED', 'PAID'].includes(invoice.status))
        throw new NotFoundException({ code: 'E4120', message: 'issued invoice not found' });
    }
    const records =
      invoice?.status === 'CANCELLED'
        ? []
        : await this.prisma.settlementRecord.findMany({
            where: { partnerId, periodYearMonth: yearMonth, supersededAt: null },
            include: {
              transaction: { include: { product: { select: { code: true, name: true } } } },
            },
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
