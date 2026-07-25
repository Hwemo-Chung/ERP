import { Prisma } from '@prisma/client';

export type VehicleRateMode = 'REPLACE' | 'ADD';

export interface TransportFeeDetail {
  rateSource: 'VEHICLE' | 'PRODUCT' | 'PARTNER_DEFAULT';
  appliedRate: string;
  vehicleRateMode: VehicleRateMode;
  baseRate?: string;
  vehicleRate?: string;
  formula: string;
}

export function calcTransportFee(
  input: {
    productRate: string | null;
    partnerDefaultRate: string | null;
    vehicleRate: string | null;
  },
  mode: VehicleRateMode = 'REPLACE',
): { amount: string; detail: TransportFeeDetail } {
  const pick = input.vehicleRate
    ? { rateSource: 'VEHICLE' as const, rate: input.vehicleRate }
    : input.productRate
      ? { rateSource: 'PRODUCT' as const, rate: input.productRate }
      : input.partnerDefaultRate
        ? { rateSource: 'PARTNER_DEFAULT' as const, rate: input.partnerDefaultRate }
        : null;
  if (!pick) throw new Error('E4108: no transport rate configured');

  // ADD only changes anything when a vehicle rate is actually present — otherwise it falls
  // back to the same REPLACE chain (product → partner default), so E4108 stays the only
  // "nothing configured" path either way.
  if (mode === 'ADD' && pick.rateSource === 'VEHICLE') {
    const base = input.productRate ?? input.partnerDefaultRate ?? '0';
    const amount = new Prisma.Decimal(input.vehicleRate!).add(base).toString();
    return {
      amount,
      detail: {
        rateSource: 'VEHICLE',
        appliedRate: amount,
        vehicleRateMode: 'ADD',
        baseRate: base,
        vehicleRate: input.vehicleRate!,
        formula: `차량 단가 ${input.vehicleRate} + 건당 요율 ${base} = ${amount}`,
      },
    };
  }

  return {
    amount: pick.rate,
    detail: {
      rateSource: pick.rateSource,
      appliedRate: pick.rate,
      vehicleRateMode: mode,
      formula: `건당 고정 요율 ${pick.rate} (${pick.rateSource})`,
    },
  };
}
