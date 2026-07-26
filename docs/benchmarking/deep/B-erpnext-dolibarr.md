# 딥 벤치마킹 B — ERPNext × Dolibarr: 정산/원장/청구 설계

**작성일**: 2026-07-26 · **범위**: frappe/erpnext, Dolibarr/dolibarr 실제 소스 (GitHub `develop` 브랜치) 정독
**목적**: 국민트랜스 ERP의 정산 계산 엔진(`apps/api/src/settlement-fees/*`)·스키마(`prisma/schema.prisma`)와 두 OSS의 원장/요율/청구서 설계를 비교, 설계 아이디어만 채택(GPL-3.0 — 코드 이식 금지)
**선행 문서**: `docs/superpowers/specs/2026-07-25-masterdata-settlement-design.md`(PRD), `docs/benchmarking/2026-07-26-oss-benchmark.md`(1차 얕은 패스)

---

## 0. 라이선스 확인 [High]

```
gh api repos/frappe/erpnext --jq '.license.spdx_id'   → GPL-3.0
gh api repos/Dolibarr/dolibarr --jq '.license.spdx_id' → GPL-3.0
```

두 저장소 모두 **GPL-3.0**. 본 레포(폐쇄형 proprietary)는 코드 그대로 복사·각색 금지. 아래 모든 절은 "데이터 모델의 필드 구성·알고리즘·워크플로우"만 아이디어로 참고했으며, 스키마 필드명·주석·코드 스니펫을 그대로 옮기지 않았다. 인용된 코드 조각은 "어떤 설계인지 검증하기 위한 근거"이며 이식 대상이 아니다.

---

## 1. Stock Ledger Entry(SLE) 설계

### 1.1 SLE가 저장하는 것 [High]

`erpnext/stock/stock_ledger.py`의 `process_sle`가 SLE 1행에 쓰는 필드:

```python
sle.qty_after_transaction = flt(self.wh_data.qty_after_transaction, self.flt_precision)
sle.valuation_rate = self.wh_data.valuation_rate
sle.stock_value = self.wh_data.stock_value
sle.stock_queue = json.dumps(self.wh_data.stock_queue)
sle.stock_value_difference = stock_value_difference
```

`stock_ledger_entry.json` 도크타입 정의 기준 전체 필드 그룹:
- **이벤트 식별**: `item_code`, `warehouse`, `posting_date`, `posting_time`, `posting_datetime`, `voucher_type`, `voucher_no`, `voucher_detail_no`, `company`, `fiscal_year`
- **수량**: `actual_qty`(이 건의 증감량, +/-), `qty_after_transaction`(**누적 잔고 스냅샷**)
- **원가**: `incoming_rate`, `outgoing_rate`, `valuation_rate`, `stock_value`, `stock_value_difference`, `stock_queue`(FIFO 큐 직렬화)
- **상태**: `is_cancelled`, `is_adjustment_entry`

핵심은 **"건별 증감(actual_qty)"과 "그 시점 누적 잔고(qty_after_transaction)"를 같은 행에 동시에 저장**한다는 점이다. 왜 둘 다 필요한가:
- `actual_qty`만 있으면 특정 시점 잔고를 알기 위해 처음부터 전부 합산해야 한다(우리 `openingStock`이 지금 이 방식).
- `qty_after_transaction`만 있으면(스냅샷만) 그 건이 정확히 얼마를 더했는지, 원장으로서의 감사 추적(왜 이 잔고가 나왔는지)이 끊긴다.
- 두 필드를 한 행에 두면 **임의 시점 잔고 조회 = 인덱스 스캔 1건(가장 최근 `qty_after_transaction`)**이 되고, 동시에 **건별 증감 이력도 원장으로 보존**된다. 이것이 "이벤트 원장 + 누적치 동거"의 이유다.

출처: https://raw.githubusercontent.com/frappe/erpnext/develop/erpnext/stock/stock_ledger.py , https://raw.githubusercontent.com/frappe/erpnext/develop/erpnext/stock/doctype/stock_ledger_entry/stock_ledger_entry.json

### 1.2 우리 `openingStock` 전체 스캔의 문제 [High]

`apps/api/src/settlement-fees/settlement-fees.service.ts:175-186`:

```ts
private async openingStock(partnerId: string, before: Date): Promise<Map<string, number>> {
  const prior = await this.prisma.warehouseTransaction.findMany({
    where: { partnerId, transactionDate: { lt: before } },
    select: { productId: true, type: true, quantity: true },
  });
  // ... 전체 이전 거래를 합산
}
```

매월 마감마다 **거래처의 전체 과거 거래 이력을 무제한 스캔**한다(코멘트에 "F5 부채"로 이미 인지됨, `docs/benchmarking/2026-07-26-oss-benchmark.md` #2). 서비스 기간이 길어질수록 매달 이 스캔량이 선형 증가 — SLE의 `qty_after_transaction` 패턴이 정확히 이 문제의 해법이다.

### 1.3 구체 설계: SLE식 누적 컬럼 도입 [Medium]

**신규 컬럼 (WarehouseTransaction에 추가)**:

```prisma
model WarehouseTransaction {
  // ... 기존 필드
  qtyAfterTransaction Int  @map("qty_after_transaction")  // (partnerId, productId) 스코프 내 누적 잔고
}
```

- 삽입 시(직접입력/엑셀업로드 공통 경로) `qtyAfterTransaction = 직전 잔고 + (INBOUND ? +qty : -qty)`로 계산해 함께 기록. Prisma 트랜잭션 내에서 "직전 잔고 조회 → 계산 → insert"를 원자적으로 수행(SLE의 `get_previous_sle` 역할).
- **인덱스**: `@@index([partnerId, productId, transactionDate])` — 현재 `(partnerId, transactionDate)`, `(productId, transactionDate)` 두 개 대신(또는 추가로) 이 복합 인덱스가 "가장 최근 잔고 1건 조회"에 직접 대응한다. `openingStock`은 이제 다음으로 대체된다:
  ```sql
  SELECT qty_after_transaction FROM warehouse_transactions
  WHERE partner_id = ? AND product_id = ? AND transaction_date < ?
  ORDER BY transaction_date DESC LIMIT 1
  ```
  전체 스캔 → 인덱스 스캔 1건.
- **백필 전략**: 기존 데이터에 대해 1회성 마이그레이션 스크립트로 `(partnerId, productId)` 그룹별로 `transactionDate` 오름차순 정렬 후 러닝 합계를 계산해 채운다. `buildDailyStock`이 이미 동일한 러닝합 로직(`storage-fee.ts:22-27`)을 갖고 있으므로 그 로직을 재사용해 백필 스크립트를 짜면 된다(신규 알고리즘 불필요).
- **주의**: 과거 시점에 소급 입력(늦게 들어온 실적)이 생기면 그 이후 모든 `qtyAfterTransaction`을 재계산해야 한다 — 이건 섹션 2(Repost)로 이어진다.

**난이도**: M(신규 컬럼 + 백필 스크립트 + insert 경로 수정, PWA/엑셀 양쪽). 마이그레이션 위험: 백필 중 동시 쓰기 발생 시 정합성 깨짐 → 백필은 정산 마감 창(야간) 또는 write-lock 하에 수행 권장.

라이선스: 이 절은 알고리즘 아이디어만 참고(GPL-3.0, 코드 미이식).

---

## 2. Repost Item Valuation — 소급 재계산 설계

### 2.1 ERPNext 방식 [High]

`repost_item_valuation.py` 분석 결과:

- **트리거**: 문서 제출(`on_submit`) 시 자동, 또는 `repost_now()` 수동 호출, 실패 건은 `bulk_restart_reposting()`.
- **큐**: Redis 백엔드. 기본은 시간당 스케줄러(`repost_entries()`)가 `Queued` 상태 건을 순차 처리. 옵션으로 병렬 처리(`run_parallel_reposting()`, 15분 주기) — `frappe.enqueue(..., queue='long', timeout=1800, job_id=..., deduplicate=True)`로 **동일 항목 중복 실행 방지**.
- **상태 머신**: `Queued → In Progress → Completed / Skipped / Failed / Cancelled`. 상태 전이마다 `self.db_set('status', ...)`로 기록 — 각 재계산 시도가 감사 가능한 레코드로 남는다.
- **재계산 시작점**: `posting_date` + `posting_time` 조합(`get_combine_datetime`)이 커트오프. 이 시점 **이후의 모든 원장·전표**만 다시 계산(`get_future_stock_vouchers`).
- **중복 제거**: `deduplicate_similar_repost()`(같은 품목·창고 조합이면 오래된 재계산 요청을 `Skipped` 처리), `skip_reposts_covered_by_dependents()`.
- **감사 추적**: 실패 시 `error_log`(전체 스택트레이스) 필드에 기록 + 재고관리자 역할에 이메일 알림(`notify_error_to_stock_managers`). 완료된 재계산은 90일 후 `clear_old_logs`로 정리(무기한 보존이 아니라 정책적 TTL).

출처: https://raw.githubusercontent.com/frappe/erpnext/develop/erpnext/stock/doctype/repost_item_valuation/repost_item_valuation.py

### 2.2 우리 방식과 비교 [High]

`closeMonth`(`settlement-fees.service.ts:193-226`):

```ts
await this.prisma.$transaction(async (tx) => {
  await tx.settlementRecord.deleteMany({ where: { periodYearMonth: yearMonth } });
  await tx.settlementRecord.createMany({ data: records });
  await tx.settlementPeriod.upsert({ ... status: 'LOCKED' ... });
}, { timeout: 120_000, maxWait: 10_000 });
```

**차이점**:

| 축 | ERPNext | 우리 |
|---|---|---|
| 실행 방식 | 백그라운드 큐(Redis), 동기 API 응답과 분리 | 동기 트랜잭션(최대 120초 타임아웃) 내 즉시 실행 |
| 재계산 범위 | 커트오프 시점 **이후만** 재계산 | 해당 월 **전체를 deleteMany 후 재생성**(월 내부는 항상 전량) |
| 멱등성 | Job ID + `deduplicate=True`, 상태 필드로 중복 실행 방지 | DB 트랜잭션의 원자성에만 의존(동시에 같은 월을 두 번 마감하면 트랜잭션 순서로 우연히 방지될 뿐, 명시적 락/상태 필드 없음) |
| 감사 추적 | 실패 로그·시도 이력이 `Repost Item Valuation` 문서로 영구(90일) 보존 | `deleteMany`로 **이전 계산 결과가 물리적으로 사라짐** — "이번 마감 전에 뭐가 있었는지" 이력 없음 |
| 실패 처리 | `Failed` 상태 + 이메일 알림 + 재시도 가능 | `BadRequestException(E4109)`로 즉시 실패, 재시도는 전체 재호출 |

우리 방식이 지금 규모(일 1만 건, 월 마감)엔 충분하지만(spec §8 "수 분 이내" 기준 충족), **감사 추적** 관점은 명백히 약하다: 마감을 재실행(재계산)하면 이전 `SettlementRecord`가 무엇이었는지 아무 흔적 없이 사라진다.

### 2.3 개선안 [Medium]

1. **하드 삭제 대신 버저닝**: `SettlementRecord`에 `supersededAt DateTime?` 또는 `version Int` 컬럼 추가. `closeMonth` 재실행 시 기존 레코드를 `deleteMany` 하지 않고 `supersededAt = now()`로 마킹 후 새 레코드를 삽입. 조회 쿼리는 `WHERE supersededAt IS NULL` 필터만 추가하면 되므로 API 계약 변화 최소.
2. **재계산 감사 로그**: 기존 `AuditLog` 모델(스키마에 이미 존재, `prisma/schema.prisma:469`)을 재사용해 "누가/언제/어느 월을 재마감했는지" 1건 기록 — 신규 모델 불필요, 배선만 추가.
3. **재계산 범위 축소는 비범위(YAGNI)**: ERPNext처럼 "이 시점 이후만" 부분 재계산은 우리 스케일(일 1만 건, 월 단위 마감)에서 정확성 이득 대비 구현 비용이 크다 — 월 전체 재계산 유지, 대신 위 1·2번만 채택.

**난이도**: S(컬럼 1개 + AuditLog 배선). 마이그레이션 위험: 낮음(추가 컬럼, 기존 로직 무변경 가능 — nullable 컬럼이라 하위호환).

라이선스: 큐/상태머신 개념만 참고(GPL-3.0, 코드 미이식).

---

## 3. 요율 유효기간·우선순위 설계

### 3.1 ERPNext Pricing Rule / Item Price [High]

`pricing_rule.py`:
- `valid_from` / `valid_upto` 날짜 필드 + `validate_from_to_dates()` 검증.
- `priority: DF.Literal["", "1", ..., "20"]` — 문자열 리터럴이지만 사실상 숫자 순위, `has_priority` 체크박스로 우선순위 강제 여부 결정.
- `apply_multiple_pricing_rules` 플래그: 켜져 있으면 여러 규칙의 할인이 **누적**(`margin_rate_or_amount += pricing_rule.margin_rate_or_amount`), 꺼져 있으면 우선순위 1건만 적용.
- 스코프 축: `applicable_for`(Customer/Customer Group/Territory), `apply_on`(Item Code/Item Group/Brand/Transaction), `min_qty`/`max_qty`(수량 구간).
- 다중 규칙 매칭 시 "Recursive Discounts with Mixed condition is not supported"로 **혼합 조건 조합 자체를 금지**해 알고리즘 복잡도를 낮춤 — 참고할 만한 실용적 절충.

`item_price.json`: `valid_from`(기본값=오늘), `valid_upto`, `price_list`, `customer`/`supplier`, `uom`. **주의: `item_code + price_list` 조합에 DB 레벨 unique 제약이 없다**(WebFetch 확인 결과 "No explicit unique constraints... isn't formally enforced at the database level") — 즉 ERPNext도 이 부분은 애플리케이션 레벨 검증에 의존하는 약점이 있다[Medium, 소스 코드 전체 미확인이라 doctype JSON 레벨 결론].

출처: https://raw.githubusercontent.com/frappe/erpnext/develop/erpnext/accounts/doctype/pricing_rule/pricing_rule.py , https://raw.githubusercontent.com/frappe/erpnext/develop/erpnext/stock/doctype/item_price/item_price.json

### 3.2 Dolibarr ProductCustomerPrice [High]

`productcustomerprice.class.php`:
- 필드: `fk_product`, `fk_soc`(거래처), `price`/`price_ttc`, `tva_tx`, `date_begin`/`date_end`.
- **히스토리 = 로그 테이블에 전체 행 복사**: `update()` 시 변경 전 레코드를 `product_customer_price_log` 테이블에 INSERT 후 원본을 수정. Row-level 버저닝이 아니라 **로그 테이블 스냅샷**.
- `verifyDates()`가 같은 `(fk_product, fk_soc)` 조합 내에서 기간 중복을 검사 — ERPNext의 priority 숫자 방식과 달리 **"기간 배타(no-overlap)"로 우선순위 모호성 자체를 원천 차단**하는 방식.
- 거래처별 가격이 있으면 일반 상품 가격을 **대체**(우선순위 숫자가 아니라 "더 구체적인 스코프가 있으면 그것을 쓴다"는 암묵적 규칙).

출처: https://raw.githubusercontent.com/Dolibarr/dolibarr/develop/htdocs/product/class/productcustomerprice.class.php

### 3.3 우리 3단 우선순위 + 유효기간 버저닝 최소 설계 [Medium]

현재 `transport-fee.ts:22-28`의 우선순위(변경 없음, 그대로 유지):

```ts
차량 지정(TransportRateCard) > 품목(Product.transportRate) > 거래처 기본(Partner.defaultTransportRate)
```

**최소 스키마 추가안** — Dolibarr의 "기간 배타" 방식을 채택(ERPNext의 숫자 priority보다 우리 3단 구조엔 더 적합 — 스코프 자체가 이미 우선순위이므로 추가로 숫자를 매길 필요 없음):

```prisma
model Product {
  // ... 기존
  transportRate         Decimal? // 유지(하위호환, "현재값" 캐시로만 사용)
}

model ProductTransportRateHistory {
  id            String   @id @default(uuid())
  productId     String
  rate          Decimal  @db.Decimal(14, 2)
  effectiveFrom DateTime @db.Date
  effectiveTo   DateTime? @db.Date  // null = 현재까지 유효
  product       Product  @relation(fields: [productId], references: [id])
  @@index([productId, effectiveFrom, effectiveTo])
}
```

같은 패턴을 `Partner.defaultTransportRate`, `TransportRateCard.rate`에도 적용(3개 히스토리 테이블 또는 공용 `RateVersion(scope: PRODUCT|PARTNER|VEHICLE, scopeId, rate, effectiveFrom, effectiveTo)` 단일 테이블 — 후자가 스키마 증식을 막아 더 라조지만, 스코프별 검증 로직(예: `VEHICLE`은 `TransportRateCard` FK 필요)이 다형이라 판별 컬럼이 지저분해질 수 있음. 3개 히스토리 테이블 쪽이 타입 안전성은 더 높다).

**No-overlap 제약**: Postgres `EXCLUDE USING gist (product_id WITH =, daterange(effective_from, effective_to) WITH &&)` — Dolibarr의 `verifyDates()`(애플리케이션 레벨 검사)보다 DB 레벨 제약이 더 안전(경쟁 상태에서도 보장).

**과거 정산 재현성 보장** — 이미 우리 설계가 이 부분은 강하다:
- `SettlementRecord.calculationDetail`(Json)에 "적용 요율 값·출처"가 계산 시점에 스냅샷으로 박혀 있다(`transport-fee.ts` `detail.appliedRate`, `detail.rateSource`). 요율이 나중에 바뀌어도 **과거 SettlementRecord는 불변**(PRD §3.7에 이미 명시된 설계 원칙).
- 히스토리 테이블을 추가하면 얻는 것은 "그 요율이 그 시점에 왜 유효했는지"를 **계산 시점(마감 실행 시각)** 기준이 아니라 **거래 발생 시점(`transactionDate`)** 기준으로 정확히 조회할 수 있다는 것. 현재는 `computeMonth`가 계산 실행 시점의 `Product.transportRate`(현재값)를 읽으므로, 만약 요율이 월중에 바뀌었는데 마감을 늦게 실행하면 그 달 전체에 "마감 시점의 요율"이 소급 적용되는 위험이 있다(ledger Task 11 deferred 항목과 동일 결함군).
- 히스토리 테이블 도입 후 조회 로직: `WHERE productId = ? AND effectiveFrom <= tx.transactionDate AND (effectiveTo IS NULL OR effectiveTo > tx.transactionDate)`로 **건별 거래일 기준** 요율을 조회하도록 `computeMonth`를 수정.

**난이도**: S~M(히스토리 테이블 3개 또는 1개 + no-overlap 제약 + `computeMonth`의 요율 조회 로직을 "현재값" → "거래일 기준 조회"로 변경). 마이그레이션 위험: 기존 `Product.transportRate` 등 단일 컬럼값을 히스토리 테이블의 초기 1행(`effectiveFrom = 서비스 시작일 or NULL`)으로 백필해야 하며, 기존 컬럼을 남겨둘지(캐시) 제거할지 결정 필요 — 남겨두고 "최신값 캐시"로 유지하는 편이 조회 성능과 하위호환 양쪽에 안전.

라이선스: 스키마 설계 아이디어만 참고(GPL-3.0, 코드 미이식).

---

## 4. 청구서(Invoice) 설계

### 4.1 Dolibarr Facture [High]

`facture.class.php`:
- **번호 채번**: 저장 시 임시로 `$this->ref = '(PROV'.$this->id.')'`(provisional). 실제 채번은 별도 모듈의 `getNextNumRef()`(마스크 기반 넘버링 — 소스 발췌엔 구현부 없음, 패턴만 확인)이 검증(validate) 시점에 실행되어 확정 번호로 교체.
- **상태 머신**: `STATUS_DRAFT(0) → STATUS_VALIDATED(1) → STATUS_CLOSED(2)` / `STATUS_ABANDONED(3)`. `validate()`, `set_paid()` 메서드가 전이를 수행. `CLOSECODE_*` 상수(DISCOUNTVAT, BADDEBT, PRODUCTRETURN 등)로 "왜 닫혔는지"까지 세분화.
- **라인 아이템**(`FactureLigne`): `desc`, `subprice`, `qty`, `tva_tx`(개별 라인 VAT율), `remise_percent`(할인율), `date_start`/`date_end`(기간 과금용).
- **세금 계산**: 라인별 `tva_tx`를 갖고 `update_price()`가 `total_ht`(공급가액)/`total_tva`(부가세)/`total_ttc`(합계)를 재계산. 다중 지방세(`localtax1`, `localtax2`) 지원 — 우리는 단일 부가세 10%라 훨씬 단순화 가능.
- **PDF 파이프라인**: DB 커밋 후 `call_trigger('BILL_CREATE', $user)` 훅 발생, `model_pdf` 필드에 선택된 PDF 템플릿명을 저장해두고 그 템플릿으로 렌더링(즉 "저장 → 이벤트 훅 → 템플릿 선택 렌더링"의 3단 파이프라인).

출처: https://raw.githubusercontent.com/Dolibarr/dolibarr/develop/htdocs/compta/facture/class/facture.class.php

### 4.2 우리 정산서를 Invoice 문서로 승격 — 모델 설계 [Medium]

현재는 `SettlementRecord`(건별 계산 결과) 집계 + `statement-export.service.ts`(xlsx)만 존재, "청구서" 문서 자체가 없다(PRD §6.3, §9에서 PDF 비범위로 명시). 승격 시 최소 모델:

```prisma
enum InvoiceStatus {
  DRAFT       // 마감 직후, 아직 거래처 미확인
  ISSUED      // 발행(번호 확정, 거래처 열람 가능)
  PAID        // 입금 확인
  CANCELLED   // 취소(반드시 사유 필요)
}

model SettlementInvoice {
  id              String        @id @default(uuid())
  invoiceNo       String        @unique @db.VarChar(30)  // 기존 Order.orderNo 패턴 재사용(SI-YYYYMM-0001 등)
  partnerId       String
  periodYearMonth String        @db.VarChar(7)
  status          InvoiceStatus @default(DRAFT)
  subtotalAmount  Decimal       @db.Decimal(14, 2)   // 부가세 제외 합계(운송료+보관료)
  vatAmount       Decimal       @db.Decimal(14, 2)   // subtotal * 0.10
  totalAmount     Decimal       @db.Decimal(14, 2)   // subtotal + vat
  issuedAt        DateTime?
  issuedBy        String?
  paidAt          DateTime?
  cancelledAt     DateTime?
  cancelReason    String?

  partner Partner @relation(fields: [partnerId], references: [id])
  @@unique([partnerId, periodYearMonth])  // 거래처당 월 1건
  @@map("settlement_invoices")
}
```

- **라인 아이템**: 신규 라인 테이블을 또 만들 필요 없음 — 기존 `SettlementRecord`(운송료/보관료 건별)가 이미 라인 역할을 한다. `SettlementInvoice`는 **헤더(집계+상태+번호)**만 추가하고, `SettlementRecord`에 `invoiceId String?` FK를 붙여 연결(YAGNI — 별도 `InvoiceLine` 테이블은 `SettlementRecord`를 그대로 복제하는 것이라 불필요).
- **번호 채번**: Dolibarr의 "임시 PROV → 검증 시 확정" 패턴은 우리 상황(월 마감이 이미 원자적 트랜잭션)엔 과합 — `closeMonth` 트랜잭션 내에서 바로 `SI-{yearMonth}-{partnerSeq:04d}` 확정 채번으로 충분(기존 `Order.orderNo`, `Product.code`(`I-`+5자리) 자동채번 컨벤션과 동일 패턴 재사용, 신규 알고리즘 불필요).
- **상태 머신**: Dolibarr의 4단(Draft/Validated/Closed/Abandoned)을 우리 도메인에 맞게 `DRAFT/ISSUED/PAID/CANCELLED`로 단순화. 상태 전이는 기존 `Order` 상태 전이 가드 패턴(`erp-state` 스킬, 400 에러) 재사용.
- **부가세 10%**: Dolibarr처럼 라인별 세율(`tva_tx`)을 둘 필요 없음 — 국내 부가세는 전 품목 10% 단일세율이므로 헤더에 `vatAmount = subtotalAmount * 0.10` 한 줄로 충분(다중세율 지원은 YAGNI).
- **PDF 파이프라인**: Dolibarr의 "이벤트 훅 → 템플릿 렌더링"은 우리 기존 `Export` 모델(비동기 export 패턴, PRD §6.3에 재사용 명시)에 이미 대응 가능한 구조 — `Export.type`에 `SETTLEMENT_INVOICE_PDF` 추가하고 비동기 워커에서 PDF 생성 라이브러리(신규 의존성 도입 전 기존 xlsx 파이프라인 옆 의존성부터 확인) 호출. 신규 훅 시스템 불필요.

**난이도**: M(신규 모델 1개 + FK 배선 + 채번 + 상태전이 가드 + PDF 워커). 마이그레이션 위험: 기존 마감된 월의 `SettlementRecord`를 소급해서 `SettlementInvoice`로 채울지(과거분 소급 발행) 여부 결정 필요 — 하지 않는다면(향후 월만 적용) 위험 없음.

라이선스: 워크플로우·필드 구성만 참고(GPL-3.0, 코드 미이식).

---

## 5. Stock Reconciliation(실사)

### 5.1 ERPNext 방식 [High]

`stock_reconciliation.py`:
- 실사 문서 저장 시 `update_stock_ledger()`가 **카운트값(`row.qty`) − 시스템값(`row.current_qty`)**을 `actual_qty`로 하는 **조정 SLE 1건**을 생성(`voucher_type = "Stock Reconciliation"`, `is_adjustment_entry = 1`).
- 값 변화 없는 항목은 스킵(`row.qty == previous_sle.qty_after_transaction`).
- 원가(`valuation_rate`)는 사용자 입력값 → 시스템 이동평균값 → 표준원가 순으로 결정.
- 취소 시 `make_sle_on_cancel()`로 SLE를 역분개하고, 이후 원장은 `repost_future_sle_and_gle()`로 재계산(섹션 2의 Repost 메커니즘 그대로 재사용) — **실사도 결국 "원장에 이벤트 1건을 더 쌓고 이후를 재계산"이라는 동일 패턴**으로 처리된다는 게 핵심 시사점.

출처: https://raw.githubusercontent.com/frappe/erpnext/develop/erpnext/stock/doctype/stock_reconciliation/stock_reconciliation.py

### 5.2 우리 도메인 시사점 [Medium]

실사는 PRD §9에서 명시적 비범위(YAGNI, 후속 PRD)다 — 지금 구현할 필요 없음. 다만 향후 도입 시 설계 원칙만 기록: 실사를 별도 특수 테이블로 만들지 말고, **섹션 1에서 도입할 `qtyAfterTransaction` 원장에 "조정 타입" 거래(`WarehouseTransaction.type`에 `ADJUSTMENT` 추가하거나 `source`에 반영)를 하나 더 쌓는 방식**이 ERPNext와 동일한 구조이며, 이는 섹션 1의 원장 설계를 그대로 재사용할 수 있다는 뜻 — 신규 원장 메커니즘을 또 만들 필요가 없다.

라이선스: 개념만 참고(GPL-3.0, 코드 미이식). **지금 구현 대상 아님 — YAGNI.**

---

## 6. 우리 도메인 매핑 표

| OSS 개념 | 우리 스키마/모듈 | 신규 모델? | 난이도 | 마이그레이션 위험 |
|---|---|---|---|---|
| SLE `qty_after_transaction`(누적 잔고) | `WarehouseTransaction` + `openingStock()`(현행 전체스캔) | 아니오(컬럼 추가) | **M** | 백필 중 동시쓰기 정합성 — 야간/락 필요 |
| SLE `is_cancelled`(역분개) | 현재 없음(트랜잭션 삭제/수정 이력 없음) | 아니오(컬럼 추가 또는 후속) | S | 낮음 — 후속 PRD 대상 |
| Repost Item Valuation(큐+상태머신+감사로그) | `closeMonth()`의 `deleteMany+createMany` | 아니오(컬럼 추가: `supersededAt`) + 기존 `AuditLog` 배선 | **S** | 낮음(nullable 컬럼) |
| Pricing Rule `valid_from/upto`+priority | `TransportRateCard`/`Product.transportRate`/`Partner.defaultTransportRate`(현재 유효기간 없음) | 예(히스토리 테이블 1~3개) | **S~M** | 기존 단일값 → 히스토리 초기행 백필 |
| Item Price `price_list`별 단가 | 해당 없음(우리는 단가가 아니라 요율 체계, `Product.unitPrice`가 유사) | 부분 해당 | - | - |
| ProductCustomerPrice `date_begin/end` + no-overlap | 위와 동일(거래처별 운송요율 유효기간) | 예(위와 통합) | S~M | 위와 동일 |
| Subscription(반복청구) | 정산은 이미 월 단위 배치(`closeMonth`)라 "구독" 개념 자체 불필요 | 아니오 | - | 해당 없음(YAGNI) |
| Facture 상태머신(Draft/Validated/Closed/Abandoned) | `SettlementRecord`(상태 없음, 집계만) | 예(`SettlementInvoice`) | **M** | 과거월 소급 발행 여부 결정 필요 |
| Facture 번호채번(getNextNumRef) | 없음(정산서에 번호 없음) | 신규 필드(`invoiceNo`) | S | 낮음(기존 `Order.orderNo` 패턴 재사용) |
| Facture VAT 계산(`total_ht/tva/ttc`) | 없음(현재 정산은 부가세 미반영) | 신규 필드(헤더 3개) | S | 낮음 |
| Facture PDF 파이프라인(훅+템플릿) | `Export` 모델(엑셀만) | 아니오(기존 `Export.type` 확장) | M | 낮음(신규 워커 로직만) |
| Stock Reconciliation(실사 조정 SLE) | 없음(PRD §9 명시적 비범위) | 예(후속) | L | **후속 PRD — 지금 손대지 않음** |

---

## 7. 종합 라이선스 경고

- **frappe/erpnext**: GPL-3.0. 위 섹션 1, 2, 3, 5의 모든 코드 인용은 "이 함수가 무엇을 하는지" 검증용 발췌이며, 실제 구현 시 NestJS/Prisma로 **처음부터 새로 작성**해야 한다. 필드명(`qty_after_transaction` 등)조차 우리 컨벤션(camelCase, Prisma 매핑)으로 재명명해 사용했다 — 원문 그대로 복사한 부분 없음.
- **Dolibarr/dolibarr**: GPL-3.0. 섹션 4의 `facture.class.php`, `productcustomerprice.class.php`, `contrat.class.php` 인용도 동일 원칙 — PHP 코드 자체는 이식 불가, "번호채번을 임시값→확정값으로 분리한다", "히스토리를 로그 테이블에 전체 복사한다" 같은 **워크플로우 아이디어**만 채택.
- 두 저장소 모두 스택이 이질적(Python/Frappe, PHP)이므로 라이선스 문제와 별개로 코드 이식 자체가 실질적으로 불가능 — 참고는 전적으로 "스키마 필드 구성·알고리즘·상태머신 설계"에 국한.
- 본 문서에서 실제로 구현을 권고한 항목(섹션 1 누적컬럼, 섹션 2 버저닝, 섹션 3 유효기간 히스토리, 섹션 4 Invoice 모델)은 모두 **우리 자체 스키마 확장 설계**이며 OSS 코드가 필요하지 않다 — `docs/benchmarking/2026-07-26-oss-benchmark.md` #1의 결론("자체수정, OSS 참고 불필요할 만큼 자명한 패턴")과 일치한다.

---

## 인용 소스 전체 목록

- https://raw.githubusercontent.com/frappe/erpnext/develop/erpnext/stock/stock_ledger.py
- https://raw.githubusercontent.com/frappe/erpnext/develop/erpnext/stock/doctype/stock_ledger_entry/stock_ledger_entry.json
- https://raw.githubusercontent.com/frappe/erpnext/develop/erpnext/stock/doctype/repost_item_valuation/repost_item_valuation.py
- https://raw.githubusercontent.com/frappe/erpnext/develop/erpnext/accounts/doctype/pricing_rule/pricing_rule.py
- https://raw.githubusercontent.com/frappe/erpnext/develop/erpnext/stock/doctype/item_price/item_price.json
- https://raw.githubusercontent.com/frappe/erpnext/develop/erpnext/accounts/doctype/subscription/subscription.py
- https://raw.githubusercontent.com/frappe/erpnext/develop/erpnext/stock/doctype/stock_reconciliation/stock_reconciliation.py
- https://raw.githubusercontent.com/Dolibarr/dolibarr/develop/htdocs/compta/facture/class/facture.class.php
- https://raw.githubusercontent.com/Dolibarr/dolibarr/develop/htdocs/product/class/productcustomerprice.class.php
- https://raw.githubusercontent.com/Dolibarr/dolibarr/develop/htdocs/contrat/class/contrat.class.php
- 로컬: `prisma/schema.prisma`, `apps/api/src/settlement-fees/settlement-fees.service.ts`, `storage-fee.ts`, `transport-fee.ts`, `docs/superpowers/specs/2026-07-25-masterdata-settlement-design.md`, `docs/benchmarking/2026-07-26-oss-benchmark.md`
