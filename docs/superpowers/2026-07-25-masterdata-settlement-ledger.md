# SDD ledger — plan: docs/superpowers/plans/2026-07-25-masterdata-settlement.md
branch: feature/masterdata-settlement (worktree .claude/worktrees/masterdata-settlement)
base: 5b79d6b (main) — docs commit follows
Task 1: deferred — migration SQL generated but not applied (no docker/postgres in sandbox); apply via 'prisma migrate deploy' on real env
Task 1: complete (commits 25f0f93..f2f3f72, review clean; migration-apply deferred to real env)
Task 2: complete (commits f2f3f72..1c11d70, review clean)
Task 2: minor (deferred): normalizeBrn no zero-pad; pnpm-lock churn
Task 3: fix round 1/5 (4 addressed, 0 open; commits 8dc677d..64228b1)
Task 3: complete (commits 1c11d70..64228b1, review clean after round 1)
Task 3: minor (deferred): nextPartnerCode TOCTOU/collision with excel codes; findAll/update no unit tests
DECISION: all new Exxxx exceptions use {code, message} object payload (repo convention) — propagate to Tasks 4-13
DECISION: import shared utils via @erp/shared/utils subpath (root barrel breaks ts-jest)
Task 4: complete (commits 64228b1..0de685a, review clean)
Task 4: minor (deferred): sibling code padding collision past 99/999; nextCode TOCTOU
Task 5: complete (commits 0de685a..cce89de, review clean)
Task 6: fix round 1/5 (1 addressed, 0 open; commits b386383..4b91190)
Task 6: complete (commits cce89de..4b91190, review clean after round 1)
DECISION: existence guard (findUnique -> E4104) required on all update/deactivate paths — propagate to later tasks
Task 7: fix round 1/5 (1 addressed, 0 open; commits 1e8b7ff..c2fd28a)
Task 7: complete (commits 4b91190..c2fd28a, review clean after round 1)
Task 7: minor (deferred): no product.isActive check in create(); WAREHOUSE_STAFF controller path untested
DECISION: warehouse settlement periods use sentinel branchId via WAREHOUSE_SETTLEMENT_BRANCH_ID from apps/api/src/warehouse/constants.ts — Task 11 must import it
DECISION: JwtPayload has roles: Role[] (array) + partnerId added; PARTNER_COORDINATOR with null partnerId fails closed (403)
Task 8: complete (commits c2fd28a..49945b2, review clean)
Task 8: minor (deferred): float boundary edge for repeating-decimal thresholds (e.g. 33.33...%)
Task 9: INCIDENT — implementer committed 3c3ec63 to main in original checkout; main reset to 5b79d6b, commit cherry-picked as fda7077 onto feature branch. Future dispatches must verify branch before commit.
Task 9: complete (commits 49945b2..fda7077 via cherry-pick, review approved)
Task 9: parked — reviewer wants runtime "provisional" marker in detail beyond vehicleRateMode field — ruling: plan text mandates exactly the implemented detail shape; §10 open question surfaces to user at finish. UI can label REPLACE mode.
Task 9: minor (deferred): '' empty-string rate falls through precedence untested; implementer report cited pre-cherry-pick hash/counts
Task 10: fix round 1/5 (3 addressed, 0 open; commits a60038f..82c2007)
Task 10: complete (commits fda7077..82c2007, review clean after round 1)
Task 10: minor (deferred): yearly proration residual undocumented; maxUnitsPerPallet===0 relies on falsy skip
DECISION: buildDailyStock skips out-of-month tx; detail includes negativeStockProducts; typed detail interfaces PalletDailyDetail/AreaFeeDetail exported
Task 11: fix round 1/5 (3 addressed incl Critical boundary; commits 5113de8..2be0fc0)
Task 11: complete (commits 82c2007..2be0fc0, review clean after round 1)
Task 11: minor (deferred): inactive-partner mid-month drop; multi-active-contract collapse; getBreakdown null vs 404; openingStock unbounded scan
Task 11: deferred — gt-boundary + sentinel-seed migration unverified on live DB (no docker in sandbox)
DECISION: SettlementPeriod exclusive periodEnd (next-month start) + gate uses gt — documented both sites; E4111 = tx without active storage contract
Task 12: fix round 1/5 (2 addressed; commits 430dffd..f0cc25c)
Task 12: complete (commits 2be0fc0..f0cc25c, review clean after round 1)
Task 12: minor (deferred): no controller-level tests for import validation paths
DECISION: import commit endpoints take batch-level defaultStorageContract (partners) / defaultPartnerId (products); commit rows field-whitelisted
Task 13: complete (commits f0cc25c..dbab070, review approved)
Task 13: minor (deferred): download endpoints error-code inconsistency (E4110 vs plain 403); 보관료 sheet granularity; implementer report tsc-count inaccurate (no code impact)
CARRY-FORWARD to Task 17: add e2e for shipment-list + statement download isolation (zero automated coverage today)
DECISION: shared xlsx upload validation in apps/api/src/common/xlsx-upload.util.ts; export services query prisma directly (no 200-row cap)
Task 14: fix round 1/5 (3 addressed; commits 4a502e4..68683bc)
Task 14: complete (commits dbab070..68683bc, review clean after round 1)
Task 14: minor (deferred): edit forms use router-state prefill (no GET /:id endpoint — backend addition is upgrade path); web suite has 171 PRE-EXISTING failures (ENVIRONMENT_CONFIG DI gap, unrelated); background-sync spec compile-broken test deletion adjudicated justified by reviewer
DECISION: web services rely on global apiResponseInterceptor (no manual unwrap); importCommit(kind, rows, batch)
Task 15: fix round 1/5 (4 addressed incl Critical read-role override; commits 4a25d0e..bd2013c)
Task 15: complete (commits 68683bc..bd2013c, review clean after round 1)
DECISION: GET /master-data/{partners,products,rate-cards} readable by WAREHOUSE_STAFF (method-level @Roles); writes stay HQ_ADMIN
Task 16: fix round 1/5 (2 addressed; commits a9da089..d6c6113)
Task 16: complete (commits bd2013c..d6c6113, review clean after round 1)
Task 16: minor (deferred): AreaFeeDetail.period not rendered; no fallback for unknown calculationDetail shape; partner dropdown 100 ceiling (typeahead upgrade path)
Task 17: fix round 1/5 (3 addressed; commits a5a0c60..0af53ed)
Task 17: complete (commits d6c6113..0af53ed, review clean after round 1)
Task 17: minor (deferred): downloadShipmentList subscribe lacks error handler (pre-existing convention); my-transactions missing-partnerId message; E2E_LIVE not wired into CI
ALL 17 TASKS COMPLETE — final whole-branch review next
FINAL REVIEW: MERGEABLE-WITH-FIXES — 4 Important (F1 staff price exposure, F2 excel Int coercion, F3 close tx timeout, F4 inactive-partner unbilled). One fix wave dispatched from 0af53ed.
FINAL FIX WAVE: F1-F4 fixed (commits 6bdd215, 06eb9c1) + F1 residual storageContracts strip (ed721cc). Re-review verdicts: F2-F4 ADDRESSED round 1; F1 ADDRESSED after residual fix. API 362/362, web build clean.
BRANCH COMPLETE: 34 commits, final review MERGEABLE (post-fixes).
