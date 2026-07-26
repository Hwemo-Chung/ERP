-- P0-3 (정산 재마감 버저닝 + 감사 추적) — docs/prd/2026-07-26-erp-benchmark-prd.md §3 P0-3
--
-- Generation note: this migration is DIFF-GENERATED, produced offline (no live DB in this
-- sandbox) via:
--   npx prisma migrate diff \
--     --from-schema-datamodel <schema.prisma before this change> \
--     --to-schema-datamodel prisma/schema.prisma \
--     --script
-- (schema-to-schema diff mode — same approach as migration 20260726120000, which does not
-- require a reachable database). UNAPPLIED in this sandbox — apply via `prisma migrate deploy`
-- on a real environment, per the existing deploy gate for 20260725080801/20260725190500/
-- 20260726010000/20260726120000.
--
-- `superseded_at` is nullable and additive only — no backfill needed. Every existing row has
-- `superseded_at = NULL`, i.e. "live", which is the correct historical state (nothing has been
-- superseded yet). `closeMonth` now marks old rows with this column instead of deleting them.

-- AlterTable
ALTER TABLE "settlement_records" ADD COLUMN     "superseded_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "settlement_records_partner_id_period_year_month_superseded__idx" ON "settlement_records"("partner_id", "period_year_month", "superseded_at");
