import { calcPallets } from './pallet';

describe('calcPallets', () => {
  // maxUnitsPerPallet=100, threshold=70%
  it.each([
    [0, 0, 0],     // 수량 0 → 0파렛트
    [69, 0, 0],    // 잔여 69% < 70% → 서비스 처리
    [70, 1, 0],    // 잔여 70% = 임계 → 1파렛트
    [100, 1, 1],   // 만재 1
    [150, 1, 1],   // 만재1 + 잔여50% → 1
    [170, 2, 1],   // 만재1 + 잔여70% → 2
    [370, 4, 3],   // 만재3 + 잔여70% → 4
  ])('quantity=%i → pallets=%i (full=%i)', (qty, expectedPallets, expectedFull) => {
    const r = calcPallets(qty, 100, 70);
    expect(r.pallets).toBe(expectedPallets);
    expect(r.fullPallets).toBe(expectedFull);
  });

  it('marks serviced=true when remainder below threshold and no full pallet', () => {
    expect(calcPallets(50, 100, 70).serviced).toBe(true);
    expect(calcPallets(150, 100, 70).serviced).toBe(false); // 만재 있으면 서비스 아님
  });

  it('respects per-product threshold override', () => {
    expect(calcPallets(50, 100, 50).pallets).toBe(1); // 임계 50%면 50개도 1파렛트
  });

  it('throws E4107 on non-positive maxUnitsPerPallet', () => {
    expect(() => calcPallets(10, 0, 70)).toThrow('E4107');
  });
});
