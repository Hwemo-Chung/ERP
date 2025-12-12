# Ready-to-Use Prompts (즉시 사용 프롬프트)

> Last Updated: 2025-12-12
> Project: Logistics ERP

---

## Overview

복사해서 바로 사용할 수 있는 **프롬프트 모음**입니다.
`[placeholder]` 부분만 채워서 사용하세요.

---

## Debugging Prompts

### Signal 상태 디버깅
```
Angular 19 + Signals 프로젝트입니다.

Component: [파일 경로]
증상: [증상 설명]

관련 코드:
```typescript
[코드]
```

분석 요청: Signal 패턴, computed 추적, effect 설정 확인

Reference: apps/mobile/src/app/core/services/auth.service.ts
```

### Offline 동기화 디버깅
```
Angular 19 + Dexie.js 프로젝트입니다.

증상: [증상 설명]
Network: [online/offline]

에러:
```
[에러 메시지]
```

분석 요청: SyncQueue, Conflict 처리, Background Sync 확인

Reference: apps/mobile/src/app/core/services/sync-queue.service.ts
```

### State Machine 에러
```
NestJS + Prisma 프로젝트입니다.

Error: E2001 (INVALID_STATUS_TRANSITION)
From: [현재 상태]
To: [목표 상태]

Request:
```json
[요청 본문]
```

분석 요청: 전환 규칙, Guard 조건, 권한 확인

Reference: apps/api/src/orders/order-state-machine.ts
```

### Version Conflict (409)
```
NestJS + Prisma 프로젝트입니다.

Error: 409 Conflict (E2017)
Expected Version: [요청 버전]
Server Version: [서버 버전]

분석 요청: 동시 수정 원인, 캐시 상태, 해결 전략

Reference: apps/api/src/orders/orders.service.ts
```

### API 에러
```
NestJS 11 프로젝트입니다.

Endpoint: [METHOD /path]
Status: [HTTP 상태]
Error:
```json
[에러 응답]
```

분석 요청: DTO 검증, Guard, Service 로직 확인

Reference: apps/api/src/[module]/
```

### 빌드 에러
```
Logistics ERP (Turborepo + pnpm) 프로젝트입니다.

Command: [명령어]
Error:
```
[에러 로그]
```

분석 요청: TS 호환성, 순환 의존성, 모듈 import

Reference: tsconfig.json, package.json
```

---

## Feature Development Prompts

### 새 Standalone Component
```
Angular 19 + Ionic 8 프로젝트입니다.

컴포넌트: [이름]
위치: apps/mobile/src/app/features/[module]/[component]/
기능: [설명]

요구사항:
- Standalone, OnPush, Signals
- Template Control Flow (@if, @for)
- i18n 키 생성

Reference: apps/mobile/src/app/features/orders/pages/order-list/
```

### 새 NestJS 모듈
```
NestJS 11 + Prisma 6 프로젝트입니다.

모듈: [이름]
위치: apps/api/src/[module]/
엔드포인트:
- GET /[module] - 목록
- GET /[module]/:id - 상세
- POST /[module] - 생성
- PATCH /[module]/:id - 수정

요구사항:
- Controller, Service, DTO
- Optimistic Locking
- Swagger 문서화

Reference: apps/api/src/orders/
```

### 새 SignalStore
```
Angular 19 + NgRx SignalStore 프로젝트입니다.

Store: [이름]Store
위치: apps/mobile/src/app/store/[feature]/
관리 데이터: [설명]

요구사항:
- withState, withComputed, withMethods
- IndexedDB 캐싱
- Optimistic Update

Reference: apps/mobile/src/app/store/orders/orders.store.ts
```

### 오프라인 지원 기능
```
Angular 19 + Dexie.js 프로젝트입니다.

기능: [이름]
오프라인 동작: [설명]

요구사항:
- IndexedDB 저장
- SyncQueue 연동
- 409 Conflict 처리
- 자동 동기화

Reference: apps/mobile/src/app/core/services/sync-queue.service.ts
```

### 풀스택 기능
```
Logistics ERP 풀스택 프로젝트입니다.

기능: [이름]
설명: [상세]

API:
- Method: [GET/POST/PATCH/DELETE]
- Endpoint: /api/v1/[path]

요구사항:
- Backend: Controller, Service, DTO
- Frontend: Store, Component
- 오프라인 지원 (필요시)

Reference:
- API: apps/api/src/orders/
- Store: apps/mobile/src/app/store/orders/
```

---

## Code Review Prompts

### 일반 코드 리뷰
```
이 코드를 리뷰해주세요.

파일: [경로]
```typescript
[코드]
```

체크 항목:
- 메모리 누수 (Signal 패턴)
- 타입 안전성 (any 사용)
- 에러 핸들링
- i18n 키 사용
- 금지 사항 위반

Reference: .prompt-guides/05-prohibitions.md
```

### PR 리뷰
```
이 PR을 리뷰해주세요.

변경 파일:
- [파일 목록]

체크 항목:
- State machine 규칙 준수
- Optimistic locking 적용
- Signal 패턴 일관성
- 테스트 커버리지

Reference: .prompt-guides/04-coding-patterns.md
```

---

## Refactoring Prompts

### BehaviorSubject → Signal 마이그레이션
```
Angular 19 마이그레이션입니다.

파일: [경로]
현재: BehaviorSubject + takeUntil
목표: Signal + computed

현재 코드:
```typescript
[코드]
```

마이그레이션 요청:
- BehaviorSubject → signal()
- subscribe → effect() 또는 제거
- takeUntil 제거

Reference: apps/mobile/src/app/core/services/auth.service.ts
```

### 대규모 리팩토링
```
ULTRATHINK

파일: [경로]
목표: [리팩토링 목표]

현재 문제:
- [문제 1]
- [문제 2]

요구사항:
- 점진적 마이그레이션
- 기존 테스트 호환
- 트랜잭션 보장

Reference: [관련 파일들]
```

---

## Architecture Prompts

### 아키텍처 분석
```
ULTRATHINK

[모듈/기능] 아키텍처를 분석해주세요.

분석 항목:
1. 현재 구조 및 데이터 흐름
2. 개선 가능한 부분
3. 확장성 고려사항

Reference:
- .doc/ARCHITECTURE.md
- [관련 코드 경로]
```

### 새 기능 설계
```
/superpowers:brainstorm

[기능 이름]을 설계합니다.

요구사항:
- [요구사항 1]
- [요구사항 2]

고려사항:
- 기존 패턴과의 일관성
- 오프라인 지원 필요 여부
- State machine 영향

Reference: .doc/ARCHITECTURE.md
```

---

## Quick Copy Templates

### 에러 보고
```
[프로젝트 타입] 프로젝트입니다.
Error: [에러 코드/메시지]
File: [파일 경로]
[관련 코드]
```

### 기능 요청
```
[프로젝트 타입] 프로젝트입니다.
기능: [이름]
위치: [경로]
요구사항:
- [항목들]
Reference: [참조 파일]
```

### 분석 요청
```
ULTRATHINK
[대상]을 분석해주세요.
목적: [분석 목적]
Reference: [관련 파일]
```

---

## Project-Specific Shortcuts

| 작업 | 프롬프트 시작 |
|------|--------------|
| API 디버깅 | `NestJS 11 프로젝트입니다. Endpoint:` |
| UI 디버깅 | `Angular 19 + Ionic 8 프로젝트입니다. Component:` |
| Store 디버깅 | `NgRx SignalStore 프로젝트입니다. Store:` |
| Offline 디버깅 | `Dexie.js 프로젝트입니다. 증상:` |
| 새 기능 | `Logistics ERP 풀스택 프로젝트입니다. 기능:` |
