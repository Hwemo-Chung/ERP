# Deep Benchmark A — Odoo `stock` 모듈 & OCA WMS 애드온

**작성일**: 2026-07-26 · **범위**: odoo/odoo(19.0) `addons/stock`, `addons/stock_account`, `addons/account`(lock date) + OCA `stock-logistics-shopfloor`(18.0, 舊 OCA/wms `shopfloor`) 소스 직독
**선행 얕은 조사**: `docs/benchmarking/2026-07-26-oss-benchmark.md` — 본 문서는 그 위에서 실제 소스 레벨로 파고든다.
**우리 도메인 기준**: `docs/superpowers/specs/2026-07-25-masterdata-settlement-design.md`, `prisma/schema.prisma`

> **라이선스 경고 (총론)**: Odoo core(`odoo/odoo`)는 **LGPL-3.0**, OCA 애드온은 **AGPL-3.0**. 본 레포는 폐쇄형 proprietary이므로 두 라이선스 모두 **코드 복사 절대 금지**. 아래 서술은 필드 구성·상태 전이·알고리즘 흐름 등 "아이디어" 수준만 다루며, 원본 함수/코드 블록을 그대로 옮기지 않았다(WebFetch 시 "prose summary만, verbatim 코드 금지" 프롬프트로 강제). 각 절 끝에 개별 경고를 반복한다.

## 0. 저장소 구조 정정 (선행 조사 보완)

선행 문서는 `OCA/wms`를 shopfloor 소스로 지목했으나, 실제로 `OCA/wms`는 현재 **메타패키지 저장소**로 축소되어 있고(루트에 `setup/_metapackage`만 존재, 실코드 없음) 실제 애드온은 기능별로 분리된 저장소로 이관됐다:

- `OCA/stock-logistics-shopfloor` — `shopfloor`, `shopfloor_mobile`, `shopfloor_gs1`, `shopfloor_reception*` 등 (스캐너 시나리오 본체)
- `OCA/stock-logistics-putaway` — `stock_storage_type`, `stock_storage_type_putaway_abc` 등 (빈/적치 슬로팅)
- `OCA/stock-logistics-reservation` — `stock_reserve`, `stock_available_to_promise_release*` (가상예약/릴리즈)
- `OCA/stock-logistics-warehouse`, `-tracking`, `-workflow`, `-barcode` 등

모두 default branch가 `18.0`이며 라이선스는 `OCA/wms` 계열과 동일 **AGPL-3.0**. 본 문서는 `stock-logistics-shopfloor`(18.0)를 실제 소스로 사용했다.

Odoo core 쪽은 default branch가 `master`가 아니라 **`19.0`**이었다(확인 완료).

---

## 1. 재고 정합성 설계 — quant vs move 이중 구조

### 1.1 이중 구조의 본질

Odoo는 재고를 두 개의 서로 다른 성격의 테이블로 분리해서 표현한다.

- **`stock.quant`** — "지금 이 순간 어디에 무엇이 얼마나 있는가"의 **스냅샷**. PK 성격의 복합키는 `(product_id, location_id, lot_id, package_id, owner_id)` 5-tuple. 핵심 수량 필드는 `quantity`(실물 보유량), `reserved_quantity`(예약된 양), `available_quantity`(계산 필드 = `quantity - reserved_quantity`). `in_date`는 이 재고가 해당 위치에 들어온 시각으로, FIFO 소진 순서 판단에 쓰인다.
- **`stock.move`** — "무엇을 어디서 어디로 옮기려는 의도/원장". 상태(`state`) 필드로 생애주기를 가진다: `draft → waiting/confirmed → assigned(또는 partially_available) → done`, 그리고 언제든 `cancel`. `move_orig_ids`/`move_dest_ids`로 선행·후행 move를 체인으로 엮어(예: 창고 입고 move → 출고 move) 다단계 창고 흐름을 하나의 그래프로 표현한다.
- **`stock.move.line`** — move의 **실행 디테일**. 하나의 move가 "10개 옮겨라"는 의도라면, move_line은 "실제로 어느 lot/package/location에서 온 몇 개"를 기록한다. 한 move가 여러 lot/여러 source location에 걸치면 move_line이 여러 개 생긴다.

즉 **move/move_line = 원장(ledger, 이벤트 소싱)**, **quant = 그 원장을 적용한 결과의 캐시된 잔고(materialized view)**. move_line이 `done`으로 확정되는 순간(`_action_done`) 두 단계로 quant가 갱신된다: source location quant를 감소(debit), destination location quant를 증가(credit). 이 "차변/대변" 방식 덕분에 재고는 항상 어떤 위치에서 어떤 위치로의 "이동"으로만 변하고, 허공에서 생기거나 사라지지 않는다(실사 조정조차 `inventory` usage 타입의 가상 위치와의 move로 표현됨 — §3 참고).

### 1.2 상태 머신과 예약(reservation)

- `draft → waiting|confirmed`: `_action_confirm()`. 선행 move(`move_orig_ids`)가 있거나 `make_to_order` 조달이면 `waiting`, 아니면 `confirmed`.
- `confirmed → assigned` (또는 `partially_available`): `_action_assign()`이 조건에 맞는 quant를 찾아 `stock.move.line`을 생성하며 quant의 `reserved_quantity`를 올린다. 요청 수량 전부를 예약 못 하면 `partially_available`.
- `assigned → done`: `_action_done()`이 실제 quant 차변/대변 반영, 원가 계산(회계 모듈 연동 시), picking 완료 여부 재계산까지 수행.
- `any → cancel`: `propagate_cancel`이 켜져 있으면 하위 체인까지 취소 전파.

예약은 "물리적으로 옮기지 않았지만 다른 주문이 못 쓰게 잠그는" 개념이다. `_update_reserved_quantity`/`_update_available_quantity`가 quant 단위로 이 값을 갱신하며, 갱신 시 `try_lock_for_update`로 row-level lock(SELECT FOR UPDATE)을 걸어 동시성 문제를 막는다. 동시에 같은 5-tuple 키로 quant가 중복 생성되는 경쟁 상태를 대비해 주기 작업(`_quant_tasks`)이 중복 quant를 GROUP BY로 병합(`_merge_quants`)하고, 예약 불일치를 정리하고, 잔량 0인 quant를 청소한다.

### 1.3 우리 `WarehouseTransaction`과의 대비 — 무엇이 부족한가

현재 스키마의 `WarehouseTransaction`(`prisma/schema.prisma` L679-699)은 `type`(INBOUND/OUTBOUND) + `partnerId`/`productId`/`quantity`/`transactionDate` 뿐인 **단일 이벤트 로그**다. Odoo와 비교하면:

| Odoo 개념 | 우리 현재 | 부족한 점 |
|---|---|---|
| quant(현재고 스냅샷, 위치·lot·owner별) | 없음. 매번 `SUM(INBOUND) - SUM(OUTBOUND)`를 스캔해서 계산 추정 | "지금 재고가 몇 개인가"를 O(1)로 답할 수 없다. 정산 계산이 전체 트랜잭션을 다시 훑어야 함(§4의 openingStock 문제와 동일 계열 결함) |
| move 상태 머신(draft/assigned/done/cancel) | 트랜잭션은 생성 즉시 fact — 중간 상태 없음 | "입고 예정인데 아직 안 옴", "출고 예약했는데 취소됨" 같은 상태를 표현 못함. 오탈자 입력을 취소/정정할 방법이 UPDATE/DELETE뿐(원장 불변성 없음) |
| 예약(reservation) | 없음 | 보관료 계산 시 "예약된 물량"과 "실제 보유 물량"을 구분 못함 — 다만 MVP 범위(§9 YAGNI: 피킹/패킹 비범위)를 고려하면 당장 필수는 아님 |
| move_orig_ids/move_dest_ids 체인 | 없음 | 입고→출고 인과관계 추적 불가(예: 특정 출고가 어느 입고 lot에서 나갔는지) — 로트 추적 요구가 생기면 필요 |
| 5-tuple 식별(product+location+lot+package+owner) | product+partner만 | 창고 내 위치(로케이션) 개념 자체가 없음(§9 YAGNI로 명시적 비범위) |

**결론**: 지금 설계는 "정산을 위한 이벤트 로그"로는 충분하지만(spec 목적에 맞음), "재고가 지금 몇 개인지"를 answer하는 시스템이 아니다. WMS 후속 PRD에서 로케이션이 들어오는 순간, quant 스냅샷 테이블을 별도로 두지 않으면 재고 조회가 항상 전체 트랜잭션 스캔이 되어 성능 문제가 재발한다.

> **라이선스**: 위 내용은 `stock_quant.py`/`stock_move.py`/`stock_move_line.py` 구조 설명이며 개념 참고용. LGPL-3.0 원본 코드 미복사.
> 출처: https://raw.githubusercontent.com/odoo/odoo/19.0/addons/stock/models/stock_quant.py , https://raw.githubusercontent.com/odoo/odoo/19.0/addons/stock/models/stock_move.py , https://raw.githubusercontent.com/odoo/odoo/19.0/addons/stock/models/stock_move_line.py

---

## 2. 로케이션 계층

### 2.1 계층 표현 — parent_path

`stock.location`은 `location_id`(부모 FK) + `child_ids`(역참조) 외에 **`parent_path`**라는 materialized path 문자열(`"1/4/16/"` 형태)을 별도 컬럼으로 저장한다. 조상 체인을 미리 문자열로 굳혀두기 때문에, "이 위치 하위 전체"를 구할 때 재귀 CTE 없이 `parent_path LIKE '1/4/%'` 류의 **range 쿼리 한 방**으로 끝난다. `(parent_path, id)` 인덱스가 이를 뒷받침. Odoo의 `child_of` 도메인 연산자가 내부적으로 이 range 쿼리로 컴파일된다. `complete_name`(계층 전체 이름, `"Warehouse/Zone A/Shelf 3"`)은 이 경로를 이름으로 재구성한 계산 필드다.

### 2.2 usage 타입

`usage` 필드는 위치의 "성격"을 나타내는 열거값이다:

- `internal` — 실제 재고가 존재하는 물리 위치
- `customer` / `supplier` — 거래 상대방을 나타내는 가상 위치(재고가 이 위치로 나가면 "판매됨", 이 위치에서 들어오면 "매입됨")
- `inventory` — 재고 실사 손익 조정용 가상 위치(§3)
- `production` — 제조 소비/산출용 가상 위치
- `transit` — 창고 간/회사 간 이동 중 재고를 나타내는 가상 위치
- `view` — 화면 그룹핑 전용, 실물 재고 보관 불가

이 구조의 핵심 통찰: **"입고"와 "출고"조차 Odoo에서는 별도 개념이 아니라 "internal ↔ supplier/customer 간의 move"**로 통일된다. 우리 `WarehouseTransaction.type`(INBOUND/OUTBOUND) enum이 하드코딩한 이분법을, Odoo는 "가상 위치의 종류"로 일반화해서 실사 조정·반품·창고간 이동까지 같은 모델로 흡수한다.

### 2.3 도입 시 최소 형태 (우리 스코프)

WMS 후속 PRD에서 로케이션이 필요해질 때, Odoo 전체를 따라갈 필요는 없다. 최소 형태 제안:

```
Location {
  id, code, name, parentId?, path (materialized, "warehouseId/zoneId/binId" 문자열)
  usage: INTERNAL | INVENTORY_ADJUSTMENT   // 처음엔 2개만, transit/production은 YAGNI
  warehouseId
}
```

`parent_path`를 그대로 흉내내되 Postgres `ltree` 확장을 쓰면 인덱스·연산자를 직접 구현할 필요가 없다(YAGNI: 문자열 LIKE 직접 구현보다 표준 확장 재사용).

> **라이선스**: `stock_location.py` 구조·필드명 설명, 개념 참고용. LGPL-3.0 원본 코드 미복사.
> 출처: https://raw.githubusercontent.com/odoo/odoo/19.0/addons/stock/models/stock_location.py

### 2.4 (참고) putaway rule 매칭 — 지금은 YAGNI, 후속 참고용

`stock.putaway.rule`은 "입고된 상품을 어느 세부 위치에 넣을지" 결정한다. 매칭은 **sequence 오름차순 + product_id 우선순위**로 정렬된 규칙 리스트를 순회 — 품목-특정 규칙이 카테고리-일반 규칙보다 먼저 매치되도록 배치하는 관례다. 매칭된 규칙의 `sublocation` 전략(`no`/`last_used`/`closest_location`)에 따라 최종 세부 위치를 계산하고, `storage_category_id`의 용량(무게/부피) 제약을 `_check_can_be_used()`로 검증해 넘치는 위치는 후보에서 제외한다. 현재 spec은 로케이션 자체가 비범위이므로 **당장 도입 불필요** — 후속 WMS PRD에서 "품목별 지정 랙" 요구가 나오면 이 패턴(우선순위 리스트 + fallback)을 참고.

> **라이선스**: `product_strategy.py`(putaway rule) 알고리즘 설명. LGPL-3.0 원본 코드 미복사.
> 출처: https://raw.githubusercontent.com/odoo/odoo/19.0/addons/stock/models/product_strategy.py

---

## 3. 재고 실사 (Inventory Adjustment)

### 3.1 Odoo 17+ 방식 — quant에 직접 카운트 입력

과거 Odoo(≤12)는 `stock.inventory`라는 별도 "실사 세션" 모델이 있었지만, 최신 버전은 **quant 자체에 카운트를 직접 기록**하는 방식으로 단순화됐다. 흐름:

1. 사용자가 "실사 모드"로 진입(컨텍스트 플래그) → 이 모드에서만 quant의 `inventory_quantity` 필드가 쓰기 가능해짐.
2. 실사자가 `inventory_quantity`(실측값)를 입력 → `inventory_quantity_set=True`, `inventory_diff_quantity = inventory_quantity - quantity`(차이)가 자동 계산.
3. `is_outdated` 플래그: 카운트를 기록한 뒤 다른 트랜잭션이 그 quant를 건드리면(다른 사람이 먼저 출고 처리) "카운트가 이미 낡았다"고 표시 → 충돌 위저드로 재확인 요구.
4. 확정(`_apply_inventory` 계열): 차이가 양수(더 많이 셈)면 `inventory` usage 위치 → 실제 위치로의 move, 음수(덜 셈)면 그 반대 방향 move를 생성해 즉시 `done` 처리.
5. 확정 후 quant의 실사 관련 필드 리셋(`inventory_quantity=0` 등), 위치의 `last_inventory_date` 갱신, 다음 예정 실사일 재계산.

핵심: **실사 차이도 결국 "move"로 기록된다.** 재고가 ±되는 모든 경로(입고/출고/실사/반품)가 동일한 move/quant 파이프라인을 지나가므로 회계 반영(§3.2)도 한 곳에서 처리된다.

### 3.2 회계 반영

실사로 생긴 move도 다른 move와 동일하게 재고 평가(valuation) 트리거를 탄다. 재고자산(Asset) 계정이 차/대변, 손익(Loss/Gain) 계정이 반대로 기록되는 저널 엔트리가 생성된다(perpetual 방식일 때 실시간, periodic 방식이면 기간말 일괄).

### 3.3 우리 도메인에 대한 시사점

우리는 실사 자체가 spec §9에서 명시적 비범위(YAGNI)다. 다만 이 설계에서 배울 점은 "실사 차이도 WarehouseTransaction과 동일한 테이블·동일한 정산 파이프라인을 통과시킨다"는 원칙 — 향후 실사 기능을 넣을 때 별도 "조정" 테이블을 새로 만들기보다, 기존 `WarehouseTransaction`에 `ADJUSTMENT_IN`/`ADJUSTMENT_OUT` 같은 `type` 값을 추가하는 편이 Odoo 패턴과 정합적이고 우리 스키마 변경도 최소(enum 값 추가 = S 사이즈)다.

> **라이선스**: `stock_quant.py`의 실사 관련 필드·흐름 설명, 개념 참고용. LGPL-3.0 원본 코드 미복사.
> 출처: https://raw.githubusercontent.com/odoo/odoo/19.0/addons/stock/models/stock_quant.py

---

## 4. 기간 마감/이월

### 4.1 Odoo의 이중 트랙 — 회계 lock date + valuation layer

Odoo는 "재고 마감"을 두 가지 독립된 메커니즘으로 다룬다.

**(a) 회계 lock date (`res.company` 확장, `account` 모듈)**: 소프트 lock 4종 — `fiscalyear_lock_date`(전체 전기 잠금), `tax_lock_date`(세무 신고 잠금, 세무 마감 실행 시 자동 세팅), `sale_lock_date`, `purchase_lock_date` — 와 하드 lock 1종 `hard_lock_date`(예외 자체가 불가능, 되돌릴 수 없음). 소프트 lock은 `account.lock_exception` 레코드(사용자별 또는 전역)로 "이 날짜 이전이라도 이 사람은 예외적으로 기표 가능"을 허용하지만, 하드 lock은 예외 메커니즘 자체를 참조하지 않는다 — **역할 기반 우회가 아니라 "예외 레코드의 존재 여부"로 우회를 통제**하는 것이 핵심 설계 차이(우리의 HQ_ADMIN 권한 우회와 다른 축).

**(b) 재고 평가 레이어 (`stock.valuation.layer`, `stock_account` 모듈)**: 재고 가치를 "현재값 하나"로 들고 있지 않고, **move 하나당 레이어 레코드 하나**를 영구 보존하는 불변 원장으로 쌓는다. 필드는 `product_id`, `move_id`, `value`(금액), `date`, `description` 등. FIFO 원가법에서는 출고 시 오래된 레이어부터 `remaining_qty`/`remaining_value`를 소진시켜 원가를 계산한다. 레이어가 `account.move`(회계 전표)와 연결되어 실물 재고와 재무제표가 항상 추적 가능하게 묶인다.

이 불변 레이어 방식의 이점: (1) 감사 추적(누가 언제 왜), (2) 원가법을 나중에 바꿔도(FIFO→이동평균) 과거 레이어가 그대로 있어 재계산 가능, (3) 삭제 없이 정정(새 레이어 추가로만 교정).

### 4.2 우리의 `openingStock unbounded scan` 문제에 대한 설계 아이디어

ledger(Task 11)가 지적한 문제: 월별 정산을 위해 "이번 달 시작 시점 재고"를 구하려면 `WarehouseTransaction` 전체 이력을 처음부터 스캔해야 한다(deferred F5). Odoo의 두 메커니즘에서 가져올 수 있는 아이디어:

1. **월말 스냅샷 테이블 (valuation layer 아이디어 차용, S 사이즈)**: `SettlementRecord`처럼 불변으로 쌓되, 매월 마감 시 `PeriodSnapshot { partnerId, productId, periodYearMonth, openingQty, closingQty, inQty, outQty }`를 **`SettlementPeriod.LOCKED` 전환과 같은 트랜잭션에서** 생성한다. 다음 달 계산은 "직전 달 스냅샷의 closingQty"를 opening으로 삼아 O(1)로 시작 — 이번 달 트랜잭션만 스캔하면 된다. Odoo가 valuation layer를 "move 하나당 레이어 하나"로 쌓듯, 우리는 "월 하나당 스냅샷 하나"로 쌓으면 충분(우리는 파렛트/면적 단위 집계지 개별 lot 원가 추적이 아니므로 Odoo만큼 세밀할 필요 없음 — over-engineering 방지).
2. **lock date의 이중 트랙 아이디어**: 지금 `SettlementPeriod`(OPEN/LOCKED)는 이미 이 역할의 축소판이다. Odoo처럼 "소프트 lock(HQ_ADMIN이 예외적으로 재오픈 가능) vs 하드 lock(예외 불가)"을 구분할 실익은 현재 스펙엔 없다 — spec §4.3이 이미 "재계산은 마감 해제(HQ_ADMIN) 후 가능"으로 단일 트랙을 명시했고 이는 충분하다. **하드 lock 도입은 YAGNI** — 회계감사 요구사항이 실제로 나오면 그때 추가.

> **라이선스**: `product_value.py`(valuation layer)·`company.py`(lock date) 개념 설명. LGPL-3.0 원본 코드 미복사.
> 출처: https://raw.githubusercontent.com/odoo/odoo/19.0/addons/stock_account/models/product_value.py , https://raw.githubusercontent.com/odoo/odoo/19.0/addons/account/models/company.py

---

## 5. OCA shopfloor 스캐너 시나리오 — 상태 머신 골격

`stock-logistics-shopfloor`(舊 OCA/wms `shopfloor`, AGPL-3.0)는 REST 엔드포인트 하나하나가 "현재 화면 상태"에 대응하는 **명시적 상태 머신**으로 스캐너 UX를 구현한다. 두 시나리오(`zone_picking.py`, `cluster_picking.py`)를 읽었고, 둘 다 같은 골격을 공유한다.

### 5.1 공통 응답 골격 (이식 가치 최고)

모든 엔드포인트가 동일한 shape로 응답한다:

```
{
  next_state: "set_line_destination",   // 다음에 렌더링할 화면 이름
  data: { ...현재 상태에 필요한 컨텍스트... },
  message: { message_type: "error"|"success"|"info", body: "..." } | null,
  popup: { ... } | null   // 완료 알림 등 모달
}
```

이 패턴의 핵심: **클라이언트는 상태를 스스로 판단하지 않는다.** "다음에 뭘 보여줄지"를 서버가 `next_state` 문자열로 지시하고, 클라이언트는 그 상태 이름에 매핑된 화면 컴포넌트를 렌더링만 한다. 검증 실패 시에도 같은 상태를 유지하며 `message`만 채워 재입력을 유도한다.

### 5.2 zone picking 상태 흐름 (요약)

`select_zone`(구역 선택, 스캔 없음) → `scan_location`(구역 바코드 스캔) → `list_move_lines`(작업 목록) → `scan_source`(위치/상품/lot/패키지 바코드 — 스캔 대상이 무엇이든 서버가 식별해 다음 상태 결정) → `set_line_destination`(목적지 바코드 + 수량, 위치 스캔이면 완료, 패키지 스캔이면 버퍼에 임시 적재) → (옵션)`zero_check`(원위치가 비었는지 확인, 재고 실사 draft 생성) → 버퍼가 차면 `prepare_unload` → `unload_single`/`unload_all`(적재 내용물을 최종 목적지로 이동).

예외 상태: `stock_issue`(현장 재고 없음 선언 → 예약 해제 후 대체 재고 탐색), `change_pack_lot`(대체 lot/패키지 수동 지정).

### 5.3 cluster picking 상태 흐름 (요약) — 우리에 더 가까운 시나리오

한 명이 카트(여러 빈)로 여러 주문을 동시에 처리. `select batch`(자동배정 또는 수동선택) → `start_line`(다음 미처리 항목 제시, 직전 항목과 같은 주문이면 같은 목적지 빈을 제안) → `scan_line`(위치/상품/패키지/lot 스캔, 오상품 스캔 시 에러 상태 유지) → `scan_destination`(빈 스캔, 다른 주문이 이미 쓴 빈이면 거부) → 반복 → `unload_all`/`unload_single`(빈별 최종 목적지 확정). `result_package_id`로 "이 항목이 어느 빈에 담겼는지"를 move_line에 기록해두고, 같은 빈을 참조하는 라인들을 언로드 시점에 그룹핑한다.

### 5.4 우리 Ionic PWA로 이식 가능한 골격

`WarehouseTransaction` 직접 입력 화면(spec §5.5, 텍스트 검색 기반)을 QR 스캔으로 대체할 때(선행 조사 TOP 3 항목 "바코드/QR 입출고 스캔")의 최소 상태 머신 제안:

```
SCAN_PARTNER (거래처 QR/바코드)
  → SCAN_PRODUCT (품목 QR/바코드, 유효하지 않으면 같은 상태 + error message)
  → ENTER_QUANTITY_AND_TYPE (수량 입력 + INBOUND/OUTBOUND 토글)
  → CONFIRM (요약 화면, 뒤로가기 가능)
  → SUBMIT → 성공 시 SCAN_PRODUCT로 복귀(같은 거래처 연속 입력, "직전과 같은 거래처" 힌트는 cluster picking의 "같은 주문이면 같은 빈 제안" 패턴 차용)
```

응답 shape는 `{ nextState, data, message }` 3-필드만으로 충분 — `popup`(완료 알림)은 YAGNI(현재 단일 작업 흐름이라 배치 완료 알림 불필요, 나중에 엑셀 업로드 배치 확정 완료 알림에 재사용 가능해지면 그때 추가).

> **라이선스**: `zone_picking.py`/`cluster_picking.py`/`completion_info.py`의 상태 흐름·응답 shape는 **개념 설명**이며, AGPL-3.0 원본 코드·스키마·문자열 리터럴은 옮기지 않았다(WebFetch 자체를 "prose only, verbatim 코드 금지" 프롬프트로 제약해 응답을 받았음). REST 계층 구조(actions/services/components)나 상태 이름 자체를 코드로 복사하는 것은 금지 — 위 상태명(`SCAN_PARTNER` 등)은 우리가 새로 지은 이름이다.
> 출처: https://raw.githubusercontent.com/OCA/stock-logistics-shopfloor/18.0/shopfloor/services/zone_picking.py , https://raw.githubusercontent.com/OCA/stock-logistics-shopfloor/18.0/shopfloor/services/cluster_picking.py , https://raw.githubusercontent.com/OCA/stock-logistics-shopfloor/18.0/shopfloor/actions/completion_info.py

---

## 6. 우리 도메인 매핑 표

| Odoo/OCA 개념 | 우리 스키마/모듈 매핑 | 신규 모델 필요? | 마이그레이션 난이도 |
|---|---|---|---|
| quant(현재고 스냅샷) | 없음 → 필요 시 `StockSnapshot`(월별) 신설, §4.2 참고 | Yes (신규, 단 WMS 로케이션 없이는 partner+product 레벨로 축소 가능) | S — 월 1행 집계 테이블, 트랜잭션 롤업만 |
| move 상태 머신(draft/assigned/done) | `WarehouseTransaction`은 상태 없는 fact | 상태 도입은 §9 YAGNI(현재 실적 입력은 즉시 확정, 예약 개념 불필요) | 해당 없음(도입 보류) |
| move_orig_ids/move_dest_ids 체인 | 없음 | 로트 추적 요구 나오기 전까진 불필요 | 해당 없음(도입 보류) |
| 로케이션 계층(parent_path, usage) | 없음(§9 명시적 비범위) | Yes, 후속 WMS PRD | L — 신규 `Location` 모델 + `WarehouseTransaction`에 FK 추가 + 기존 데이터 backfill |
| putaway rule | 없음(§9 비범위) | 후속 WMS PRD, 우선순위 낮음 | L |
| 재고 실사(quant count) | 없음(§9 비범위) | `WarehouseTransaction.type`에 `ADJUSTMENT_IN/OUT` enum 값 추가로 충분(§3.3) | S — enum 확장, 신규 테이블 불필요 |
| valuation layer(불변 원가 원장) | `SettlementRecord`가 이미 이 역할(계산 결과 불변 스냅샷, `calculationDetail` Json) | No — 이미 있음 | 해당 없음 |
| 회계 lock date(소프트/하드 이중) | `SettlementPeriod`(OPEN/LOCKED) 단일 트랙 | No — 현재로선 충분(§4.2) | 해당 없음(YAGNI) |
| shopfloor 상태 머신(next_state 응답) | 신규 QR 입출고 화면(spec §5.5 대체) | 프론트 상태 머신만 신규, 백엔드는 기존 `WarehouseTransaction` API 재사용 | M — Angular 상태 머신 + Capacitor 스캔 플러그인 배선 |
| cluster picking의 "같은 주문 → 같은 빈 제안" | 해당 없음(우리는 피킹 카트 없음) | No | 해당 없음(개념만 참고, 이식 대상 아님) |

---

## 7. 종합 결론

1. **재고 스냅샷 부재가 가장 근본적인 구조 차이다.** Odoo가 quant/move를 분리한 이유(잔고 조회 O(1) vs 원장 추적)와 우리 ledger Task 11의 `openingStock unbounded scan` 결함은 같은 문제의 다른 표현 — 월별 스냅샷 테이블 하나로 해소 가능(S).
2. **로케이션·실사·putaway는 spec이 이미 명시적으로 비범위 처리했고, 이 판단은 유지할 근거가 충분하다** — Odoo 수준의 5-tuple quant 정합성·putaway 슬로팅은 국민트랜스 MVP(파렛트/면적 단위 정산)엔 과설계(over-engineering)다.
3. **shopfloor의 `next_state` 기반 상태 응답 패턴은 라이선스 리스크 없이(개념만) 바로 이식 가능**하고, 선행 조사가 뽑은 "바코드/QR 입출고 스캔"(TOP 3) 구현 시 화면 전이 설계의 뼈대로 바로 쓸 수 있다.
4. **회계 lock date의 소프트/하드 이중 트랙은 지금 도입할 실익이 없다** — `SettlementPeriod` 단일 트랙으로 spec 요구사항(HQ_ADMIN 마감 해제)을 이미 충족.

### 전체 인용 출처 목록

- https://raw.githubusercontent.com/odoo/odoo/19.0/addons/stock/models/stock_quant.py
- https://raw.githubusercontent.com/odoo/odoo/19.0/addons/stock/models/stock_move.py
- https://raw.githubusercontent.com/odoo/odoo/19.0/addons/stock/models/stock_move_line.py
- https://raw.githubusercontent.com/odoo/odoo/19.0/addons/stock/models/stock_location.py
- https://raw.githubusercontent.com/odoo/odoo/19.0/addons/stock/models/product_strategy.py
- https://raw.githubusercontent.com/odoo/odoo/19.0/addons/stock/models/stock_picking.py
- https://raw.githubusercontent.com/odoo/odoo/19.0/addons/stock/models/stock_rule.py
- https://raw.githubusercontent.com/odoo/odoo/19.0/addons/stock_account/models/product_value.py
- https://raw.githubusercontent.com/odoo/odoo/19.0/addons/account/models/company.py
- https://raw.githubusercontent.com/OCA/stock-logistics-shopfloor/18.0/shopfloor/services/zone_picking.py
- https://raw.githubusercontent.com/OCA/stock-logistics-shopfloor/18.0/shopfloor/services/cluster_picking.py
- https://raw.githubusercontent.com/OCA/stock-logistics-shopfloor/18.0/shopfloor/actions/completion_info.py
- 저장소 존재/라이선스/기본 브랜치 확인: `gh api repos/odoo/odoo`, `gh api repos/OCA/wms`, `gh api repos/OCA/stock-logistics-shopfloor` (LGPL-3.0 / AGPL-3.0 확인)

**라이선스 최종 확인**: odoo/odoo = LGPL-3.0(`https://github.com/odoo/odoo/blob/19.0/LICENSE`), OCA 전체 = AGPL-3.0(`https://github.com/OCA/stock-logistics-shopfloor/blob/18.0/LICENSE` 및 OCA 조직 공통 정책). 본 문서의 모든 절은 **아이디어·구조 설명**이며 코드 인용 없음.
