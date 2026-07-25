-- Seed the sentinel Branch row used as the FK target for SettlementPeriod.branchId
-- when Task 11's warehouse settlement close (SettlementFeesService.closeMonth) and
-- Task 7's lock gate (TransactionsService.create) write/read rows keyed by
-- WAREHOUSE_SETTLEMENT_BRANCH_ID = 'WAREHOUSE' (apps/api/src/warehouse/constants.ts).
-- Without this row, SettlementPeriod.branchId's FK to branches(id) rejects the upsert
-- in closeMonth on any real database. Idempotent: safe to re-run.
-- Bare ON CONFLICT DO NOTHING (no target) absorbs a collision on either the "id" PK or the
-- unique "code" column, so this can't fail-hard and block later migrations either way.
INSERT INTO "branches" ("id", "code", "name", "region", "timezone")
VALUES ('WAREHOUSE', 'WAREHOUSE', '창고 정산', '전사', 'Asia/Seoul')
ON CONFLICT DO NOTHING;
