export interface PalletResult {
  pallets: number;
  fullPallets: number;
  remainderRatio: number; // 0~1
  serviced: boolean; // 잔여분이 임계 미만으로 0 처리됐고 만재도 없는 경우
}

export function calcPallets(quantity: number, maxUnitsPerPallet: number, thresholdPct: number): PalletResult {
  if (maxUnitsPerPallet <= 0) throw new Error('E4107: maxUnitsPerPallet must be positive');
  const fullPallets = Math.floor(quantity / maxUnitsPerPallet);
  const remainder = quantity % maxUnitsPerPallet;
  const remainderRatio = remainder / maxUnitsPerPallet;
  const extra = remainderRatio >= thresholdPct / 100 ? 1 : 0;
  const pallets = fullPallets + extra;
  return {
    pallets,
    fullPallets,
    remainderRatio,
    serviced: pallets === 0 && quantity > 0,
  };
}
