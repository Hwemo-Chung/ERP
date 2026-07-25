# OSS 기능 벤치마킹 — 국민트랜스 ERP 확장 후보 조사

**작성일**: 2026-07-26 · **범위**: 10개 오픈소스 프로젝트 vs. 본 ERP(NestJS 11+Prisma+PostgreSQL / Angular 19+Ionic 8 PWA)의 도메인 갭
**기준 문서**: `docs/superpowers/specs/2026-07-25-masterdata-settlement-design.md` §9 비범위, `docs/superpowers/2026-07-25-masterdata-settlement-ledger.md` deferred 항목

## 0. 방법론

### 0.1 갭 정의 — 어디서 가져왔나

spec §9(비범위)에서 직접: **재고 실사, 로케이션 관리, 배차 최적화/실시간 차량 추적(TMS)**.
ledger deferred 항목 중 실제 "제품 기능" 갭으로 걸러낸 것만 채택(TOCTOU, 단위테스트 누락, float 경계값 같은 내부 품질 부채는 OSS 벤치마킹 대상 아님 — 제외):

| 갭 | 근거 |
|---|---|
| 재고 스냅샷/기간 이월 | ledger: `openingStock unbounded scan`(Task 11) — 기간별 opening balance 스냅샷 부재 |
| 요율/계약 유효기간 버저닝 | ledger: `multi-active-contract collapse`, `inactive-partner mid-month drop`(Task 11) — TransportRate/StorageContract에 effective_from/to 없음 |
| 청구서 PDF | spec §6.3 — 다운로드가 전부 엑셀뿐, PDF 언급 없음. ledger `보관료 sheet granularity`(Task 13)도 관련 |
| 바코드/QR 입출고 | spec §5.5 — "직접 입력"이 텍스트 검색 기반, 스캔 언급 없음(신규 갭) |
| 재고 실사, 로케이션 관리 | spec §9 비범위(YAGNI) — 명시적으로 후속 PRD로 분리 |
| 배차 최적화·실시간 차량 추적(TMS) | spec §9 비범위(YAGNI) — 명시적으로 후속 PRD로 분리 |

기존 인프라라서 **"이식"이 아니라 "확장"**으로 재분류한 항목(중요):
- **오프라인 동기화**: spec §7에 `OfflineSyncQueue` 기존 존재·재사용 명시. → OSS에서 "포팅"할 게 아니라 실적 입력 화면에 연결하는 배선 작업.
- **재고 알림**: `apps/api/src/notifications`(+`push-providers`: FCM/APNs/WebPush)가 이미 존재. → 임계값 룰 + 트리거 배선이면 됨(S 사이즈), 신규 구축 아님.

### 0.2 라이선스 원칙 (반복 명시)

- **MIT / Apache-2.0 / EPL-1.0(주의)** = 코드 그대로 가져와 각색 가능(출처 표시 조건). 단 EPL-1.0은 파일 단위 약한 카피레프트 — 폐쇄형 배포 시 해당 파일 자체엔 EPL 의무가 재부착될 여지가 있어 안전하게 아이디어 참고로만 취급.
- **GPL-3.0 / AGPL-3.0 / LGPL-3.0** = 본 레포는 폐쇄형 proprietary이므로 **코드 복사 절대 금지**. 데이터 모델의 필드 구성, 알고리즘, 워크플로우 설계는 저작권 보호 대상인 "표현"이 아니라 "아이디어"이므로 참고 가능하나, 스키마 필드명·주석·코드를 그대로 옮기는 것은 금지.
- **스택 이질성은 별개 축**: 라이선스가 코드 복사를 허용해도 스택이 다르면(.NET/Vue, Java/Spring, Django/React) 실질은 "스키마·알고리즘 참고 후 NestJS/Angular로 재작성" — 코드 이식이 아니라 아키텍처 참고에 가깝다. 아래 표에 별도 표기.

---

## 1. 저장소별 요약

### 1) odoo/odoo — LGPL-3.0
전체 통합 ERP(CRM/웹사이트/이커머스/창고관리/제조/POS/HR/회계). 창고 모듈: put-away 전략(slow/fast mover, ABC 분석, cross-dock), 다중 창고 재고, 실시간 로케이션별 조회, cycle counting, 오프라인 지원 바코드 스캐너(QR/GS-1), min-max 규칙 기반 스마트 보충·자동 발주, FIFO/이동평균/LIFO/표준원가 valuation, push/pull 라우트 기반 배송.
**라이선스**: LGPL-3.0 — 코드 복사 불가. 아이디어/아키텍처만.
출처: https://github.com/odoo/odoo/blob/master/README.md , https://www.odoo.com/page/warehouse , https://raw.githubusercontent.com/odoo/odoo/master/LICENSE(라이선스 직접 확인)

### 2) frappe/erpnext — GPL-3.0
Frappe 프레임워크 기반 ERP. 5대 모듈(Accounting, Order Management, Manufacturing, Asset Management, Projects). Stock 모듈: 창고별 재고 이동 추적, 입출고/이동 트랜잭션, **주기적 실사(physical count) 대사** 명시. 배치/시리얼 추적·재고 valuation은 문서에서 구체 문구 확인 못함[Medium].
**라이선스**: GPL-3.0 — 코드 복사 불가. 아이디어만.
출처: https://github.com/frappe/erpnext/blob/develop/README.md , https://docs.frappe.io/erpnext (Stock 섹션)

### 3) Dolibarr/dolibarr — GPL-3.0
PHP 기반 ERP/CRM(견적·주문·인보이스·재고, 100+ 기본 모듈/1000+ 애드온). 창고 재고관리, 바코드 생성/스캔, 배치/로트/시리얼 추적, BOM/제조지시서, PDF·ODT 인보이스/견적서/주문서 생성, 공급사 단가표 기반 가격관리, 배송 모듈. 재고알림은 기능 목록에 언급되나 상세 미확인[Medium].
**라이선스**: GPL-3.0 — 코드 복사 불가. 아이디어만. (단 청구서 PDF 생성 방식은 우리가 이미 필요로 하는 기능이라 워크플로우 참고 가치 높음)
출처: https://raw.githubusercontent.com/Dolibarr/dolibarr/develop/README.md

### 4) inventree/InvenTree — MIT
Python/Django + React(Mantine) 재고관리 전문 시스템. 로케이션 계층(상위-하위 cascading location), 각 재고 항목에 `Last Stocktake` 날짜 필드(실사 이력 추적), 모바일 앱(Android/iOS)에 **네이티브 바코드 지원 + 상황인지형(context-sensitive) 재고 액션**, REST API, 플러그인 시스템. 오프라인 지원은 문서상 명시 안 됨(온라인 API 의존 시사)[Medium]. 저재고 알림/PDF 리포트는 플러그인 존재 언급되나 상세 미확인.
**라이선스**: MIT — **코드 그대로 각색 가능**(출처 표시). 단 Django/React 스택 → 실질은 스키마·로케이션 계층 모델·모바일 스캔 UX 참고 후 NestJS/Angular 재작성.
출처: https://raw.githubusercontent.com/inventree/InvenTree/master/README.md , https://docs.inventree.org/en/stable/stock/ , https://docs.inventree.org/en/stable/app/

### 5) ever-co/ever-gauzy — AGPL-3.0 (Community Edition)
NestJS+Angular(ngx-admin)+TypeORM/MikroORM, Nx+Lerna 모노레포, **우리 스택과 가장 근접한 아키텍처**(apps/packages 분리, 멀티테넌시=Multiple Organizations 패턴). HR/CRM/영업파이프라인/Invoicing/재고·SCM까지 아우르는 올인원 플랫폼. Invoicing 모듈 존재(PDF 렌더링 상세 미확인). 로케이션/실사/바코드/요율버저닝은 README 레벨에서 구체 기능 확인 안 됨(WMS 전문 프로젝트 대비 얕음)[Low-Medium].
**라이선스**: **AGPL-3.0 — 스택이 가장 가까운데 라이선스가 가장 엄격**(네트워크 사용 조항 포함, GPL보다 강함). 코드 복사 절대 불가. Nx 모노레포 구조·멀티테넌시 아키텍처 패턴만 아이디어로 참고.
출처: https://github.com/ever-co/ever-gauzy (README)

### 6) fjykTec/ModernWMS — Apache-2.0
.NET 7 + Vue3/Vuetify WMS. 상용 ERP에서 파생된 중소기업용 창고관리. **Location & Bin Management**, **Inventory Counting(재고 실사·조정)**, **Barcode/QR Code Scanning + Inbound/Outbound Processing**(스캔과 입출고 워크플로우 통합), **Stock Alerts**(재고 수준 모니터링·알림), 분석 대시보드 — 우리 §9 비범위 항목과 거의 1:1로 일치.
**라이선스**: Apache-2.0 — **코드 이식 가능**(출처 표시). .NET/Vue 스택 → 그대로 포팅은 불가, 로직/스키마 설계는 코드 레벨로 참조해 NestJS/Angular로 재구현.
출처: https://github.com/fjykTec/ModernWMS (README, 라이선스 GitHub API로 확인: apache-2.0)

### 7) openboxes/openboxes — EPL-1.0
Grails 기반, 의료 공급망 전문(아이티 지진 대응 기원, 현재 시에라리온·레소토·르완다·라이베리아·미국 사용). 검증된 모듈: Products API, Inbound API(입고), Outbound API(출고/배분), Bulk Actions. 로케이션/실사/바코드/유통기한 알림은 도메인상 존재 가능성 높으나 fetch로 검증된 문구는 아님[Low] — 이 부분은 확인 안 됐다고 명시.
**라이선스**: EPL-1.0(파일 단위 약한 카피레프트) — 폐쇄형 배포 시 안전하게 코드 복사 금지, 아이디어만.
출처: https://raw.githubusercontent.com/openboxes/openboxes/master/README.md , https://docs.openboxes.com/en/latest/ (하위 상세 페이지 다수 404, 이 두 URL 이상은 검증 못함)

### 8) openwms/org.openwms — Apache-2.0 (일부 서브 apache 아닌 GPLv3 가능성 있음, 서브별 재확인 필요)
Java 25/Spring Boot 4.1, ~30개 이상 독립 배포 마이크로서비스(계층형 아닌 business-component 모델). 확인된 서비스: Service Registry/Config/Gateway/Auth(UAA)/Common/OSIP-TCP driver/Transaction/**Transportation Service+TMS Routing**/Receiving/Inventory/Movements/Picking/Shipping, SAP/Dynamics/NetSuite 어댑터, BPMN 엔진(Activiti/Flowable/Camunda), RabbitMQ 이벤트. 기능명(서비스명)만 확인, 세부 스토크테이크·바코드 기능문서는 미검증[Medium].
**라이선스**: 루트+공개 서비스 대부분 Apache-2.0 — 코드 참조 각색 가능. 단 일부 엔터프라이즈 확장이 GPLv3일 수 있어 서브모듈별 재확인 필요. Java/Spring 스택 → 실질은 마이크로서비스 분해 방식·TMS 라우팅 개념 참고.
출처: https://github.com/openwms/org.openwms (README)

### 9) enatega/food-delivery-multivendor — MIT
React Native(Customer/Rider/Vendor 앱) + Next.js(Admin) + Node/GraphQL/MongoDB. 배달 주문 전체 라이프사이클. **Rider 앱 + Admin 대시보드에서 배송기사 실시간 위치 추적/주문 배정** — 배차·기사 추적 갭에 가장 직접적으로 대응. Firebase 기반 push/email 알림(주문·배송 상태 변경) — 알림 패턴 참고 가치. 재고/로케이션/바코드/요율버저닝/오프라인동기화 기능 없음(배달 특화, WMS 아님).
**라이선스**: MIT — **10개 중 유일하게 "코드 그대로 각색"이 실질적으로 성립하는 후보**(React Native/Node 스택, 우리 mobile 앱도 결국 웹뷰 기반 Ionic이라 UI 패턴 이식은 제한적이나 위치추적 API/주문배정 로직 설계는 직접 참고 가능). 단 backend API 자체는 별도 유료 라이선스 정책이 있다는 점 주의(README상 프런트만 MIT 취지, 재검증 필요).
출처: https://github.com/enatega/food-delivery-multivendor (README)

### 10) OCA/wms — AGPL-3.0
Odoo 애드온 메타 레포. `stock-logistics-warehouse`(로케이션/피킹/이동/로트 모델 확장 — **로케이션 관리** 정면 대응), `shopfloor`(REST 기반 바코드 스캐너 앱: cluster picking/zone picking/checkout-packing/delivery/location content transfer, API-key 인증), `stock-logistics-putaway`(적치 슬로팅), `stock-logistics-reservation`(할당/가상예약), `stock-logistics-tracking`(로트/패키지 추적).
**라이선스**: AGPL-3.0(Odoo 코어와 동일 계열) — 코드 복사 절대 불가. REST API 형태·워크플로우 분해·shopfloor의 action/service/component 계층 구조는 아이디어로만 참고.
출처: https://github.com/OCA/wms (README), https://github.com/OCA/wms/tree/16.0/shopfloor

---

## 2. 이식 후보 TOP 10 (가치 × 구현비용 × 라이선스 안전성)

**스코어링 공식 (검산 가능하도록 4개 컬럼 분리)**:
- 가치 1~5 (MVP 임팩트, spec 목표 부합도)
- 비용: S=3 / M=2 / L=1 (구현비용 역산 — 작을수록 높은 점수)
- 라이선스: 코드이식가능(Apache/MIT/EPL 소스 존재)=3 · 부분/혼합(코드+아이디어 섞임)=2 · 아이디어전용(GPL/AGPL/LGPL만 근거)=1 · 자체수정(OSS 코드 미사용, 라이선스 리스크 자체가 없음)=3
- **곱 = 가치 × 비용 × 라이선스** (모두 그대로 곱, 역산 없음 — 아래 표에서 직접 검산 가능)

| # | 기능 | 가치 | 비용(사이즈) | 라이선스(성격) | 곱 | 소스 저장소 | 이식 대상 | 착지 위치 |
|---|---|---|---|---|---|---|---|---|
| 1 | 요율/계약 유효기간 버저닝 (TransportRate·StorageContract에 effective_from/to + no-overlap 제약) | 5 | 3(S) | 3(자체수정) | **45** | ledger Task 11 자체 결함(다중 활성계약 충돌·월중 비활성 파트너 미청구) 수정이 본질 — OSS 참고 불필요할 만큼 자명한 패턴 | 아이디어 없음(자체 버그수정) | `apps/api/src/master-data`, `apps/api/src/settlement-fees` |
| 2 | 기간 이월 재고 스냅샷 (월말 opening/closing balance 스냅샷 테이블) | 4 | 3(S) | 3(자체수정) | **36** | ledger Task 11 `openingStock unbounded scan` 결함 수정. odoo(재고 이동 리포트)·InvenTree(`Last Stocktake` 필드)는 설계 감(idea)만 참고 | 아이디어(스냅샷 테이블 패턴) | `apps/api/src/settlement`, Prisma 마이그레이션 |
| 3 | 재고 알림 임계값 배선 (min-max 재입고 알림 → 기존 notifications 모듈 연결) | 3 | 3(S) | 3(자체 인프라 확장) | **27** | odoo(min-max 스마트 보충), ModernWMS(Stock Alerts) — 아이디어만. `apps/api/src/notifications`(FCM/APNs/WebPush) 기존 인프라라 신규 라이선스 리스크 없음 | 아이디어(룰 엔진 설계만) | `apps/api/src/notifications`, `apps/api/src/master-data`(threshold 필드) |
| 4 | 바코드/QR 입출고 스캔 (WarehouseTransaction 입력 화면에 QR 스캔 추가) | 4 | 2(M) | 3(코드이식가능) | **24** | ModernWMS(Barcode/QR+Inbound/Outbound 통합, Apache-2.0), InvenTree(모바일 네이티브 스캔 UX, MIT) — 라이선스 API로 검증 완료 | 코드(스캔→액션 매핑 로직) 참고 후 Angular/Capacitor 재구현 | `apps/web/src/app/features/warehouse`, `apps/mobile/src/app/features` 신규 |
| 5 | 로케이션/빈(bin) 관리 — 창고 내 보관위치 계층 | 3 | 1(L) | 3(코드이식가능) | **9** | ModernWMS(Location & Bin Management, Apache-2.0), InvenTree(cascading location, MIT) — 코드 참고 가능. OCA/wms `stock-logistics-warehouse`는 AGPL이라 아이디어만. spec §9 명시적 비범위 | 코드(테이블 설계) 참고 후 재구현 | `apps/api/src/warehouse`(신규 Location 모델), `apps/web/src/app/features/warehouse` |
| 6 | 청구서 PDF 생성 (월 정산서 PDF 다운로드 추가, 현재 엑셀뿐) | 4 | 2(M) | 1(아이디어전용) | **8** | Dolibarr("PDF & ODT generation for invoices", GPL-3.0), odoo(인보이스 PDF, LGPL-3.0) — 워크플로우·항목 배치만 참고 가능, 코드 불가. spec §5.9 "메일 송부 업무 대체" 목표에 부합해 가치는 높음 | 아이디어(PDF 템플릿 구조 참고) | `apps/api/src/settlement-fees`(statement-export 옆 추가), `apps/web/src/app/features/partner-portal` |
| 7 | 배차·기사 실시간 위치 추적 | 2 | 1(L) | 3(코드이식가능) | **6** | enatega(Rider 앱 실시간 위치추적+주문배정, MIT — 라이선스 API 검증 완료) | 코드(위치추적 API 설계) 참고, UI는 이질적(RN vs Ionic) | `apps/mobile/src/app/features/assignment` 확장 |
| 8 | 재고 실사(Cycle Count/Stocktake) | 2 | 1(L) | 2(부분/혼합) | **4** | odoo(cycle counting, LGPL·아이디어만), InvenTree(`Last Stocktake` 필드, MIT·코드가능), ModernWMS(Inventory Counting, Apache·코드가능), erpnext(주기적 실사 대사, GPL·아이디어만) — 코드+아이디어 혼합 | 코드+아이디어 혼합 참고 | `apps/api/src/warehouse`(신규 StocktakeSession), `apps/web/src/app/features/warehouse` |
| 9 | 창고 스캐너 앱 아키텍처(action/service/component 계층 REST 설계) | 2 | 1(L) | 1(아이디어전용) | **2** | OCA/wms `shopfloor` — AGPL, 코드 이식 절대 불가, 계층 설계 패턴만 참고 | 아이디어(계층 설계 패턴) | `apps/api/src/warehouse` 향후 API 설계 시 참고 |
| 10 | 멀티테넌시/모노레포 구조 참고 | 1 | 1(L) | 1(아이디어전용) | **1** | ever-gauzy(Nx 기반 apps/packages, Multiple Organizations 패턴) — AGPL, 코드 이식 절대 불가. 현재 단일 회사 ERP라 시급성도 낮음 | 아이디어(구조 참고) | 해당 없음(장기 아키텍처 참고용) |

---

## 3. 권장 1차 이식 3건

1. **요율/계약 유효기간 버저닝** (곱 45, S) — ledger Task 11 deferred 결함(다중 활성계약 충돌, 월중 비활성 파트너 미청구)을 직접 해소. 라이선스 리스크 0(자체 버그 수정), MVP 정산 정확성에 직결.
2. **기간 이월 재고 스냅샷** (곱 36, S) — ledger Task 11 `openingStock unbounded scan` 해소. 매월 opening/closing 스냅샷 테이블 하나 추가로 성능·정합성 동시 개선. 라이선스 리스크 0.
3. **바코드/QR 입출고 스캔** (곱 24, M) — TOP 10 중 유일하게 "실제 OSS 코드 참고가 성립"하면서 license-safe(ModernWMS Apache-2.0, InvenTree MIT — 라이선스 API로 직접 검증)한 실질적 이식 후보. `WarehouseTransaction` 직접 입력 화면(spec §5.5)의 텍스트 검색 방식을 스캔으로 대체해 현장 입력 오류·시간을 줄인다.

참고: 재고 알림 임계값 배선(곱 27, #3 순위)은 `apps/api/src/notifications` 인프라가 이미 완비되어 있어 "이식"이 아닌 단순 배선 작업(S) — 1차 착수 후보로 추가 권장하되 이식 3건 슬롯에서는 제외.
