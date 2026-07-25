import { Prisma } from '@prisma/client';
import { buildDailyStock, calcStorageFeePalletDaily, calcStorageFeeArea } from './storage-fee';

describe('buildDailyStock', () => {
  it('accumulates inbound minus outbound per day', () => {
    const txs = [
      { productId: 'p1', type: 'INBOUND' as const, quantity: 100, transactionDate: new Date('2026-07-05') },
      { productId: 'p1', type: 'OUTBOUND' as const, quantity: 30, transactionDate: new Date('2026-07-10') },
    ];
    const stock = buildDailyStock(txs, new Map(), 2026, 7);
    const days = stock.get('p1')!;
    expect(days[3]).toBe(0);    // 7/4
    expect(days[4]).toBe(100);  // 7/5 입고 반영
    expect(days[9]).toBe(70);   // 7/10 출고 반영
    expect(days[30]).toBe(70);  // 7/31
    expect(days.length).toBe(31);
  });

  it('starts from opening stock carried from previous month', () => {
    const stock = buildDailyStock([], new Map([['p1', 50]]), 2026, 7);
    expect(stock.get('p1')![0]).toBe(50);
  });

  it('ignores transactions outside the target year/month', () => {
    const txs = [
      { productId: 'p1', type: 'INBOUND' as const, quantity: 100, transactionDate: new Date('2026-07-05') },
      // August tx must not leak into July's reconstructed stock via getUTCDate() day-of-month collision
      { productId: 'p1', type: 'INBOUND' as const, quantity: 999, transactionDate: new Date('2026-08-05') },
    ];
    const stock = buildDailyStock(txs, new Map(), 2026, 7);
    const days = stock.get('p1')!;
    expect(days[4]).toBe(100);  // 7/5 only — not 1099
    expect(days[30]).toBe(100); // 7/31 unaffected by August tx
  });
});

describe('calcStorageFeePalletDaily', () => {
  it('sums daily pallets times rate', () => {
    // 2일간 재고 150 (만재1+잔여50%<70% → 1파렛트), 단가 1000 → 2000
    const dailyStock = new Map([['p1', [150, 150]]]);
    const products = new Map([['p1', { maxUnitsPerPallet: 100, palletThreshold: null }]]);
    const r = calcStorageFeePalletDaily(dailyStock, products, 70, '1000');
    expect(r.amount).toBe('2000');
  });

  it('uses product threshold override', () => {
    const dailyStock = new Map([['p1', [50]]]); // 50% ≥ override 50% → 1파렛트
    const products = new Map([['p1', { maxUnitsPerPallet: 100, palletThreshold: 50 }]]);
    expect(calcStorageFeePalletDaily(dailyStock, products, 70, '1000').amount).toBe('1000');
  });

  it('skips products without maxUnitsPerPallet and records them', () => {
    const dailyStock = new Map([['p1', [500]]]);
    const products = new Map([['p1', { maxUnitsPerPallet: null, palletThreshold: null }]]);
    const r = calcStorageFeePalletDaily(dailyStock, products, 70, '1000');
    expect(r.amount).toBe('0');
    expect(r.detail.skippedProducts).toEqual(['p1']);
  });

  it('records negative-stock (over-outbound) products without billing them', () => {
    const dailyStock = new Map([['p1', [-10, 50]]]); // day 1 over-outbound, day 2 under threshold
    const products = new Map([['p1', { maxUnitsPerPallet: 100, palletThreshold: null }]]);
    const r = calcStorageFeePalletDaily(dailyStock, products, 70, '1000');
    expect(r.amount).toBe('0');
    expect(r.detail.negativeStockProducts).toEqual(['p1']);
  });
});

describe('calcStorageFeeArea', () => {
  it('monthly: area times rate', () => {
    expect(calcStorageFeeArea('100', '10000', 'AREA_MONTHLY', 2026, 7).amount).toBe('1000000');
  });
  it('yearly: divided by 12', () => {
    expect(calcStorageFeeArea('120', '12000', 'AREA_YEARLY', 2026, 7).amount).toBe('120000');
  });

  describe('DAILY_PRORATED billing mode', () => {
    // 2026-07 has 31 days. Monthly gross = 100 * 10000 = 1,000,000.
    it('contract starts mid-month: prorates from start date to month end', () => {
      const r = calcStorageFeeArea(
        '100', '10000', 'AREA_MONTHLY', 2026, 7, 'DAILY_PRORATED',
        new Date('2026-07-16'), null,
      );
      // 7/16 ~ 7/31 inclusive = 16 days
      expect(r.detail.coveredDays).toBe(16);
      expect(r.detail.daysInMonth).toBe(31);
      expect(r.amount).toBe(new Prisma.Decimal(1000000).mul(16).div(31).toFixed(0));
    });

    it('contract ends mid-month: prorates from month start to end date', () => {
      const r = calcStorageFeeArea(
        '100', '10000', 'AREA_MONTHLY', 2026, 7, 'DAILY_PRORATED',
        new Date('2026-06-01'), new Date('2026-07-10'),
      );
      // 7/1 ~ 7/10 inclusive = 10 days
      expect(r.detail.coveredDays).toBe(10);
      expect(r.amount).toBe(new Prisma.Decimal(1000000).mul(10).div(31).toFixed(0));
    });

    it('contract covers the full month: same as FULL_MONTH', () => {
      const r = calcStorageFeeArea(
        '100', '10000', 'AREA_MONTHLY', 2026, 7, 'DAILY_PRORATED',
        new Date('2026-01-01'), null,
      );
      expect(r.detail.coveredDays).toBe(31);
      expect(r.amount).toBe('1000000');
    });

    it('no overlap with the target month: amount is 0', () => {
      const r = calcStorageFeeArea(
        '100', '10000', 'AREA_MONTHLY', 2026, 7, 'DAILY_PRORATED',
        new Date('2026-08-01'), null,
      );
      expect(r.detail.coveredDays).toBe(0);
      expect(r.amount).toBe('0');
    });

    it('AREA_YEARLY proration applies to the post-÷12 monthly amount', () => {
      // monthly = 120*12000/12 = 120000; contract active 7/1~7/15 (15 days)/31
      const r = calcStorageFeeArea(
        '120', '12000', 'AREA_YEARLY', 2026, 7, 'DAILY_PRORATED',
        new Date('2026-07-01'), new Date('2026-07-15'),
      );
      expect(r.detail.coveredDays).toBe(15);
      expect(r.amount).toBe(new Prisma.Decimal(120000).mul(15).div(31).toFixed(0));
    });
  });
});
