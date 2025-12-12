# Product Requirements Document (PRD)

## 1. Background & Problem Statement
- **Business context**: HQ transferred FDC delivery/installation support to branches, requiring a unified platform for assignment control, KPI governance, and real-time field issue resolution.
- **Current issues**: Spreadsheet/phone-based coordination creates delayed updates, KPI blind spots, and inconsistent documentation (e.g., ECOAS exports, waste pickup tracking).
- **Product vision**: Deliver a resilient **cross-platform app (Angular + Ionic + Capacitor)** that encapsulates every process from the 2017 logistics manual so branch + partner teams can execute end-to-end workflows from any secure browser (PWA), Android device, or iOS device with VPN access.

## 2. Target Platforms & Device Optimization
| Platform | Technology | Min Requirements | Notes |
| --- | --- | --- | --- |
| Web (PWA) | Chrome 90+, Safari 14+, Edge 90+ | Desktop/Mobile | Full offline support via Service Worker |
| Android | APK via Capacitor 6 | Android 8.0+ (API 26), 2GB RAM | Native push, camera access |
| iOS | IPA via Capacitor 6 | iOS 13+, iPhone 6s+ | Native push, TestFlight/App Store |

### Low-End Device Strategy
- **Target**: Budget Android devices (2GB RAM, 1.4GHz quad-core)
- **Optimizations**: Zoneless Angular, virtual scrolling, lazy loading, <150KB initial bundle, image compression

## 3. Personas & User Journeys
| Persona | Goals | Friction Today | App Opportunities |
| --- | --- | --- | --- |
| Branch Scheduler | Assign installers, change appointments, monitor daily completion. | Manual filters, late notifications, no mobile support. | Guided bulk assignment, instant push alerts (FCM), native mobile app experience. |
| Partner Ops Lead | Balance installer capacity, submit split orders, log waste pickups. | Lacks centralized view, cannot edit after site visits without HQ. | Self-service edit rights post-VPN, offline capture with camera for waste/serial data. |
| HQ Quality Manager | Audit KPIs and ECOAS outputs. | Receives inconsistent raw data, manual Excel cleanup. | Auto-generated exports, drill-down dashboards, immutable audit logs. |

### Core Journeys
1. **Assignment cycle**: Import new orders → filter by branch → assign installers → print pick lists → notify partners.
2. **Execution cycle**: Installer performs job → logs serial + waste pickup → branch verifies → statuses roll into dashboards.
3. **Exception cycle**: Customer reschedules/cancels → branch edits order → service worker pushes notification to installers → KPIs update.
4. **Reporting**: Branch/HQ run raw export (ECOAS, completion, pending) → download CSV/PDF for compliance.

## 3. Functional Scope
### 3.1 Assignment & Scheduling (Slides 4-7)
- Manage states: 미배정 → 배정 → 배정확정 → 출고확정 → 출문 → 인수/부분인수/회수/취소.
- Bulk operations: appointment changes, installer changes, split assignments, provisional (임시) assignments.
- Batch prints: 출고요청집계표, 출고요청 리스트, 배정 리스트.

### 3.2 Completion Processing (Slides 5, 15-18)
- Serial number capture per item.
- Waste appliance pickup logging with product codes (P01~P21 list).
- 출고확정, 출문처리, 특이사항 log, completion statuses.
- ECOAS raw export formatting.

### 3.3 Cancellation & Amendments (Slide 6)
- Allow 의뢰취소 before 출고확정.
- Allow center/installer reassignment when 상태=출문.
- Permit 미처리 revert + appointment change (당일+5).
- Special notes log.

### 3.4 Monitoring & Reporting (Slides 9-20)
- Customer history lookup (by vendor/branch/customer name).
- 진행현황 dashboards at all levels.
- 미완료, 설치완료, 폐가전 집계, 처리현황, 미환입, 배달/설치 raw data lists.
- Filtering combos exactly as manual (date bases, customer filters, product filters).

### 3.5 Unreturned Items Management (Slide 19) ✅ NEW
- 미환입 현황 (Cancelled orders pending item returns)
- Filter by date range, branch, return status (all/returned/unreturned)
- Summary cards showing total/unreturned/returned counts
- Branch-level aggregation with progress indicators
- Mark items as returned with audit trail

### 3.6 Split Orders (Slide 21)
- UI to split multi-item orders into multiple installer assignments with quantity control.
- Validation to ensure splits only occur for eligible orders and while assigned to branch.

### 3.7 Device Constraints & Edge Cases
- **Hardware back button**: Android hardware back must map to Ionic router stack rules (no accidental logout) and prompt before discarding unsaved forms.
- **App resume & killed-state recovery**: If the OS kills the app due to memory pressure, next launch must restore last screen and any unsent offline queue items.
- **Battery/data saver modes**: Detect when push/background sync is throttled and switch to polling fallback with banner warning.
- **Biometric quick login**: Optional Face ID / fingerprint unlock after initial credential login when device policy allows.
- **Per-device notification control**: Allow users to mute/enable categories per device so push storms on shared tablets can be managed.

## 4. Detailed Requirements
| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| FR-01 | Provide combined list view with filters for appointment date, branch code, status, installer. | Server returns <2s response for 10k records; view supports saved filters per user. |
| FR-02 | Allow batch appointment date edits with validation (<=+15 days). | Attempts beyond +15 prompt localized error; background job updates statuses and pushes notifications. |
| FR-03 | Support provisional assignment + confirmation flow. | 임시배정 items appear flagged; confirmation toggles state and triggers event log. |
| FR-04 | Capture manufacturing serial numbers per line item before completion. | Serial field required once 진행상태=인수; offline capture allowed with later sync. |
| FR-05 | Waste pickup entry with standard Pxx codes + quantity. | Multi-select UI, aggregated totals show in dashboard/export. |
| FR-06 | ECOAS export formatting. | CSV matches legacy ECOAS schema; download button respects VPN and requires timestamp watermark. |
| FR-07 | Customer history search. | Query by vendor/branch/name; results include at least last 12 months; export to CSV. |
| FR-08 | KPI dashboards. | Provide cards for 고객만족도, 약속방문준수율, 폐가전 회수율, 설치불량율 with territory filter. |
| FR-09 | Notifications/alarms. | Service worker push triggered for assignment changes, delays, rewrites; user can mute per category. |
| FR-10 | Split order workflow. | UI enforces quantity control, new child tasks inherit metadata, audit log captures actor/time. |
| FR-11 | Center-level progress dashboard. | Show installer-wise progress counts per status; drill-down to order list. |
| FR-12 | Settlement period management. | Weekly auto-lock; manual unlock requires HQ approval; locked orders not editable. |
| FR-13 | Postpone workflow (연기). | Capture reason code + new appointment; max +15 days; notify customer & installer. |
| FR-14 | Absence workflow (부재). | Log absence reason; auto-schedule retry visit; max 3 retries before escalation. |
| FR-15 | Confirmation certificate issuance tracking. | Filter by issued/not-issued; mark as issued on print. |
| FR-16 | Release summary by FDC (출고요청집계표). | Aggregate by FDC, model, quantity; printable PDF. |
| FR-17 | Concurrent edit protection. | Optimistic locking; show conflict dialog when version mismatch. |
| FR-18 | Bulk operation partial failure handling. | Return per-item success/failure; allow retry of failed items only. |
| FR-19 | Session timeout & re-auth. | 30min idle timeout; prompt re-login without losing unsaved form data. |
| FR-20 | File attachment per order. | Upload photos (max 5MB each, 10 per order); store in S3; display in order detail. |
| FR-21 | Mobile hardware back & resume handling. | Android hardware back respects guarded routes; unsaved data prompt appears; resume restores scroll/filter state. |
| FR-22 | Biometric quick login. | After opt-in, biometric prompt unlocks session without password if refresh token valid; fallback path logged. |
| FR-23 | Device-level notification preferences. | `/notifications/subscribe` captures deviceId/platform/token; UI toggles categories per device; server honors mute list when broadcasting. |
| FR-24 | Unreturned items tracking (미환입 현황). | GET `/reports/unreturned` returns cancelled orders with return status; POST `/reports/unreturned/{id}/return` marks as returned; branch-level summary; full audit trail. |

## 5. Non-Functional Requirements (개정)

### 5.1 Concurrency & Data Integrity
- **Distributed Lock (Redis)**: 배정 작업 시 주문 선점 방지 (TTL 3초)
- **Optimistic Locking**: orders.version 컬럼으로 충돌 감지
- **SLA**: 배정 완료 < 100ms, 충돌 감지 < 500ms

### 5.2 Notification System
- **개별 알림**: < 1초 (배정 확정 시 기사 1명)
- **대량 공지**: Throttling 50건/초 (FCM Rate Limit 준수)
- **아키텍처**: BullMQ 큐 기반, 별도 Worker 인스턴스
- **수신 확인**: read_at 타임스탬프로 수신율 추적

### 5.3 Low-Spec Device Optimization (2GB RAM)
- **성능**: P95 렌더링 < 60fps
- **번들 크기**: 초기 로딩 < 2MB (현재: 1.52MB)
- **Change Detection**: ChangeDetectionStrategy.OnPush (필수)
- **Virtual Scrolling**: 50개 이상 리스트에 필수
- **애니메이션**: transform/opacity만 허용, top/left 금지
- **이미지**: WebP + 1024px max, 클라이언트 압축

### 5.4 Offline Data Sync
- **Initial Load**: 로그인 시 오늘 ±3일 데이터만 IndexedDB 저장
- **Delta Sync**: 마지막 동기화 이후 변경된 데이터만 가져옴
- **Optimistic UI**: 사진 촬영 즉시 완료 표시, 백그라운드 업로드

### 5.5 Data Storage
- **PostgreSQL Partitioning**: Orders 테이블 월 단위 파티셔닝
- **Covering Index**: (status, promise_date, id, customer_name)
- **Redis Caching**: 마스터 데이터 24h, 대시보드 1분 단위

### 5.6 Deployment Infrastructure
- **API Servers**: 2대 (NLB)
- **Worker Server**: 1대 (BullMQ + FCM)
- **Database**: Primary + 1 Read Replica
- **Monitoring**: Slow Query > 1초 자동 로깅 + Slack 알림

## 6. Non-Functional Requirements (기존)
- **Concurrency**: Optimistic locking with version field; conflict resolution UI for critical field collisions.
- **Session Management**: 30-minute idle timeout; graceful re-auth preserving form state; JWT refresh 5 min before expiry.
- **Data Validation**: Phone (Korean mobile format), address (postal code lookup), serial number (alphanumeric 10-20 chars).
- **Bulk Operations**: Max 100 items per batch; partial success with detailed error list; idempotency key support.

## 6. Cross-Platform Offline & Alarm Features
1. **Installability**: Manifest with branch-specific icons; display install prompts for desktop/mobile.
2. **Precaching**: Use Angular Service Worker (`ngsw-config.json`) to precache shell + critical data with `installMode=prefetch` for assignment lists (see Architecture doc).
3. **Runtime caching**: Network-first with stale fallback for order APIs, cache-first for static assets and metadata dataGroups.
4. **Background sync**: Queue completion updates & waste entries while offline; auto retry when `sync` event fires; fall back to manual retry if Background Sync unsupported (iOS PWA).
5. **Push notifications**: Use Web Push (VAPID) for browser + FCM/APNs for native builds; categories for 재배정, 연체, 고객요청; if VPN blocks push, degrade to SMS/email.
6. **Alarm center UI**: Drawer shows unread alerts; clicking navigates to specific order; per-device mute applies to both Web and native tokens.
7. **Device resume watchdog**: Detect when app resumes after >30 min background and force data refresh with banner indicator.

## 7. Data & Reporting
- Provide raw exports for every manual-defined list (CSV, optionally XLSX).
- Provide printable PDFs for 출고요청, 설치확인서 using server-side template or client print CSS.
- Provide aggregated KPIs by branch/installer/time slice.

## 8. Release Plan (1 Month, Single Dev)
| Sprint (1 week) | Deliverables |
| --- | --- |
| Sprint 1 | Repo setup, .nvmrc/.java-version, base PWA scaffold, i18n, data model definition, Assignment list read-only.
| Sprint 2 | Full assignment CRUD, cancellation/amendment, split order backend, push notification skeleton.
| Sprint 3 | Completion processing, waste logging, ECOAS export, dashboards, printable docs.
| Sprint 4 | Offline/Serwist hardening, QA per TDD plan, UAT, deployment + training.

## 9. Success Metrics & Acceptance
- All manual features trace to at least one UI/test case.
- KPI dashboards validated with sample data.
- Offline tests simulate VPN drop and confirm background sync.
- Documentation (SDD/TDD) reviewed; regression automation >70% coverage of critical flows.

## 10. Risks & Mitigations
| Risk | Impact | Mitigation |
| --- | --- | --- |
| VPN-only access may block push notifications on mobile. | Missed alarms. | Use corporate push proxy or fall back to SMS/email bridging. |
| Single developer schedule. | Delivery slippage. | Aggressive scope triage + automation (codegen, UI templates). |
| No design system. | UI inconsistency. | Adopt lightweight token set + responsive grid early. |
| Offline data conflicts. | Data integrity issues. | Implement server-side conflict detection + manual merge UI per order history. |
| Concurrent edits to same order. | Data corruption. | Optimistic locking with version field; show conflict dialog; audit all resolutions. |
| State machine violations. | Invalid order states. | Strict server-side transition guards; client pre-validation; comprehensive E2E tests. |
| Settlement lock bypass. | Financial discrepancies. | Server-enforced lock checks; audit log for unlock attempts; HQ-only unlock permission. |
| IndexedDB quota exceeded. | Offline failure. | Monitor quota; auto-purge old data; alert user before limit. |
| WebSocket reconnect storms. | Server overload. | Exponential backoff; jitter; connection pooling on server. |
| iOS Safari PWA limitations. | Degraded UX on iPhone. | Detect Safari; show install guide; use polling fallback for push. |

## 11. Traceability to Manual
- Each slide requirement is mapped to FR IDs within an internal matrix (see Appendix A) to guarantee 1:1 coverage.
- Appendices include screenshot references (to be attached post-design) for stakeholder validation.
