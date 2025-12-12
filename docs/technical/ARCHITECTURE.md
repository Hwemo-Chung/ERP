# Architecture Plan

## 1. Solution Overview
```
[Client Apps (Angular 19 + Ionic 8 + Capacitor 6)]
    │           │           │
    │  PWA      │  Android  │  iOS
    │  (Web)    │  (APK)    │  (IPA)
    │           │           │
    └───────────┼───────────┘
                │ HTTPS over corporate VPN
[API Gateway (NestJS)]
    │
[Application Services]
    ├─ Assignment Service
    ├─ Completion & Waste Service
    ├─ Reporting Service
    └─ Notification Service
    │
[PostgreSQL 15]  [Redis 7]  [Object Storage for exports]
```
- **Frontend**: Angular 19 (Standalone Components + Signals) with Ionic 8 UI, Capacitor 6 for native access, @ngx-translate for i18n.
- **State Management**: NgRx SignalStore for reactive state, Dexie.js for IndexedDB offline storage.
- **Service Worker**: @angular/pwa for precaching, runtime caching, background sync.
- **Backend**: NestJS (Node 20 LTS) exposes REST APIs; uses Prisma ORM to PostgreSQL; Redis handles queues + session tokens.
- **Infrastructure**: Containerized via Docker, deployed to on-prem K8s or cloud cluster accessible via VPN. Object storage (S3-compatible) stores PDF/CSV exports.

## 2. Frontend Architecture (Angular + Ionic)
- **Routing**: Angular Router with guards for role-based access (branch/partner/HQ). Lazy loading all feature modules.
- **State Management**:
  - NgRx SignalStore for server state with computed selectors.
  - Signals for local UI state (filters, dialogs).
  - Dexie.js for IndexedDB persistence (offline-first).
- **UI Layer**: Ionic 8 components (ion-list, ion-card, ion-modal) with CSS variables for theming. Virtual scrolling for large lists via @angular/cdk.
- **i18n**: @ngx-translate/core with locale JSON split; default Korean, fallback English.
- **Form Handling**: Angular Reactive Forms + custom validators.
- **Charts**: ngx-echarts for KPI cards.
- **Performance**: Zoneless Angular (ChangeDetectionStrategy.OnPush everywhere), trackBy on all *ngFor.

## 3. Service Worker Strategy (@angular/pwa)
- **Precaching**: ngsw-config.json defines app shell assets in `assetGroups` with `prefetch` mode for critical resources.
- **Runtime caching**: `dataGroups` with `freshness` strategy for /api/orders, `performance` strategy for metadata endpoints.
- **Background Sync**: Custom sync service using Background Sync API with Dexie.js offline queue for order completions.
- **Update flow**: SwUpdate service detects new version, display toast via Ionic ToastController, user triggers `activateUpdate()`.
- **Platform Sync**: On Capacitor (native), use @capawesome/capacitor-app-update for in-app updates.

## 4. Backend Architecture
- **Services**:
  - Assignment Service: order ingestion, state machine enforcement, split logic.
  - Completion Service: serial capture, waste logging, ECOAS formatting.
  - Reporting Service: SQL views for dashboards, export generation jobs.
  - Notification Service: FCM for Android/iOS push, Web Push/VAPID for PWA, email/SMS fallback.
- **Data Contracts**: REST JSON; consider GraphQL for future multiclient but out-of-scope for v1.
- **Validation**: Class-validator w/ DTOs; central error handler.
- **Auth**: VPN-level IP allowlist + JWT auth; password stored with Argon2. Roles: HQ_ADMIN, BRANCH_MANAGER, PARTNER_COORDINATOR, INSTALLER.

### 4.1 Concurrency Control Strategy (동시성 제어)
**Problem**: 관리자 10명이 동시에 배정, 기사 500명이 동시에 완료 처리 → 데이터 충돌 위험

**Solution - Dual Strategy**:

#### 1단계: 배정 작업 (Redis Distributed Lock - Pessimistic)
```
주문 선점 방지 → 먼저 선점한 요청만 처리
Key: order:{orderId}:lock, TTL: 3초, Op: SETNX

흐름:
1. SETNX order:123:lock → 성공
2. 배정 처리 진행
3. DEL order:123:lock

실패 시: "이미 처리 중인 주문입니다" 에러
```

#### 2단계: 데이터 수정 (Optimistic Locking - DB)
```sql
ALTER TABLE orders ADD COLUMN version INT DEFAULT 1;

UPDATE orders 
SET status='RELEASED', version=version+1 
WHERE id=123 AND version=5;

-- Affected Rows=0 → 누군가 이미 수정함 → 사용자에게 "데이터가 변경되었습니다. 새로고침하세요" 알림
```

**SLA**: 배정 완료 < 100ms, 충돌 감지 < 500ms

### 4.2 Notification System Architecture
**Scale**: 500명 동시 수신 → Throttling 필수

```
API Server
    ↓
Message Queue (BullMQ)
    ↓
Notification Worker (별도 인스턴스)
    ↓
FCM (Firebase Cloud Messaging)
```

**3가지 발송 패턴**:
- **개별 알림**: 배정 확정 1명 → 즉시, SLA < 1초
- **대량 공지**: 500명 대상 → 50건/초 Throttling (FCM Rate Limit 준수)
- **수신 확인**: 기사 클릭 → read_at 타임스탬프 기록 (수신율 통계용)

## 5. Data Storage
- **PostgreSQL tables** (see Database Schema doc) normalized with audit triggers.
  - **Partitioning**: Orders 테이블은 월 단위 파티셔닝 (예: orders_2025_01, orders_2025_02)
  - **Covering Index**: installer_id, status, promise_date 복합 인덱스 + 필드별 인덱스
- **Redis**: 
  - Master data (코드, 센터, 품목) 영구 캐싱 (1일 1회 갱신)
  - Dashboard 통계 1분 단위 집계 캐싱
  - 배정 작업용 분산 락 (3초 TTL)
- **Object Storage**: signed URLs for downloads, auto expiration (7 days).

## 6. Integration & External Systems
- **VPN**: All requests originate within VPN; provide health endpoint accessible internally.
- **Push gateway**: For Web Push across VPN, set up corporate reverse proxy to expose VAPID endpoint.
- **ECOAS**: Provide manual download; future automation possible.

## 7. Observability & Operations
- Structured logging via pino (backend) and browser tracing via Sentry.
- Metrics: Prometheus scraping NestJS metrics endpoint; dashboards in Grafana.
- Tracing: OpenTelemetry instrumentation for API calls.

## 8. Security Considerations
- Enforce TLS 1.2+ even within VPN.
- Rate limit login & sensitive endpoints (Redis-based sliding window).
- Encrypt secrets with Vault/KMS; .env never committed.
- Implement data retention policy (minimum 5 years for audit logs).

## 9. Scaling Plan
- App servers horizontally scalable behind load balancer.
- Use read replicas for PostgreSQL to offload reporting.
- Future modules (inventory, billing) can reuse same architecture by adding bounded contexts/microservices.

## 10. Order State Machine
The order lifecycle follows a strict state machine. Invalid transitions must be rejected by the API.

```
                         ┌──────────────┐
                         │   미배정      │  (Initial)
                         └──────┬───────┘
                                │ assign
                         ┌──────▼───────┐
                         │    배정       │
                         └──────┬───────┘
                                │ confirm
                         ┌──────▼───────┐
                         │  배정확정     │
                         └──────┬───────┘
                                │ release
                         ┌──────▼───────┐
                         │  출고확정     │
                         └──────┬───────┘
                                │ dispatch
                         ┌──────▼───────┐
       ┌─────────────────┤    출문       ├─────────────────┐
       │                 └──────┬───────┘                 │
       │ postpone               │ complete                │ cancel
┌──────▼───────┐         ┌──────▼───────┐         ┌──────▼───────┐
│    연기       │         │    인수       │         │    취소       │
└──────────────┘         └──────────────┘         └──────────────┘
       │                         │
       │ retry                   │ partial
┌──────▼───────┐         ┌──────▼───────┐
│    부재       │         │  부분인수     │
└──────────────┘         └──────────────┘
                                │
                                │ collect
                         ┌──────▼───────┐
                         │    회수       │
                         └──────────────┘
```

### Transition Guard Conditions
| From | To | Guard |
| --- | --- | --- |
| 미배정 | 배정 | installer_id provided |
| 배정 | 배정확정 | confirmation by branch staff |
| 배정확정 | 출고확정 | appointment_date = today |
| 출고확정 | 출문 | items picked, truck loaded |
| 출문 | 인수 | serial_number captured, customer signed |
| 출문 | 연기 | reason_code in (CUSTOMER_REQUEST, INSTALLER_ISSUE) |
| 출문 | 부재 | customer_absent = true, retry_count < 3 |
| 출문 | 취소 | cancel_reason provided, before delivery |
| 인수 | 회수 | waste_pickup logged |

### Revert Rules
- 완료 상태(인수/회수/취소)에서 미처리 복원: `당일 + 5일` 이내만 허용
- 약속일자 변경: `최초약속일 + 15일` 이내만 허용
- 센터/설치자 변경: 상태가 `출문`인 경우만 허용

## 11. Offline Conflict Resolution
### Strategy: Optimistic Locking + Last-Write-Wins with Manual Merge UI

**Version Field**: Every `orders` row has a `version` integer. On update:
```sql
UPDATE orders SET status = :new, version = version + 1
WHERE id = :id AND version = :expected;
-- If rowcount = 0 → conflict detected
```

**Client Sync Flow**:
1. User makes offline edit → stored in IndexedDB `offline_queue` with `expectedVersion`.
2. On reconnect, Background Sync fires → POST/PATCH sent with `expectedVersion`.
3. Server responds:
   - `200 OK` → queue item removed.
   - `409 Conflict` → returns `currentVersion`, `serverState`.
4. If conflict:
   - Simple fields (notes, appointment_date): **Last-Write-Wins** with user notification.
   - Critical fields (status, installer): **Manual Merge UI** shown.

**Merge UI**:
- Side-by-side diff: Your Change vs Server State.
- User picks per-field or accepts one version entirely.
- Conflict resolution logged in `audit_logs`.

**Conflict Detection Window**: Background sync retries every 30s (max 5 attempts), then surfaces conflict alert.

## 12. Cache Invalidation Strategy
### Layers
| Layer | Tool | TTL | Invalidation Trigger |
| --- | --- | --- | --- |
| API Response | Redis | 60s | Order state change event |
| KPI Dashboard | Redis | 5min | Cron job or order completion event |
| Static Assets | CDN/SW | 7d | Build hash change |
| Order List (client) | TanStack Query | 30s stale | `queryClient.invalidateQueries(['orders'])` |

### Event-Driven Invalidation
- Order status change → Publish `order.updated` event to Redis Pub/Sub.
- Subscribers: Reporting Service invalidates KPI cache keys; Notification Service triggers push.
- Client receives WebSocket message → triggers query invalidation.

### Cache Key Design
```
orders:list:{branchCode}:{status}:{date}:{page}
kpi:summary:{level}:{branchCode}:{date}
user:session:{userId}
```

## 13. IndexedDB Offline Schema
```typescript
interface OfflineDB {
  // Stores
  orders: {
    key: string; // order_id
    value: Order;
    indexes: ['branchCode', 'status', 'appointmentDate'];
  };
  installers: {
    key: string;
    value: Installer;
    indexes: ['branchCode'];
  };
  offline_queue: {
    key: number; // autoIncrement
    value: {
      id: number;
      operation: 'CREATE' | 'UPDATE' | 'DELETE';
      endpoint: string;
      payload: unknown;
      expectedVersion?: number;
      createdAt: string;
      retryCount: number;
      lastError?: string;
    };
  };
  sync_metadata: {
    key: string; // 'lastSync'
    value: { timestamp: string; branchCode: string };
  };
}
```

### Quota Management
- Target: 50MB per branch (≈3 days of orders).
- On quota warning (navigator.storage.estimate): Purge orders older than 7 days.
- Critical data (offline_queue) never purged until synced.

## 14. Real-Time Updates (WebSocket)
### Connection Management
- Endpoint: `wss://<vpn-domain>/ws`
- Auth: JWT in `Sec-WebSocket-Protocol` header.
- Heartbeat: Client sends `ping` every 30s; server responds `pong`.
- Reconnect: Exponential backoff (1s, 2s, 4s, 8s, max 30s).

### Event Types
```typescript
type WSEvent =
  | { type: 'ORDER_UPDATED'; payload: { orderId: string; newStatus: string } }
  | { type: 'ASSIGNMENT_CHANGED'; payload: { orderId: string; installerId: string } }
  | { type: 'NOTIFICATION'; payload: Notification }
  | { type: 'FORCE_REFRESH'; payload: { reason: string } };
```

### Multi-Tab Coordination
- Use `BroadcastChannel('erp-sync')` to share WebSocket connection across tabs.
- Leader election: First tab becomes leader, others listen via BroadcastChannel.

## 15. Error Boundary Architecture
```
App
├── RootErrorBoundary (catches unhandled, shows "Something went wrong")
│   ├── AuthErrorBoundary (catches 401 → redirect to login)
│   │   ├── RouteErrorBoundary (catches route-level errors → "Page error")
│   │   │   ├── DataGridErrorBoundary (catches grid errors → "Table error, retry")
│   │   │   └── FormErrorBoundary (catches form errors → inline message)
```

### Fallback Components
- `ErrorFallback`: Generic retry button + error code for support.
- `OfflineFallback`: "You're offline. Showing cached data."
- `MaintenanceFallback`: "System under maintenance. ETA: X"

## 16. Circuit Breaker Pattern
For external dependencies (Push Gateway, future integrations):
```typescript
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 30000, // 30s
  monitorInterval: 10000,
});

async function sendPush(payload: PushPayload) {
  return circuitBreaker.execute(() => pushGateway.send(payload));
}
// States: CLOSED → OPEN (after 5 failures) → HALF_OPEN (after 30s) → CLOSED/OPEN
```
