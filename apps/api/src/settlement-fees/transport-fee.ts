export interface TransportFeeDetail {
  rateSource: 'VEHICLE' | 'PRODUCT' | 'PARTNER_DEFAULT';
  appliedRate: string;
  vehicleRateMode: 'REPLACE'; // ponytail: §10 미확정 — 합산 모드 필요해지면 'ADD' 분기 추가
  formula: string;
}

export function calcTransportFee(input: {
  productRate: string | null;
  partnerDefaultRate: string | null;
  vehicleRate: string | null;
}): { amount: string; detail: TransportFeeDetail } {
  const pick = input.vehicleRate
    ? { rateSource: 'VEHICLE' as const, rate: input.vehicleRate }
    : input.productRate
      ? { rateSource: 'PRODUCT' as const, rate: input.productRate }
      : input.partnerDefaultRate
        ? { rateSource: 'PARTNER_DEFAULT' as const, rate: input.partnerDefaultRate }
        : null;
  if (!pick) throw new Error('E4108: no transport rate configured');
  return {
    amount: pick.rate,
    detail: {
      rateSource: pick.rateSource,
      appliedRate: pick.rate,
      vehicleRateMode: 'REPLACE',
      formula: `건당 고정 요율 ${pick.rate} (${pick.rateSource})`,
    },
  };
}
