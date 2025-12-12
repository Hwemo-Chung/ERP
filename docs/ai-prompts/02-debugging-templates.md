# Debugging Prompt Templates (디버깅 프롬프트 템플릿)

> Last Updated: 2025-12-12
> Project: Logistics ERP

---

## Overview

이 프로젝트에서 자주 발생하는 **에러 상황별 디버깅 프롬프트 템플릿**입니다.
각 템플릿을 복사하여 `[placeholder]` 부분만 채워 사용하세요.

---

## 1. Signal State Debug

### 사용 상황
- `computed()`가 업데이트되지 않음
- `effect()`가 트리거되지 않음
- Signal 값 변경이 UI에 반영되지 않음

### 템플릿
```
Angular 19 + Signals 프로젝트입니다.

Component: [파일 경로]
증상: [computed가 업데이트 안 됨 / effect가 실행 안 됨 / UI 반영 안 됨]

관련 코드:
```typescript
[문제가 되는 코드 붙여넣기]
```

분석 요청:
1. Signal mutation 패턴 확인 (update vs set)
2. Computed dependency tracking 확인
3. Effect의 allowSignalWrites 설정 확인
4. Zoneless change detection 호환성 확인
5. Template에서 Signal 호출 방식 확인

Reference:
- AuthService: apps/mobile/src/app/core/services/auth.service.ts
- OrdersStore: apps/mobile/src/app/store/orders/orders.store.ts
```

### 체크리스트
```
□ signal.set() 대신 signal.update() 사용했는가?
□ computed() 내부에서 Signal을 함수로 호출했는가? (data() 형태)
□ effect()에 { allowSignalWrites: true } 옵션 추가했는가?
□ Template에서 {{ signal() }} 형태로 호출했는가?
□ ChangeDetectionStrategy.OnPush 사용 중인가?
```

---

## 2. Offline Sync Debug (Dexie.js)

### 사용 상황
- 오프라인 큐가 처리되지 않음
- 409 Conflict가 해결되지 않음
- IndexedDB 데이터 불일치

### 템플릿
```
Angular 19 + Dexie.js 프로젝트입니다.

증상: [sync queue 처리 안 됨 / conflict 해결 안 됨 / 데이터 불일치]
Network State: [online / offline]
Last Sync Time: [timestamp 또는 unknown]

에러 메시지:
```
[에러 로그 붙여넣기]
```

분석 요청:
1. SyncQueueService의 priority 처리 로직
2. 409 Conflict 해결 flow (서버 버전 vs 로컬 버전)
3. BackgroundSyncService의 effect 트리거 조건
4. IndexedDB 트랜잭션 상태

Reference:
- Database: apps/mobile/src/app/core/db/database.ts
- SyncQueue: apps/mobile/src/app/core/services/sync-queue.service.ts
- BackgroundSync: apps/mobile/src/app/core/services/background-sync.service.ts
```

### 체크리스트
```
□ NetworkService.isOffline() Signal이 올바른 값인가?
□ syncQueue 테이블에 pending 상태 항목이 있는가?
□ retryCount가 maxRetries(5)를 초과했는가?
□ conflict 상태 항목에 conflictData가 있는가?
□ effect()가 네트워크 상태 변화를 감지하는가?
```

---

## 3. State Machine Transition Debug

### 사용 상황
- E2001 에러 (INVALID_STATUS_TRANSITION)
- 상태 전환이 실패함
- Guard 조건 불충족

### 템플릿
```
NestJS + Prisma 프로젝트입니다.

Endpoint: PATCH /orders/:id
Error: E2001 (INVALID_STATUS_TRANSITION)
Current Status: [현재 상태]
Target Status: [목표 상태]

Request Body:
```json
[요청 본문 붙여넣기]
```

분석 요청:
1. State machine 전환 규칙 검증
2. Guard 조건 확인 (appointmentDate, serialsCaptured)
3. RBAC 권한 체크
4. Settlement lock 상태 확인

Reference:
- State Machine: apps/api/src/orders/order-state-machine.ts
- Guards: apps/api/src/orders/state-machine/guards/
- ARCHITECTURE: .doc/ARCHITECTURE.md (State Machine 섹션)
```

### State Machine 전환표
```
UNASSIGNED → ASSIGNED (only)
ASSIGNED → CONFIRMED | UNASSIGNED
CONFIRMED → RELEASED | ASSIGNED
RELEASED → DISPATCHED | CONFIRMED
DISPATCHED → COMPLETED | POSTPONED | ABSENT

Guard 조건:
- RELEASED → DISPATCHED: appointmentDate === today
- DISPATCHED → COMPLETED: serialsCaptured === true
```

---

## 4. Version Conflict (409) Debug

### 사용 상황
- HTTP 409 Conflict 에러
- E2017 (VERSION_CONFLICT) 에러
- 낙관적 잠금 실패

### 템플릿
```
NestJS + Prisma 프로젝트입니다.

Endpoint: [PATCH /orders/:id]
Error: 409 Conflict (E2017)

요청 시 버전: [expectedVersion 값]
서버 응답:
```json
{
  "error": "E2017",
  "message": "error.version_conflict",
  "currentVersion": [서버 버전],
  "serverState": { ... }
}
```

분석 요청:
1. 요청과 서버 버전 차이 원인
2. 동시 수정 가능성 분석
3. 클라이언트 측 캐시 상태
4. 해결 전략 제안 (재시도 / 병합 / 덮어쓰기)

Reference:
- OrdersService: apps/api/src/orders/orders.service.ts (update 메서드)
- OrdersStore: apps/mobile/src/app/store/orders/orders.store.ts
```

### 해결 전략
```
1. 자동 재시도: 최신 데이터 fetch → 재요청
2. 병합: 서버와 로컬 변경사항 비교 → 수동 병합
3. 덮어쓰기: 서버 데이터로 로컬 덮어쓰기 (데이터 손실 가능)
```

---

## 5. NestJS API Error Debug

### 사용 상황
- API 엔드포인트 에러
- DTO 검증 실패
- Guard/Interceptor 문제

### 템플릿
```
NestJS 11 + Prisma 6 프로젝트입니다.

Endpoint: [HTTP Method + URL]
HTTP Status: [상태 코드]
Error Response:
```json
[에러 응답 붙여넣기]
```

Request Headers:
```
Authorization: Bearer [토큰 일부]
X-App-Version: [버전]
X-Device-Id: [ID]
X-Platform: [플랫폼]
```

Request Body:
```json
[요청 본문 붙여넣기]
```

분석 요청:
1. DTO 검증 규칙 확인
2. Guard 권한 체크 (JwtAuthGuard, RolesGuard)
3. Interceptor 처리 (에러 변환, 로깅)
4. Service 비즈니스 로직

Reference:
- Controller: apps/api/src/[module]/[module].controller.ts
- Service: apps/api/src/[module]/[module].service.ts
- DTO: apps/api/src/[module]/dto/
- Guards: apps/api/src/auth/guards/
```

### Error Code 빠른 참조
```
E1xxx: Auth (E1001 비밀번호, E1002 토큰만료, E1003 권한부족)
E2xxx: Business (E2001 상태전환, E2002 정산잠금, E2017 버전충돌)
E3xxx: Validation (E3001 필수값, E3002 형식오류)
E4xxx: External (E4001 Push실패)
E5xxx: System (E5001 DB연결)
```

---

## 6. Build Error Debug (Turborepo)

### 사용 상황
- pnpm build 실패
- TypeScript 컴파일 에러
- Angular/NestJS 빌드 에러

### 템플릿
```
Logistics ERP 프로젝트입니다.
Node: 20.18.0, pnpm workspace, Turborepo

Command: [pnpm api:build / pnpm mobile:build]
Error:
```
[전체 에러 로그 붙여넣기]
```

분석 요청:
1. TypeScript 5.5 호환성 문제
2. Angular 19 / NestJS 11 breaking changes
3. 순환 의존성 (Circular dependency)
4. 누락된 모듈 import
5. Prisma Client 생성 상태

Reference:
- tsconfig.json (루트 및 apps/*)
- package.json (의존성 버전)
- angular.json / nest-cli.json
```

### 빠른 해결 명령어
```bash
# Prisma Client 재생성
pnpm db:generate

# node_modules 재설치
rm -rf node_modules apps/*/node_modules
pnpm install

# 캐시 정리
pnpm turbo clean
pnpm turbo run build --force

# TypeScript 캐시 정리
rm -rf dist apps/*/dist apps/*/.angular
```

---

## 7. HTTP Interceptor Debug

### 사용 상황
- 401 토큰 갱신 실패
- 요청 헤더 누락
- 오프라인 폴백 실패

### 템플릿
```
Angular 19 프로젝트입니다.

증상: [401 갱신 실패 / 헤더 누락 / 오프라인 폴백 실패]
Network State: [online / offline]

Request URL: [URL]
Request Headers (실제):
```
[개발자 도구에서 확인한 헤더]
```

Error:
```
[에러 메시지]
```

분석 요청:
1. AuthInterceptor의 토큰 갱신 로직
2. HeadersInterceptor의 필수 헤더 추가
3. OfflineInterceptor의 캐시/큐 폴백
4. ErrorInterceptor의 에러 변환

Reference:
- Interceptors: apps/mobile/src/app/core/interceptors/
- provideHttpClient 설정: apps/mobile/src/app/app.config.ts
```

### Interceptor 실행 순서
```
Request: Headers → Auth → Offline → (서버)
Response: (서버) → Error → Offline → Auth → Headers
```

---

## 8. WebSocket Connection Debug

### 사용 상황
- WebSocket 연결 실패
- 실시간 알림 수신 안 됨
- 연결 끊김 후 재연결 실패

### 템플릿
```
NestJS WebSocket Gateway + Angular 클라이언트입니다.

증상: [연결 실패 / 알림 수신 안 됨 / 재연결 실패]
VPN 상태: [연결됨 / 연결 안 됨]

클라이언트 에러:
```
[WebSocket 에러 로그]
```

서버 로그:
```
[Gateway 로그]
```

분석 요청:
1. WebSocket URL 및 인증 헤더
2. Heartbeat (ping/pong) 상태
3. 재연결 로직 (지수 백오프)
4. VPN 환경에서의 WebSocket 제한

Reference:
- Gateway: apps/api/src/notifications/notifications.gateway.ts
- Client: apps/mobile/src/app/core/services/websocket.service.ts
```

---

## Quick Reference Table

| 증상 | 가능한 원인 | 참조 섹션 |
|------|------------|----------|
| computed 업데이트 안 됨 | Signal 호출 누락, 종속성 추적 실패 | Section 1 |
| Offline 큐 처리 안 됨 | 네트워크 감지 실패, 우선순위 문제 | Section 2 |
| E2001 상태 전환 실패 | 잘못된 전환, Guard 조건 미충족 | Section 3 |
| 409 Version conflict | 동시 수정, 캐시 불일치 | Section 4 |
| API 400/401/403 | DTO 검증, 인증, 권한 | Section 5 |
| Build 실패 | TS 호환성, 순환 의존성 | Section 6 |
| 헤더 누락 | Interceptor 설정 | Section 7 |
| WebSocket 끊김 | VPN, Heartbeat 실패 | Section 8 |
