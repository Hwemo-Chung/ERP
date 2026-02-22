# @erp/shared

> ERP Logistics 공유 패키지 — Web과 Mobile 앱 간 공통 코드

## 구조

```
packages/shared/src/
├── index.ts                    # 메인 barrel export
├── models/                     # 공유 데이터 모델
│   ├── orders.models.ts        # Order, OrderStatus 등
│   └── installers.models.ts    # Installer 관련 타입
├── constants/
│   └── error-codes.ts          # API 에러 코드 (E1xxx-E5xxx)
├── interceptors/
│   ├── auth.interceptor.ts     # JWT 토큰 자동 첨부
│   ├── auth.interface.ts       # 인터셉터 인터페이스
│   └── error.interceptor.ts    # 전역 에러 핸들링
├── guards/
│   └── auth.guard.ts           # 인증 가드
├── tokens/
│   ├── environment.token.ts    # ENVIRONMENT_CONFIG (apiUrl 등)
│   ├── platform.token.ts       # PLATFORM_CONFIG (web/mobile 구분)
│   ├── logger.token.ts         # 로거 토큰
│   └── translate.token.ts      # TRANSLATE_SERVICE_TOKEN
├── services/
│   ├── logger.service.ts       # 로깅 서비스
│   ├── network.service.ts      # 네트워크 상태 감지
│   ├── notifications.service.ts # 알림 서비스
│   ├── settlement.service.ts   # 정산 서비스
│   ├── websocket.service.ts    # WebSocket 실시간 통신
│   ├── barcode-scanner.service.ts # 바코드 스캔
│   ├── responsive-layout.service.ts # 반응형 레이아웃
│   ├── base-auth.service.ts    # 인증 추상 기본 클래스
│   ├── auth.models.ts          # User, AuthTokens, LoginRequest 타입
│   ├── reports.service.ts      # 리포트 추상 기본 클래스
│   ├── reports.models.ts       # KpiSummary, ProgressReport 등 타입
│   └── sync-queue.utils.ts     # 동기화 큐 유틸리티
├── store/
│   ├── orders.utils.ts         # 주문 스토어 유틸리티
│   ├── ui.store.ts             # UI 상태 스토어
│   └── ui.models.ts            # UI 모델 타입
├── components/
│   └── base-signature-pad.component.ts # 서명 패드 기본 클래스 + 템플릿/스타일
├── db/
│   └── database.models.ts      # OfflineOrder, SyncQueueEntry 등 DB 타입
└── utils/
    └── error.util.ts           # 에러 유틸리티
```

## 사용법

```typescript
// 앱에서 import
import { LoggerService, NetworkService, ENVIRONMENT_CONFIG } from '@erp/shared';

// 서브패스 import도 가능
import { Order, OrderStatus } from '@erp/shared/models';
import { ERROR_CODES } from '@erp/shared/constants';
```

## 토큰 프로비전

앱의 `main.ts`에서 토큰을 제공해야 합니다:

```typescript
// Web (apps/web/src/main.ts)
providers: [
  { provide: ENVIRONMENT_CONFIG, useValue: environment },
  { provide: PLATFORM_CONFIG, useValue: { platform: 'web', ... } },
  { provide: TRANSLATE_SERVICE_TOKEN, useExisting: TranslateService },
]

// Mobile (apps/mobile/src/main.ts)
providers: [
  { provide: ENVIRONMENT_CONFIG, useValue: environment },
  { provide: PLATFORM_CONFIG, useValue: { platform: 'mobile', ... } },
]
```

## 상속 패턴

추상 클래스를 상속하는 서비스:

| 공유 기본 클래스            | Web 구현                | Mobile 구현             |
| --------------------------- | ----------------------- | ----------------------- |
| `BaseAuthService`           | `AuthService`           | `AuthService`           |
| `BaseReportsService`        | `ReportsService`        | `ReportsService`        |
| `BaseSignaturePadComponent` | `SignaturePadComponent` | `SignaturePadComponent` |

## 플랫폼별 서비스

공유되지 않는 플랫폼 고유 서비스는 `PLATFORM_SPECIFIC.md`를 참조하세요.
