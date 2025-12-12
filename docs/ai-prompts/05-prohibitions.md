# Absolute Prohibitions (절대 금지 사항)

> Last Updated: 2025-12-12
> Project: Logistics ERP

---

## Overview

이 문서는 **반드시 피해야 할 패턴**을 정리합니다.
이 규칙을 위반하면 런타임 에러, 데이터 손상, 또는 보안 취약점이 발생합니다.

---

## 1. State Machine 규칙 위반 ❌

### Error Code: `E2001` (INVALID_STATUS_TRANSITION)

Order 상태는 정해진 순서로만 전환할 수 있습니다.

```
UNASSIGNED → ASSIGNED → CONFIRMED → RELEASED → DISPATCHED → COMPLETED → COLLECTED
                                                    ↓
                                              POSTPONED / ABSENT
```

### 위반 예시
```typescript
// ❌ BAD: UNASSIGNED에서 RELEASED로 직접 전환 불가
await prisma.order.update({
  where: { id },
  data: { status: 'RELEASED' }, // 현재가 UNASSIGNED면 에러
});
```

### Guard 조건 (반드시 확인)
| 전환 | 조건 |
|------|------|
| `RELEASED → DISPATCHED` | `appointmentDate === today` |
| `DISPATCHED → COMPLETED` | `serialNumber` 필수 |
| `ASSIGNED → CONFIRMED` | Branch staff 권한 필요 |

### Reference
- `apps/api/src/orders/order-state-machine.ts`
- `apps/api/src/orders/state-machine/guards/`

---

## 2. Version 필드 없이 UPDATE ❌

### Error Code: `E2017` (VERSION_CONFLICT) → HTTP 409

Optimistic Locking 없이 UPDATE하면 동시 수정 시 데이터 손실이 발생합니다.

### 위반 예시
```typescript
// ❌ BAD: version 체크 없음
await prisma.order.update({
  where: { id },
  data: { status: newStatus },
});
```

### 올바른 패턴
```typescript
// ✅ GOOD: version 필드로 Optimistic Locking
const result = await prisma.order.update({
  where: {
    id,
    version: expectedVersion,  // 현재 버전 확인
  },
  data: {
    status: newStatus,
    version: { increment: 1 },  // 버전 증가
  },
});

// rowcount = 0 이면 ConflictException 발생
if (!result) {
  throw new ConflictException({
    error: 'E2017',
    message: 'error.version_conflict',
    currentVersion: existingOrder.version,
  });
}
```

### Reference
- `apps/api/src/orders/orders.service.ts` (update 메서드)
- `.doc/ARCHITECTURE.md` (Optimistic Locking 섹션)

---

## 3. Soft Delete 필터 누락 ❌

### 증상: 삭제된 데이터가 조회됨

Prisma 미들웨어가 자동 적용하지만, **Raw Query 사용 시 직접 필터링 필수**.

### 위반 예시
```typescript
// ❌ BAD: deleted_at 필터 없음
const orders = await prisma.$queryRaw`
  SELECT * FROM orders WHERE branch_id = ${branchId}
`;
```

### 올바른 패턴
```typescript
// ✅ GOOD: deleted_at IS NULL 필터 추가
const orders = await prisma.$queryRaw`
  SELECT * FROM orders
  WHERE branch_id = ${branchId}
  AND deleted_at IS NULL
`;
```

### Reference
- `apps/api/src/prisma/prisma.service.ts` (middleware)
- `prisma/schema.prisma` (deletedAt 필드)

---

## 4. 한글 하드코딩 ❌

### 규칙: 모든 사용자 대면 텍스트는 i18n 키 사용

### 위반 예시
```typescript
// ❌ BAD: 한글 하드코딩
this.toastService.show('주문이 완료되었습니다');

// ❌ BAD: 템플릿에 한글
<ion-label>주문 목록</ion-label>
```

### 올바른 패턴
```typescript
// ✅ GOOD: i18n 키 사용
this.toastService.show(this.translate.instant('orders.completed'));

// ✅ GOOD: 템플릿에서 translate 파이프
<ion-label>{{ 'orders.list_title' | translate }}</ion-label>
```

### i18n Key 형식
```
MODULE.COMPONENT.KEY_NAME

예시:
- orders.list.title
- orders.detail.status_label
- errors.version_conflict
```

### Reference
- `apps/mobile/src/assets/i18n/ko.json`
- `apps/mobile/src/assets/i18n/en.json`

---

## 5. 필수 HTTP 헤더 생략 ❌

### Error Code: HTTP 400 Bad Request

API 호출 시 아래 헤더가 **필수**입니다.

```
X-App-Version: 1.2.3          # 앱 버전 (Semantic)
X-Device-Id: <UUID>           # 디바이스 고유 ID
X-Platform: web|android|ios   # 플랫폼
Authorization: Bearer <JWT>   # 인증 토큰
```

### Interceptor에서 자동 추가
```typescript
// apps/mobile/src/app/core/interceptors/headers.interceptor.ts
req = req.clone({
  setHeaders: {
    'X-App-Version': environment.version,
    'X-Device-Id': this.deviceService.getDeviceId(),
    'X-Platform': Capacitor.getPlatform(),
  },
});
```

### Reference
- `.doc/API_SPEC.md` (Required Headers 섹션)
- `apps/mobile/src/app/core/interceptors/`

---

## 6. Revert 규칙 무시 ❌

### 비즈니스 규칙: 기간 제한이 있음

| 작업 | 제한 |
|------|------|
| 완료 → 미처리 복원 | **당일 + 5일 이내** |
| 약속일자 변경 | **최초약속일 + 15일 이내** |

### 위반 시 에러
```json
{
  "error": "E2003",
  "message": "error.revert_period_exceeded",
  "details": {
    "completedAt": "2025-12-01",
    "currentDate": "2025-12-10",
    "maxDays": 5
  }
}
```

### Reference
- `.doc/ARCHITECTURE.md` (Revert Rules 섹션)
- `apps/api/src/orders/order-state-machine.ts`

---

## 7. Settlement Lock 기간 편집 ❌

### Error Code: `E2002` (SETTLEMENT_LOCKED)

매주 월요일 자동 Lock → 이전 주 데이터 수정 불가

### 증상
```
PATCH /orders/123 → 400 Bad Request
{
  "error": "E2002",
  "message": "error.settlement_locked",
  "details": {
    "lockedPeriod": "2025-12-02 ~ 2025-12-08",
    "lockType": "WEEKLY"
  }
}
```

### 해결법
- **HQ_ADMIN 권한**으로 수동 Unlock 필요
- Endpoint: `POST /api/settlement/{id}/unlock`

### Reference
- `apps/api/src/settlement/settlement.service.ts`
- `.doc/ARCHITECTURE.md` (Settlement Lock 섹션)

---

## 8. Critical Files 무단 변경 ❌

### 확인 없이 수정 금지 파일

| File | 위험 |
|------|------|
| `package.json` | 의존성 충돌, 버전 불일치 |
| `tsconfig.json` | 컴파일 에러, 타입 체크 비활성화 |
| `prisma/schema.prisma` | DB 스키마 변경, 마이그레이션 필요 |
| `angular.json` | 빌드 설정 변경 |
| `capacitor.config.json` | 네이티브 설정 변경 |
| `.nvmrc` / `.java-version` | 환경 버전 변경 |

### 변경 전 확인 사항
1. **WHAT**: 어떤 파일을 수정하는가?
2. **WHY**: 왜 이 수정이 필요한가?
3. **BEFORE/AFTER**: 변경 내용 diff
4. **IMPACT**: 예상되는 영향
5. **ROLLBACK**: 문제 시 복원 방법

---

## Quick Checklist (작업 전 확인)

```markdown
□ State machine 전환 규칙 확인했는가?
□ UPDATE 시 version 필드 포함했는가?
□ Raw query에 deleted_at IS NULL 추가했는가?
□ 한글 대신 i18n 키 사용했는가?
□ HTTP 헤더 인터셉터 확인했는가?
□ Revert 기간 제한 확인했는가?
□ Settlement lock 상태 확인했는가?
□ Critical file 변경 시 확인 받았는가?
```

---

## Error Code Reference

| Code | Category | Description |
|------|----------|-------------|
| E1001 | Auth | 잘못된 비밀번호 |
| E1002 | Auth | 토큰 만료 |
| E1003 | Auth | 권한 부족 |
| E2001 | Business | 잘못된 상태 전환 |
| E2002 | Business | 정산 기간 잠김 |
| E2003 | Business | 기간 초과 |
| E2017 | Business | 버전 충돌 (409) |
| E3001 | Validation | 필수 필드 누락 |
| E3002 | Validation | 잘못된 형식 |
