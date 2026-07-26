import { BadRequestException } from '@nestjs/common';

/**
 * Review fix I-3 (settlement-p0-review.md): rates.service.ts / products.service.ts /
 * partners.service.ts all close the currently-open rate-history row (`effectiveTo: null`) and
 * open a new one at the requested `effectiveFrom`. If the caller submits an `effectiveFrom` at or
 * before the open row's own `effectiveFrom`, that either closes the open row with
 * `effectiveTo <= effectiveFrom` (an invalid daterange) or creates an overlapping range — both
 * are rejected by the DB's EXCLUDE constraint (migration 20260726120000) as a raw, uncaught 500
 * with no {code,message}. Guard it here instead, once, shared by all three write paths.
 */
export function assertRateEffectiveFromAdvances(openRowEffectiveFrom: Date | null | undefined, newEffectiveFrom: Date): void {
  if (openRowEffectiveFrom && newEffectiveFrom.getTime() <= openRowEffectiveFrom.getTime()) {
    throw new BadRequestException({
      code: 'E4113',
      message: '적용 시작일은 현재 요율의 시작일보다 이후여야 합니다',
    });
  }
}
