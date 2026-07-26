# 심화 설계 벤치마킹 — ever-gauzy / enatega / openboxes

**작성일**: 2026-07-26 · **대상**: 국민트랜스 ERP(NestJS 11 + Prisma + PostgreSQL, Angular 19 + Ionic 8 PWA + Capacitor)
**전제 문서**: `docs/superpowers/specs/2026-07-25-masterdata-settlement-design.md`, `prisma/schema.prisma`, `apps/api/src/orders/order-state-machine.ts`, `docs/benchmarking/2026-07-26-oss-benchmark.md`(얕은 1차 조사 — 본 문서가 심화판)

**방법론**: 3개 병렬 서브에이전트가 `gh api`/raw.githubusercontent.com으로 실제 소스를 직접 fetch. README나 마케팅 문구가 아니라 실제 코드(엔티티/가드/리졸버)를 인용. 검증 안 된 내용은 `[Unknown]`/`[Low]`로 명시.

---

## 0. 라이선스 원칙 재확인

- **ever-co/ever-gauzy**: AGPL-3.0(Community Edition). **코드 복사 절대 금지.** 아이디어·아키텍처 패턴만 참고.
- **enatega/food-delivery-multivendor**: MIT. **단, 백엔드(API)는 공개 저장소에 존재하지 않는다 — 프로프라이어터리(유료 라이선스).** README 원문: *"the backend and API are proprietary and can be licensed as part of a paid package"*. `gh api repos/enatega/enatega-multivendor-api` → 404 확인. 공개된 것은 rider/customer/vendor/admin 프런트엔드(React Native/Next.js)뿐이며 이것만 MIT — 코드 각색 가능.
- **openboxes/openboxes**: EPL-1.0. 파일 단위 약한 카피레프트. LICENSE.md Section 3 원문: 소스 형태로 배포 시 "a copy of this Agreement must be included... Contributors may not remove or alter any copyright notices." Section 1은 "별도 모듈로 배포되고 Program의 파생저작물이 아닌 추가물은 Contribution이 아니다"라고 명시 — 즉 **직접 포팅/번역이 아니라 스키마·설계만 참고해 NestJS/Prisma로 새로 작성하면 EPL 의무가 재부착되지 않는다.** 실제 코드를 그대로 옮기면 그 파일 자체가 EPL 대상이 됨.

---

## 1. 배차·기사 워크플로우

### 1.1 검증 가능 범위의 한계 (중요)

enatega의 **백엔드(주문↔기사 배정 리졸버, DB 스키마)는 공개되어 있지 않다.** 배정 알고리즘(거리 기반 자동 매칭 여부, 관리자 강제 배정 여부)은 서버 리졸버 내부에 있고 그 코드는 존재 자체가 확인 불가(`[Unknown]`). 아래는 **rider 앱(React Native/Expo, MIT)의 실제 소스에서만 검증된 것**이다 — 이 부분만 코드 각색이 실질적으로 성립.

파일: `enatega-multivendor-rider/lib/apollo/mutations/order.mutation.ts`, `.../rider.mutation.ts`, `.../subscriptions.ts`, `.../lib/context/global/location.context.tsx`

### 1.2 주문 상태 전이 (클라이언트 측 enum, `[Medium]` — 서버 authoritative 스키마 아님)

```
PENDING → ACCEPTED → ASSIGNED → PICKED → DELIVERED → COMPLETED
                                                    ↘ CANCELLED
```
(`lib/utils/enums/global.enum.ts`의 `ORDER_STATUS_ENUM`. 단 `IOrder.orderStatus: string` — 클라이언트 자체가 이 enum을 타입으로 강제하지 않음, 서버가 다른 값을 보낼 수도 있다는 뜻.)

### 1.3 배차 방식 — 풀(pull) 기반, 자동매칭 근거 없음

```graphql
mutation AssignOrder($id: String!) {
  assignOrder(id: $id) { _id orderStatus rider { _id name username } }
}
```
- rider 앱이 `subscriptionZoneOrders(zoneId)`로 자기 구역의 미배정 주문 풀을 구독하고, 기사가 직접 `assignOrder`를 호출해 **스스로 건을 잡는(self-claim) 구조**다. 관리자가 강제 배정하는 경로가 있는지는 확인 불가.
- 별도로 `subscriptionAssignRider(riderId)`가 있어 시스템이 특정 기사에게 배정을 push하는 경로도 존재 — 즉 "풀에서 스스로 잡기"와 "배정받기" 두 경로가 공존하는 것으로 보이나, 서버가 어느 쪽을 언제 쓰는지는 리졸버가 없어 불명.
- 기사 가용 상태: `mutation ToggleRider($id: String!) { toggleAvailablity(id: $id) { _id } }` (원문 오타 "Availablity" 그대로 실존 코드).

### 1.4 실시간 위치 전송 — Apollo GraphQL Subscription, 주기·배터리 정책 완전 확인됨

전송(Mutation, 위/경도가 `String!`인 점이 특이):
```graphql
mutation UpdateRiderLocation($latitude: String!, $longitude: String!) {
  updateRiderLocation(latitude: $latitude, longitude: $longitude) { _id }
}
```
구독(관리자/고객 측이 보는 쪽):
```graphql
subscription SubscriptionRiderLocation($riderId: String!) {
  subscriptionRiderLocation(riderId: $riderId) { _id location { coordinates } }
}
```
- 소켓이 아니라 **GraphQL Subscription**(Apollo). 우리 인프라(Socket.IO `/ws` 게이트웨이, room 기반)와 전송 계층은 다르지만 "구독 채널에 위치 push" 패턴 자체는 그대로 참고 가능.
- **서버가 매 ping을 DB에 영속화하는지, 아니면 in-memory pub/sub로만 흘려보내는지는 리졸버가 없어 확인 불가**(`[Low]` 추정 — durable write 가능성이 높아 보이나 근거 약함).

- **적응형 추적 프로파일(실코드, `location.context.tsx`)**:
```js
const ACTIVE_TRACKING_OPTIONS = { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 30000 };
const IDLE_TRACKING_OPTIONS  = { accuracy: Location.Accuracy.Balanced, distanceInterval: 50, timeInterval: 60000 };
```
  `isActivelyDelivering`(배정된 주문의 상태가 `ASSIGNED`/`PICKED`이고 그 주문의 rider가 본인일 때)가 참일 때만 ACTIVE 프로파일(10m 또는 30초마다) 사용, 그 외엔 IDLE(50m 또는 60초). **battery-aware 설계 — 우리 Installer 위치추적을 얹을 때 그대로 채용 가치 있음.**
- **포그라운드 전용**: `getForegroundPermissionsAsync`만 사용, 백그라운드 권한 요청(`expo-task-manager`, `startLocationUpdatesAsync`)이 코드에 전혀 없음. 앱이 백그라운드로 가면 추적이 끊긴다는 뜻 — 설치기사 앱에 그대로 쓸 경우 이 한계를 인지해야 함.
- **오프라인 처리: 사실상 없음.** 위치 전송 mutation 실패 시 `catch` 블록에서 `console.log`만 하고 끝 — 큐잉/재시도 없이 그냥 유실(drop). 토큰이 없으면 아예 전송 안 함(silent return). **우리 `OfflineSyncQueue`(PENDING/SYNCED/CONFLICT/FAILED)를 위치 이벤트에도 적용하면 enatega보다 견고한 설계가 된다** — 이 부분은 enatega를 뛰어넘어야 할 지점이지 그대로 베낄 지점이 아님.
- 동일 좌표 연속 전송을 막는 dedup(`previousLocationRef` 비교) — 트래픽 절약 아이디어로 참고 가치 있음.

### 1.5 우리 Installer/Appointment/Order에 얹을 최소 설계 제안

현재 `Installer` 모델엔 위치 필드가 전혀 없다(`prisma/schema.prisma:188-206`). 최소 추가안:

```prisma
model Installer {
  // ...기존 필드...
  lastLat       Decimal?  @db.Decimal(9, 6)
  lastLng       Decimal?  @db.Decimal(9, 6)
  lastLocatedAt DateTime?
}
```
(별도 이력 테이블은 YAGNI — MVP는 "현재 위치 1개"면 충분. 이력이 필요해지면 `InstallerLocationLog` 별도 테이블로 확장.)

- **전송 트리거**: enatega처럼 `Order.status`가 `DISPATCHED`(우리 상태값, enatega의 PICKED에 해당)인 주문을 배정받은 installer만 ACTIVE 주기(예: 30초/10m) 전송, 그 외엔 미전송 또는 저주기. 우리는 이미 `OrderStatus.DISPATCHED` 전이 시점에 gateway로 `ASSIGNMENT_CHANGED`를 쏘고 있으니 그 이벤트를 트리거로 재사용.
- **채널**: 신규 GraphQL subscription을 도입할 이유 없음(YAGNI) — 기존 Socket.IO `/ws` 게이트웨이에 `INSTALLER_LOCATION_UPDATED` 이벤트 하나 추가, `order:{id}` room(거래처/HQ가 이미 구독 중인 room)으로 브로드캐스트하면 끝.
- **오프라인**: enatega처럼 유실시키지 말고 `OfflineSyncQueue`에 `entityType: 'InstallerLocation'`으로 태워 기존 동기화 배관 재사용 — 신규 인프라 불필요.
- **ETA**: enatega엔 ETA 계산 코드가 확인되지 않았다(`[Unknown]`) — 이 부분은 참고할 소스가 없으므로 직선거리/네이버맵 API 등 별도 설계 필요(본 조사 범위 밖).

---

## 2. 알림/실시간 채널

### 2.1 enatega 쪽 확인된 사실 (rider 앱, MIT)

- Push: **Expo Push Token** 방식(`expo-notifications`, `getExpoPushTokenAsync`) — FCM/APNs를 직접 다루지 않고 Expo 중계 서비스를 씀. 토큰은 별도 등록 호출이 아니라 **로그인 mutation의 변수(`notificationToken`)로 함께 전송**.
- 카테고리별 옵트인/아웃: `mutation UpdateNotificationStatus($offerNotification: Boolean!, $orderNotification: Boolean!)` — boolean 2종(주문/프로모션)만 존재. **quiet hours 개념 없음.**
- 고객/관리자 쪽은 push와 **병행하여 GraphQL Subscription도 동시에 사용**(`orderStatusChanged(userId)`, `subscriptionOrder(id)`) — "push는 앱이 죽어있을 때, subscription은 앱이 떠 있을 때"의 하이브리드 구조로 추정(`[Medium]`, 서버 트리거 로직 자체는 비공개라 검증 불가).
- 서버가 정확히 어떤 이�트에 push를 쏘는지(배정/수락/상태변경 등 트리거 조건)는 **리졸버 비공개로 검증 불가** — 이 부분은 참고 근거가 없다.

### 2.2 우리 인프라 대비 매핑

우리는 이미 enatega보다 구조적으로 더 정교하다:

| 항목 | enatega(rider, 확인분) | 우리 기존 인프라 |
|---|---|---|
| Push 트랜스포트 | Expo 단일 경로 | `PushProvider` enum(VAPID/FCM/APNS) — 플랫폼별 분기 이미 구현 (`apps/api/src/notifications/push-providers/*.provider.ts`) |
| 옵트인 단위 | boolean 2개 | `NotificationSubscription.categoriesEnabled: String[]` — 임의 카테고리 확장 가능 |
| 무음 시간대 | 없음 | `quietHours: Json?` 필드 이미 존재 |
| 실시간 채널 | GraphQL Subscription | Socket.IO(`/ws`, JWT 인증, room 기반: `branch:{code}`, `order:{id}`) — 이미 `ORDER_UPDATED`/`ASSIGNMENT_CHANGED`/`NOTIFICATION`/`FORCE_REFRESH`/`SETTLEMENT_LOCKED/UNLOCKED` 발행 중 |

**시사점**: enatega에서 가져올 새 아이디어는 딱 하나 — "**주문에 활성 배송원(rider/installer)이 배정돼 있을 때만, 그리고 그 주문이 진행 상태(PICKED/DISPATCHED)일 때만 위치를 쏜다**"는 이벤트-게이팅 조건. 채널·프로바이더·구독 모델 자체는 이미 우리가 더 낫다 — 이식이 아니라 이벤트 트리거 로직만 참고.

**우리 쪽에 추가할 이벤트**: `WsEventType`에 `INSTALLER_LOCATION_UPDATED` 1개 추가, `Notification.category`에 `INSTALLER_LOCATION`은 불필요(위치는 상태 변화가 아니라 스트림이므로 영속 알림 테이블에 쌓을 필요 없음 — `Notification` 테이블에 매 ping을 쓰면 과설계, 소켓 스트림으로만 흘리는 게 맞다).

---

## 3. openboxes 재고 트랜잭션 타입 체계

파일: `grails-app/domain/org/pih/warehouse/inventory/{Transaction,TransactionEntry,TransactionType,TransactionSource}.groovy`, `src/main/groovy/org/pih/warehouse/inventory/TransactionCode.groovy`, `src/main/groovy/org/pih/warehouse/core/Constants.groovy`

### 3.1 핵심 설계 — "고정 코드 4종 + DB 시드 타입 N종" 이중 구조

OpenBoxes는 우리처럼 `enum TransactionType { INBOUND, OUTBOUND }`을 코드에 하드코딩하지 않는다. 대신:

1. **컴파일된 고정 enum `TransactionCode`**(의미론적 뼈대, 4종만):
   - `DEBIT` — 재고 항목 수량 감소
   - `CREDIT` — 재고 항목 수량 증가
   - `INVENTORY` — 특정 재고 항목(로트)의 수량을 절대값으로 재설정(실사/조정 메커니즘)
   - `PRODUCT_INVENTORY` — 품목의 모든 로트에 대해 동일하게 적용되는 INVENTORY

2. **DB 테이블 `TransactionType`**(운영 중 추가 가능한 실제 타입 목록, `id/name/description/sortOrder/transactionCode` — 즉 각 행이 위 4개 코드 중 하나에 매핑됨). `Constants.groovy`에 박제된 실제 시드 ID:

| ID | 타입 | TransactionCode |
|---|---|---|
| 2 | CONSUMPTION(소모) | DEBIT |
| 3 | ADJUSTMENT_CREDIT(조정-증가) | CREDIT |
| 4 | EXPIRATION(유통기한 폐기) | DEBIT |
| 5 | DAMAGE(파손) | DEBIT |
| 7 | INVENTORY(재고 재설정, deprecated) | INVENTORY |
| 8 | TRANSFER_IN(이동-입고) | CREDIT |
| 9 | TRANSFER_OUT(이동-출고) | DEBIT |
| 10 | ADJUSTMENT_DEBIT(조정-감소) | DEBIT |
| 11 | PRODUCT_INVENTORY(품목 전체 재설정, deprecated) | PRODUCT_INVENTORY |
| 12 | INVENTORY_BASELINE(기초 재고) | INVENTORY |

(ID 1, 6은 이름 상수를 찾지 못함 — `[Unknown]`, 아마 입고/구 버전 receiving 타입으로 추정되나 근거 없이 단정 안 함.)

### 3.2 헤더/라인 구조 및 이중분개(double-entry)

- **`Transaction`(헤더) → `TransactionEntry`(라인)**: `hasMany = [transactionEntries: TransactionEntry]`, cascade `all-delete-orphan`. 헤더는 `transactionType, transactionDate, source(Location), destination(Location), requisition, receipt, order, cycleCount, confirmed, confirmedBy` 등을 가짐.
- 클래스 주석이 명시: *"모든 창고 이벤트는 두 개의 트랜잭션을 가진다 — 출발지의 출고 트랜잭션과 도착지의 입고 트랜잭션"* — 즉 이동(TRANSFER)은 **양쪽 로케이션에 각각 하나씩, 총 2건의 Transaction 레코드**로 기록되는 이중분개 방식. Validator가 `source`와 `destination`을 동시에 세팅하지 못하게 강제(TRANSFER_IN은 source 필수, TRANSFER_OUT은 destination 필수).
- **`TransactionEntry`(라인)**: `quantity, product, inventoryItem(로트 단위, 필수), binLocation, reasonCode, comments`.
- **`TransactionSource`**: Transaction과 별개로 존재하는 감사/그룹핑 테이블. "이 배치의 트랜잭션들이 어떤 액션(shipment/requisition/receipt/order/cycleCount)에서 비롯됐는가"를 추적하고, 데이터 마이그레이션으로 되채운 행은 `accurate=false`로 표시하는 정직한 설계.

### 3.3 InventoryLevel(재주문점) — 실제 필드

```groovy
Integer minQuantity        // 안전재고 하한(경고)
Integer reorderQuantity    // 재주문점(이 값 아래로 떨어지면 발주 트리거)
Integer maxQuantity        // 상한(경고)
BigDecimal forecastQuantity
BigDecimal forecastPeriodDays = 30
BigDecimal expectedLeadTimeDays
BigDecimal replenishmentPeriodDays
BigDecimal demandTimePeriodDays
Location preferredBinLocation
Location replenishmentLocation   // 외부 공급처 또는 내부 빈(bin)일 수 있음
String abcClass
InventoryStatus status = InventoryStatus.SUPPORTED
```
"재주문점"이라는 단일 필드명은 없고 `reorderQuantity`가 그 역할. `min/max`는 별도 경고 임계값으로 분리돼 있다 — 우리가 재고알림(1차 벤치마킹 문서 #3, 곱 27)을 설계할 때 "min만 있는 단순 룰"이 아니라 min/reorder/max 3단 구조가 실전에서 쓰인다는 근거.

### 3.4 우리 `WarehouseTransaction.type`(INBOUND/OUTBOUND 2종) 확장 설계

**직접 포팅 금지(EPL-1.0) — 아이디어만 채용해 우리 컨벤션(Prisma enum + FK)으로 재작성.** 현재 스펙(§9 YAGNI)은 실사/조정/이동을 명시적으로 후속 PRD로 미뤘으나, "지금 확장한다면 이 모양"이라는 답:

```prisma
enum TransactionType {
  INBOUND       // 기존
  OUTBOUND      // 기존
  ADJUSTMENT    // 신규 — 실사 후 차이 보정(+/-는 quantity 부호로 표현)
  TRANSFER      // 신규 — 창고/로케이션 간 이동(로케이션 모델 도입 후 의미 있음, 그 전엔 YAGNI)
}

enum AdjustmentReason {
  STOCKTAKE     // 실사 결과 반영
  DAMAGE        // 파손
  EXPIRATION    // 유통기한 폐기
}
```

- OpenBoxes의 "고정 코드 4종 + DB 시드 N종" **이중 구조는 우리 규모(창고 1~수개, 일 1만 건)엔 과설계** — YAGNI. 우리는 `TransactionType` enum 4~5개로 충분하고, 세부 사유는 신규 컬럼 `reasonCode: AdjustmentReason?`로 족하다. OpenBoxes가 DB 시드 테이블을 쓰는 이유는 전 세계 여러 기관이 커스텀 타입을 운영 중 추가해야 하는 SaaS형 배포 특성 때문 — 국민트랜스는 단일 회사 ERP이므로 이 유연성이 불필요한 비용이다.
- `WarehouseTransaction`은 이미 헤더=라인이 1:1(quantity 1개, product 1개)이라 OpenBoxes의 Transaction/TransactionEntry 분리(헤더 1: 라인 N)는 **지금 필요 없음** — 한 실적 입력에 여러 품목을 한 번에 넣는 화면이 생기기 전까지는(엑셀 업로드는 이미 행 단위라 문제 없음). 도입한다면 `WarehouseTransaction`(헤더: partnerId, transactionDate, source) + `WarehouseTransactionLine`(라인: productId, quantity)으로 쪼개되, **직접입력 화면이 다품목 동시입력을 요구하게 될 때**로 미룬다(YAGNI, 지금은 불필요한 리팩터).
- 이동(TRANSFER) 타입은 로케이션 모델(1차 벤치마킹 #5, 비범위)이 없는 지금은 의미가 없다 — 로케이션 도입과 묶어서 후속 PRD.

---

## 4. Shipment 개념

파일: `grails-app/domain/org/pih/warehouse/shipping/{Shipment,ShipmentItem,ShipmentType,Container,ContainerType}.groovy`, `src/main/groovy/org/pih/warehouse/shipping/ShipmentStatusCode.groovy`, `.../order/{Order,OrderItem,OrderType}.groovy`

### 4.1 "출고 묶음"을 어떻게 표현하나 — 조인 테이블을 통한 다대다

핵심 발견: **`Shipment`는 `OrderItem`을 직접 참조하지 않는다.** `ShipmentItem`이 조인 지점이다.

```
Order 1―N OrderItem 1―N ShipmentItem N―1 Shipment
                              (order_shipment 조인 테이블로 OrderItem↔ShipmentItem 다대다)
```

- `ShipmentItem`: `belongsTo = [Shipment, OrderItem]`, `hasMany = [orderItems: OrderItem]`(조인 테이블 `order_shipment`) — **한 ShipmentItem이 여러 OrderItem을 참조할 수 있고**, `Shipment.getOrders()`는 `shipmentItems*.orderItems.order.flatten().unique()`로 **계산해서** 도출한다(저장 컬럼이 아님). 즉 "하나의 출고(트럭 1대분)가 여러 주문을 묶는다"는 게 저장 관계가 아니라 조회 시점 집계로 표현된다.
- `Order.getShipments()`도 마찬가지로 역방향 계산 프로퍼티 — Order 테이블 자체엔 `shipmentId` 컬럼이 없다.

### 4.2 차량/기사 필드 — 의외로 얇다

```groovy
Person carrier          // 실제로 물건을 옮기는 사람/조직
String driverName       // 주석: "재고 이동용으로 추가됨(carrier를 써야 함)" — 사실상 임시방편으로 인정된 중복 필드
ShipmentMethod shipmentMethod  // 배송 캐리어/서비스 종류
```
**차량 번호판·톤수·차량단가 필드가 아예 없다.** 비용(요율)은 Shipment에 붙지 않고 별도 Invoice/InvoiceItem 쪽에서 다뤄진다. 이는 의료 물류(공급망 중심, 자체 차량 소유가 아닌 외주 캐리어 중심) 도메인 특성 — **국민트랜스의 "차량 단가표"(`TransportRateCard`: vehicleType/tonnage/containerSize) 요구사항엔 OpenBoxes Shipment가 참고가 안 된다.** 이 부분은 우리가 이미 더 구체적으로 설계돼 있다.

### 4.3 상태 — 저장이 아니라 이벤트에서 계산

`Shipment.status`는 컬럼이 아니라 `getStatus()`가 `wasReceived()/wasPartiallyReceived()/hasShipped()`(각각 `Event`/`EventCode` 이력 조회)로 매번 계산한다. `currentStatus`(영속 `ShipmentStatusCode`: CREATED/PENDING/SHIPPED/PARTIALLY_RECEIVED/RECEIVED)는 `beforeInsert`/`beforeUpdate`에서 재계산해 캐싱한 스냅샷일 뿐이다. 우리 `Order.status`는 명시적 상태머신(`order-state-machine.ts`)으로 전이를 가드하는 방식이라 훨씬 견고함 — 이 계산형 상태는 참고할 필요 없음.

### 4.4 "건당 운송료의 건"에 대한 시사점

현재 스펙(§4.1)은 운송료를 **"WarehouseTransaction 1건 = 요율 1건"**으로 고정 계산한다(차량 지정 시 `TransportRateCard.rate` 추가/대체). OpenBoxes의 Shipment/ShipmentItem 다대다 설계가 시사하는 것:

- "**하나의 출고 단위(트럭 1대분)에 여러 거래처·여러 품목의 건이 합쳐질 수 있다**"는 개념이 실제로 존재한다(ShipmentItem이 여러 OrderItem을 묶는 것과 동형). 지금 우리 계산식은 `WarehouseTransaction`(거래처 1개 + 품목 1개) 단위로 "건"을 정의하는데, 만약 실제 운영에서 "한 트럭에 3개 거래처 화물을 함께 실어 배송하고 운송료는 트럭 단위로 청구"하는 케이스가 있다면, 지금 모델로는 표현이 안 된다 — **이건 스펙 §10 미해결 사항("차량 지정 건의 운송료가 합산인지 대체인지")과 직결되는 질문이며, 답에 따라 "건"의 단위를 `WarehouseTransaction`(현재, 거래처×품목×일자)으로 유지할지 `TransportRun`(트럭 1대 운행 = 여러 WarehouseTransaction 묶음) 같은 새 개념을 얹을지 갈린다.**
- 지금 스펙 범위(§9 YAGNI: TMS 배차/실시간 추적 후속)에서는 **"건 = WarehouseTransaction 1행"으로 충분하다.** Shipment형 묶음 개념은 "차량 1대에 여러 거래처를 합적하는" 실제 운영 패턴이 확인되기 전까지 도입하지 않는 게 맞다(YAGNI) — 다만 정산 담당자 확인(§10) 결과 합적 운송이 실무에 존재한다면, `TransportRun`(헤더: vehicleId/tonnage/date) ↔ `WarehouseTransaction`(라인, FK `transportRunId?`) 형태로 얇게 얹을 수 있다는 것만 미리 기록해 둔다.

---

## 5. 모노레포/공유 타입 아키텍처

파일: `packages/contracts/{package.json,project.json,src/index.ts,src/lib/role-permission.model.ts}`, `packages/core/package.json`, `apps/gauzy/package.json`, 루트 `package.json`, `tsconfig.base.json`

### 5.1 gauzy의 실제 구조 — "빌드되는 내부 npm 패키지"이지 "소스 폴더 참조"가 아니다

- `packages/contracts/package.json`: `main: "./src/index.js"`, `typings: "./src/index.d.ts"` — **컴파일된 산출물 경로**를 가리킨다. `.ts` 원본이 아니다.
- `project.json`(Nx): `@nx/js:tsc` executor로 `dist/packages/contracts`에 빌드, Nx-release 설정까지 있어 **독립 버저닝되는 패키지처럼(0.1.0) 취급**된다(`private: true`라 실제 npm 레지스트리엔 안 올라감).
- **`tsconfig.base.json`에 `@gauzy/contracts` 경로 별칭(paths)이 없다** — 직접 fetch로 확인. 즉 TS path-mapping으로 소스를 직접 읽는 방식이 아니라, **Yarn/npm workspaces**(루트 `package.json`의 `"packages": ["apps/*","packages/*","packages/plugins/*"]`)가 `packages/contracts`를 workspace의 `node_modules/@gauzy/contracts`에 심볼릭 링크하고, `packages/core/package.json`과 `apps/gauzy/package.json`이 이를 `"@gauzy/contracts": "^0.1.0"`이라는 **평범한 semver 의존성**으로 선언한다.
- 결과: contracts가 먼저 빌드돼야(`nx build contracts` → `dist/…/*.js + *.d.ts`) 백엔드/프런트 양쪽에서 `node_modules` 경유로 타입을 resolve — **외부 npm 패키지를 쓰는 것과 완전히 동일한 흐름**, 다만 registry 대신 workspace 심볼릭 링크로 대체된 것뿐.

### 5.2 반전 — gauzy도 "DB→타입 자동 생성" 문제는 안 풀었다

`packages/contracts`의 인터페이스(`IOrganization`, `ICreateOrganizationInput` 등)는 **TypeORM/MikroORM 엔티티 클래스와 별개로 손으로 유지**되는 순수 인터페이스다. 즉 gauzy가 실제로 해결한 문제는 "**여러 앱이 손으로 관리하는 사본을 각자 갖지 않고, 손으로 관리하는 사본 하나를 패키지로 공유한다**"이지, "**ORM/DB 스키마에서 타입을 자동 파생한다**"가 아니다. 후자는 우리 Prisma가 이미 `@prisma/client`로 해결하고 있는 문제이고, gauzy는 그조차 안 하고 있다.

### 5.3 우리 상황과의 정확한 비교

| | ever-gauzy | 우리 (현재) |
|---|---|---|
| 공유 타입 정의 방식 | `packages/contracts`에 손으로 작성한 인터페이스 | `packages/shared/src/models/*.ts`에 손으로 작성(예: `orders.models.ts`가 Prisma `OrderStatus` enum을 문자열로 재입력) |
| 백엔드 DTO 소스 | TypeORM 엔티티(별개, 손 유지) | Prisma 스키마 → `@prisma/client` 타입(자동 생성, 이미 단일 소스 존재) |
| 프런트 소비 방식 | workspace 심볼릭 링크 + semver 의존성(빌드 필요) | 미상 — grep 결과 `packages/shared`가 pnpm workspace 패키지이긴 하나(`apps/mobile`, `apps/web` 개선 커밋 이력 확인됨), 백엔드 DTO는 프런트에서 **수동으로 재입력 중**(`apps/web`이 백엔드 응답 형태를 손으로 미러링) |
| 이중정의 근본 원인 | 애초에 ORM에서 타입 자동파생을 안 함(설계 선택) | Prisma가 이미 `@prisma/client`로 백엔드 타입을 자동 생성하는데 **그 타입을 프런트가 재사용하지 않고 손으로 다시 씀** — gauzy보다 우리가 고칠 여지가 더 크다 |

### 5.4 제거 설계안 — 이중정의 없애기

gauzy를 그대로 따라할 필요 없음(우리가 이미 더 나은 원천 — Prisma). 대신:

1. **`packages/shared`에 `@prisma/client`가 생성하는 타입(enum, 그리고 필요시 `Prisma.OrderGetPayload<...>` 유틸 타입)을 재노출(re-export)하는 진입점 하나 추가.** 신규 인터페이스를 손으로 다시 안 쓰고 Prisma가 이미 만든 것을 가리키기만 하면 끝(YAGNI — 별도 코드생성 파이프라인 불필요, Prisma client가 이미 그 파이프라인이다).
2. Angular(웹/모바일)는 API 응답 DTO가 Prisma 엔티티와 1:1이 아닌 경우(관계 select, 필드 마스킹 등)가 많으므로, **NestJS 쪽에 실제 응답 shape를 나타내는 `class`(또는 `interface`) DTO를 두고 그것을 `packages/shared`가 재노출**하는 편이 더 정확하다(엔티티 그대로 노출은 오버페칭·필드마스킹 우회 위험). 이 DTO들은 지금도 `apps/api/src/*/dto/`에 존재하므로 **새 파일을 만들 필요 없이 packages/shared에서 import path만 연결**하면 된다.
3. gauzy식 "빌드되는 독립 npm 패키지 + workspace symlink"는 우리 규모(단일 회사, 모노레포 3-4개 앱)에 과설계다. `packages/shared`가 이미 workspace 패키지로 존재하니 **tsconfig `paths`로 `apps/api`의 DTO 폴더를 가리키게 하거나, 아주 얇은 re-export 파일 몇 개 추가**로 충분 — Nx-release/버저닝 같은 gauzy의 배포 인프라는 불필요.

---

## 6. 권한 모델

파일: `packages/contracts/src/lib/role-permission.model.ts`, `packages/core/src/lib/shared/{decorators/permissions.decorator.ts,guards/permission.guard.ts}`, `packages/core/src/lib/core/decorators/{sensitive-relations.decorator.ts,is-secret.ts}`, `packages/core/src/lib/core/interceptors/sensitive-relations.interceptor.ts`, `packages/core/src/lib/core/crud/tenant-aware-crud.service.ts`, `apps/gauzy/src/app/pages/projects/guards/project-manager.guard.ts`

### 6.1 gauzy 권한 모델의 3개 층

1. **엔드포인트 게이팅(가장 흔한 층)**: `PermissionsEnum`(플랫 문자열 enum, ~200개, `ORG_EMPLOYEES_EDIT`처럼 리소스+CRUD suffix 컨벤션) + `@Permissions(...)` 데코레이터 + `PermissionGuard`(Reflector로 메타데이터 읽고, JWT의 tenantId/roleId로 캐시 키 구성, `RolePermissionService.checkRolePermission`으로 판정). **딱 우리 `RolesGuard`(`@Roles(Role.HQ_ADMIN)` + `Reflector`)와 동일한 패턴**, 차이는 gauzy가 role이 아니라 role에 부여된 개별 permission 단위로 더 세분화한다는 것.
2. **관계(relation) 포함 게이팅**: `@SensitiveRelations(config, rootKey)` + `SensitiveRelationsInterceptor`. **주석에 명시: "쿼리를 수정하거나 관계를 필터링하지 않는다. 권한 없는 관계를 요청하면 그냥 403을 던질 뿐이다."** 즉 우리가 원하는 "단가 필드만 지우고 나머지는 보여주기"가 아니라 "그 관계 전체를 요청하면 통째로 거부"하는 all-or-nothing 방식.
3. **문자열 마스킹**: `@IsSecret()`/`WrapSecrets()` — `abc123xyz` → `***23xyz`처럼 **비밀번호/API키 같은 리터럴 시크릿 필드**용. `custom-smtp.entity.ts`, `tenant-api-key.entity.ts` 등에 적용된 사례만 확인. **비즈니스 필드(단가 등)를 역할에 따라 조건부로 숨기는 범용 메커니즘은 gauzy에도 없다**(`packages/plugins/*` 미검색 영역 제외, `packages/core` 내엔 없음 확인).
4. **행(row) 레벨 필터**: `TenantAwareCrudService.findConditionsWithEmployeeByUser()` — `CHANGE_SELECTED_EMPLOYEE` 권한이 없는 직원이 조회하면 `WHERE employee.id = :자기자신`을 강제 주입. 이건 우리 스펙의 "거래처는 partnerId 필터 강제"(§2)와 **동형 패턴** — 서비스 공통 베이스에서 자동 주입한다는 아이디어는 참고 가치 있음.

### 6.2 결론: 우리 "단가 비노출" 요구사항에 gauzy가 주는 답은 없다

스펙 §5.5는 `WAREHOUSE_STAFF`에게 `unitPrice`/`costPrice`/`transportRate`를 비노출해야 한다고 명시하고, 실제로 `apps/api/src/master-data/products.service.ts:54`에 이미 다음과 같이 **서비스 레이어에서 구조분해로 필드를 제거하는 수동 방식**이 구현돼 있다:
```ts
rows.map(({ unitPrice: _unitPrice, costPrice: _costPrice, transportRate: _transportRate, ...rest }) => rest)
```
gauzy를 조사한 결과 **이보다 나은 "선언적 필드 마스킹" 메커니즘은 gauzy에도 없다.** gauzy의 `SensitiveRelations`는 관계 단위 all-or-nothing이라 우리 요구(같은 엔티티의 스칼라 필드 일부만 제거)엔 안 맞고, `IsSecret`은 문자열 마스킹이라 "완전히 지운다"는 우리 요구와 다르다.

**시사점**: 지금 방식(서비스 레이어 구조분해)이 사실 gauzy보다 단순하고 우리 요구에 더 정확히 맞다 — **바꿀 필요 없음(YAGNI).** 다만 지금처럼 서비스마다 반복(products.service.ts, 향후 다른 마스킹 지점)되면 중복이 늘어나므로, **역할별 필드 제외 목록을 한 곳(`packages/shared`나 `apps/api/src/common/`)에 `Record<Role, string[]>` 형태로 정의하고 공통 유틸 함수(`omitFieldsForRole(row, role, entityKey)`) 하나로 재사용**하는 정도가 다음 단계로 적당하다(신규 인터셉터/데코레이터 프레임워크는 과설계 — 필드 목록이 몇 개 안 되는 지금 규모엔 함수 하나로 충분).

### 6.3 우리 4-role(HQ_ADMIN/WAREHOUSE_STAFF/PARTNER_COORDINATOR/INSTALLER) + BRANCH_MANAGER 구조와 비교

gauzy는 역할(role) 자체보다 **역할에 매핑된 개별 permission 200여 개**가 실질 단위다(역할은 permission의 묶음일 뿐). 우리는 `Role` enum 5종(`HQ_ADMIN/BRANCH_MANAGER/PARTNER_COORDINATOR/INSTALLER/WAREHOUSE_STAFF`)에 `@Roles()`로 직접 게이팅한다 — **세분화 수준이 훨씬 거칠다.** 지금 규모(회사 1개, 역할 5개, 필드마스킹 필요 지점 1~2곳)에서는 이게 적절한 선택이다(YAGNI) — gauzy의 200개 permission enum + role-permission 매핑 테이블은 다중 조직/커스터마이징 가능한 SaaS를 위한 설계이고, 국민트랜스처럼 역할이 고정된 단일회사 ERP엔 관리 오버헤드만 늘린다. **"역할이 6개, 7개로 늘어나거나 역할별로 세부 권한을 관리자가 커스터마이징해야 할 필요가 생기기 전까지는 지금 방식을 유지하는 게 맞다.**

---

## 7. 우리 도메인 매핑 표

| # | 개념 | 소스 저장소(라이선스) | 코드이식 가능? | 착지 스키마/모듈 | 난이도 |
|---|---|---|---|---|---|
| 1 | 설치기사 현재 위치(lastLat/lastLng/lastLocatedAt) | enatega rider 앱(MIT, 백엔드는 비공개이므로 클라이언트 캡처 로직만) | 아이디어(주기·배터리 프로파일 값)만 참고, NestJS/Ionic로 재작성 | `Installer`(신규 컬럼 3개), `apps/mobile` 위치 캡처 서비스 | S |
| 2 | 배터리 적응형 위치 전송 주기(ACTIVE 10m/30s, IDLE 50m/60s) | enatega rider 앱(MIT) | 코드 각색 가능(수치·조건 로직) — Capacitor Geolocation으로 재구현 | `apps/mobile/src/app/features` 신규 위치 서비스 | S |
| 3 | 위치 이벤트 실시간 브로드캐스트 | enatega(구조 아이디어), 우리 기존 Socket.IO 인프라 | 해당없음(기존 인프라 확장) | `notifications.gateway.ts`에 `INSTALLER_LOCATION_UPDATED` 이벤트 추가 | S |
| 4 | 위치 오프라인 큐잉(enatega엔 없음 — 우리가 더 잘 만들 지점) | 아이디어 없음(자체 설계, 기존 `OfflineSyncQueue` 재사용) | 해당없음(자체 인프라 확장) | `OfflineSyncQueue`(entityType='InstallerLocation') | S |
| 5 | 재고 조정(실사/파손/폐기) 트랜잭션 타입 확장 | openboxes(EPL-1.0, 아이디어만) | 스키마 필드명 그대로 옮기지 말 것 — 개념(코드 4종 분류)만 참고해 재설계 | `TransactionType` enum에 `ADJUSTMENT` 추가 + `AdjustmentReason` enum | S |
| 6 | InventoryLevel(min/reorder/max 3단 재고알림) | openboxes(EPL-1.0, 아이디어만), odoo(LGPL, 아이디어만) | 필드 구조 참고만, 재작성 | `Product`(또는 신규 `InventoryLevel`)에 `minQuantity/reorderQuantity/maxQuantity`, `apps/api/src/notifications` 배선 | S~M |
| 7 | TRANSFER(로케이션 간 이동) 트랜잭션 | openboxes(EPL-1.0, 아이디어만) | 로케이션 모델 없이는 의미 없음 — 로케이션 도입과 동시 진행 | 로케이션 모델 도입 후 `TransactionType.TRANSFER` | M(로케이션 선행 필요) |
| 8 | Shipment(트럭 1대분 합적) 개념 | openboxes(EPL-1.0, 아이디어만) | 실무에 합적 운송이 확인되기 전엔 도입 보류(YAGNI) | 확인되면 `TransportRun` 헤더 + `WarehouseTransaction.transportRunId?` | M |
| 9 | 멀티테넌시 base entity 상속(Tenant/Organization) | ever-gauzy(AGPL, 아이디어만) | 코드 절대 불가, 우리는 단일회사라 해당없음 | 해당없음 | — |
| 10 | 공유 타입 패키지를 빌드되는 workspace 패키지로 재구성 | ever-gauzy(AGPL, 구조 아이디어만) | 코드 불가, 구조만 참고 | `packages/shared`에 `@prisma/client` 재노출 진입점 추가 | S |
| 11 | 역할별 필드마스킹 공통 유틸 함수 | 자체 설계(gauzy에도 없음을 확인 — 참고 대상 없음) | 해당없음 | `apps/api/src/common/omit-fields-for-role.ts`(신규, 얇게) | S |
| 12 | 세분화된 permission enum(200+) | ever-gauzy(AGPL, 아이디어만) | 코드 불가, 그리고 채택 자체가 YAGNI(현재 규모엔 과설계) | 해당없음 | — |

---

## 8. 읽은 파일 URL 전부 인용

### ever-co/ever-gauzy (branch: develop)
- https://raw.githubusercontent.com/ever-co/ever-gauzy/develop/packages/core/src/lib/core/entities/base.entity.ts
- https://raw.githubusercontent.com/ever-co/ever-gauzy/develop/packages/core/src/lib/core/entities/tenant-base.entity.ts
- https://raw.githubusercontent.com/ever-co/ever-gauzy/develop/packages/core/src/lib/core/entities/tenant-organization-base.entity.ts
- https://raw.githubusercontent.com/ever-co/ever-gauzy/develop/packages/core/src/lib/shared/guards/permission.guard.ts
- https://raw.githubusercontent.com/ever-co/ever-gauzy/develop/packages/core/src/lib/shared/decorators/permissions.decorator.ts
- https://raw.githubusercontent.com/ever-co/ever-gauzy/develop/apps/gauzy/src/app/app.module.guard.ts
- https://raw.githubusercontent.com/ever-co/ever-gauzy/develop/tsconfig.base.json
- packages/contracts/src/lib/role-permission.model.ts, packages/core/src/lib/core/decorators/is-secret.ts, packages/core/src/lib/core/decorators/sensitive-relations.decorator.ts, packages/core/src/lib/core/interceptors/sensitive-relations.interceptor.ts, packages/core/src/lib/employee/employee.controller.ts(발췌), apps/gauzy/src/app/pages/projects/guards/project-manager.guard.ts, packages/core/src/lib/organization/organization.entity.ts, packages/core/src/lib/core/crud/tenant-aware-crud.service.ts, packages/contracts/package.json, packages/contracts/src/index.ts, packages/contracts/project.json, packages/core/package.json, apps/gauzy/package.json, apps/api/package.json, 루트 package.json (전부 `gh api repos/ever-co/ever-gauzy/contents/{path}` content-decode로 fetch)
- 디렉터리 리스팅(`gh api repos/ever-co/ever-gauzy/contents/{path}`): packages/core/src, packages/core/src/lib, packages/core/src/lib/organization, packages/core/src/lib/organization/dto, packages/core/src/lib/invoice, packages/core/src/lib/tenant, packages/core/src/lib/role, packages/core/src/lib/core, packages/core/src/lib/core/entities, packages/core/src/lib/core/decorators, packages/core/src/lib/core/crud, packages/core/src/lib/shared/guards, packages/contracts/src, packages/contracts/src/lib, apps, apps/gauzy/src/app, apps/gauzy/src/app/pages, apps/gauzy/src/app/pages/projects/guards

### enatega/food-delivery-multivendor (branch: main)
- https://raw.githubusercontent.com/enatega/food-delivery-multivendor/main/README.md
- https://raw.githubusercontent.com/enatega/food-delivery-multivendor/main/LICENSE
- https://raw.githubusercontent.com/enatega/food-delivery-multivendor/main/enatega-multivendor-rider/lib/apollo/mutations/rider.mutation.ts
- https://raw.githubusercontent.com/enatega/food-delivery-multivendor/main/enatega-multivendor-rider/lib/apollo/mutations/order.mutation.ts
- https://raw.githubusercontent.com/enatega/food-delivery-multivendor/main/enatega-multivendor-rider/lib/apollo/mutations/push-token.mutation.ts
- https://raw.githubusercontent.com/enatega/food-delivery-multivendor/main/enatega-multivendor-rider/lib/apollo/mutations/notification.mutation.ts
- https://raw.githubusercontent.com/enatega/food-delivery-multivendor/main/enatega-multivendor-rider/lib/apollo/subscriptions.ts
- https://raw.githubusercontent.com/enatega/food-delivery-multivendor/main/enatega-multivendor-rider/lib/context/global/location.context.tsx
- https://raw.githubusercontent.com/enatega/food-delivery-multivendor/main/enatega-multivendor-rider/lib/ui/useable-components/location-permission/index.tsx
- https://raw.githubusercontent.com/enatega/food-delivery-multivendor/main/enatega-multivendor-rider/lib/utils/methods/permission.ts
- https://raw.githubusercontent.com/enatega/food-delivery-multivendor/main/enatega-multivendor-rider/lib/hooks/useLogin.ts
- https://raw.githubusercontent.com/enatega/food-delivery-multivendor/main/enatega-multivendor-rider/lib/hooks/useOrder.ts
- https://raw.githubusercontent.com/enatega/food-delivery-multivendor/main/enatega-multivendor-rider/lib/utils/enums/global.enum.ts
- https://raw.githubusercontent.com/enatega/food-delivery-multivendor/main/enatega-multivendor-rider/lib/utils/interfaces/rider.interface.ts (+ location.interface.ts, order.interface.ts)
- https://raw.githubusercontent.com/enatega/food-delivery-multivendor/main/enatega-multivendor-rider/app/_layout.tsx, app/location/index.tsx
- https://raw.githubusercontent.com/enatega/food-delivery-multivendor/main/enatega-multivendor-rider/package.json
- `gh api repos/enatega/food-delivery-multivendor/...`(디렉터리 리스팅), `gh api orgs/enatega/repos`, `gh api repos/enatega/enatega-multivendor-api`(404 — 백엔드 저장소 부재 확인)

### openboxes/openboxes (branch: develop)
- https://raw.githubusercontent.com/openboxes/openboxes/develop/grails-app/domain/org/pih/warehouse/inventory/Transaction.groovy
- https://raw.githubusercontent.com/openboxes/openboxes/develop/grails-app/domain/org/pih/warehouse/inventory/TransactionEntry.groovy
- https://raw.githubusercontent.com/openboxes/openboxes/develop/grails-app/domain/org/pih/warehouse/inventory/TransactionType.groovy
- https://raw.githubusercontent.com/openboxes/openboxes/develop/grails-app/domain/org/pih/warehouse/inventory/TransactionSource.groovy
- https://raw.githubusercontent.com/openboxes/openboxes/develop/src/main/groovy/org/pih/warehouse/inventory/TransactionCode.groovy
- https://raw.githubusercontent.com/openboxes/openboxes/develop/src/main/groovy/org/pih/warehouse/core/Constants.groovy (grep 발췌)
- https://raw.githubusercontent.com/openboxes/openboxes/develop/grails-app/domain/org/pih/warehouse/inventory/InventoryLevel.groovy
- https://raw.githubusercontent.com/openboxes/openboxes/develop/grails-app/domain/org/pih/warehouse/order/Order.groovy
- https://raw.githubusercontent.com/openboxes/openboxes/develop/grails-app/domain/org/pih/warehouse/order/OrderType.groovy
- https://raw.githubusercontent.com/openboxes/openboxes/develop/grails-app/domain/org/pih/warehouse/order/OrderItem.groovy
- https://raw.githubusercontent.com/openboxes/openboxes/develop/src/main/groovy/org/pih/warehouse/order/OrderTypeCode.groovy
- https://raw.githubusercontent.com/openboxes/openboxes/develop/src/main/groovy/org/pih/warehouse/order/OrderStatus.groovy
- https://raw.githubusercontent.com/openboxes/openboxes/develop/src/main/groovy/org/pih/warehouse/order/OrderItemStatusCode.groovy
- https://raw.githubusercontent.com/openboxes/openboxes/develop/grails-app/domain/org/pih/warehouse/shipping/Shipment.groovy
- https://raw.githubusercontent.com/openboxes/openboxes/develop/grails-app/domain/org/pih/warehouse/shipping/ShipmentItem.groovy
- https://raw.githubusercontent.com/openboxes/openboxes/develop/grails-app/domain/org/pih/warehouse/shipping/ShipmentType.groovy
- https://raw.githubusercontent.com/openboxes/openboxes/develop/src/main/groovy/org/pih/warehouse/shipping/ShipmentStatusCode.groovy
- https://raw.githubusercontent.com/openboxes/openboxes/develop/grails-app/domain/org/pih/warehouse/shipping/Container.groovy (앞부분 ~60줄)
- https://raw.githubusercontent.com/openboxes/openboxes/develop/grails-app/domain/org/pih/warehouse/shipping/ContainerType.groovy
- https://raw.githubusercontent.com/openboxes/openboxes/develop/LICENSE.md

### 우리 저장소 내부(교차 검증용, 이번 조사에서 직접 재확인)
- `prisma/schema.prisma`(전체, Installer/Order/Notification/NotificationSubscription/WarehouseTransaction/TransactionType 등)
- `apps/api/src/orders/order-state-machine.ts`
- `apps/api/src/notifications/notifications.gateway.ts`, `apps/api/src/notifications/interfaces/ws-event.interface.ts`
- `apps/api/src/auth/guards/roles.guard.ts`
- `apps/api/src/master-data/products.service.ts`(단가 필드 마스킹 구현부), `master-data-read-roles.spec.ts`
- `packages/shared/src/models/orders.models.ts`(수동 미러링 사례)
- `docs/superpowers/specs/2026-07-25-masterdata-settlement-design.md`
- `docs/benchmarking/2026-07-26-oss-benchmark.md`

---

## 미해결/추가 확인 필요 사항

- enatega 배정 알고리즘(거리기반 자동매칭 여부)은 백엔드 비공개로 영구히 검증 불가 — 필요하면 유료 라이선스 문의 또는 다른 오픈소스(Odoo delivery, OCA/wms) 참고로 대체.
- openboxes TransactionType 시드 ID 1, 6의 실제 의미는 소스만으로 확인 불가(DB 시드 데이터/Liquibase 체인지로그 확인 필요, 이번 조사 범위 밖).
- "차량 지정 건의 운송료 합산/대체 여부"(스펙 §10)와 "합적 운송 실무 존재 여부"는 정산 담당자 확인이 선행돼야 §4의 Shipment/TransportRun 도입 여부가 결정됨 — 코드 조사로는 답이 안 나오는 질문.
