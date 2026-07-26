// P0-1 (요율 유효기간 버저닝) — docs/prd/2026-07-26-erp-benchmark-prd.md §3 P0-1.
// Pure function: given a rate's full history, pick the rate effective on a given date.
// Used by SettlementFeesService.computeMonth so settlement amounts depend on the transaction
// date, not on when the month happens to be closed (the bug this whole task fixes).

export interface RateHistoryRow {
  rate: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

/**
 * effectiveFrom is an INCLUSIVE lower bound, effectiveTo is an EXCLUSIVE upper bound
 * (effectiveTo === null means "still current, no upper bound").
 * If more than one row matches `at` (shouldn't happen — the DB EXCLUDE constraint in the
 * migration prevents overlapping periods for the same scope id), the row with the latest
 * effectiveFrom wins, so the resolution is still deterministic.
 */
export function resolveRateAt(history: RateHistoryRow[], at: Date): string | null {
  const matches = history.filter(
    (h) => h.effectiveFrom <= at && (h.effectiveTo === null || h.effectiveTo > at),
  );
  if (matches.length === 0) return null;
  return matches.reduce((latest, h) => (h.effectiveFrom > latest.effectiveFrom ? h : latest)).rate;
}
