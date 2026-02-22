# Platform-Specific Services

> 이 문서는 `packages/shared/`로 추출되지 않은, 플랫폼별로 고유한 서비스들을 설명합니다.
> 각 서비스가 공유되지 않는 이유와 플랫폼 의존성을 명시합니다.

---

## Web 전용 서비스 (`apps/web/`)

### `background-sync.service.ts`

- **역할**: Service Worker 기반 백그라운드 동기화 관리
- **플랫폼 의존성**: `@angular/service-worker` (`SwUpdate`), `ServiceWorkerRegistration` API
- **공유 불가 사유**: Web은 Service Worker + Background Sync API를 사용하고, Mobile은 Capacitor 네이티브 스레드 기반으로 동작하여 구현 방식이 근본적으로 다름
- **비고**: Mobile에도 `background-sync.service.ts`가 있으나, 동일한 SwUpdate 기반으로 동작 (향후 Capacitor Background Task로 마이그레이션 가능)

### `offline-sync.service.ts`

- **역할**: ±3일 정책 기반 오프라인 데이터 델타 동기화
- **플랫폼 의존성**: IndexedDB (`Dexie`), `HttpClient`
- **공유 불가 사유**: Web 전용 오프라인 정책 구현. Mobile은 Capacitor Preferences와 별도 동기화 전략 사용

### `biometric.service.ts`

- **역할**: 생체 인증 (Face ID / Fingerprint) 빠른 로그인
- **플랫폼 의존성**: `@capacitor/core` (`Capacitor`), `capacitor-native-biometric` (`NativeBiometric`)
- **공유 불가 사유**: Capacitor 네이티브 플러그인 직접 호출. Web에서는 WebAuthn으로 대체 가능하나 현재 Capacitor 기반으로 구현됨
- **비고**: Web에 위치하지만 Capacitor 플러그인을 사용하므로 PWA/하이브리드 앱 컨텍스트에서 동작

### `camera.service.ts`

- **역할**: 사진 촬영 (설치 완료 증빙)
- **플랫폼 의존성**: `@capacitor/camera` (동적 import), `@ionic/angular` (`ActionSheetController`)
- **공유 불가 사유**: 네이티브 카메라 vs 웹 file input 분기 로직이 플랫폼마다 다름
- **비고**: Web에도 `camera.service.ts`가 있으며 동일한 Capacitor 기반

### `image-optimization.service.ts`

- **역할**: 이미지 리사이징, WebP 변환, 품질 조정, 캐싱
- **플랫폼 의존성**: Canvas API, `LocalStorage`
- **공유 불가 사유**: Web 전용 Canvas 기반 최적화. Mobile은 네이티브 이미지 처리 또는 Capacitor 플러그인 활용 가능

### `app-init.service.ts`

- **역할**: 앱 부트스트래핑 (Auth → Network → Sync → SW Update 순서)
- **플랫폼 의존성**: `@angular/service-worker` (`SwUpdate`), `@ngx-translate/core` (`TranslateService`)
- **공유 불가 사유**: 초기화 순서와 의존 서비스가 플랫폼마다 다름 (Web: SwUpdate + TranslateService, Mobile: TranslationService + Capacitor)

---

## Mobile 전용 서비스 (`apps/mobile/`)

### `translation.service.ts`

- **역할**: 다국어 지원 (ko/en) — Capacitor Preferences 기반 언어 저장
- **플랫폼 의존성**: `@capacitor/preferences` (`Preferences`), `HttpClient`
- **공유 불가 사유**: Web은 `@ngx-translate/core`를 사용하고, Mobile은 Capacitor Preferences 기반 커스텀 구현
- **비고**: Web은 `TranslateService` (ngx-translate), Mobile은 자체 `TranslationService`로 완전히 다른 구현

### `background-sync.service.ts`

- **역할**: 백그라운드 동기화 (Web과 유사하지만 자체 `SyncOperation` 타입 사용)
- **플랫폼 의존성**: `@angular/service-worker` (`SwUpdate`)
- **공유 불가 사유**: Mobile 전용 `SyncOperation` 인터페이스 사용, Web의 `SyncQueueEntry` 타입과 구조가 다름. 향후 Capacitor Background Task로 전환 예정

### `app-init.service.ts`

- **역할**: 앱 부트스트래핑 (Translation → Auth → Network → Sync → SW 순서)
- **플랫폼 의존성**: `TranslationService` (Mobile 전용), `SwUpdate`
- **공유 불가 사유**: Mobile은 `TranslationService`를 먼저 초기화하는 반면, Web은 `TranslateService`가 별도 모듈로 제공됨

---

## 양쪽 모두 존재하지만 다른 구현 (`apps/web/` + `apps/mobile/`)

### `sync-queue.service.ts`

- **Web**: `HttpClient` + `Dexie` 기반, 간단한 enqueue/dequeue
- **Mobile**: `HttpClient` + `Dexie` + `ModalController` (충돌 해결 UI), `SyncConflictModal` 연동, chunk 처리
- **공유 불가 사유**: Mobile은 충돌 감지 시 사용자 UI 인터랙션 (`SyncConflictModal`) 필요. Web은 자동 재시도만 수행

### `auth.service.ts`

- **상태**: `BaseAuthService`를 상속 (Wave 3 T10에서 추상화 완료)
- **Web 고유**: `refreshAccessToken()` (생체 인증 연동), `TranslateService` 사용
- **Mobile 고유**: `_refreshPromise` (동시 갱신 방지), `isTokenExpired()`, `_isLoggingOut`, `_initialized` 플래그
- **비고**: 공통 로직은 `BaseAuthService`로 추출 완료. 나머지는 플랫폼 고유 동작

### `reports.service.ts`

- **상태**: `BaseReportsService`를 상속 (Wave 3 T13에서 추상화 완료)
- **Mobile 고유**: `transformProgressData()`, `returnStatus` 필터, `LoggerService` 주입
- **비고**: 공통 타입과 기본 API 호출은 `BaseReportsService`로 추출 완료

---

## 공유 완료된 서비스 (참고)

아래 서비스들은 `packages/shared/`로 성공적으로 추출되었습니다:

| 서비스                      | 파일                                                             | Wave    |
| --------------------------- | ---------------------------------------------------------------- | ------- |
| `LoggerService`             | `packages/shared/src/services/logger.service.ts`                 | 1 (T01) |
| `SettlementService`         | `packages/shared/src/services/settlement.service.ts`             | 1 (T01) |
| `WebSocketService`          | `packages/shared/src/services/websocket.service.ts`              | 1 (T01) |
| `NotificationsService`      | `packages/shared/src/services/notifications.service.ts`          | 2 (T05) |
| `NetworkService`            | `packages/shared/src/services/network.service.ts`                | 2 (T06) |
| `BarcodeScannerService`     | `packages/shared/src/services/barcode-scanner.service.ts`        | 2 (T07) |
| `ResponsiveLayoutService`   | `packages/shared/src/services/responsive-layout.service.ts`      | 3 (T12) |
| `BaseAuthService`           | `packages/shared/src/services/base-auth.service.ts`              | 3 (T10) |
| `BaseReportsService`        | `packages/shared/src/services/reports.service.ts`                | 3 (T13) |
| `BaseSignaturePadComponent` | `packages/shared/src/components/base-signature-pad.component.ts` | 3 (T11) |
| `UIStore`                   | `packages/shared/src/store/ui.store.ts`                          | 1 (T02) |
| `ordersUtils`               | `packages/shared/src/store/orders.utils.ts`                      | 2 (T08) |
