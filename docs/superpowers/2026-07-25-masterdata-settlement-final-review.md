# Final whole-branch review — feature/masterdata-settlement (5b79d6b..0af53ed, 29 commits)

Reviewer scope: cross-task seams, spec coverage, ledger-deferred triage, money-path trace, security sweep.
Per-task findings already settled in task-1..17 reviews are NOT re-litigated.

## Verdict: MERGEABLE-WITH-FIXES

## Independent verification (evidence)

- `pnpm --filter erp-logistics-api test` → **22 suites, 342/342 passed** (expected 342). ✅
- `pnpm --filter web build` → exit 0. ✅
- Full web test suite intentionally not run (171 pre-existing failures, documented in ledger Task 14 — not this branch's debt).
- Live-DB checks (migration apply, sentinel seed, `gt` boundary SQL) remain deferred — no docker/postgres in this sandbox. Deploy gate, not merge gate.

---

## 1. Cross-task integration seams — CLEAN

- **Module wiring**: `app.module.ts` registers `MasterDataModule`, `WarehouseModule`, `SettlementFeesModule`. Dependency chain Warehouse → SettlementFees → MasterData is acyclic; `StatementExportService` reuse by `TransactionsController` correctly goes through `SettlementFeesModule` exports (the circular-ref avoidance is documented in `statement-export.service.ts`).
- **Sentinel constant**: `WAREHOUSE_SETTLEMENT_BRANCH_ID = 'WAREHOUSE'` defined once (`apps/api/src/warehouse/constants.ts`), imported (not retyped) at both consumers: lock gate (`warehouse/transactions.service.ts:35`) and close upsert (`settlement-fees/settlement-fees.service.ts:185-187`). Sentinel Branch row seeded by migration `20260725190500_seed_warehouse_sentinel_branch`. ✅
- **Exclusive periodEnd convention**: `monthRange()` stores periodEnd = next-month first instant; lock gate uses `periodEnd: { gt: txDate }`. Both sides carry the COUPLED INVARIANT comment naming each other. Consistent. ✅
- **Error-code registry**: no duplicate code with divergent meaning. E4101 BRN invalid / E4102 duplicate(BRN·partner-code·product-code) / E4103 incomplete storage contract / E4104 not-found / E4105 category depth / E4106 product-partner mismatch / E4107 pallet denominator / E4108 no transport rate / E4109 close blocked / E4110 cross-partner denied / E4111 no active storage contract. E2002 reused per spec for lock violation.
- **BE→FE error shape**: no global exception filter exists, so Nest returns the `{code, message, errors?}` object payload as the error body. FE reads `e.error.message` / `e.error.errors` (monthly-close E4109 re-preview handler) / `error.error?.code` (global-error-handler:162). Shapes match. ✅
- **JwtPayload seam**: `partnerId` added to payload, login/refresh/`/auth/me` all emit it (final commit 0af53ed closed the /auth/me divergence). PARTNER_COORDINATOR with null partnerId fails closed (403) at every scoped endpoint (`scopeFor`, transactions findAll, shipment download). ✅

## 2. Spec coverage walk (§2–§8)

| Spec | Status |
|---|---|
| §2 사용자/권한 | Roles wired; **but WAREHOUSE_STAFF 단가·원가·요율 비노출 violated at API level — Finding F1** |
| §3 데이터 모델 | All 7 models + Partner extension + indexes ((partnerId,transactionDate), (productId,transactionDate)) present in schema + migration |
| §4 계산 엔진 | Transport precedence (vehicle > product > partner-default), pallet threshold (global 70% + override), area monthly/yearly÷12, snapshot SettlementRecord, E4109 close block, E2002 lock — all present. vehicleRateMode:'REPLACE' marker recorded per plan §10 default |
| §5 화면 | All 9 screens exist (master-data 4종, warehouse entry/list/import, breakdown, statement, dashboard, portal 3종 + shared breakdown route). Dashboard shows month totals only — "오늘 누적" card absent (Minor, F7) |
| §6 엑셀 | Master import (parse→category extract→preview→commit, partial success) ✅ **but product commit has a type bug — Finding F2**. Tx import ✅ (routes through lock gate — E2002 rows collected as failed). Downloads: 정산서·출고명세서 ✅; 실적 내역·마스터 목록 downloads were plan-descoped from spec §6.3 (Minor, F8) |
| §7 아키텍처 | Modules/shared/exceljs ✅. OfflineSyncQueue reuse for entry screen (spec §7) silently descoped by plan — entry page is online-only (Minor, F8) |
| §8 성공 기준 | 1 이관 — impacted by F2. 2 breakdown ✅. 3 마감→정산서→xlsx ✅. 4 isolation ✅ (server-forced scope + e2e spec incl. download paths). 5 performance — see analysis below (F3) |

### Success criterion 5 — close-path scale analysis (honest classification)

Spec scale: **일 1만 건** → worst-case ~30만 tx/월 (the review brief's "1만건/월" is the lenient reading; spec §1/§8 say per-day).

- Month tx fetch: single query, linear. At 10k/month trivial; at 300k/month large-but-linear (memory of includes is the practical ceiling, not query count).
- Per-partner `txs.filter(...)`: O(P×T) in-memory. ~30M comparisons at worst case ≈ seconds. Not O(n²) in DB. Acceptable; a Map group-by is a cheap later win.
- `openingStock`: one query per PALLET_DAILY partner scanning that partner's **entire transaction history** (unbounded, grows monthly; already ledger-deferred Task 11). Linear in history, not O(n²); becomes the dominant cost after ~1 year at high volume. Upgrade path: SQL `groupBy` sum or carried-forward opening snapshot. **Known debt, not a merge blocker.**
- `createMany` of all SettlementRecords: single batch (Prisma chunks bind params). ✅
- **The actual breaker: `closeMonth`'s interactive `$transaction` uses the Prisma default 5s timeout** (Finding F3). deleteMany + createMany of ~300k records + upsert will not finish in 5s; even ~10k with JSONB details is borderline on a remote DB. One-line fix.

Classification: with F3 fixed, close is O(T + history) with bounded query count (≈ 3 + 2·P queries) — meets "수 분 이내" at spec scale. Without F3, close **fails exactly at spec scale**.

## 3. Money-path end-to-end trace — SOUND (one bug on the import edge)

Trace: PWA entry (`quantity` int, DTO-validated) → `WarehouseTransaction` → `computeMonth` reads Decimals, converts via `.toString()` → `calcTransportFee` picks rate as **string**, no arithmetic → `Prisma.Decimal.add` accumulation → `SettlementRecord.amount` Decimal(14,2) via createMany (string input — Prisma-safe) → `getStatement` sums with `Prisma.Decimal` → `.toFixed(0)` strings → FE renders strings verbatim → xlsx writes `r.amount.toString()`. **No float mutation anywhere on the money path.** Pallet counting uses JS integers (safe ≤2^53); the only float is `remainderRatio` threshold compare (ledger-deferred repeating-decimal edge, Task 8 — ship). Dashboard `Number()` sum was adjudicated + ceiling-documented in Task 16 (d6c6113) — integer-string inputs, exact. ✅

## 4. Security sweep

- Every new controller: `@UseGuards(JwtAuthGuard, RolesGuard)` + class-level `@Roles` (HQ_ADMIN) with narrow, tested method-level read overrides (`master-data-read-roles.spec.ts` locks the metadata). No unguarded endpoint found.
- PARTNER_COORDINATOR reachable routes all force server-side scope: transactions list (`scope.partnerId ?? q.partnerId` — forced wins), shipment download (forces partnerId), statement/breakdown/statement-download (E4110 fail-closed on null partnerId, cross-partner 403). E2E `partner-isolation.spec.ts` covers statement 403 + shipment-download force-scope (Task 13 carry-forward delivered).
- **Gap: F1 below** (staff price visibility — spec conflict, not cross-tenant leak).
- Nit: `getBreakdown` is an existence oracle (403 when another partner's record exists vs null when absent). Trivial; not actionable for MVP.

---

## Findings

### Critical

None.

### Important (fix before merge)

**F1 — WAREHOUSE_STAFF can read 단가·원가·요율 via API, violating spec §2 "단가·원가·요율 비노출".** [High]
Task 15's read-role override (`GET /master-data/partners|products|rate-cards` + `GET /warehouse/transactions` with `vehicleRate: true` include) returns full records: `Product.unitPrice/costPrice/transportRate`, `Partner.defaultTransportRate`, `TransportRateCard.rate`. The per-task review granted the access for dropdowns but never reconciled with §2's non-exposure clause — UI hiding doesn't help; the API body carries the numbers. Fix (small): role-aware `select` projection on the three findAll paths + slim `vehicleRate` select (staff needs id/vehicleType/tonnage labels only, never `rate`). Alternative: explicit product-owner waiver recorded in the ledger.
Files: `apps/api/src/master-data/{partners,products,rates}.controller.ts`+services, `apps/api/src/warehouse/transactions.service.ts:84`.

**F2 — Excel product import sends string `maxUnitsPerPallet` into Prisma `Int?` field → every row that maps a non-empty 물류 column fails.** [High on mechanism — Prisma does not coerce String→Int (only Decimal/BigInt/DateTime accept strings); confirm once on live DB since sandbox has none]
`excel-import.service.ts:131-142` passes raw parsed strings (`readRows` stringifies every cell) straight to `products.create` → `prisma.product.create`. `maxUnitsPerPallet: "12"` is rejected by Prisma type validation → row lands in `failed` with an unreadable Prisma dump. Same edge for `''` empty strings mapped onto optional Decimal columns (`transportRate`, `palletThreshold`) and required `unitPrice`/`costPrice` (parse only validates when truthy). Impact: 성공 기준 1 (이관) — and the failed field is exactly the storage-fee denominator, so the fallout is silent `skippedProducts` under-billing after operators give up on the column. Not caught by tests because specs mock prisma (no runtime type validation). Fix (small, in `commitProducts`): coerce — `maxUnitsPerPallet: raw ? Number(raw) : undefined` with `Number.isInteger && >= 1` guard, and map `'' → undefined` for optional numeric columns. PWA form path is unaffected (`product-form.page.ts:133` already sends `Number(...)`).

**F3 — `closeMonth` interactive `$transaction` runs on Prisma's default 5s timeout.** [High]
`settlement-fees.service.ts:181-196`. At spec scale (일 1만 건 → 월 ~30만 SettlementRecord) deleteMany+createMany+upsert cannot finish in 5s; even ~10k rows with JSONB details is borderline against a non-local DB. Close then fails with a Prisma transaction-expired error after computing everything. One-line fix: `this.prisma.$transaction(async (tx) => {...}, { timeout: 120_000, maxWait: 10_000 })` (+ optional `// ponytail:` ceiling comment).

**F4 — Inactive partner with in-month transactions is silently unbilled (elevated from ledger Task 11 deferred minor).** [High]
`computeMonth` iterates `partner.findMany({ isActive: true })`; month txs belonging to a partner deactivated mid-month are fetched but never processed — no TRANSPORT records, no STORAGE, **and no error**, so close succeeds while revenue drops. This contradicts the branch's own fail-closed philosophy (E4111 exists precisely to prevent silent non-billing). Elevating because it is a silent money-loss path with a ~5-line fix: after the partner loop, collect tx partnerIds not in the active set and push an E-coded error (blocks close via E4109, admin resolves by closing before deactivation or reactivating).

### Minor (new whole-branch observations — ship as debt, tracked)

- **F5** `openingStock` full-history scan per partner per close/preview — linear-in-history; replace with SQL groupBy or opening snapshot when volume grows (ledger already tracks; keep).
- **F6** Transaction excel commit is 3 sequential queries/row (product lookup + lock check + insert) — ~10k-row upload ≈ tens of seconds. Acceptable ceiling for partial-success semantics; document, batch later if uploads grow.
- **F7** Dashboard lacks the spec §5.8 "오늘" accumulation card (month-only, preview-API reuse per plan note). Product call.
- **F8** Plan-level descopes vs spec to surface to product at finish: §6.3 실적 내역·마스터 목록 다운로드 not implemented; §7 OfflineSyncQueue reuse for the entry screen not implemented (entry is online-only, E2002-aware).
- **F9** `closeMonth` on an already-LOCKED month recomputes and replaces records without requiring unlock first (spec §4.3.4 says recalc after 마감 해제). Same role (HQ_ADMIN) either way — process gap only. Consider a status check or accept as re-close semantics.
- **F10** `getBreakdown` existence oracle (403 vs null for foreign transactionIds). Cosmetic.

## Deferred-item triage (ledger)

**Blocks merge:** only Task 11's "inactive-partner mid-month drop" — elevated to **F4** above. Everything else ships as known debt.

**Ships as debt (keep in ledger):** Task 2 normalizeBrn zero-pad; Task 3/4 nextCode TOCTOU (unique constraint backstops with 409/500, admin-only low concurrency); Task 7 product.isActive check + untested staff controller path; Task 8 float threshold edge; Task 9 '' rate precedence untested; Task 10 proration doc + falsy skip; Task 11 multi-active-contract collapse + breakdown null-vs-404 + openingStock scan (=F5); Task 12 controller-level import test gap; Task 13 download 403 code inconsistency + 보관료 sheet granularity; Task 14 router-state prefill; Task 16 AreaFeeDetail.period + unknown-detail fallback + 100-partner dropdown cap; Task 17 download error handler + E2E_LIVE CI wiring.

**Deploy gates (not merge gates):** migration apply (`prisma migrate deploy`) + sentinel Branch seed verification + one live-SQL check of the `gt` boundary (task-11-review Scenario A/B); run the partner-isolation e2e with `E2E_LIVE` once an environment exists.

**Parked (correct as-is):** Task 9 vehicleRateMode — `'REPLACE'` marker is recorded in every TRANSPORT calculationDetail as the plan mandates; §10 open question (대체 vs 합산, plus area-contract billing timing and real excel column samples) must be surfaced to the user at finish per ledger ruling.

**Pre-existing (not this branch):** 171 web test failures (ENVIRONMENT_CONFIG DI gap).
