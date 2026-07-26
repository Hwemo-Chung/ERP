import { BadRequestException } from '@nestjs/common';
import { assertRateEffectiveFromAdvances } from './rate-effective-from.util';

describe('assertRateEffectiveFromAdvances (I-3)', () => {
  it('throws E4113 when the new effectiveFrom is before the open row', () => {
    expect(() => assertRateEffectiveFromAdvances(new Date('2026-07-15'), new Date('2026-07-01'))).toThrow(
      BadRequestException,
    );
    try {
      assertRateEffectiveFromAdvances(new Date('2026-07-15'), new Date('2026-07-01'));
    } catch (e: any) {
      expect(e.response).toMatchObject({ code: 'E4113' });
    }
  });

  it('throws E4113 when the new effectiveFrom equals the open row (would create an empty/invalid range)', () => {
    expect(() => assertRateEffectiveFromAdvances(new Date('2026-07-15'), new Date('2026-07-15'))).toThrow(
      BadRequestException,
    );
  });

  it('passes when the new effectiveFrom is strictly after the open row', () => {
    expect(() => assertRateEffectiveFromAdvances(new Date('2026-07-01'), new Date('2026-07-15'))).not.toThrow();
  });

  it('passes when there is no open row (first-ever rate)', () => {
    expect(() => assertRateEffectiveFromAdvances(null, new Date('2026-07-01'))).not.toThrow();
    expect(() => assertRateEffectiveFromAdvances(undefined, new Date('2026-07-01'))).not.toThrow();
  });
});
