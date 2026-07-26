# ERP 개선 PRD — OSS 설계 벤치마킹 기반

**작성일**: 2026-07-26 · **대상**: (주)국민트랜스 물류 ERP · **근거**: 오픈소스 10종 심층 설계 벤치마킹
**선행 상태**: 마스터데이터·정산 MVP + 정산 옵션화 main 머지 완료 (API 테스트 385/385)

---

## 1. 개요

마스터데이터 코드화·운송료/보관료 정산 MVP가 가동 가능한 상태로 머지되었다. 이 PRD는 **오픈소스 ERP/WMS 10종의 설계를 실제 소스 코드 수준에서 분석**해 우리 구조의 결함과 다음 단계 기능을 도출한 결과다.

벤치마킹 대상 10종(전부 포크 완료):
odoo/odoo, frappe/erpnext, Dolibarr/dolibarr, inventree/InvenTree, ever-co/ever-gauzy, fjykTec/ModernWMS, openboxes/openboxes, openwms/org.openwms, enatega/food-delivery-multivendor, OCA/wms

심층 분석 리포트 4건(각 저장소별 실제 모델 파일·워크플로우 분석, 인용 URL 포함):
- `docs/benchmarking/deep/A-odoo-oca-wms.md` — 재고 정합성(quant vs move), 로케이션, 실사, 스캐너 상태머신
- `docs/benchmarking/deep/B-erpnext-dolibarr.md` — Stock Ledger Entry, 소급 재계산, 요율 유효기간, 청구서
- `docs/benchmarking/deep/C-inventree-modernwms-openwms.md` — 재고 단위 모델, 바코드 리졸버, 실사, 로케이션
- `docs/benchmarking/deep/D-gauzy-enatega-openboxes.md` — 배차·기사 위치, 트랜잭션 분류, 권한, 공유 타입

### 1.1 라이선스 원칙 (전 항목 적용, 예외 없음)

| 저장소 | 라이선스 | 이식 가능 범위 |
|---|---|---|
| inventree/InvenTree | MIT | **코드 각색 가능** (저작권·라이선스 문구 유지) |
| fjykTec/ModernWMS | Apache-2.0 | **코드 각색 가능** (변경 파일 명시 필요) |
| openwms/org.openwms | Apache-2.0 | 코드 각색 가능 (단, 자동화 도메인 불일치로 실익 없음) |
| enatega (rider 앱) | MIT | **코드 각색 가능** (백엔드는 비공개 — 클라이언트만) |
| openboxes/openboxes | EPL-1.0 | 파일 단위 copyleft — 아이디어만 채택 권고 |
| odoo/odoo | LGPL-3.0 | **코드 복사 금지** — 개념·구조만 |
| frappe/erpnext, Dolibarr | GPL-3.0 | **코드 복사 금지** — 개념·구조만 |
| ever-co/ever-gauzy, OCA/* | AGPL-3.0 | **코드 복사 금지** — 개념·구조만 |

세 저장소(InvenTree/ModernWMS/openwms) 모두 NOTICE 파일 없음(확인 완료) — MIT/Apache는 저작권 표기와 라이선스 전문 유지로 요건 충족.

**중요**: 아래 P0 3건은 전부 **우리 자체 스키마 확장**이며 OSS 코드를 필요로 하지 않는다. 벤치마킹의 기여는 "무엇이 잘못됐는지"를 규명한 것이다.

---

## 2. 현황 진단 — 벤치마킹으로 드러난 구조적 결함

### 2.1 요율에 유효기간이 없다 → 정산 금액이 마감 실행 시점에 좌우된다 [Critical]

`computeMonth`는 거래 건의 요율을 조회할 때 `Product.transportRate` / `Partner.defaultTransportRate` / `TransportRateCard.rate`의 **현재 값**을 읽는다(`settlement-fees.service.ts`, 거래에 include된 관계 필드). 요율 컬럼에는 유효기간이 없다.

결과: 7월 15일에 요율을 인상하고 7월분을 8월 초에 마감하면, **7월 1~14일 거래에도 인상된 요율이 소급 적용**된다. 반대로 마감을 먼저 하고 요율을 바꾸면 값이 달라진다. 같은 달을 언제 마감하느냐에 따라 청구액이 달라지는 상태 — 정산 시스템으로서 근본 결함이다.

ERPNext(Pricing Rule `valid_from`/`valid_upto`)와 Dolibarr(`ProductCustomerPrice.date_begin/date_end` + 기간 중복 검증) 모두 요율에 유효기간을 두고 **거래일 기준**으로 조회한다. 우리에게 없는 것은 이 한 가지다.

### 2.2 재고 잔고 스냅샷이 없다 → 전체 이력 스캔 [High]

`openingStock()`은 특정 시점의 재고를 구하기 위해 해당 거래처의 **전체 거래 이력**을 조회해 러닝 합계를 계산한다. 최종 리뷰에서 이미 부채(F5)로 기록된 항목이며, 벤치마킹은 이것이 설계 계열 결함임을 확인해 주었다:

- Odoo: `stock.quant`(현재고 스냅샷) + `stock.move`(불변 원장) **이중 구조** — 잔고 조회는 O(1)
- ERPNext: `Stock Ledger Entry`에 건별 증감(`actual_qty`)과 **누적 잔고(`qty_after_transaction`)를 같은 행에 저장** — 직전 1행만 읽으면 잔고 확정

우리는 원장만 있고 잔고가 없다. 데이터가 쌓이면 마감 시간이 이력 길이에 비례해 늘어난다.

### 2.3 재마감 시 이전 계산이 흔적 없이 사라진다 [High]

`closeMonth`는 재실행 시 `settlementRecord.deleteMany({ periodYearMonth })` 후 재삽입한다. 멱등성은 확보되지만 **"이전에는 얼마로 계산했었는지"가 소멸**한다. 거래처와 금액 분쟁이 생겼을 때 "무엇이 언제 어떻게 바뀌었는지" 증명할 수 없다.

ERPNext의 `Repost Item Valuation`은 소급 재계산을 큐 + 상태머신 + 감사 로그로 처리하며 이전 값을 보존한다. 우리는 이미 `AuditLog` 모델을 갖고 있으므로 배선만 하면 된다.

### 2.4 정산서가 "문서"가 아니다 [Medium]

현재 정산서는 `SettlementRecord` 집계 + xlsx 출력이다. **번호·상태·발행일·부가세가 없다.** 거래처에 청구 근거로 제시하려면 문서로서의 식별자와 상태가 필요하다. 국내 사업에서 부가세 10% 미반영은 실무상 곧 문제가 된다.

Dolibarr `Facture`(번호 채번 → 상태 머신 Draft/Validated/Closed/Abandoned → PDF 훅)가 정확히 이 모델이다.

### 2.5 부차 갭

| 갭 | 현황 | 벤치마킹 시사점 |
|---|---|---|
| 바코드/QR 입출고 | 없음(품목 텍스트 검색) | InvenTree `POST /barcode/` 리졸버 체인(MIT, 이식 가능) |
| 조정/실사 트랜잭션 | `TransactionType`이 INBOUND/OUTBOUND 2종뿐 | Odoo(가상 로케이션 대체 move), openboxes(TransactionCode 4종 분류) |
| 재고 임계 알림 | 없음(Notification 인프라는 있음) | openboxes `InventoryLevel`(min/reorder/max 3단) |
| 설치기사 위치 | 없음 | enatega rider(MIT): 상태 기반 적응형 전송 — 배송중 10m/30s, 대기 50m/60s |
| 프런트-백엔드 타입 이중 정의 | web service가 백엔드 DTO를 수동 미러링 | gauzy `packages/contracts`(구조만) — 우리는 Prisma 타입 재노출이 더 우월 |

---

## 3. 개선 항목

### P0 — 정산 정확성·감사 추적 (돈과 직결)

#### P0-1. 요율 유효기간 버저닝 (거래일 기준 요율 조회)

- **문제**: §2.1 — 마감 실행 시점의 현재 요율이 과거 거래에 소급 적용된다. 요율 인상/인하가 있는 달의 청구액이 마감 타이밍에 따라 달라진다.
- **개선안**:
  - 요율 히스토리 테이블 3개 신설(타입 안전성 우선): `ProductTransportRateHistory`, `PartnerTransportRateHistory`, `VehicleRateHistory` — 공통 필드 `{ scopeId, rate Decimal(14,2), effectiveFrom Date, effectiveTo Date? }`, `effectiveTo IS NULL` = 현재까지 유효.
  - 기간 중복 금지를 **DB 제약**으로: `EXCLUDE USING gist (scope_id WITH =, daterange(effective_from, effective_to) WITH &&)` (애플리케이션 검증보다 경쟁 상태에 안전).
  - 기존 단일 컬럼(`Product.transportRate` 등)은 **"현재값 캐시"로 유지**(하위호환 + 조회 성능). 화면에서 요율 변경 시 히스토리 행 추가 + 캐시 컬럼 갱신을 한 트랜잭션에서.
  - `computeMonth`의 요율 조회를 **건별 거래일 기준**으로 변경: `effectiveFrom <= tx.transactionDate AND (effectiveTo IS NULL OR effectiveTo > tx.transactionDate)`. 우선순위(차량 > 품목 > 거래처 기본)는 변경 없음.
  - 백필: 기존 단일값을 `effectiveFrom = 서비스 개시일`인 초기 1행으로 이관.
- **근거**: `docs/benchmarking/deep/B-erpnext-dolibarr.md` §3 (ERPNext Pricing Rule / Dolibarr ProductCustomerPrice 기간 배타 방식)
- **수용 기준**:
  1. 요율을 월중 변경한 시나리오 테스트: 변경 전 거래는 구 요율, 변경 후 거래는 신 요율로 계산되고, **마감을 언제 실행해도 결과가 동일**하다.
  2. 기간이 겹치는 히스토리 행 삽입 시 DB 제약으로 거부된다(테스트로 증명).
  3. 백필 후 기존 마감월 재계산 결과가 종전과 일치한다(회귀 없음).
  4. 요율 변경 화면에서 적용 시작일을 입력할 수 있고, 이력이 화면에 표시된다.
- **난이도**: S~M · **라이선스**: 자체 설계(GPL 코드 미사용)

#### P0-2. 거래 누적 잔고 컬럼 + 복합 인덱스

- **문제**: §2.2 — `openingStock()` 전체 이력 스캔. 이력 증가에 비례해 마감이 느려진다.
- **개선안**:
  - `WarehouseTransaction.qtyAfterTransaction Int` 추가 — `(partnerId, productId)` 스코프의 누적 잔고. 삽입 시 "직전 잔고 조회 → 계산 → insert"를 Prisma 트랜잭션 내 원자 수행(PWA 직접입력·엑셀 업로드 양 경로 공통).
  - 인덱스 `@@index([partnerId, productId, transactionDate])` 추가.
  - `openingStock()`을 "직전 1행 조회"로 대체: `WHERE partnerId=? AND productId=? AND transactionDate < ? ORDER BY transactionDate DESC LIMIT 1`.
  - 백필: `(partnerId, productId)` 그룹별 시간순 러닝 합계. `storage-fee.ts`의 `buildDailyStock` 러닝합 로직을 재사용(신규 알고리즘 불필요).
  - **소급 입력 처리**: 과거 일자로 실적이 늦게 입력되면 그 이후 행의 잔고를 재계산해야 한다 → 삽입 시 "이 거래일보다 뒤에 행이 존재하면 이후 행 재계산" 경로 필수(P0-3의 감사 로그와 함께 처리).
- **근거**: `deep/B` §1 (SLE `qty_after_transaction`), `deep/A` §1·§4 (quant vs move 이중 구조)
- **수용 기준**:
  1. 백필 후 전 거래의 `qtyAfterTransaction`이 러닝합과 일치(검증 스크립트 결과 첨부).
  2. 과거 일자 소급 입력 시 이후 행 잔고가 자동 재계산되고, 재계산 건수가 감사 로그에 남는다.
  3. `openingStock`이 인덱스 1행 조회로 동작함을 `EXPLAIN`으로 확인.
  4. 기존 정산 결과 회귀 없음(마감 재실행 결과 동일).
- **난이도**: M · **주의**: 백필 중 동시 쓰기 시 정합성 훼손 — 야간 또는 write-lock 하에 수행.

#### P0-3. 정산 재마감 버저닝 + 감사 추적

- **문제**: §2.3 — 재마감 시 `deleteMany`로 이전 계산이 소멸. 금액 분쟁 시 증명 불가.
- **개선안**:
  - `SettlementRecord.supersededAt DateTime?` 추가. 재마감 시 삭제 대신 `supersededAt = now()` 마킹 후 신규 삽입. 모든 조회에 `WHERE supersededAt IS NULL` 추가(API 계약 변경 없음).
  - 기존 `AuditLog`에 재마감 이벤트 기록: 누가/언제/어느 월/이전 총액→신규 총액.
  - 부분 재계산(ERPNext식 "이 시점 이후만")은 채택하지 않음 — 우리 규모에서 비용 대비 이득 없음.
- **근거**: `deep/B` §2 (Repost Item Valuation 큐·상태머신·감사로그)
- **수용 기준**:
  1. 같은 월을 두 번 마감하면 이전 레코드가 `supersededAt` 값을 갖고 보존되며, 정산서·breakdown 조회에는 최신본만 나온다.
  2. 재마감 이력이 `AuditLog`에 1건 기록되고 이전/신규 총액이 포함된다.
  3. `supersededAt` 필터 누락으로 금액이 이중 계상되지 않음을 테스트로 증명.
- **난이도**: S (nullable 컬럼 + 배선)

### P1 — 실무 효율·청구 문서화

#### P1-1. 정산서를 청구서 문서로 승격 (번호·상태·부가세·PDF)

- **문제**: §2.4 — 정산서에 식별자·상태·부가세가 없다.
- **개선안**:
  - `SettlementInvoice` 헤더 모델 신설: `invoiceNo`(`SI-YYYYMM-0001`, 기존 `Order.orderNo`/`Product.code` 자동채번 패턴 재사용), `status`(DRAFT/ISSUED/PAID/CANCELLED), `subtotalAmount`/`vatAmount`/`totalAmount`, `issuedAt/By`, `paidAt`, `cancelledAt`+`cancelReason`, `@@unique([partnerId, periodYearMonth])`.
  - **라인 테이블 신설하지 않음** — 기존 `SettlementRecord`가 라인 역할. `SettlementRecord.invoiceId String?` FK만 추가.
  - 부가세: 단일세율 10%를 헤더에 계산(다중세율 지원은 비범위).
  - 상태 전이 가드는 기존 주문 상태머신 패턴(400 에러) 재사용.
  - PDF: 기존 `Export` 모델의 비동기 export 패턴에 `SETTLEMENT_INVOICE_PDF` 타입 추가(신규 훅 시스템 불필요). PDF 라이브러리는 기존 의존성(`pdfkit` 존재) 우선 확인.
  - 과거 마감월 소급 발행 여부는 운영 결정 사항 — 기본은 향후 월만 적용.
- **근거**: `deep/B` §4 (Dolibarr Facture 번호채번·상태머신·PDF 훅)
- **수용 기준**:
  1. 월 마감 시 거래처별 청구서가 DRAFT로 생성되고 번호가 부여된다(거래처×월 1건 유일성 보장).
  2. 발행(ISSUED) 후 거래처 포털에서 열람 가능, DRAFT는 비노출.
  3. 부가세 = 공급가 × 10%, 합계 = 공급가 + 부가세가 화면·PDF·엑셀에서 일치.
  4. 취소 시 사유 필수, 취소된 청구서는 총액 집계에서 제외.
  5. PDF 다운로드가 동작하고 청구서 번호·기간·거래처·금액 3단이 표시된다.
- **난이도**: M

#### P1-2. 바코드/QR 입출고 스캔

- **문제**: 현장 입출고 입력이 품목 텍스트 검색 방식 — 속도·오입력 리스크.
- **개선안** (InvenTree MIT 코드 각색 가능):
  - `POST /warehouse/barcode/scan { barcode }` 신설 — **리졸버 체인** 패턴(첫 성공 매치에서 종료): ① 내부 발급 QR(`{typeCode}:{id}`) → ② `Product.code` 정확 매치 → ③ `Partner.code` 정확 매치. 결과 `{ type, entity }` 반환, 매치 없으면 Exxxx 에러.
  - 엔티티별 타입코드 관례(`P`/`I` 등)로 내부 QR은 최소 정보만 인코딩.
  - Ionic 입출고 입력 화면: Capacitor 스캐너로 원문 획득 → 위 API → 거래처/품목 자동 채움(텍스트 검색 UX 대체). 화면 전이는 OCA shopfloor의 `next_state` 응답 패턴을 참고한 상태머신(`SCAN_PARTNER → SCAN_PRODUCT → ENTER_QUANTITY → CONFIRM`).
  - 스캔 성공/실패 감사 로그(자체 설계, 단순).
  - **출처 표기 필수**: InvenTree(MIT) 리졸버 구조 참고 — 저작권·라이선스 문구를 해당 파일 헤더에 명시.
- **근거**: `deep/C` §3 (InvenTree `plugin/base/barcodes/api.py` `BarcodeView.scan_barcode` L143-188, `helper.py` L46-66), `deep/A` §5 (OCA shopfloor `next_state` 응답 골격 — 개념만)
- **수용 기준**:
  1. 품목코드 바코드 스캔 시 해당 품목이 자동 선택된다.
  2. 미등록 바코드는 명확한 에러 메시지로 안내(무응답 금지).
  3. 스캐너 미지원 환경에서 기존 텍스트 검색으로 폴백된다.
  4. 리졸버 우선순위가 테스트로 고정된다(품목·거래처 코드가 우연히 겹칠 때 동작 정의).
- **난이도**: M · **라이선스**: MIT 각색 + 출처 표기

#### P1-3. 조정 트랜잭션 타입 확장 (실사·파손·폐기 대응)

- **문제**: `TransactionType`이 INBOUND/OUTBOUND뿐 — 재고 차이 조정, 파손, 폐기를 기록할 수단이 없다. 현장에서 수량이 안 맞으면 가짜 입고/출고로 우겨 넣게 되고, 보관료 계산이 오염된다.
- **개선안**: `TransactionType`에 `ADJUSTMENT_IN`/`ADJUSTMENT_OUT` 추가 + `AdjustmentReason` enum(`STOCKTAKE_DIFF`/`DAMAGE`/`DISPOSAL`/`OTHER`, OTHER는 메모 필수). 별도 테이블 신설하지 않음(Odoo도 실사 차이를 별도 문서가 아닌 move로 흡수). 보관료 계산은 조정도 잔고 변동으로 동일 취급.
- **근거**: `deep/A` §3 (Odoo 17 quant 카운트 → 자동 move), `deep/D` §3 (openboxes TransactionCode 4종 분류 — EPL 아이디어만)
- **수용 기준**:
  1. 조정 입력 시 사유 필수, 사유별 집계가 조회된다.
  2. 조정이 일별 재고·보관료 계산에 반영된다(테스트).
  3. 조정 건은 운송료 계산 대상에서 제외된다.
- **난이도**: S

#### P1-4. 재고 임계 알림

- **문제**: 재고 과소/과다를 사전 인지할 수단 없음.
- **개선안**: `Product`에 `minQuantity`/`reorderQuantity`/`maxQuantity`(전부 nullable) 추가, 잔고 변동 시(P0-2의 `qtyAfterTransaction` 갱신 지점) 임계 위반 판정 → 기존 `Notification`/`NotificationSubscription` + socket.io 인프라로 발송. 신규 알림 인프라 불필요.
- **근거**: `deep/D` §3 (openboxes `InventoryLevel` min/reorder/max 3단 — 아이디어만)
- **수용 기준**: 임계 미달/초과 시 HQ_ADMIN에게 알림 1건 발송, 동일 품목 중복 알림은 억제(일 1회), 임계값 미설정 품목은 판정 제외.
- **난이도**: S~M

### P2 — 후속 (선행 조건 있음 또는 실무 확인 필요)

| # | 항목 | 개선안 요약 | 선행/조건 | 난이도 | 근거 |
|---|---|---|---|---|---|
| P2-1 | 재고 실사(StockCount) | `StockCount` + `StockCountLine(bookQty/countedQty/differenceQty)` 신설, 확정 시 P1-3 조정 트랜잭션 자동 생성 | P1-3 선행 | M | `deep/C` §4 (ModernWMS `StocktakingEntity`, Apache 참고 가능) |
| P2-2 | 설치기사 위치추적·ETA | `Installer`에 `lastLat/lastLng/lastLocatedAt` 3컬럼, 모바일에서 **상태 기반 적응형 전송**(작업중 10m/30s, 대기 50m/60s), 실패 시 기존 `OfflineSyncQueue`에 적재(enatega는 이 부분이 없어 유실 — 우리가 더 낫게), socket.io `INSTALLER_LOCATION_UPDATED` 브로드캐스트 | 개인위치정보 수집 동의·보관기간 정책 결정 필수 | S~M | `deep/D` §1·§2 (enatega rider, MIT 각색 가능) |
| P2-3 | 로케이션 3단 관리 | `Warehouse → Area → Location` 3단 고정(트리 무한 depth 아님), `WarehouseTransaction.locationId?` FK | 실제 창고에 랙/구역 체계가 운영되고 있는지 확인 후 | L | `deep/C` §2 (ModernWMS 3단 구조가 InvenTree MPTT·openwms 좌표계보다 현실적) |
| P2-4 | 공유 타입 정리 | `packages/shared`에서 Prisma 생성 타입을 재노출해 프런트가 백엔드 DTO를 수동 미러링하지 않도록 | — | S | `deep/D` §5 (gauzy `packages/contracts` 구조만 참고; 우리 Prisma 기반이 더 우월) |
| P2-5 | 입출고 예정(ASN/DN) | 예정 vs 실적 분리 — `ExpectedTransaction` 또는 상태 필드 | 예정 데이터를 실제로 사전 수령하는지 확인 후 | M | `deep/C` §5 (ModernWMS asn/dn) |

---

## 4. 비범위 (YAGNI — 명시적으로 채택하지 않음)

벤치마킹에서 검토했으나 **우리 규모·도메인에 과설계로 판단**한 항목. 나중에 다시 논의될 때 이 판단 근거를 참조할 것.

| 항목 | 출처 | 기각 사유 |
|---|---|---|
| quant 5-tuple 정합성(product+location+lot+package+owner) | Odoo | 로케이션·로트·패키지 개념 자체가 없음. 파렛트/면적 단위 정산에 불필요 |
| 재고 예약(reservation) + move 상태머신(draft/assigned/done) | Odoo | 실적 입력이 즉시 확정 방식. 피킹/패킹 비범위 유지 |
| putaway rule 슬로팅 | Odoo, OCA | 로케이션 도입 전 무의미 |
| 회계 lock date 소프트/하드 이중 트랙 | Odoo | `SettlementPeriod` OPEN/LOCKED 단일 트랙으로 요구사항 충족 |
| 부분 소급 재계산(시점 이후만) | ERPNext Repost | 월 단위 전체 재계산으로 충분, 구현 비용만 큼 |
| 다중 세율 라인별 세금 | Dolibarr | 국내 부가세 단일 10% |
| 반복 청구(Subscription) | ERPNext | 월 마감 배치가 이미 그 역할 |
| StockItem 개체 모델(split/merge/serial 계보) | InvenTree | 파렛트 단위 정산에 개체 추적 불필요. 스냅샷(P0-2)으로 충분 |
| TransportUnit/TransportOrder 자동화 TMS | openwms | 창고 자동화 설비 전제 — 수동 창고에 부적합 |
| 멀티테넌시 base entity 상속 | ever-gauzy | 단일 회사 |
| 200+ 세분화 permission enum | ever-gauzy | 4역할 + 필드 마스킹으로 충분 |
| 합적 운송(Shipment/트럭 1대분 묶음) | openboxes | **실무 확인 필요** — 여러 거래처 화물을 한 차량에 합적해 운송료를 배분하는 업무가 실제 존재하면 P1으로 승격. 현재는 건당 계산 전제 |

---

## 5. 권장 실행 순서

1. **P0-1 요율 유효기간** — 청구액 정확성 문제. 다른 어떤 기능보다 먼저.
2. **P0-3 재마감 버저닝** — S 규모, P0-2의 소급 재계산 감사와 맞물림.
3. **P0-2 누적 잔고** — P0-3의 감사 배선을 재사용. 백필은 야간 수행.
4. **P1-3 조정 타입** → **P1-2 바코드** → **P1-1 청구서 문서화** → **P1-4 알림**
5. P2는 각 선행/확인 조건 충족 시.

P0 3건은 서로 얽혀 있으므로(요율 조회 변경·잔고 재계산·감사 로그) **한 브랜치에서 순차 구현**을 권장한다.

---

## 6. 배포 선행 게이트 (기존 미해결 — 이 PRD와 별개로 필수)

- `prisma migrate deploy` 미적용 마이그레이션 3건(masterdata_settlement, sentinel branch seed, area_billing_mode) — 실 DB 적용·검증 필요
- 정산 기간 경계(`gt`) 동작 실 DB SQL 확인 1회
- `E2E_LIVE=1` 거래처 격리 e2e 실행
- 웹 유닛 스위트 선재 실패 171건(ENVIRONMENT_CONFIG DI 문제, 이 작업들과 무관) — 별도 처리 필요

---

## 7. 참고 자료

**심층 분석 리포트**(각 문서 말미에 읽은 소스 파일 URL 전량 인용)
- `docs/benchmarking/deep/A-odoo-oca-wms.md`
- `docs/benchmarking/deep/B-erpnext-dolibarr.md`
- `docs/benchmarking/deep/C-inventree-modernwms-openwms.md`
- `docs/benchmarking/deep/D-gauzy-enatega-openboxes.md`
- 1차 개괄: `docs/benchmarking/2026-07-26-oss-benchmark.md`

**우리 기준 문서**
- `docs/superpowers/specs/2026-07-25-masterdata-settlement-design.md` (MVP 스펙)
- `docs/superpowers/2026-07-25-masterdata-settlement-final-review.md` (전체 리뷰 — F1~F10)
- `docs/superpowers/2026-07-25-masterdata-settlement-ledger.md` (구현 이력·부채 대장)

**주요 인용 소스**(전체 목록은 각 심층 리포트 참조)
- https://raw.githubusercontent.com/frappe/erpnext/develop/erpnext/stock/stock_ledger.py
- https://raw.githubusercontent.com/frappe/erpnext/develop/erpnext/accounts/doctype/pricing_rule/pricing_rule.py
- https://raw.githubusercontent.com/Dolibarr/dolibarr/develop/htdocs/product/class/productcustomerprice.class.php
- https://raw.githubusercontent.com/Dolibarr/dolibarr/develop/htdocs/compta/facture/class/facture.class.php
- https://raw.githubusercontent.com/odoo/odoo/19.0/addons/stock/models/stock_quant.py
- https://raw.githubusercontent.com/inventree/InvenTree/master/src/backend/InvenTree/plugin/base/barcodes/api.py
- https://raw.githubusercontent.com/fjykTec/ModernWMS/master/backend/ModernWMS.WMS/Entities/Models/Stocktaking/StocktakingEntity.cs
- https://raw.githubusercontent.com/enatega/food-delivery-multivendor/main/enatega-multivendor-rider/lib/context/global/location.context.tsx
