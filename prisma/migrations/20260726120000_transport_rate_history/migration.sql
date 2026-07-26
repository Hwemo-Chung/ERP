-- P0-1 (요율 유효기간 버저닝) — docs/prd/2026-07-26-erp-benchmark-prd.md §3 P0-1
--
-- Generation note: this migration is DIFF-GENERATED for the three CreateTable/CreateIndex/
-- AddForeignKey blocks below, produced offline (no live DB in this sandbox) via:
--   npx prisma migrate diff \
--     --from-schema-datamodel <schema.prisma before this change> \
--     --to-schema-datamodel prisma/schema.prisma \
--     --script
-- (schema-to-schema diff mode — does not require a reachable database, unlike
-- --from-schema-datasource which reads live DB state; that mode was tried first per the
-- pattern used for migration 20260725080801 and failed with "Can't reach database server",
-- confirmed there is no docker/postgres in this sandbox — same situation noted in
-- docs/superpowers/2026-07-25-masterdata-settlement-ledger.md Task 1.)
-- The EXCLUDE constraints and backfill INSERT below are hand-appended (Prisma has no schema
-- primitive for either). UNAPPLIED in this sandbox — apply via `prisma migrate deploy` on a
-- real environment, per the existing deploy gate for 20260725080801/20260725190500/20260726010000.

-- CreateTable
CREATE TABLE "product_transport_rate_histories" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_transport_rate_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_transport_rate_histories" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_transport_rate_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_rate_histories" (
    "id" TEXT NOT NULL,
    "rate_card_id" TEXT NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_rate_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_transport_rate_histories_product_id_effective_from__idx" ON "product_transport_rate_histories"("product_id", "effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "partner_transport_rate_histories_partner_id_effective_from__idx" ON "partner_transport_rate_histories"("partner_id", "effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "vehicle_rate_histories_rate_card_id_effective_from_effectiv_idx" ON "vehicle_rate_histories"("rate_card_id", "effective_from", "effective_to");

-- AddForeignKey
ALTER TABLE "product_transport_rate_histories" ADD CONSTRAINT "product_transport_rate_histories_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_transport_rate_histories" ADD CONSTRAINT "partner_transport_rate_histories_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_rate_histories" ADD CONSTRAINT "vehicle_rate_histories_rate_card_id_fkey" FOREIGN KEY ("rate_card_id") REFERENCES "transport_rate_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Hand-appended: no-overlap DB constraints (PRD §3 수용 기준 #2 — DB-level rejection of
-- overlapping validity periods, safer than application-level validation under race conditions).
-- daterange(effective_from, effective_to) with a NULL upper bound is unbounded above, which is
-- exactly "still current" — Postgres's range-type semantics give us this for free.
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "product_transport_rate_histories"
  ADD CONSTRAINT "product_transport_rate_histories_no_overlap"
  EXCLUDE USING gist (
    "product_id" WITH =,
    daterange("effective_from", "effective_to") WITH &&
  );

ALTER TABLE "partner_transport_rate_histories"
  ADD CONSTRAINT "partner_transport_rate_histories_no_overlap"
  EXCLUDE USING gist (
    "partner_id" WITH =,
    daterange("effective_from", "effective_to") WITH &&
  );

ALTER TABLE "vehicle_rate_histories"
  ADD CONSTRAINT "vehicle_rate_histories_no_overlap"
  EXCLUDE USING gist (
    "rate_card_id" WITH =,
    daterange("effective_from", "effective_to") WITH &&
  );

-- ============================================================================
-- Hand-appended: backfill — one initial history row per existing entity that already has a
-- non-null rate, covering from the service start date to "still current" (effective_to NULL).
-- 2026-01-01 is used as the service-start constant: it predates every WarehouseTransaction this
-- system has ever recorded (this ERP's transaction data begins in 2026), so it is guaranteed to
-- cover every historical transactionDate computeMonth will ever resolve a rate for. Any
-- transaction dated before this (there should be none) falls through to the cache-column
-- fallback in rate-resolution.ts's caller, so this is not a correctness cliff even if wrong.
-- ============================================================================
INSERT INTO "product_transport_rate_histories" ("id", "product_id", "rate", "effective_from", "effective_to")
SELECT gen_random_uuid(), "id", "transport_rate", '2026-01-01'::date, NULL
FROM "products"
WHERE "transport_rate" IS NOT NULL;

INSERT INTO "partner_transport_rate_histories" ("id", "partner_id", "rate", "effective_from", "effective_to")
SELECT gen_random_uuid(), "id", "default_transport_rate", '2026-01-01'::date, NULL
FROM "partners"
WHERE "default_transport_rate" IS NOT NULL;

INSERT INTO "vehicle_rate_histories" ("id", "rate_card_id", "rate", "effective_from", "effective_to")
SELECT gen_random_uuid(), "id", "rate", '2026-01-01'::date, NULL
FROM "transport_rate_cards";
