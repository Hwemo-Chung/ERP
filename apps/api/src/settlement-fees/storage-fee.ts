import { Prisma } from '@prisma/client';
import { calcPallets } from './pallet';

type Tx = { productId: string; type: 'INBOUND' | 'OUTBOUND'; quantity: number; transactionDate: Date };

export function buildDailyStock(
  transactions: Tx[], openingStock: Map<string, number>, year: number, month: number,
): Map<string, number[]> {
  const daysInMonth = new Date(year, month, 0).getDate();
  const productIds = new Set([...openingStock.keys(), ...transactions.map(t => t.productId)]);
  const result = new Map<string, number[]>();

  for (const pid of productIds) {
    const deltaByDay = new Array(daysInMonth).fill(0);
    for (const tx of transactions) {
      if (tx.productId !== pid) continue;
      // ponytail: guard against transactions outside [year, month] — caller-supplied data isn't pre-filtered
      if (tx.transactionDate.getUTCFullYear() !== year || tx.transactionDate.getUTCMonth() + 1 !== month) continue;
      const day = tx.transactionDate.getUTCDate() - 1;
      deltaByDay[day] += tx.type === 'INBOUND' ? tx.quantity : -tx.quantity;
    }
    const days: number[] = [];
    let running = openingStock.get(pid) ?? 0;
    for (let d = 0; d < daysInMonth; d++) {
      running += deltaByDay[d];
      days.push(running);
    }
    result.set(pid, days);
  }
  return result;
}

// Typed detail shapes (not `object`) so callers/tests read fields without `as any`.
export interface PalletDailyDetail {
  contractType: 'PALLET_DAILY';
  palletDailyRate: string;
  totalPalletDays: number;
  perProduct: Record<string, { palletDays: number; threshold: number }>;
  skippedProducts: string[];
  negativeStockProducts: string[];
  formula: string;
}

export type AreaBillingMode = 'FULL_MONTH' | 'DAILY_PRORATED';

export interface AreaFeeDetail {
  contractType: 'AREA_MONTHLY' | 'AREA_YEARLY';
  areaPyeong: string;
  areaRate: string;
  period: string;
  areaBillingMode: AreaBillingMode;
  coveredDays?: number;
  daysInMonth?: number;
  formula: string;
}

export function calcStorageFeePalletDaily(
  dailyStock: Map<string, number[]>,
  products: Map<string, { maxUnitsPerPallet: number | null; palletThreshold: number | null }>,
  globalThresholdPct: number,
  palletDailyRate: string,
): { amount: string; detail: PalletDailyDetail } {
  const rate = new Prisma.Decimal(palletDailyRate);
  let totalPalletDays = 0;
  const perProduct: Record<string, { palletDays: number; threshold: number }> = {};
  const skippedProducts: string[] = [];
  const negativeStockProducts: string[] = [];

  for (const [pid, days] of dailyStock) {
    const p = products.get(pid);
    if (!p?.maxUnitsPerPallet) { skippedProducts.push(pid); continue; }
    const threshold = p.palletThreshold ?? globalThresholdPct;
    let palletDays = 0;
    let hasNegativeDay = false;
    for (const qty of days) {
      if (qty > 0) palletDays += calcPallets(qty, p.maxUnitsPerPallet, threshold).pallets;
      else if (qty < 0) hasNegativeDay = true;
    }
    if (hasNegativeDay) negativeStockProducts.push(pid);
    totalPalletDays += palletDays;
    perProduct[pid] = { palletDays, threshold };
  }

  return {
    amount: rate.mul(totalPalletDays).toFixed(0),
    detail: {
      contractType: 'PALLET_DAILY', palletDailyRate, totalPalletDays, perProduct, skippedProducts,
      negativeStockProducts,
      formula: `${totalPalletDays} 파렛트일 × ${palletDailyRate}`,
    },
  };
}

/** UTC 기준 [year, month] 월의 일수. monthRange(settlement-fees.service.ts)와 동일한
 * Date.UTC 규약 — @db.Date 컬럼은 Prisma에서 UTC 자정으로 돌아오므로 local Date를 쓰면
 * KST 등 UTC+ 타임존 서버에서 하루씩 밀린다. */
function daysInMonthUTC(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 계약 기간 [startDate, endDate ?? ∞]와 대상 월의 겹치는 일수 (endDate는 포함). */
function coveredDaysInMonth(year: number, month: number, startDate: Date, endDate: Date | null): number {
  const monthStart = Date.UTC(year, month - 1, 1);
  const monthEnd = Date.UTC(year, month, 1); // exclusive
  const contractStart = startDate.getTime();
  const contractEnd = endDate ? endDate.getTime() + 24 * 60 * 60 * 1000 : Infinity; // endDate inclusive → exclusive boundary is next day
  const overlapStart = Math.max(monthStart, contractStart);
  const overlapEnd = Math.min(monthEnd, contractEnd);
  const coveredMs = Math.max(0, overlapEnd - overlapStart);
  return Math.round(coveredMs / (24 * 60 * 60 * 1000));
}

export function calcStorageFeeArea(
  areaPyeong: string, areaRate: string,
  contractType: 'AREA_MONTHLY' | 'AREA_YEARLY', year: number, month: number,
  billingMode: AreaBillingMode = 'FULL_MONTH',
  startDate?: Date, endDate?: Date | null,
): { amount: string; detail: AreaFeeDetail } {
  const gross = new Prisma.Decimal(areaPyeong).mul(new Prisma.Decimal(areaRate));
  const monthlyAmount = contractType === 'AREA_YEARLY' ? gross.div(12) : gross;
  const period = `${year}-${String(month).padStart(2, '0')}`;
  const baseFormula = contractType === 'AREA_YEARLY'
    ? `${areaPyeong}평 × ${areaRate} ÷ 12 (년임대 월할)`
    : `${areaPyeong}평 × ${areaRate}`;

  if (billingMode === 'DAILY_PRORATED' && startDate) {
    const daysInMonth = daysInMonthUTC(year, month);
    const coveredDays = coveredDaysInMonth(year, month, startDate, endDate ?? null);
    const amount = monthlyAmount.mul(coveredDays).div(daysInMonth);
    return {
      amount: amount.toFixed(0),
      detail: {
        contractType, areaPyeong, areaRate, period,
        areaBillingMode: 'DAILY_PRORATED',
        coveredDays, daysInMonth,
        formula: `(${baseFormula}) × ${coveredDays}/${daysInMonth}일`,
      },
    };
  }

  return {
    amount: monthlyAmount.toFixed(0),
    detail: {
      contractType, areaPyeong, areaRate, period,
      areaBillingMode: 'FULL_MONTH',
      formula: baseFormula,
    },
  };
}
