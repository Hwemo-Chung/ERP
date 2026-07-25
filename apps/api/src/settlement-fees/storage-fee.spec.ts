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
});
