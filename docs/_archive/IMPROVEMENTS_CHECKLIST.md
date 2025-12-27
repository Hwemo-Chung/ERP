# ✅ 즉시 실행 개선 체크리스트

> 기존 문서 vs PRD_03.md 교차 검증 후 **실행 필요한 아이템만** 정리

---

## 🔴 P0 (긴급 - 이번 주)

### 1. ARCHITECTURE.md 개정: 동시성 제어 전략 추가
**현황**: Optimistic Locking만 명시
**개선**: 이중 전략 (Redis Lock + Optimistic)

**추가 내용**:
```
### 4.1 동시성 제어 (Concurrency Control)

1. 배정 단계 (Redis Distributed Lock)
   - 키: order:{orderId}:lock, TTL: 3초
   - 먼저 선점한 요청만 처리 → SETNX

2. 데이터 수정 (Optimistic Locking)
   - orders 테이블에 version 컬럼 추가
   - UPDATE ... WHERE id=? AND version=?
   - Affected Rows=0 → 충돌 발생
```

---

### 2. PRD.md 개정: 비기능 요구사항 추가
**현황**: 23개 FR만 명시
**개선**: 성능/동시성 요구사항 추가

**추가 섹션**:
```
## 6. Non-Functional Requirements (개정)

### 동시성 제어
- 배정 단계: Redis Mutex (TTL 3초)
- 데이터 수정: Optimistic Locking (version 기반)

### 저사양 기기 (2GB RAM)
- 초기 번들: < 2MB (현재 1.52MB)
- 애니메이션: transform/opacity만 허용
- 이미지: WebP + 1024px max
- 저사양 모드: 애니메이션 OFF 옵션

### 알림 시스템
- 개별 알림: < 1초 SLA
- 대량 공지: Throttling (50건/초)
- 아키텍처: API → BullMQ → Worker → FCM
```

---

## 🟡 P1 (단기 - 2주일 내)

### 3. DATABASE_SCHEMA.md 개정: 파티셔닝 + 캐싱
**추가**:
```sql
-- 월 단위 파티셔닝
ALTER TABLE orders PARTITION BY RANGE (YEAR_MONTH(created_at));

-- Covering Index
CREATE INDEX idx_order_list ON orders
  (status, promise_date, id, customer_name, installer_id);
```

---

### 4. 신규 문서: PERFORMANCE_GUIDE.md
**내용**: 저사양 기기 최적화 기준 (개발팀용)
- Change Detection: OnPush 필수
- Virtual Scrolling: 50개 이상 필수
- 애니메이션 금지 규칙
- 이미지 압축 기준

---

## ✅ 삭제 대상 파일

| 파일 | 이유 |
|------|------|
| VALIDATION_SUMMARY.md | 내용 자체가 요약본 |
| ARCHITECTURE_IMPROVEMENTS.md | 내용을 ARCHITECTURE.md에 직접 통합 |
| CROSS_VALIDATION_ANALYSIS.md | 너무 길어서 분석 자체가 필요 없음 |
| PRD_03.md | Gemini 작성본이므로 _archive/로 이동 |

---

## 📊 최종 문서 구조

```
docs/
├── README.md
├── PROGRESS.md
├── IMPROVEMENTS_CHECKLIST.md ← 이 파일
├── PERFORMANCE_GUIDE.md (신규)
├── technical/
│   ├── PRD.md (개정 ✅)
│   ├── ARCHITECTURE.md (개정 ✅)
│   ├── DATABASE_SCHEMA.md (개정 ✅)
│   ├── API_SPEC.md
│   ├── DEPLOYMENT.md
│   ├── SDD.md
│   └── PROJECT_OVERVIEW.md
└── _archive/
    └── PRD_03.md (참고용)
```

---

## 🚀 실행 순서

1. ✅ ARCHITECTURE.md 개정
2. ✅ PRD.md 개정  
3. ✅ DATABASE_SCHEMA.md 개정
4. ✅ PERFORMANCE_GUIDE.md 작성
5. ✅ 불필요한 파일 삭제
6. ✅ PRD_03.md → _archive/로 이동

---

**최종 목표**: 불필요한 분석 문서 제거, 핵심 기술 문서만 유지 + 개선
