import { resolveRateAt, RateHistoryRow } from './rate-resolution';

function row(rate: string, from: string, to: string | null): RateHistoryRow {
  return { rate, effectiveFrom: new Date(from), effectiveTo: to ? new Date(to) : null };
}

describe('resolveRateAt', () => {
  it('returns null when there are no rows', () => {
    expect(resolveRateAt([], new Date('2026-07-10'))).toBeNull();
  });

  it('returns null when queried before the first row starts', () => {
    const history = [row('5000', '2026-07-01', null)];
    expect(resolveRateAt(history, new Date('2026-06-30'))).toBeNull();
  });

  it('includes the exact effectiveFrom instant (inclusive lower bound)', () => {
    const history = [row('5000', '2026-07-15', null)];
    expect(resolveRateAt(history, new Date('2026-07-15'))).toBe('5000');
  });

  it('excludes the exact effectiveTo instant (exclusive upper bound)', () => {
    const history = [
      row('5000', '2026-07-01', '2026-07-15'),
      row('6000', '2026-07-15', null),
    ];
    expect(resolveRateAt(history, new Date('2026-07-15'))).toBe('6000');
    expect(resolveRateAt(history, new Date('2026-07-14'))).toBe('5000');
  });

  it('resolves to the still-open row after the last closed row (unbounded upper bound)', () => {
    const history = [
      row('5000', '2026-01-01', '2026-07-15'),
      row('6000', '2026-07-15', null),
    ];
    expect(resolveRateAt(history, new Date('2026-12-31'))).toBe('6000');
  });

  it('walks multiple sequential rows to the correct segment', () => {
    const history = [
      row('4000', '2026-01-01', '2026-03-01'),
      row('5000', '2026-03-01', '2026-06-01'),
      row('6000', '2026-06-01', '2026-09-01'),
      row('7000', '2026-09-01', null),
    ];
    expect(resolveRateAt(history, new Date('2026-02-15'))).toBe('4000');
    expect(resolveRateAt(history, new Date('2026-04-15'))).toBe('5000');
    expect(resolveRateAt(history, new Date('2026-07-15'))).toBe('6000');
    expect(resolveRateAt(history, new Date('2026-10-15'))).toBe('7000');
  });

  it('deterministically picks the latest effectiveFrom when rows overlap (defensive — DB constraint should prevent this)', () => {
    const history = [
      row('5000', '2026-07-01', null),
      row('6000', '2026-07-10', null),
    ];
    expect(resolveRateAt(history, new Date('2026-07-20'))).toBe('6000');
  });
});
