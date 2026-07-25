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

export function calcStorageFeePalletDaily(
  dailyStock: Map<string, number[]>,
  products: Map<string, { maxUnitsPerPallet: number | null; palletThreshold: number | null }>,
  globalThresholdPct: number,
  palletDailyRate: string,
): { amount: string; detail: object } {
  const rate = new Prisma.Decimal(palletDailyRate);
  let totalPalletDays = 0;
  const perProduct: Record<string, { palletDays: number; threshold: number }> = {};
  const skippedProducts: string[] = [];

  for (const [pid, days] of dailyStock) {
    const p = products.get(pid);
    if (!p?.maxUnitsPerPallet) { skippedProducts.push(pid); continue; }
    const threshold = p.palletThreshold ?? globalThresholdPct;
    let palletDays = 0;
    for (const qty of days) {
      if (qty > 0) palletDays += calcPallets(qty, p.maxUnitsPerPallet, threshold).pallets;
    }
    totalPalletDays += palletDays;
    perProduct[pid] = { palletDays, threshold };
  }

  return {
    amount: rate.mul(totalPalletDays).toFixed(0),
    detail: {
      contractType: 'PALLET_DAILY', palletDailyRate, totalPalletDays, perProduct, skippedProducts,
      formula: `${totalPalletDays} 파렛트일 × ${palletDailyRate}`,
    },
  };
}

export function calcStorageFeeArea(
  areaPyeong: string, areaRate: string,
  contractType: 'AREA_MONTHLY' | 'AREA_YEARLY', year: number, month: number,
): { amount: string; detail: object } {
  const gross = new Prisma.Decimal(areaPyeong).mul(new Prisma.Decimal(areaRate));
  const amount = contractType === 'AREA_YEARLY' ? gross.div(12) : gross;
  return {
    amount: amount.toFixed(0),
    detail: {
      contractType, areaPyeong, areaRate, period: `${year}-${String(month).padStart(2, '0')}`,
      formula: contractType === 'AREA_YEARLY'
        ? `${areaPyeong}평 × ${areaRate} ÷ 12 (년임대 월할)`
        : `${areaPyeong}평 × ${areaRate}`,
    },
  };
}
