# Logistics ERP Prompt Engineering Guide

> **Claude Opus 4.5** 최적화 프롬프트 가이드
> Last Updated: 2025-12-12
> 물류 센터 주문 관리 시스템 (Offline-First)

---

## Quick Reference (빠른 참조)

필요한 섹션만 읽어서 **토큰을 효율적으로 사용**하세요.

| 상황 | 참조 파일 |
|------|----------|
| 🚀 처음 시작 | [`.prompt-guides/01-quick-start.md`](.prompt-guides/01-quick-start.md) |
| 🐛 에러 디버깅 | [`.prompt-guides/02-debugging-templates.md`](.prompt-guides/02-debugging-templates.md) |
| ✨ 새 기능 개발 | [`.prompt-guides/03-feature-templates.md`](.prompt-guides/03-feature-templates.md) |
| 📝 코딩 패턴 | [`.prompt-guides/04-coding-patterns.md`](.prompt-guides/04-coding-patterns.md) |
| ⛔ 금지 사항 | [`.prompt-guides/05-prohibitions.md`](.prompt-guides/05-prohibitions.md) |
| 🔧 Claude 도구 | [`.prompt-guides/06-tools-reference.md`](.prompt-guides/06-tools-reference.md) |
| 📋 즉시 사용 프롬프트 | [`.prompt-guides/07-ready-prompts.md`](.prompt-guides/07-ready-prompts.md) |

---

## Tech Stack (Version-Locked)

| Layer | Tech | Version |
|-------|------|---------|
| Backend | NestJS + Prisma | 11.x / 6.x |
| Database | PostgreSQL + Redis | 15.x / 7.x |
| Frontend | Angular + Ionic | 19.x / 8.x |
| Native | Capacitor | 6.x |
| State | NgRx SignalStore | 19.x |
| Offline | Dexie.js (IndexedDB) | 4.x |
| Runtime | Node.js | 20.18.0 |

---

## Top 5 Prompts (가장 자주 사용)

### 1️⃣ Signal 디버깅
```
Angular 19 + Signals 프로젝트입니다.
Component: [경로]
증상: [computed 업데이트 안 됨]
Reference: apps/mobile/src/app/core/services/auth.service.ts
```

### 2️⃣ Offline 동기화
```
Angular 19 + Dexie.js 프로젝트입니다.
증상: [sync 실패]
Reference: apps/mobile/src/app/core/services/sync-queue.service.ts
```

### 3️⃣ State Machine 에러
```
NestJS 프로젝트입니다.
Error: E2001 (INVALID_STATUS_TRANSITION)
From: [현재] → To: [목표]
Reference: apps/api/src/orders/order-state-machine.ts
```

### 4️⃣ 새 SignalStore
```
NgRx SignalStore 프로젝트입니다.
Store: [Name]Store
데이터: [설명]
Reference: apps/mobile/src/app/store/orders/orders.store.ts
```

### 5️⃣ 풀스택 기능
```
Logistics ERP 풀스택입니다.
기능: [이름]
API: [METHOD /path]
Reference: apps/api/src/orders/, apps/mobile/src/app/store/orders/
```

---

## Error Code Quick Reference

| Code | Category | Description |
|------|----------|-------------|
| **E1001** | Auth | 잘못된 비밀번호 |
| **E1002** | Auth | 토큰 만료 |
| **E2001** | Business | 잘못된 상태 전환 |
| **E2002** | Business | 정산 기간 잠김 |
| **E2017** | Business | 버전 충돌 (409) |
| **E3001** | Validation | 필수 필드 누락 |

전체 목록: [`.prompt-guides/05-prohibitions.md`](.prompt-guides/05-prohibitions.md#error-code-reference)

---

## Order State Machine (핵심)

```
UNASSIGNED → ASSIGNED → CONFIRMED → RELEASED → DISPATCHED → COMPLETED
                                                    ↓
                                              POSTPONED / ABSENT
```

**Guard 조건:**
- `RELEASED → DISPATCHED`: appointmentDate === today
- `DISPATCHED → COMPLETED`: serialsCaptured === true

자세히: [`.doc/ARCHITECTURE.md`](.doc/ARCHITECTURE.md)

---

## Key Patterns (한눈에)

### Signal (BehaviorSubject 대체)
```typescript
const data = signal<Data | null>(null);
const isLoaded = computed(() => data() !== null);
```

### SignalStore
```typescript
signalStore(
  withState<State>(initial),
  withComputed(({ items }) => ({ count: computed(() => items().length) })),
  withMethods((store) => ({ load: () => patchState(store, { ... }) }))
)
```

### Offline Queue
```typescript
await syncQueue.enqueue({
  method: 'PATCH', url: `/orders/${id}`,
  body: { status, expectedVersion }, priority: 2,
});
```

자세히: [`.prompt-guides/04-coding-patterns.md`](.prompt-guides/04-coding-patterns.md)

---

## Absolute Prohibitions (절대 금지)

| ❌ 금지 | 결과 |
|--------|------|
| State Machine 규칙 무시 | E2001 에러 |
| version 없이 UPDATE | 409 Conflict |
| Soft delete 필터 누락 | 삭제된 데이터 조회 |
| 한글 하드코딩 | i18n 위반 |
| 필수 헤더 생략 | 400 Bad Request |

자세히: [`.prompt-guides/05-prohibitions.md`](.prompt-guides/05-prohibitions.md)

---

## File Structure

```
.prompt-guides/
├── 01-quick-start.md        # Tech Stack, Top 5 Prompts
├── 02-debugging-templates.md # 디버깅 템플릿 6종
├── 03-feature-templates.md  # 기능 개발 템플릿 6종
├── 04-coding-patterns.md    # 필수 패턴 8종
├── 05-prohibitions.md       # 금지 사항 8종
├── 06-tools-reference.md    # Claude 도구 가이드
└── 07-ready-prompts.md      # 복사해서 쓰는 프롬프트
```

---

## Related Documentation

| 문서 | 내용 |
|------|------|
| [`CLAUDE.md`](CLAUDE.md) | 프로젝트 핵심 컨텍스트 |
| [`.doc/ARCHITECTURE.md`](.doc/ARCHITECTURE.md) | State Machine, Offline Sync |
| [`.doc/API_SPEC.md`](.doc/API_SPEC.md) | API 계약, 에러 코드 |
| [`.doc/DATABASE_SCHEMA.md`](.doc/DATABASE_SCHEMA.md) | DB 스키마, 인덱스 |

---

## Claude Tools Quick Reference

| 도구 | 활성화 | 용도 |
|------|--------|------|
| **ULTRATHINK** | 키워드 포함 | 복잡한 분석 |
| **Plan Mode** | Shift+Tab | 다중 파일 변경 |
| **Context7** | `use context7` | 공식 문서 참조 |
| **Brainstorm** | `/superpowers:brainstorm` | 아이디어 구체화 |

자세히: [`.prompt-guides/06-tools-reference.md`](.prompt-guides/06-tools-reference.md)

---

## Pre-Work Checklist

```markdown
□ State machine 전환 규칙 확인?
□ UPDATE 시 version 필드 포함?
□ i18n 키 사용? (한글 하드코딩 금지)
□ 오프라인 지원 필요?
□ 관련 Reference 파일 확인?
```
