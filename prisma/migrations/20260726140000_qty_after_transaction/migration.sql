-- P0-2 (거래 누적 잔고 컬럼 + 소급 재계산) — docs/prd/2026-07-26-erp-benchmark-prd.md §3 P0-2
--
-- Generation note: this migration is DIFF-GENERATED for the AddColumn/CreateIndex blocks below,
-- produced offline (no live DB in this sandbox) via:
--   npx prisma migrate diff \
--     --from-schema-datamodel <schema.prisma before this change> \
--     --to-schema-datamodel prisma/schema.prisma \
--     --script
-- (schema-to-schema diff mode — same approach as 20260726120000/20260726130000, which does not
-- require a reachable database; confirmed there is still no docker/postgres in this sandbox).
-- The temporary DEFAULT/DROP DEFAULT and the backfill UPDATE below are hand-appended (Prisma has
-- no schema primitive for either). UNAPPLIED in this sandbox — apply via `prisma migrate deploy`
-- on a real environment, per the existing deploy gate for 20260725080801/20260725190500/
-- 20260726010000/20260726120000/20260726130000.
--
-- NOT NULL strategy (per task instructions, pick one + justify):
-- Chosen: ADD COLUMN ... NOT NULL DEFAULT 0 → backfill (window-function UPDATE, overwrites the
-- 0 placeholder with the real running balance for every existing row) → DROP DEFAULT.
-- Rejected alternative (nullable → backfill → SET NOT NULL): the table already has live writers
-- (TransactionsService.create) that must run in the gap between "add column" and "backfill" on
-- a real deploy; a nullable column would let a concurrent insert land with qty_after_transaction
-- = NULL, silently breaking the DISTINCT ON lookup in openingStock() (`ORDER BY transaction_date
-- DESC, id DESC` — nulls need special-casing that a hot balance column shouldn't require). A
-- transient DEFAULT 0 means concurrent inserts during the migration window still get a
-- structurally valid (if temporarily wrong) value, and the backfill's UPDATE corrects every row
-- — including ones inserted during the window, since the window function recomputes from the
-- full table, not from a snapshot taken before migration start — as long as concurrent writes
-- are quiesced per the "apply during a write-lock/night window" operational note below.
-- The Prisma schema itself declares plain `Int` (no `@default`), matching the FINAL state after
-- DROP DEFAULT — the default only exists transiently during migration application, so schema and
-- deployed DB agree once this migration finishes.
--
-- Backfill ordering tiebreaker: `ORDER BY transaction_date, id` (ascending) within each
-- (partner_id, product_id) partition. This MUST match the insert-path ordering in
-- TransactionsService.create(), which looks up the "previous" row via
--   WHERE (transaction_date, id) < (:newTransactionDate, :newId)
--   ORDER BY transaction_date DESC, id DESC LIMIT 1
-- and the "later rows to recompute" (retroactive insert) via the mirror-image `>` query ordered
-- ascending — i.e. runtime and backfill both treat (transaction_date, id) as the single total
-- order over a partition's rows. `id` (UUID) is an otherwise-arbitrary tiebreaker for same-date
-- rows; that arbitrariness is a known, documented ceiling (see TransactionsService.create()),
-- not an inconsistency between backfill and runtime — both use the exact same tiebreak key.

-- AlterTable
ALTER TABLE "warehouse_transactions" ADD COLUMN "qty_after_transaction" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "warehouse_transactions_partner_id_product_id_transaction_d_idx" ON "warehouse_transactions"("partner_id", "product_id", "transaction_date");

-- ============================================================================
-- Hand-appended: backfill via window function (running sum per (partner_id, product_id),
-- ordered by transaction_date then id — see ordering note above). Reference algorithm is
-- buildDailyStock's running-sum loop (apps/api/src/settlement-fees/storage-fee.ts) ported to SQL
-- — no new algorithm invented for this migration.
-- Operational note (per PRD §3 P0-2 caveat): run during a maintenance window or under an
-- explicit write-lock — a concurrent INSERT into warehouse_transactions between this UPDATE
-- starting and committing could compute its own qty_after_transaction against a partial view
-- and then be silently correct-by-luck or wrong depending on timing. This statement is not
-- itself transactionally isolated from concurrent writers beyond Postgres's default read
-- committed semantics.
-- ============================================================================
UPDATE "warehouse_transactions" t
SET "qty_after_transaction" = c.running
FROM (
  SELECT
    id,
    SUM(CASE WHEN type = 'INBOUND' THEN quantity ELSE -quantity END)
      OVER (PARTITION BY partner_id, product_id ORDER BY transaction_date, id) AS running
  FROM "warehouse_transactions"
) c
WHERE t.id = c.id;

-- Drop the transient default now that every row (pre-existing and backfilled) holds a real,
-- computed balance — future inserts must always supply this column explicitly
-- (TransactionsService.create() does), matching the final Prisma schema (`Int`, no @default).
ALTER TABLE "warehouse_transactions" ALTER COLUMN "qty_after_transaction" DROP DEFAULT;

-- ============================================================================
-- Verification (per PRD §3 P0-2 수용 기준 #1): after applying this migration on a real DB, run
--   node scripts/verify-qty-after-transaction.mjs
-- which independently recomputes the same running sum in JS and reports any row whose stored
-- qty_after_transaction disagrees with the recomputed value. It cannot be run in this sandbox
-- (no reachable Postgres instance) — this is documented, not executed, here.
-- ============================================================================
