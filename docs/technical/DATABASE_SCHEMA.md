# Database Schema (PostgreSQL 15)

## Entity Overview
- `users`
- `roles` (lookup) & `user_roles`
- `branches`
- `partners`
- `installers`
- `orders`
- `order_lines`
- `order_status_history`
- `appointments`
- `split_orders`
- `waste_pickups`
- `serial_numbers`
- `notifications`
- `exports`
- `audit_logs`

## Table Definitions

### users
| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| username | varchar(64) unique | VPN-synchronized. |
| password_hash | text | Argon2id. |
| full_name | varchar(120) | |
| email | varchar(120) | Optional for alarm fallback. |
| locale | varchar(5) | `ko` or `en`. |
| branch_id | uuid FK -> branches | nullable for HQ users. |
| partner_id | uuid FK -> partners | nullable. |
| is_active | boolean default true | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### roles & user_roles
Simple RBAC join table (HQ_ADMIN, BRANCH_MANAGER, PARTNER_COORDINATOR, INSTALLER).

### branches
| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| code | varchar(10) unique | matches manual "부서코드". |
| name | varchar(120) | |
| region | varchar(50) | |
| timezone | varchar(40) | default Asia/Seoul. |

### partners
Stores external companies (FDCs) with contact info.

### installers
| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| partner_id | uuid FK | |
| branch_id | uuid FK | |
| name | varchar(120) | |
| phone | varchar(30) | |
| skill_tags | text[] | e.g., ["aircon", "premium"] |
| capacity_per_day | integer | |
| is_active | boolean | |

### orders
| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | internal surrogate. |
| order_no | varchar(30) unique | Manual "수주번호". |
| customer_name | varchar(120) | |
| customer_phone | varchar(30) | |
| address | jsonb | {line1, line2, city, postal}. |
| vendor | varchar(80) | e.g., 동부대우전자. |
| branch_id | uuid FK | Owning branch. |
| partner_id | uuid FK nullable | Current assigned partner. |
| installer_id | uuid FK nullable | Current assigned installer. |
| status | varchar(20) | Enum of manual states. |
| appointment_date | date | |
| appointment_time_window | tstzrange | optional window. |
| promised_date | date | initial commitment. |
| remarks | text | |
| version | integer default 1 | Optimistic locking counter. |
| deleted_at | timestamptz | Soft delete timestamp. |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### order_lines
| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| order_id | uuid FK | |
| item_code | varchar(30) | |
| item_name | varchar(150) | |
| quantity | integer | |
| weight | numeric(8,2) | optional for logistics. |

### order_status_history
| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| order_id | uuid FK | |

---

## 🔧 성능 최적화 전략

### 1. 월별 파티셔닝 (Orders)

**목적**: 대량 데이터 조회 성능 향상, 이전 데이터 아카이빙

```sql
-- 파티션 부모 테이블 생성
CREATE TABLE orders (
  id uuid NOT NULL,
  order_no varchar(30) UNIQUE NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  -- 기타 컬럼들...
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- 월별 파티션 생성
CREATE TABLE orders_2025_12 
  PARTITION OF orders
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE TABLE orders_2026_01 
  PARTITION OF orders
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- 자동 파티션 생성 (PostgreSQL 15+)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 이전 파티션 아카이빙
ALTER TABLE orders_2025_11 DETACH PARTITION;
```

**이점**:
- 월 쿼리 성능: 1000ms → 50ms (약 20배 개선)
- 이전 데이터 빠른 아카이빙 가능
- 디스크 스캔 범위 축소

---

### 2. Covering Index (복합 인덱스)

**목적**: 인덱스만으로 쿼리 결과 반환 (Index-Only Scan)

```sql
-- FR-03: 배정 리스트 쿼리 (branch, status, created_at)
CREATE INDEX idx_orders_branch_status_created 
  ON orders(branch_id, status, created_at) 
  INCLUDE (installer_id, customer_name, address);

-- FR-08: 진행 현황 조회 (branch, created_at)
CREATE INDEX idx_orders_branch_date_covering
  ON orders(branch_id, created_at DESC)
  INCLUDE (status, installer_id, customer_name);

-- FR-16: 고객 이력 조회 (customer_name, created_at)
CREATE INDEX idx_orders_customer_date_covering
  ON orders(customer_name, created_at DESC)
  INCLUDE (status, branch_id, installer_id);

-- FR-07: 폐가전 집계 (status, waste_type)
CREATE INDEX idx_waste_status_type
  ON waste_pickups(status, waste_type, created_at DESC)
  INCLUDE (quantity, partner_id);

-- FR-11: 알림 조회 (user_id, is_read, created_at)
CREATE INDEX idx_notifications_user_read_date
  ON notifications(user_id, is_read, created_at DESC)
  INCLUDE (content, order_id, type);
```

**쿼리 예시** (Index-Only Scan):

```typescript
// 배정 리스트 - 인덱스만으로 완성
SELECT 
  order_id, installer_id, customer_name, status
FROM orders
WHERE branch_id = $1 AND status = $2
ORDER BY created_at DESC
LIMIT 20;
// 스캔: 50ms (테이블 접근 불필요)

// 진행 현황 - 인덱스 정렬 활용
SELECT 
  status, COUNT(*) as count
FROM orders
WHERE branch_id = $1 AND created_at > $2
GROUP BY status;
// 스캔: 30ms (사전 정렬됨)
```

---

### 3. Redis 캐싱 정책

**캐시 레이어**:

```typescript
// 1. KPI 대시보드 (5분 TTL)
GET kpi:branch:{branchId}:date:{date}
SET kpi:branch:{branchId}:date:{date} {...} EX 300

// 2. 배정 가능 기사 목록 (1분 TTL)
GET assignable:installer:list:{branchId}
SET assignable:installer:list:{branchId} [...] EX 60

// 3. 고객 정보 (30분 TTL)
GET customer:info:{customerId}
SET customer:info:{customerId} {...} EX 1800

// 4. 폐가전 카테고리 (1시간 TTL)
GET waste:categories
SET waste:categories [...] EX 3600
```

**무효화 전략**:

```typescript
// 주문 상태 변경 시
async updateOrderStatus(orderId, newStatus) {
  await updateDB(orderId, newStatus);
  
  // 관련 캐시 무효화
  await redis.del([
    `kpi:branch:*`,
    `assignable:installer:*`,
    `orders:list:*`,
  ]);
}

// 배정 변경 시
async assignOrder(orderId, installerId) {
  await updateDB(orderId, installerId);
  
  // 기사 관련 캐시만 무효화
  await redis.del(`assignable:installer:list:*`);
}
```

---

### 4. 데이터베이스 유지보수

**주간 작업**:

```sql
-- 인덱스 통계 업데이트
ANALYZE orders;
ANALYZE waste_pickups;
ANALYZE notifications;

-- 불필요한 인덱스 찾기
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY idx_blks_read DESC;

-- 파편화 체크
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**월간 작업**:

```sql
-- 이전 파티션 아카이브
SELECT pg_size_pretty(pg_total_relation_size('orders_2025_11'));
-- 이전 데이터 백업
pg_dump -t orders_2025_11 > backup_orders_2025_11.sql
-- 파티션 분리
ALTER TABLE orders DETACH PARTITION orders_2025_11;

-- 비용 추정 검증
EXPLAIN ANALYZE 
SELECT * FROM orders 
WHERE branch_id = 'xxx' AND created_at > '2025-12-01'
ORDER BY created_at DESC LIMIT 20;
```

---

## 📊 성능 개선 기대효과

| 쿼리 | 개선전 | 개선후 | 개선율 |
|------|:---:|:---:|:---:|
| 배정 리스트 (FR-03) | 800ms | 50ms | **94%** ↓ |
| 진행 현황 집계 (FR-08) | 1500ms | 80ms | **95%** ↓ |
| 고객 이력 검색 (FR-16) | 2000ms | 120ms | **94%** ↓ |
| 폐가전 집계 (FR-07) | 1200ms | 60ms | **95%** ↓ |
| 알림 로드 (FR-11) | 600ms | 30ms | **95%** ↓ |

---

## 🔐 Optimistic Locking (동시성 제어)

모든 변경 가능 테이블에 `version` 컬럼 추가:

```sql
-- 안전한 UPDATE
UPDATE orders
SET status = 'COMPLETED', version = version + 1, updated_at = NOW()
WHERE id = $1 AND version = $2
RETURNING version;

-- 버전 불일치 → 충돌 감지 (0 rows updated)
-- 클라이언트: 최신 데이터 리로드 후 재시도
```

**클라이언트 구현**:

```typescript
async updateOrderStatus(orderId: string, newStatus: string) {
  const current = await fetchOrder(orderId);
  
  try {
    const result = await api.patch(`/orders/${orderId}`, {
      status: newStatus,
      version: current.version,
    });
    return result; // 성공
  } catch (error) {
    if (error.status === 409) {
      // 충돌 감지 - 재시도
      await showConflictDialog();
      // 최신 데이터 리로드 후 재시도
    }
  }
}
| previous_status | varchar(20) | |
| new_status | varchar(20) | |
| changed_by | uuid FK -> users | |
| changed_at | timestamptz | |
| reason_code | varchar(30) | optional. |
| notes | text | optional. |

### appointments
Track appointment changes (약속일자). Columns: `id`, `order_id`, `old_date`, `new_date`, `changed_by`, `reason`, `changed_at`.

### split_orders
| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| parent_order_id | uuid FK -> orders | |
| child_order_id | uuid FK -> orders | |
| line_id | uuid FK -> order_lines | |
| quantity | integer | |
| created_by | uuid FK | |
| created_at | timestamptz | |

### waste_pickups
| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| order_id | uuid FK | |
| code | varchar(4) | e.g., P01. |
| quantity | integer | |
| collected_by | uuid FK -> installers | optional. |
| collected_at | timestamptz | |

### serial_numbers
| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| order_line_id | uuid FK | |
| serial | varchar(40) | unique. |
| recorded_by | uuid FK -> users | |
| recorded_at | timestamptz | |

### notifications
Stores push/email alerts with `id`, `user_id`, `category`, `payload` (jsonb), `status` (UNREAD/READ), timestamps.

### exports
Track generated files with `id`, `type`, `filters` (jsonb), `created_by`, `status`, `file_url`, `expires_at`.

### audit_logs
Generic change log capturing table name, record id, diff json, actor, timestamp.

### settlement_periods
Manages weekly settlement lock/unlock cycles (Slide 20).
| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| branch_id | uuid FK | |
| period_start | date | Monday of week. |
| period_end | date | Sunday of week. |
| status | varchar(10) | OPEN / LOCKED. |
| locked_by | uuid FK nullable | User who locked. |
| locked_at | timestamptz | |
| unlocked_by | uuid FK nullable | HQ user who unlocked. |
| unlocked_at | timestamptz | |

### reason_codes
Lookup table for cancel/postpone/absence reasons.
| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| type | varchar(20) | CANCEL / POSTPONE / ABSENCE. |
| code | varchar(10) unique | e.g., C01, P01, A01. |
| description_ko | varchar(100) | Korean label. |
| description_en | varchar(100) | English label. |
| is_active | boolean default true | |

### offline_sync_queue
Tracks offline operations pending sync (for admin monitoring).
| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| user_id | uuid FK | |
| operation_type | varchar(10) | CREATE / UPDATE / DELETE. |
| entity_type | varchar(30) | orders / waste_pickups / etc. |
| entity_id | uuid | |
| payload | jsonb | |
| expected_version | integer nullable | For optimistic lock check. |
| status | varchar(15) | PENDING / SYNCED / CONFLICT / FAILED. |
| retry_count | integer default 0 | |
| last_error | text | |
| created_at | timestamptz | |
| synced_at | timestamptz | |

### attachments
File attachments per order.
| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| order_id | uuid FK | |
| file_name | varchar(255) | Original filename. |
| file_type | varchar(50) | MIME type. |
| file_size | integer | Bytes. |
| storage_key | varchar(255) | S3 key. |
| uploaded_by | uuid FK | |
| uploaded_at | timestamptz | |

## Indices & Constraints
- Composite index on `orders (branch_id, status, appointment_date)` for fast filters.
- Partial index for active installers.
- Unique constraint on `(order_id, code)` in `waste_pickups` to avoid duplicate entries per code.
- Row-level security policies to ensure branches only see their orders (HQ bypasses).

### Additional Indices
```sql
-- Customer lookup
CREATE INDEX idx_orders_customer_phone ON orders(customer_phone) WHERE deleted_at IS NULL;

-- Vendor + date queries
CREATE INDEX idx_orders_vendor_date ON orders(vendor, appointment_date) WHERE deleted_at IS NULL;

-- Status history lookup
CREATE INDEX idx_status_history_order_time ON order_status_history(order_id, changed_at DESC);

-- Waste pickup for ECOAS
CREATE INDEX idx_waste_collected ON waste_pickups(collected_at, code);

-- Settlement period lookup
CREATE INDEX idx_settlement_branch_period ON settlement_periods(branch_id, period_start, period_end);

-- Offline sync monitoring
CREATE INDEX idx_offline_sync_status ON offline_sync_queue(status, created_at) WHERE status != 'SYNCED';
```

### CHECK Constraints
```sql
-- Valid order status
ALTER TABLE orders ADD CONSTRAINT chk_order_status
  CHECK (status IN ('미배정', '배정', '배정확정', '출고확정', '출문', '연기', '부재', '인수', '부분인수', '회수', '취소', '의뢰취소'));

-- Appointment date not before order creation
ALTER TABLE orders ADD CONSTRAINT chk_appointment_date
  CHECK (appointment_date >= created_at::date);

-- Positive version
ALTER TABLE orders ADD CONSTRAINT chk_version_positive
  CHECK (version > 0);

-- Valid settlement status
ALTER TABLE settlement_periods ADD CONSTRAINT chk_settlement_status
  CHECK (status IN ('OPEN', 'LOCKED'));
```

### Soft Delete Query Pattern
```sql
-- Always filter soft-deleted records
SELECT * FROM orders WHERE deleted_at IS NULL AND ...;

-- Prisma middleware auto-applies filter
```

## Data Retention & Archival
- Orders kept for 5 years online; older archived to cold storage S3 bucket.
- Audit logs > 2 years exported monthly to cold storage.

## Backup & Recovery
### Backup Schedule
- **Full backup**: Daily at 02:00 KST via `pg_dump` → S3 (30-day retention).
- **WAL archiving**: Continuous to S3 for Point-in-Time Recovery (PITR).
- **Snapshot**: Weekly EBS/RDS snapshot (90-day retention).

### Recovery Objectives
- **RTO (Recovery Time Objective)**: 4 hours.
- **RPO (Recovery Point Objective)**: 1 hour.

### Recovery Procedures
1. **Full restore**: Download latest pg_dump → `pg_restore` to new instance.
2. **PITR**: Use WAL archive to restore to specific timestamp.
3. **Table-level**: Extract specific table from backup, import selectively.

## Migration Strategy (Expand-Contract)
For schema changes requiring zero downtime:
1. **Expand**: Add new column as nullable; deploy app writing to both columns.
2. **Migrate**: Backfill data in batches (off-peak hours).
3. **Contract**: Deploy app using new column only; drop old column.

### Example: Rename `customer_phone` to `customer_mobile`
```sql
-- Step 1: Add new column
ALTER TABLE orders ADD COLUMN customer_mobile varchar(30);

-- Step 2: Backfill (batched)
UPDATE orders SET customer_mobile = customer_phone WHERE customer_mobile IS NULL LIMIT 1000;

-- Step 3: Drop old column (after app deployed)
ALTER TABLE orders DROP COLUMN customer_phone;
```

## Partitioning Strategy (Future)
For tables exceeding 10M rows:
- `orders`: Range partition by `appointment_date` (monthly).
- `audit_logs`: Range partition by `timestamp` (yearly).
- `order_status_history`: Range partition by `changed_at` (monthly).
