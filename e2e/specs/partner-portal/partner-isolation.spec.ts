/**
 * Partner data-isolation E2E (Task 17).
 *
 * Hits the API directly rather than through the web app's baseURL (localhost:4200):
 * the web dev server has no /api proxy — apps/web/src/environments/environment.ts's
 * `apiUrl` is an absolute `http://localhost:3000/api/v1`, not a relative path the
 * Angular dev server rewrites. Playwright's `request` fixture accepts absolute URLs
 * that bypass the config's `baseURL`, so every call below is fully qualified.
 *
 * Fixture accounts: prisma/seed.ts creates two PARTNER_COORDINATOR users,
 * `partner-a` (partners[1]) and `partner-b` (partners[2]), password `test1234` —
 * added specifically for this spec (no such accounts existed before this task).
 * Deliberately not partners[0]: seed.ts marks index 0 inactive in every batch of 10
 * (`isActive: i % 10 !== 0`), which would make these fixture accounts an edge case.
 *
 * Requires a running stack to execute live:
 *   docker compose up -d && pnpm db:migrate && pnpm db:seed && pnpm api:dev && E2E_LIVE=1 npx playwright test --project=chromium partner-isolation
 * This sandbox has neither Postgres nor the Nest server running, so these tests were
 * NOT executed live here — `test.skip(!process.env.E2E_LIVE, ...)` below skips (not
 * fails) the whole describe block by default, so this file is inert in any
 * environment/CI run that doesn't opt in. Verified instead via:
 *   - `npx playwright test --list` (this file parses and is collected correctly)
 *   - `tsc --noEmit` type-check against the real DTOs/response shapes, traced from
 *     apps/api/src source (transactions.controller.ts, settlement-fees.controller.ts,
 *     auth.service.ts, token-response.dto.ts) rather than assumed from the task brief.
 *
 * Throttle note: POST /auth/login is rate-limited (`@Throttle` 5/min). Each test logs
 * in twice; `test.describe.configure({ mode: 'serial' })` below keeps this file's three
 * tests from running in parallel against one shared dev server. Still run with
 * `--project=chromium` (see command above) — across all 5 Playwright projects the
 * same file would otherwise run 5x concurrently.
 */
import { test, expect, type APIRequestContext } from '@playwright/test';

const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:3000/api/v1';

const PARTNER_A = { username: 'partner-a', password: 'test1234' };
const PARTNER_B = { username: 'partner-b', password: 'test1234' };

interface Session {
  accessToken: string;
  partnerId: string;
}

async function login(request: APIRequestContext, creds: { username: string; password: string }): Promise<Session> {
  const res = await request.post(`${API_BASE}/auth/login`, { data: creds });
  expect(res.ok(), `login failed for ${creds.username}: ${res.status()} ${await res.text()}`).toBeTruthy();
  // Wire shape: TransformInterceptor wraps the controller's TokenResponseDto as
  // { success, data: TokenResponseDto, timestamp } — single-level `data` here (unlike
  // paginated list endpoints, which nest a second `data` inside the payload itself).
  const body = await res.json();
  const partnerId = body.data.user.partnerId as string | undefined;
  expect(partnerId, `${creds.username} has no partnerId on their user object — check seed.ts`).toBeTruthy();
  return { accessToken: body.data.accessToken as string, partnerId: partnerId! };
}

test.describe('Partner data isolation (Task 17 — Task 13 review coverage gap)', () => {
  // No live Postgres/Nest server exists in the sandbox this spec was written in — see
  // the file-header comment. Skipped by default so this spec doesn't report as a
  // failure in an environment without the seeded stack; set E2E_LIVE=1 (after
  // `docker compose up -d && pnpm db:migrate && pnpm db:seed && pnpm api:dev`) to
  // actually run it.
  test.skip(!process.env.E2E_LIVE, 'requires docker compose + pnpm db:seed + pnpm api:dev (set E2E_LIVE=1 to run)');
  // Serial, not parallel: each test logs in twice and POST /auth/login is throttled to
  // 5/min (auth.controller.ts @Throttle) — six logins in parallel across this file's
  // three tests would trip that limit against one shared dev server.
  test.describe.configure({ mode: 'serial' });

  test('GET /warehouse/transactions: partner A sees only own rows even when requesting partner B via query', async ({ request }) => {
    const a = await login(request, PARTNER_A);
    const b = await login(request, PARTNER_B);

    const res = await request.get(`${API_BASE}/warehouse/transactions`, {
      params: { partnerId: b.partnerId },
      headers: { Authorization: `Bearer ${a.accessToken}` },
    });
    expect(res.status()).toBe(200);

    // Paginated endpoint: findAll() returns { data, totalCount }, which the interceptor
    // wraps again — so the row array is body.data.data, not body.data.
    const body = await res.json();
    const rows = body.data.data as Array<{ partnerId: string }>;
    // transactions.controller.ts findAll(): PARTNER_COORDINATOR's scope.partnerId
    // (forced from the JWT) takes priority over any partnerId query param
    // ("강제 스코프 우선"), so every returned row must belong to partner A, never B —
    // even though the request explicitly asked for partner B's data.
    for (const tx of rows) {
      expect(tx.partnerId).toBe(a.partnerId);
      expect(tx.partnerId).not.toBe(b.partnerId);
    }
  });

  test('GET /settlement-fees/statement: partner A requesting partner B\'s statement gets 403 E4110', async ({ request }) => {
    const a = await login(request, PARTNER_A);
    const b = await login(request, PARTNER_B);
    const yearMonth = new Date().toISOString().slice(0, 7);

    const res = await request.get(`${API_BASE}/settlement-fees/statement`, {
      params: { partnerId: b.partnerId, yearMonth },
      headers: { Authorization: `Bearer ${a.accessToken}` },
    });
    expect(res.status()).toBe(403);

    // Nest's default exception filter serializes an HttpException's object payload
    // verbatim (no {success,data} envelope — TransformInterceptor only wraps the
    // success path), so the body IS { code, message }, not nested under .data or .error.
    const body = await res.json();
    expect(body.code).toBe('E4110');
  });

  test('GET /warehouse/transactions/shipment-list/download: partner A requesting partner B force-scopes to A, not 403', async ({ request }) => {
    const a = await login(request, PARTNER_A);
    const b = await login(request, PARTNER_B);

    const res = await request.get(`${API_BASE}/warehouse/transactions/shipment-list/download`, {
      params: { partnerId: b.partnerId },
      headers: { Authorization: `Bearer ${a.accessToken}` },
    });

    // This is the deliberate deviation from the statement endpoint, confirmed by
    // reading transactions.controller.ts's downloadShipmentList(): unlike
    // settlement-fees' scopeFor() (which compares and 403s on mismatch), this endpoint
    // has no E4110 comparison at all — it silently overwrites `partnerId` with the
    // caller's own JWT partnerId ("강제 스코프 우선 — findAll과 동일 정책") before ever
    // building the xlsx. So a cross-partner request does NOT 403; it succeeds (200)
    // and silently returns partner A's own shipment list instead of B's — verified via
    // the Content-Disposition filename, which the controller derives from the
    // (overwritten) partnerId variable. This is exactly the untested branch flagged in
    // task-13-review.md ("shipment-list/download's PARTNER_COORDINATOR-forcing ... has
    // no automated test coverage").
    expect(res.status()).toBe(200);
    const disposition = res.headers()['content-disposition'] ?? '';
    expect(disposition).toContain(`shipment-list-${a.partnerId}.xlsx`);
    expect(disposition).not.toContain(b.partnerId);
  });
});
