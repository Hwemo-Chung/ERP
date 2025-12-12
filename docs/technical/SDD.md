# Software Design Document (SDD)

## 1. Introduction
This document details the software design for the Logistics ERP Branch & Partner App, built with **Angular 19 + Ionic 8 + Capacitor** for optimal cross-platform support (Web, Android, iOS) with low-end device optimization.

### 1.1 Technology Stack Decision
| Criteria | Decision | Rationale |
| --- | --- | --- |
| Framework | Angular 19 (Standalone) | Signal-based reactivity, zoneless change detection |
| UI Library | Ionic 8 | Native-like components, platform-adaptive styling |
| Cross-Platform | Capacitor 6 | Native access, single codebase for Web/Android/iOS |
| State | Angular Signals + NgRx SignalStore | Fine-grained reactivity, minimal bundle |
| i18n | @ngx-translate/core | Runtime language switching |
| Offline | Angular Service Worker + IndexedDB | PWA support via @angular/pwa |

### 1.2 Low-End Device Optimization Strategy
```
┌─────────────────────────────────────────────────────────────────┐
│               LOW-END DEVICE OPTIMIZATION MATRIX                │
├─────────────────────────────────────────────────────────────────┤
│  Target Specs: 2GB RAM, Quad-core 1.4GHz, Android 8+ / iOS 13+ │
├─────────────────────────────────────────────────────────────────┤
│  ✓ Zoneless Angular (No Zone.js = 30KB less, faster CD)        │
│  ✓ OnPush Change Detection everywhere                          │
│  ✓ Virtual Scrolling for lists > 20 items                      │
│  ✓ Lazy loading all routes                                     │
│  ✓ Image compression (WebP, lazy load, srcset)                 │
│  ✓ Bundle splitting (initial < 200KB gzipped)                  │
│  ✓ Service Worker precaching critical assets                   │
│  ✓ IndexedDB pagination (50 records per page)                  │
│  ✓ Debounced inputs (300ms)                                    │
│  ✓ requestIdleCallback for non-critical tasks                  │
└─────────────────────────────────────────────────────────────────┘
```

## 2. System Context Diagram (C4 Level 1)
```
                    ┌─────────────────────┐
                    │   Branch Staff      │
                    │   Partner Ops       │
                    │   HQ Supervisors    │
                    └─────────┬───────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
     ┌─────────┐        ┌─────────┐        ┌─────────┐
     │   Web   │        │ Android │        │   iOS   │
     │ Browser │        │   App   │        │   App   │
     │ (PWA)   │        │(Capacitor)       │(Capacitor)
     └────┬────┘        └────┬────┘        └────┬────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │ HTTPS (VPN)
                             ▼
                    ┌─────────────────────┐
                    │   NestJS API        │
                    │   (Backend)         │
                    └─────────┬───────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
     ┌────────────┐   ┌────────────┐   ┌────────────┐
     │ PostgreSQL │   │   Redis    │   │ S3 Storage │
     └────────────┘   └────────────┘   └────────────┘
```

## 3. Container Diagram (C4 Level 2)
```
┌────────────────────────────────────────────────────────────────┐
│                   Logistics ERP Ionic App                      │
├────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐    ┌──────────────────┐                 │
│  │ Angular 19 +     │    │   NestJS API     │                 │
│  │ Ionic 8 App      │◄──►│   (Node 20 LTS)  │                 │
│  │                  │    │                  │                 │
│  │ - Standalone     │    │  - REST API      │                 │
│  │ - Signals        │    │  - WebSocket     │                 │
│  │ - Capacitor 6    │    │  - Prisma ORM    │                 │
│  │ - NgRx SignalStore    │  - Bull Queue    │                 │
│  │ - @angular/pwa   │    │  - Passport JWT  │                 │
│  │ - @ngx-translate │    │                  │                 │
│  └────────┬─────────┘    └────────┬─────────┘                 │
│           │                       │                            │
│   ┌───────┴───────┐              │                            │
│   │               │              │                            │
│   ▼               ▼              ▼                            │
│ ┌──────────┐ ┌──────────┐  ┌──────────┐   ┌──────────┐       │
│ │ IndexedDB│ │ Capacitor│  │PostgreSQL│   │  Redis   │       │
│ │ (Offline)│ │ Plugins  │  │   15     │   │    7     │       │
│ └──────────┘ └──────────┘  └──────────┘   └──────────┘       │
│               │                                               │
│     ┌─────────┴─────────┐                                    │
│     │ Native Features   │                                    │
│     │ - Camera          │                                    │
│     │ - Push Notify     │                                    │
│     │ - App Updates     │                                    │
│     │ - Biometrics      │                                    │
│     └───────────────────┘                                    │
└────────────────────────────────────────────────────────────────┘
```

## 4. Component Diagram (C4 Level 3)
### 4.1 Frontend Project Structure (Angular + Ionic)
```
src/
├── app/
│   ├── core/                         # Singleton services
│   │   ├── auth/
│   │   │   ├── auth.service.ts       # JWT handling
│   │   │   ├── auth.guard.ts         # Route protection
│   │   │   └── auth.interceptor.ts   # Token injection
│   │   ├── api/
│   │   │   ├── api.service.ts        # HTTP client wrapper
│   │   │   └── offline-queue.service.ts
│   │   ├── storage/
│   │   │   ├── indexed-db.service.ts # Dexie wrapper
│   │   │   └── sync.service.ts       # Background sync
│   │   └── platform/
│   │       ├── network.service.ts    # Online/offline detection
│   │       └── push.service.ts       # Push notifications
│   │
│   ├── shared/                       # Reusable components
│   │   ├── components/
│   │   │   ├── order-card/
│   │   │   ├── status-badge/
│   │   │   ├── loading-skeleton/
│   │   │   ├── offline-indicator/
│   │   │   └── virtual-list/
│   │   ├── directives/
│   │   │   ├── debounce-click.directive.ts
│   │   │   └── lazy-image.directive.ts
│   │   ├── pipes/
│   │   │   ├── date-format.pipe.ts
│   │   │   └── phone-mask.pipe.ts
│   │   └── shared.module.ts
│   │
│   ├── store/                        # NgRx SignalStore
│   │   ├── orders/
│   │   │   ├── orders.store.ts
│   │   │   └── orders.models.ts
│   │   ├── installers/
│   │   │   └── installers.store.ts
│   │   └── ui/
│   │       └── ui.store.ts           # Loading, errors, modals
│   │
│   ├── pages/                        # Lazy-loaded feature modules
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   │   └── login.page.ts     # Standalone component
│   │   │   └── auth.routes.ts
│   │   │
│   │   ├── tabs/                     # Main tab navigation
│   │   │   ├── tabs.page.ts
│   │   │   └── tabs.routes.ts
│   │   │
│   │   ├── orders/
│   │   │   ├── order-list/
│   │   │   │   ├── order-list.page.ts
│   │   │   │   ├── order-list.page.html
│   │   │   │   └── order-list.page.scss
│   │   │   ├── order-detail/
│   │   │   │   └── order-detail.page.ts
│   │   │   ├── order-assign/
│   │   │   │   └── order-assign.modal.ts
│   │   │   └── orders.routes.ts
│   │   │
│   │   ├── completion/
│   │   │   ├── daily-completion/
│   │   │   │   └── daily-completion.page.ts
│   │   │   ├── serial-input/
│   │   │   │   └── serial-input.modal.ts
│   │   │   ├── waste-pickup/
│   │   │   │   └── waste-pickup.modal.ts
│   │   │   └── completion.routes.ts
│   │   │
│   │   ├── reports/
│   │   │   ├── dashboard/
│   │   │   │   └── dashboard.page.ts
│   │   │   ├── kpi/
│   │   │   │   └── kpi.page.ts
│   │   │   ├── exports/
│   │   │   │   └── exports.page.ts
│   │   │   └── reports.routes.ts
│   │   │
│   │   └── settings/
│   │       └── settings.page.ts
│   │
│   ├── app.component.ts              # Root component
│   ├── app.config.ts                 # App configuration
│   └── app.routes.ts                 # Root routing
│
├── assets/
│   ├── i18n/
│   │   ├── ko.json                   # Korean translations
│   │   └── en.json                   # English translations
│   ├── icon/
│   └── splash/
│
├── environments/
│   ├── environment.ts
│   └── environment.prod.ts
│
├── theme/
│   ├── variables.scss                # Ionic CSS variables
│   └── global.scss
│
├── index.html
├── main.ts                           # Bootstrap with zoneless
├── manifest.webmanifest              # PWA manifest
└── ngsw-config.json                  # Service Worker config
```

### 4.2 Backend Modules (NestJS - unchanged)
```
src/
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── guards/
│   │   ├── jwt.guard.ts
│   │   └── roles.guard.ts
│   └── strategies/
│       └── jwt.strategy.ts
├── orders/
│   ├── orders.module.ts
│   ├── orders.controller.ts
│   ├── orders.service.ts
│   ├── orders.repository.ts
│   └── state-machine/
│       └── order.state-machine.ts
├── completion/
│   ├── completion.module.ts
│   └── completion.service.ts
├── reports/
│   ├── reports.module.ts
│   └── exporters/
│       ├── csv.exporter.ts
│       └── ecoas.formatter.ts
├── notifications/
│   ├── notifications.gateway.ts      # WebSocket
│   └── push.service.ts               # FCM for mobile
├── health/
│   └── health.controller.ts
└── common/
    ├── filters/
    ├── interceptors/
    └── decorators/
```

## 5. Sequence Diagrams

### 5.1 Order Status Update Flow (Angular Signals + Optimistic Update)
```
User        Ionic Page     SignalStore    API Service    Backend      Other Users
 │             │               │              │             │             │
 │─────────────►               │              │             │             │
 │  Tap "Confirm"              │              │             │             │
 │             │               │              │             │             │
 │             │───────────────►              │             │             │
 │             │  patchOrder({status,version})│             │             │
 │             │               │              │             │             │
 │             │               │──────────────►             │             │
 │             │               │ Optimistic UI│             │             │
 │             │               │ update signal│             │             │
 │◄────────────────────────────│              │             │             │
 │  UI updated │               │              │             │             │
 │  immediately│               │              │             │             │
 │             │               │              │─────────────►             │
 │             │               │              │ PATCH /orders/{id}        │
 │             │               │              │◄────────────│             │
 │             │               │              │   200 OK    │             │
 │             │               │◄─────────────│             │             │
 │             │               │ Confirm or   │             │             │
 │             │               │ rollback     │             │             │
 │             │               │              │             │             │
 │             │               │              │   WebSocket: ORDER_UPDATED
 │             │               │              │             │─────────────►
 │             │               │              │             │  Broadcast  │
 │             │               │              │             │             │
```

### 5.2 Offline Sync Flow (Angular Service Worker + Background Sync)
```
User        Ionic Page     IndexedDB     SW/SyncManager   API
 │             │               │              │             │
 │─────────────►               │              │             │
 │  Submit completion          │              │             │
 │  (OFFLINE)                  │              │             │
 │             │               │              │             │
 │             │───────────────►              │             │
 │             │  offlineQueue.add()          │             │
 │             │               │              │             │
 │             │───────────────────────────────►             │
 │             │  navigator.serviceWorker     │             │
 │             │  .ready.then(sw =>           │             │
 │             │    sw.sync.register('sync-orders'))        │
 │◄────────────│               │              │             │
 │  Toast: "Saved offline,     │              │             │
 │   will sync when online"    │              │             │
 │             │               │              │             │
 │  ... Network restored ...   │              │             │
 │             │               │              │             │
 │             │               │◄─────────────│             │
 │             │               │  'sync' event│             │
 │             │               │              │             │
 │             │               │──────────────►             │
 │             │               │  getAll()    │             │
 │             │               │◄─────────────│             │
 │             │               │  items[]     │             │
 │             │               │              │             │
 │             │               │              │─────────────►
 │             │               │              │ POST /orders/batch-sync
 │             │               │              │◄────────────│
 │             │               │              │  200 OK     │
 │             │               │              │             │
 │             │               │◄─────────────│             │
 │             │               │  delete synced│            │
 │◄────────────────────────────│              │             │
 │  Toast: "3 items synced"    │              │             │
```

### 5.3 Capacitor Native Camera Flow
```
User        Ionic Page     Camera Plugin   File System    API
 │             │               │              │             │
 │─────────────►               │              │             │
 │  Tap "Add Photo"            │              │             │
 │             │               │              │             │
 │             │───────────────►              │             │
 │             │  Camera.getPhoto({          │             │
 │             │    quality: 70,             │             │
 │             │    resultType: DataUrl,     │             │
 │             │    source: CameraSource.Prompt            │
 │             │  })           │              │             │
 │             │               │              │             │
 │             │  [Native Camera UI]         │             │
 │             │               │              │             │
 │             │◄──────────────│              │             │
 │             │  {dataUrl, format}          │             │
 │             │               │              │             │
 │             │  Compress if > 500KB        │             │
 │             │               │              │             │
 │             │───────────────────────────────►            │
 │             │               │  Save to IndexedDB        │
 │             │               │  (offline support)        │
 │             │               │              │             │
 │             │───────────────────────────────────────────►
 │             │               │              │ POST /attachments
 │             │               │              │ multipart/form-data
 │             │               │              │◄────────────│
 │             │               │              │ {id, url}   │
 │◄────────────│               │              │             │
 │  Photo attached             │              │             │
```

## 6. Data Flow Diagrams

### 6.1 Settlement Lock Flow
```
                            ┌─────────────────┐
                            │  Cron Job       │
                            │  (Weekly Mon AM)│
                            └────────┬────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │ Settlement      │
                            │ Service         │
                            └────────┬────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
    ┌─────────────┐           ┌─────────────┐           ┌─────────────┐
    │ Lock Week   │           │ Cache       │           │ Notify      │
    │ (N-1)       │           │ Invalidate  │           │ Branches    │
    └─────────────┘           └─────────────┘           └─────────────┘
           │                         │                         │
           ▼                         ▼                         ▼
    ┌─────────────┐           ┌─────────────┐           ┌─────────────┐
    │ DB: Update  │           │ Redis: Clear│           │ FCM Push:   │
    │ status=     │           │ KPI keys    │           │ SETTLEMENT  │
    │ LOCKED      │           │             │           │ _LOCKED     │
    └─────────────┘           └─────────────┘           └─────────────┘
```

### 6.2 Cross-Platform Build Flow
```
┌───────────────────────────────────────────────────────────────────┐
│                     Build & Deploy Pipeline                       │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐                                                │
│  │ Angular Build│                                                │
│  │ ng build     │                                                │
│  │ --prod       │                                                │
│  └──────┬───────┘                                                │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐                                                │
│  │   www/       │  (Optimized bundle)                           │
│  │   dist/      │                                                │
│  └──────┬───────┘                                                │
│         │                                                        │
│    ┌────┴────┬────────────┐                                     │
│    ▼         ▼            ▼                                     │
│ ┌──────┐ ┌──────┐    ┌──────┐                                  │
│ │ PWA  │ │ Android    │ iOS  │                                  │
│ │Deploy│ │ Build │    │Build │                                  │
│ └──┬───┘ └──┬───┘    └──┬───┘                                  │
│    │        │           │                                       │
│    ▼        ▼           ▼                                       │
│ ┌──────┐ ┌──────────┐ ┌──────────┐                             │
│ │ CDN  │ │ Google   │ │ App      │                             │
│ │      │ │ Play     │ │ Store    │                             │
│ │      │ │ (AAB)    │ │ (IPA)    │                             │
│ └──────┘ └──────────┘ └──────────┘                             │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

## 7. Security Design

### 7.1 Authentication Flow
```
┌─────────────────────────────────────────────────────────────────┐
│                      Authentication Flow                        │
├─────────────────────────────────────────────────────────────────┤
│  1. VPN Connection (Required)                                   │
│     └─► IP verified against allowlist                           │
│                                                                 │
│  2. Login Request                                               │
│     └─► POST /auth/login { username, password }                 │
│         └─► Argon2 password verification                        │
│         └─► Generate JWT (1h) + Refresh Token (7d)              │
│         └─► Store refresh token hash in Redis                   │
│         └─► On Mobile: Store in Capacitor Secure Storage        │
│                                                                 │
│  3. Authenticated Requests                                      │
│     └─► Authorization: Bearer <jwt>                             │
│         └─► JWT Guard validates signature + expiry              │
│         └─► Roles Guard checks user.role vs required roles      │
│         └─► Branch Guard checks user.branchId vs resource       │
│                                                                 │
│  4. Token Refresh                                               │
│     └─► POST /auth/refresh { refreshToken }                     │
│         └─► Verify refresh token in Redis                       │
│         └─► Rotate: issue new JWT + new refresh token           │
│         └─► Invalidate old refresh token                        │
│                                                                 │
│  5. Biometric Auth (Mobile Only - Optional)                     │
│     └─► Capacitor BiometricAuth plugin                          │
│         └─► Verify fingerprint/face                             │
│         └─► Retrieve stored credentials from Secure Storage     │
│         └─► Auto-login flow                                     │
│                                                                 │
│  6. Logout                                                      │
│     └─► POST /auth/logout                                       │
│         └─► Remove refresh token from Redis                     │
│         └─► Clear Secure Storage on mobile                      │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 RBAC Matrix
| Resource | HQ_ADMIN | BRANCH_MANAGER | PARTNER_COORDINATOR | INSTALLER |
| --- | --- | --- | --- | --- |
| View all branches | ✓ | ✗ | ✗ | ✗ |
| View own branch | ✓ | ✓ | ✓ | ✓ |
| Assign orders | ✓ | ✓ | ✗ | ✗ |
| Complete orders | ✓ | ✓ | ✓ | ✓ |
| Cancel orders | ✓ | ✓ | ✗ | ✗ |
| Unlock settlement | ✓ | ✗ | ✗ | ✗ |
| View KPI all | ✓ | ✗ | ✗ | ✗ |
| View KPI branch | ✓ | ✓ | ✓ | ✗ |
| Export ECOAS | ✓ | ✓ | ✗ | ✗ |
| Manage users | ✓ | ✗ | ✗ | ✗ |

## 8. Error Handling Design

### 8.1 Error Code Taxonomy
```typescript
export enum ErrorCode {
  // Authentication (E1xxx)
  INVALID_CREDENTIALS = 'E1001',
  TOKEN_EXPIRED = 'E1002',
  INSUFFICIENT_PERMISSIONS = 'E1003',
  SESSION_EXPIRED = 'E1004',
  BIOMETRIC_FAILED = 'E1005',
  
  // Business Rules (E2xxx)
  INVALID_STATUS_TRANSITION = 'E2001',
  SETTLEMENT_LOCKED = 'E2002',
  APPOINTMENT_DATE_EXCEEDED = 'E2003',
  ORDER_ALREADY_COMPLETED = 'E2004',
  SPLIT_NOT_ALLOWED = 'E2005',
  VERSION_CONFLICT = 'E2006',
  
  // Validation (E3xxx)
  REQUIRED_FIELD_MISSING = 'E3001',
  INVALID_FORMAT = 'E3002',
  DUPLICATE_ENTRY = 'E3003',
  MAX_ITEMS_EXCEEDED = 'E3004',
  
  // External (E4xxx)
  PUSH_GATEWAY_ERROR = 'E4001',
  STORAGE_UPLOAD_FAILED = 'E4002',
  CAMERA_PERMISSION_DENIED = 'E4003',
  
  // System (E5xxx)
  DATABASE_ERROR = 'E5001',
  CACHE_ERROR = 'E5002',
  OFFLINE_SYNC_FAILED = 'E5003',
  INTERNAL_ERROR = 'E5999',
}
```

### 8.2 Error Boundary Strategy (Angular)
```typescript
// Global error handler
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(
    private toastCtrl: ToastController,
    private errorService: ErrorService
  ) {}

  handleError(error: unknown): void {
    // 1. Log to monitoring (Sentry)
    this.errorService.logError(error);
    
    // 2. Show user-friendly toast
    const message = this.errorService.getUserMessage(error);
    this.toastCtrl.create({
      message,
      duration: 3000,
      color: 'danger',
      position: 'top'
    }).then(toast => toast.present());
    
    // 3. Don't rethrow to prevent app crash
  }
}
```

## 9. Offline Design

### 9.1 IndexedDB Schema (Dexie.js)
```typescript
import Dexie, { Table } from 'dexie';

export interface Order {
  id: string;
  orderNumber: string;
  branchCode: string;
  status: string;
  appointmentDate: string;
  customerName: string;
  customerPhone: string;
  address: string;
  installerId?: string;
  version: number;
  syncedAt?: number;
}

export interface OfflineAction {
  id?: number;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'order' | 'completion' | 'attachment';
  entityId: string;
  payload: unknown;
  createdAt: number;
  retryCount: number;
  status: 'PENDING' | 'SYNCING' | 'FAILED';
}

export class AppDatabase extends Dexie {
  orders!: Table<Order>;
  installers!: Table<Installer>;
  offlineActions!: Table<OfflineAction>;
  syncMetadata!: Table<{ key: string; value: unknown }>;

  constructor() {
    super('erp-logistics');
    this.version(1).stores({
      orders: 'id, branchCode, status, appointmentDate, [branchCode+status]',
      installers: 'id, branchCode',
      offlineActions: '++id, status, entity, createdAt',
      syncMetadata: 'key'
    });
  }
}

export const db = new AppDatabase();
```

### 9.2 Sync Priority & Conflict Resolution
```typescript
export const SYNC_CONFIG = {
  priorities: {
    completion: 1,      // Highest - affects KPI
    statusChange: 2,    // High - user action
    wastePickup: 3,     // Medium - regulatory
    attachment: 4,      // Low - can retry
    note: 5             // Lowest - not critical
  },
  retryPolicy: {
    maxRetries: 5,
    backoffMs: [1000, 5000, 15000, 60000, 300000],  // Exponential
  },
  conflictResolution: 'SERVER_WINS' as const,  // Simple strategy
  batchSize: 20
};
```

### 9.3 Angular Service Worker Config (ngsw-config.json)
```json
{
  "$schema": "./node_modules/@angular/service-worker/config/schema.json",
  "index": "/index.html",
  "assetGroups": [
    {
      "name": "app",
      "installMode": "prefetch",
      "updateMode": "prefetch",
      "resources": {
        "files": [
          "/favicon.ico",
          "/index.html",
          "/manifest.webmanifest",
          "/*.css",
          "/*.js"
        ]
      }
    },
    {
      "name": "assets",
      "installMode": "lazy",
      "updateMode": "prefetch",
      "resources": {
        "files": [
          "/assets/**",
          "/*.(svg|cur|jpg|jpeg|png|webp|gif|otf|ttf|woff|woff2)"
        ]
      }
    }
  ],
  "dataGroups": [
    {
      "name": "api-performance",
      "urls": ["/api/metadata/**", "/api/installers"],
      "cacheConfig": {
        "maxSize": 100,
        "maxAge": "1d",
        "strategy": "performance"
      }
    },
    {
      "name": "api-freshness",
      "urls": ["/api/orders/**"],
      "cacheConfig": {
        "maxSize": 500,
        "maxAge": "1h",
        "timeout": "5s",
        "strategy": "freshness"
      }
    }
  ]
}
```

## 10. Performance Optimization

### 10.1 Bundle Size Targets
```
┌────────────────────────────────────────────────────────────────┐
│                    Bundle Size Budget                          │
├────────────────────────────────────────────────────────────────┤
│  Initial Load (main + polyfills):    < 150 KB gzipped         │
│  Lazy Module (largest):              < 50 KB gzipped          │
│  Total App Size:                     < 2 MB (installed)       │
├────────────────────────────────────────────────────────────────┤
│  Enforcement: ng build --stats-json && bundle-analyzer        │
│  CI/CD Gate: Fail if initial > 200KB                          │
└────────────────────────────────────────────────────────────────┘
```

### 10.2 Low-End Device Patterns
```typescript
// 1. Virtual Scrolling for large lists
@Component({
  template: `
    <ion-content>
      <cdk-virtual-scroll-viewport itemSize="72" class="ion-content-scroll-host">
        <ion-item *cdkVirtualFor="let order of orders; trackBy: trackById">
          <app-order-card [order]="order" />
        </ion-item>
      </cdk-virtual-scroll-viewport>
    </ion-content>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderListPage {
  orders = signal<Order[]>([]);
  trackById = (index: number, order: Order) => order.id;
}

// 2. Debounced search input
@Component({
  template: `
    <ion-searchbar 
      [debounce]="300"
      (ionInput)="onSearch($event)">
    </ion-searchbar>
  `
})

// 3. Skeleton loading
@Component({
  template: `
    @if (loading()) {
      <ion-skeleton-text [animated]="true" />
    } @else {
      <span>{{ data() }}</span>
    }
  `
})

// 4. requestIdleCallback for non-critical work
export function scheduleIdleTask(task: () => void): void {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(task, { timeout: 2000 });
  } else {
    setTimeout(task, 100);
  }
}
```

### 10.3 Zoneless Angular Bootstrap
```typescript
// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    provideExperimentalZonelessChangeDetection(),
    // ... other providers
  ]
});
```

## 11. Capacitor Plugin Configuration

### 11.1 Required Plugins
```json
{
  "dependencies": {
    "@capacitor/core": "^6.0.0",
    "@capacitor/android": "^6.0.0",
    "@capacitor/ios": "^6.0.0",
    "@capacitor/app": "^6.0.0",
    "@capacitor/camera": "^6.0.0",
    "@capacitor/filesystem": "^6.0.0",
    "@capacitor/network": "^6.0.0",
    "@capacitor/push-notifications": "^6.0.0",
    "@capacitor/splash-screen": "^6.0.0",
    "@capacitor/status-bar": "^6.0.0",
    "@capacitor/keyboard": "^6.0.0",
    "@capawesome/capacitor-app-update": "^6.0.0",
    "@capawesome/capacitor-badge": "^6.0.0"
  }
}
```

### 11.2 capacitor.config.ts
```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.company.erp.logistics',
  appName: 'Logistics ERP',
  webDir: 'www',
  server: {
    androidScheme: 'https',
    iosScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#1976d2',
      showSpinner: false
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    }
  },
  android: {
    buildOptions: {
      keystorePath: 'release.keystore',
      keystoreAlias: 'erp-logistics'
    }
  },
  ios: {
    contentInset: 'automatic',
    scheme: 'Logistics ERP'
  }
};

export default config;
```

## 12. i18n Configuration

### 12.1 @ngx-translate Setup
```typescript
// app.config.ts
import { provideHttpClient } from '@angular/common/http';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

export function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    importProvidersFrom(
      TranslateModule.forRoot({
        defaultLanguage: 'ko',
        loader: {
          provide: TranslateLoader,
          useFactory: HttpLoaderFactory,
          deps: [HttpClient]
        }
      })
    )
  ]
};
```

### 12.2 Translation Files Structure
```
assets/i18n/
├── ko.json
│   {
│     "common": {
│       "save": "저장",
│       "cancel": "취소",
│       "confirm": "확인",
│       "loading": "로딩 중..."
│     },
│     "orders": {
│       "title": "주문 목록",
│       "status": {
│         "PENDING": "대기",
│         "ASSIGNED": "배정완료",
│         "COMPLETED": "설치완료"
│       }
│     },
│     "errors": {
│       "E1001": "아이디 또는 비밀번호가 올바르지 않습니다.",
│       "E2002": "정산이 마감되어 수정할 수 없습니다."
│     }
│   }
│
└── en.json
    {
      "common": {
        "save": "Save",
        "cancel": "Cancel",
        ...
      }
    }
```

    ## 13. Edge Case Catalogue & Mitigations
    | Scenario | Observable Symptom | Mitigation |
    | --- | --- | --- |
    | **Offline completion conflicts** | User A completes order offline while User B edits online → version mismatch during sync. | Sync service catches 409, marks queue item `CONFLICT`, surfaces toast linking to conflict resolver that shows diff + allows manual merge. |
    | **Push token expiration** | FCM token invalidated after device restore; user stops receiving alarms. | `/notifications/subscribe` called on every login/resume; server prunes stale tokens and falls back to SMS/email if delivery fails 3 times. |
    | **Hardware back aggressive exit** | Android back button closes app mid-form. | Ionic `IonRouterOutlet` intercepts back events; unsaved form guard prompts user; double-back within 2s exits only from root tab. |
    | **iOS background throttling** | iOS suspends background sync → stale dashboards. | On resume, compare `lastSync` timestamp; if > 15 min, auto-refresh with loading banner; show warning when Background Sync unsupported. |
    | **Battery/Data saver modes** | OS delays push + network; operations fail silently. | Detect via Capacitor Network API + PerformanceObserver; switch to 5-min polling fallback; display badge in header. |
    | **Biometric failure loop** | Face/Touch ID fails repeatedly causing lockout. | After 3 failures, fall back to PIN/password; log event for audit; allow user to disable biometric in settings. |
    | **Storage quota exceeded** | IndexedDB full on low-storage device; offline queue stuck. | Dexie layer monitors `quotaExceededError`; purge cached historical data (old orders) and prompt user to re-sync. |
    | **Settlement lock race** | Order edited right as lock job runs; user sees success but DB rejects. | API enforces lock at DB layer; client inspects `E2002` and refreshes UI with lock banner plus quick link to settlement view. |
    | **App update mismatch** | Old app hitting deprecated API causing errors. | Gateway checks `X-App-Version`; if below minimum, respond with `426 Upgrade Required` + update modal or force immediate App Update plugin flow. |

    ## 14. Appendix

### 13.1 Glossary
- **FDC**: Field Delivery Center (배송설치 협력사)
- **ECOAS**: Environment Corporation Appliance Disposal System (환경공단 폐가전 시스템)
- **수주번호**: Order number
- **Capacitor**: Cross-platform runtime for deploying web apps to iOS/Android
- **Zoneless**: Angular mode without Zone.js for better performance

### 14.2 Version Matrix
| Component | Version | Notes |
| --- | --- | --- |
| Angular | 19.x | Standalone, Signals, Zoneless |
| Ionic | 8.x | Latest components |
| Capacitor | 6.x | Native plugins |
| Node.js | 20 LTS | Backend runtime |
| TypeScript | 5.6+ | Strict mode |

### 14.3 References
- PRD.md: Functional requirements
- ARCHITECTURE.md: High-level architecture
- API_SPEC.md: API contracts
- DATABASE_SCHEMA.md: Data model
- [Ionic Angular Docs](https://ionicframework.com/docs/angular/overview)
- [Capacitor Docs](https://capacitorjs.com/docs)
- [Angular Signals](https://angular.dev/guide/signals)
