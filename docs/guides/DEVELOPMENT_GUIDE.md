# Development Guide

## 1. Environment Setup
1. Install zsh + Homebrew dependencies (Node 20.18.x, pnpm 9.x, PostgreSQL 15, Redis 7).
2. Run `nvm install 20.18.0` then `nvm use` (see `.nvmrc`).
3. Ensure Java 17 via `jenv` (see `.java-version`) for Android builds with Gradle.
4. Copy `.env.example` → `.env` and fill secrets (DB URL, Redis URL, FCM keys). Never commit `.env`.
5. Install Ionic CLI: `npm install -g @ionic/cli`
6. Install Angular CLI: `npm install -g @angular/cli`
7. Run `pnpm install`, `ionic serve` for frontend, `pnpm start:dev` (backend) after `prisma migrate dev`.
8. For native builds: 
   - Android: Install Android Studio, SDK 33+, accept licenses
   - iOS: Install Xcode 15+, CocoaPods

## 2. Repository Structure (planned)
```
apps/
  mobile/       # Angular + Ionic + Capacitor
    ├── src/
    │   ├── app/
    │   │   ├── core/       # Auth, API, Storage services
    │   │   ├── shared/     # Reusable components
    │   │   ├── store/      # NgRx SignalStore
    │   │   └── pages/      # Feature modules (lazy loaded)
    │   ├── assets/
    │   │   └── i18n/       # ko.json, en.json
    │   └── theme/          # Ionic CSS variables
    ├── android/            # Capacitor Android project
    ├── ios/                # Capacitor iOS project
    └── capacitor.config.ts
  api/          # NestJS
packages/
  ui/           # Shared Ionic components (if needed)
  config/       # eslint, tsconfig
infra/
  db/           # migrations
  scripts/
``` 

## 3. Coding Conventions
- TypeScript strict mode.
- ESLint + Prettier; commit hooks via Husky + lint-staged.
- Use path aliases (`@app/core/...`, `@app/shared/...`).
- Avoid Korean strings in code; all user-facing text via i18n keys (@ngx-translate).
- Write unit tests before committing per TDD cadence (Jasmine/Karma for Angular, Jest for NestJS).
- Use Standalone Components (no NgModules except SharedModule).
- Use Signals for reactive state, avoid manual subscriptions where possible.

## 4. Build & Run Commands
| Purpose | Command |
| --- | --- |
| Web dev server | `ionic serve --configuration=development` |
| Production web build | `ionic build --configuration=production` |
| Sync Capacitor native projects | `npx cap sync` |
| Open Android Studio | `npx cap open android` |
| Open Xcode workspace | `npx cap open ios` |
| Run on Android device | `ionic capacitor run android --device --livereload` |
| Run on iOS simulator | `ionic capacitor run ios -l --external` |
| Generate Android release bundle | `cd android && ./gradlew bundleRelease` |
| Archive iOS build | `cd ios/App && xcodebuild -scheme App -configuration Release archive` |

### Signing & Secrets
- Android keystore path + alias managed via `gradle.properties`; never commit keystore.
- iOS signing handled through Xcode automatic signing with the corporate team ID; provisioning profiles stored in secure repo.
- `capacitor.config.ts` reads environment-specific API base URLs via `APP_ENV` build-time token.

## 5. QA Matrix & Edge Cases
| Scenario | Platform | Checklist |
| --- | --- | --- |
| Offline completion & sync | Web PWA, Android | Toggle airplane mode, submit completion, ensure queue drains when back online. |
| Hardware back navigation | Android | Verify guarded routes, double-back exit on root tab only. |
| App resume after OS kill | Android (low RAM), iOS | Simulate kill via dev tools; ensure orders list reloads and unsynced data persists. |
| Background push throttling | Android battery saver, iOS Focus | Confirm banner warning + polling fallback kicks in. |
| Biometric login | Android (Fingerprint), iOS (Face ID) | Validate opt-in/out flow and fallback to password after failures. |
| Attachment capture | Android/iOS camera & gallery | Test compression, 5MB limit, offline storage.
| Settlement lock race | Web PWA | Attempt edit during lock window, confirm `E2002` UI.

- Record results in TestRail (or spreadsheet) per release; attach screenshots or screen recordings for regressions.
- Use Playwright for PWA smoke tests and Appium for native smoke flows (assignment, completion, notification acknowledgement).

## 3.1 Error Handling Standards
### Error Code System
| Range | Category | Example |
| --- | --- | --- |
| E1xxx | Authentication/Authorization | E1001: INVALID_CREDENTIALS, E1002: TOKEN_EXPIRED, E1003: INSUFFICIENT_PERMISSIONS |
| E2xxx | Business Rule Violation | E2001: INVALID_STATUS_TRANSITION, E2002: SETTLEMENT_LOCKED, E2003: APPOINTMENT_DATE_EXCEEDED |
| E3xxx | Data Validation | E3001: REQUIRED_FIELD_MISSING, E3002: INVALID_FORMAT, E3003: DUPLICATE_ENTRY |
| E4xxx | External System | E4001: PUSH_GATEWAY_ERROR, E4002: STORAGE_UPLOAD_FAILED |
| E5xxx | System/Infrastructure | E5001: DATABASE_CONNECTION_FAILED, E5002: REDIS_TIMEOUT |

### Error Response Shape
```typescript
interface ApiError {
  timestamp: string;
  path: string;
  error: string;       // Error code (e.g., E2001)
  message: string;     // i18n key (e.g., "error.invalid_status_transition")
  details?: Record<string, unknown>; // Additional context
  traceId: string;     // For support correlation
}
```

### Frontend Error Handling (Angular + Ionic)
```typescript
// Global Error Handler
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(
    private toastCtrl: ToastController,
    private translate: TranslateService,
    private sentry: SentryService
  ) {}

  handleError(error: unknown): void {
    const apiError = error as ApiError;
    
    // Show user-friendly toast
    const messageKey = `errors.${apiError?.error}` || 'errors.generic';
    this.translate.get(messageKey).subscribe(async (msg) => {
      const toast = await this.toastCtrl.create({
        message: msg,
        duration: 3000,
        color: 'danger',
        position: 'top'
      });
      await toast.present();
    });
    
    // Log to Sentry
    this.sentry.captureException(error);
  }
}

// HTTP Interceptor for API errors
@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        // Handle 409 Conflict (version mismatch) specially
        if (error.status === 409) {
          // Trigger refresh and retry flow
        }
        return throwError(() => error.error);
      })
    );
  }
}
```

## 3.2 Logging Standards
### Log Levels
| Level | Usage |
| --- | --- |
| ERROR | Unexpected failures requiring attention |
| WARN | Recoverable issues, deprecated usage |
| INFO | Significant business events (order status change, login) |
| DEBUG | Development troubleshooting (disabled in prod) |

### Required Fields
```typescript
interface LogEntry {
  timestamp: string;     // ISO 8601
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  correlationId: string; // Request trace ID
  userId?: string;       // Authenticated user
  action: string;        // e.g., "order.status.update"
  details: Record<string, unknown>;
}
```

### PII Masking Rules
- Phone numbers: `010-****-5678`
- Email: `a***@example.com`
- Address: Log city/district only, not full address.
- Serial numbers: Full (not PII).

### Example
```typescript
logger.info({
  action: 'order.status.update',
  correlationId: req.headers['x-correlation-id'],
  userId: user.id,
  details: {
    orderId: order.id,
    previousStatus: order.status,
    newStatus: 'COMPLETED',
    customerPhone: maskPhone(order.customerPhone),
  },
});
```

## 3.3 Security Coding Guidelines
### OWASP Top 10 Mitigations
| Threat | Mitigation |
| --- | --- |
| SQL Injection | Use Prisma parameterized queries; never concatenate user input. |
| XSS | Angular templates auto-escape; never bypass `DomSanitizer` unless necessary; sanitize any dynamic HTML. |
| CSRF | SameSite=Strict cookies; verify Origin header on mutations. |
| Broken Auth | JWT short expiry (1h); refresh token rotation; rate limit login. |
| Sensitive Data Exposure | Encrypt at rest (DB); TLS in transit; mask PII in logs. |
| Broken Access Control | RBAC middleware; verify branch_id ownership in queries. |

### Secure Coding Checklist
- [ ] No secrets in code or logs.
- [ ] Validate all user inputs (class-validator DTOs backend, Angular reactive form validators frontend).
- [ ] Sanitize file uploads (type, size, content).
- [ ] Use HTTPS-only cookies.
- [ ] Implement rate limiting on sensitive endpoints.

## 3.4 Code Review Checklist
### Functionality
- [ ] Meets acceptance criteria from FR/PRD.
- [ ] Edge cases handled (empty states, max limits).
- [ ] Error messages are user-friendly (i18n keys).

### Security
- [ ] No SQL injection vectors.
- [ ] No XSS vulnerabilities.
- [ ] Authorization checks present.
- [ ] Sensitive data not logged.

### Performance
- [ ] No N+1 queries (use Prisma `include`).
- [ ] Large lists virtualized or paginated (`cdk-virtual-scroll-viewport`).
- [ ] Images optimized (`ngOptimizedImage`, responsive srcset).
- [ ] Components use `ChangeDetectionStrategy.OnPush` + `trackBy` for lists.

### Accessibility
- [ ] Interactive elements keyboard-accessible.
- [ ] ARIA labels on icons/buttons.
- [ ] Color contrast meets WCAG AA.
- [ ] Form inputs have labels.

### Internationalization
- [ ] All user-facing strings use i18n keys.
- [ ] Date/number formatting via i18n.
- [ ] Layout handles text expansion (30%).

### Testing
- [ ] Unit tests for new logic.
- [ ] Integration test for API changes.
- [ ] E2E test for critical paths.
- [ ] Test coverage meets target.

## 3.5 Performance Optimization Guidelines
### Angular Components
- Default to `ChangeDetectionStrategy.OnPush` + Signals for state to minimize re-render cost.
- Use `trackBy` on every `*ngFor`; prefer `@for` syntax where available for compilation hints.
- Virtualize lists >50 rows via `cdk-virtual-scroll-viewport` or Ionic's `ion-virtual-scroll`.
- Lazy load standalone feature routes and modal components with `loadComponent`.

### Data Fetching
- Use NgRx SignalStore + HttpClient for caching/deduplication; store query metadata in IndexedDB for offline mode.
- Configure polling vs push updates per module (orders poll every 60s if WebSocket unavailable).
- Prefetch data when navigating between tabs using Ionic lifecycle hooks (`ionViewWillEnter`).

### Bundle
- Analyze bundle with `ng build --configuration=production --stats-json` + `npx source-map-explorer dist/browser/*.js`.
- Ensure initial chunk <150KB gzip; move heavy deps (charts, pdf) to stand-alone lazy modules.
- Prefer native APIs over large polyfills; tree-shake moment by using `date-fns` or Intl APIs.

### Images
- Use `ngOptimizedImage` with `priority` for above-fold content and Ionic skeletons.
- Serve WebP/AVIF with PNG fallback for legacy browsers.
- Lazy load below-fold images and camera previews via `IntersectionObserver` directive.

## 4. SDD Outline
- **Context & Diagrams**: Reference `ARCHITECTURE.md` high-level view + C4 diagrams (Level 2 & 3).
- **Module Design**:
  - Assignment module: state machine diagram, sequence for batch updates.
  - Completion module: offline queue interactions, ECOAS formatting pipeline.
  - Notification module: push subscription flow, retry/backoff design.
- **Data Contracts**: Document DTO schemas (aligned with `API_SPEC.md`).
- **Security**: Auth sequence diagrams, RBAC matrix.
- **Error Handling**: Standardized error codes/resolution mapping.

## 5. TDD Strategy
| Layer | Tools | Coverage Goals |
| --- | --- | --- |
| Domain logic | Jest (api) | 90% for state machine + split logic. |
| API endpoints | Supertest + Pact contract tests. | 80% critical endpoints. |
| Frontend | Jasmine/Karma + Spectator + Playwright. | 70% for critical flows, 3 E2E happy paths. |
| Service worker | `@angular/service-worker/testing` harness + integration spec. | Validate precache manifest & background sync queue. |

Test cadence:
1. Write failing unit test for requirement (derived from PRD FR IDs).
2. Implement logic until green.
3. Add integration/E2E scenario.
4. Link test IDs back to requirements matrix for traceability.

### Test Types & Schedule
| Type | Trigger | Duration | Scope |
| --- | --- | --- | --- |
| Unit | Every commit (CI) | <2 min | Single function/component |
| Integration | Every PR | <5 min | API endpoint + DB |
| E2E (Smoke) | Every deploy | <3 min | 5 critical paths |
| E2E (Full) | Nightly | <30 min | All user journeys |
| Performance | Weekly | <15 min | k6 load test (200 users) |
| Accessibility | Every PR | <2 min | axe-core automated scan |
| Security | Weekly | <10 min | OWASP ZAP scan |

### Test Data Management
- Use Faker.js for realistic seed data.
- Isolate tests with transaction rollback (Prisma `$transaction`).
- Maintain anonymized production data subset for staging.

### PWA-Specific Tests
1. **Offline read**: Disconnect network → verify order list from IndexedDB.
2. **Offline write**: Submit completion offline → verify queued in IndexedDB.
3. **Sync on reconnect**: Restore network → verify sync completes.
4. **Conflict handling**: Simulate version mismatch → verify merge UI appears.
5. **Push notification**: Mock push event → verify notification displays.
6. **Install prompt**: Verify manifest criteria met → install banner shows.

### Contract Testing (Pact)
```typescript
// Consumer (frontend) defines expected API shape
const interaction = {
  state: 'orders exist',
  uponReceiving: 'a request for orders',
  withRequest: { method: 'GET', path: '/api/v1/orders', query: { branchCode: 'B001' } },
  willRespondWith: { status: 200, body: { data: eachLike(orderShape) } },
};

// Provider (backend) verifies against contract
pact.verify({ providerBaseUrl: 'http://localhost:3001' });
```

## 6. Branching & Workflow
- `main` (protected) ← `develop` ← feature branches (`feat/<module>`).
- Require PR review (self + checklist since single dev) and CI green.
- Use Conventional Commits for clarity.
- No commits without explicit approval per governance policy.

## 7. Tooling & Automation
- **CI**: GitHub Actions (lint, test, build, PWA audit via Lighthouse CI).
- **CD**: Argo CD or GitHub Actions deploy to staging/prod clusters.
- **Static Analysis**: SonarQube for code smells/security.
- **Docs**: Keep `.doc` Markdown updated per milestone; auto-publish to internal wiki.

## 8. Observability & Alerts
- Integrate Sentry for frontend/backend error capture.
- Prometheus + Grafana for metrics; set alerts for API latency, background sync queue depth, push failures.

## 9. QA & Sign-off Checklist
- Requirement coverage matrix complete.
- Lighthouse PWA score ≥ 90 (desktop/mobile) under VPN simulation.
- Offline tests executed (airplane mode) for assignment list and completion submission.
- Push notifications validated on Android Chrome + iOS Safari (fallback if not supported).
- Documentation: PRD, SDD, TDD summaries stored in `.doc` and shared.
