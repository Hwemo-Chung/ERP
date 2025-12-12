# Quick Start Guide (빠른 시작 가이드)

> Last Updated: 2025-12-12
> Project: Logistics ERP - 물류 센터 주문 관리 시스템

---

## Tech Stack (Version-Locked)

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Backend** | NestJS + Prisma | 11.x / 6.x | API Server, ORM |
| **Database** | PostgreSQL | 15.x | Primary DB |
| **Cache** | Redis | 7.x | Session, Rate Limit |
| **Frontend** | Angular + Ionic | 19.x / 8.x | Mobile-First Web App |
| **Native** | Capacitor | 6.x | PWA/Android/iOS |
| **State** | NgRx SignalStore | 19.x | Client State Management |
| **Offline** | Dexie.js (IndexedDB) | 4.x | Offline Queue + Cache |
| **Runtime** | Node.js | 20.18.0 | via nvm |
| **Build** | Turborepo + pnpm | - | Monorepo |

---

## Essential Commands

```bash
# 1. 환경 설정 (반드시 먼저!)
nvm use                          # Node 20.18.0
docker compose up -d             # PostgreSQL + Redis

# 2. DB 설정
pnpm db:generate                 # Prisma Client 생성
pnpm db:migrate                  # Migration 실행
pnpm db:seed                     # 테스트 데이터

# 3. 개발 서버
pnpm api:dev                     # localhost:3000 (Swagger: /api/docs)
pnpm mobile:dev                  # localhost:4200

# 4. 테스트
pnpm api:test                    # API 단위 테스트
pnpm mobile:test                 # Angular 단위 테스트

# 5. 빌드
pnpm build                       # 전체 빌드
```

---

## Top 5 Most Used Prompts

### 1. Signal State Debug
```
Angular 19 + Signals 프로젝트입니다.
Component: [파일 경로]
증상: [computed 업데이트 안 됨 / effect 실행 안 됨]
Reference: apps/mobile/src/app/core/services/auth.service.ts
```

### 2. Offline Sync Issue
```
Angular 19 + Dexie.js 프로젝트입니다.
증상: [sync queue 처리 안 됨 / conflict 해결 안 됨]
Network State: [online / offline]
Reference: apps/mobile/src/app/core/services/sync-queue.service.ts
```

### 3. State Machine Transition Error
```
NestJS + Prisma 프로젝트입니다.
Error: E2001 (INVALID_STATUS_TRANSITION)
Current Status: [현재]
Target Status: [목표]
Reference: apps/api/src/orders/order-state-machine.ts
```

### 4. New SignalStore Feature
```
Angular 19 + NgRx SignalStore 프로젝트입니다.
Store 이름: [Name]Store
관리 데이터: [설명]
Reference: apps/mobile/src/app/store/orders/orders.store.ts
```

### 5. NestJS API + Integration
```
Logistics ERP 풀스택 프로젝트입니다.
Endpoint: [METHOD /path]
기능: [설명]
Reference:
- API: apps/api/src/orders/
- Store: apps/mobile/src/app/store/orders/
```

---

## Project Structure Overview

```
/Users/solution/Documents/ERP/
├── apps/
│   ├── api/src/                 # NestJS Backend
│   │   ├── auth/                # JWT + Guards
│   │   ├── orders/              # 핵심 도메인 + State Machine
│   │   ├── users/               # 사용자 관리
│   │   ├── notifications/       # WebSocket + Push
│   │   ├── settlement/          # 정산 Lock/Unlock
│   │   └── prisma/              # DB 서비스
│   │
│   └── mobile/src/app/          # Angular Frontend
│       ├── core/                # Services, Guards, Interceptors
│       │   ├── services/        # AuthService, NetworkService
│       │   ├── guards/          # authGuard, noAuthGuard
│       │   ├── interceptors/    # Auth, Error, Offline
│       │   └── db/              # Dexie.js (IndexedDB)
│       ├── store/               # NgRx SignalStore
│       │   ├── orders/          # 주문 상태
│       │   └── auth/            # 인증 상태
│       └── features/            # Lazy-loaded Pages
│
├── prisma/
│   ├── schema.prisma            # DB Schema
│   └── seed.ts                  # 시드 데이터
│
├── .doc/                        # 프로젝트 문서
│   ├── ARCHITECTURE.md          # State Machine, Offline Sync
│   ├── API_SPEC.md              # Endpoints, Error Codes
│   └── DATABASE_SCHEMA.md       # Tables, Indices
│
└── .prompt-guides/              # Claude 프롬프트 가이드 (현재 문서)
```

---

## Error Code Quick Reference

| Code | Category | Description |
|------|----------|-------------|
| **E1001** | Auth | 잘못된 비밀번호 |
| **E1002** | Auth | 토큰 만료 |
| **E1003** | Auth | 권한 부족 |
| **E2001** | Business | 잘못된 상태 전환 |
| **E2002** | Business | 정산 기간 잠김 |
| **E2003** | Business | 기간 초과 (Revert/약속일자) |
| **E2017** | Business | 버전 충돌 (409) |
| **E3001** | Validation | 필수 필드 누락 |
| **E3002** | Validation | 잘못된 형식 |

---

## Key Concepts (이것만 알면 시작 가능)

### 1. Order State Machine
```
UNASSIGNED → ASSIGNED → CONFIRMED → RELEASED → DISPATCHED → COMPLETED
```
- 각 전환에는 **Guard 조건**이 있음
- 자세한 규칙: `.doc/ARCHITECTURE.md`

### 2. Signals (BehaviorSubject 대체)
```typescript
// Signal 기본
const count = signal(0);
count.set(5);           // 값 설정
count.update(n => n+1); // 값 업데이트

// Computed (파생 상태)
const doubled = computed(() => count() * 2);

// Effect (부수효과)
effect(() => console.log('Count:', count()));
```

### 3. Offline-First
```
작업 → 로컬 저장 (IndexedDB) → 서버 동기화
         ↓
     오프라인이면 SyncQueue에 추가
         ↓
     온라인 복귀 시 자동 동기화
```

### 4. Optimistic Locking
- 모든 UPDATE에 `expectedVersion` 포함
- 서버 version과 불일치 시 **409 Conflict**

---

## Next Steps

상황별로 필요한 문서를 참조하세요:

| 상황 | 참조 문서 |
|------|----------|
| 에러 발생 | `02-debugging-templates.md` |
| 새 기능 개발 | `03-feature-templates.md` |
| 코딩 패턴 확인 | `04-coding-patterns.md` |
| 금지 사항 확인 | `05-prohibitions.md` |
| Claude 도구 활용 | `06-tools-reference.md` |
| 바로 쓸 수 있는 프롬프트 | `07-ready-prompts.md` |
