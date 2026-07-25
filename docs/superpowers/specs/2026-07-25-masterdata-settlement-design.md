# 마스터데이터 코드화 · 운송료/보관료 정산 MVP — 설계 문서 (PRD)

**작성일**: 2026-07-25 · **대상**: (주)국민트랜스 물류 업무 · **기반**: 기존 ERP 모노레포 확장

## 1. 배경과 목적

국민트랜스(보관물류·운송·설치물류)는 현재 업체/품목/단가/운송요율 등 마스터데이터를 엑셀로 관리하고, 출고명세서 등 정산 자료를 메일로 주고받는다. 이로 인해:

- 요율·단가의 단일 출처가 없어 운송료/보관료 계산 근거를 확인하기 어렵다.
- 거래처(화주)가 자사 물량·정산 내역을 확인하려면 담당자에게 메일로 요청해야 한다.
- 데이터 입력·전달 과정의 수작업 오류와 지연이 반복된다.

본 MVP의 목적: **엑셀 마스터데이터를 DB로 코드화하고, 운송료·보관료 계산 근거를 건별로 명확히 확인·정산할 수 있는 PWA 모듈**을 기존 ERP에 추가한다.

- 처리 규모: 일 1만 건 이내 실시간. 특수 최적화 불필요, 표준 인덱스로 충분.
- 1차 범위: 마스터데이터 + 정산 계산 + 엑셀 입출력 + 거래처 포털. WMS(재고/로케이션), TMS(배차), SCM은 후속 PRD로 분리.

## 2. 사용자와 권한

| 역할 | Role 값 | 권한 |
|---|---|---|
| 본사 관리자 | `HQ_ADMIN` (기존) | 마스터데이터 관리, 요율 관리, 정산 마감/생성, 대시보드 |
| 창고 현장 직원 | `WAREHOUSE_STAFF` (신규) | 입출고 실적 입력, 엑셀 실적 업로드. 단가·원가·요율 비노출 |
| 거래처(화주) | `PARTNER_COORDINATOR` (기존 재사용) | 자사 데이터만 조회: 물량 현황, 출고명세서, 정산서, 엑셀 다운로드 |

거래처 계정은 `User.partnerId`로 소속 거래처에 귀속되며, 모든 조회 쿼리에 partnerId 필터를 강제한다(서비스 레이어 공통 가드).

## 3. 데이터 모델

### 3.1 Partner (기존 모델 확장)

기존 `Partner`(code, name, contactName, phone, email)에 추가:

| 필드 | 타입 | 비고 |
|---|---|---|
| `businessRegistrationNo` | String? @unique | 사업자등록번호. 10자리 체크섬 검증 + 중복 체크 |
| `representativeName` | String? | 대표자 |
| `businessType` | String? | 업태 |
| `businessCategory` | String? | 종목 |
| `address` | String? | 주소 |
| `defaultTransportRate` | Decimal? | 건당 기본 운송요율 (품목별 요율이 없을 때 적용) |

- 코드 채번: 기존 엑셀 코드는 그대로 이관, 신규 등록만 자동채번(`P-` + 4자리 순번).
- 보관 계약은 별도 모델(`StorageContract`)로 분리 — 거래처 등록 시 최초 설정 필수(등록 플로우에서 강제).
- 입력날짜/수정 이력: `createdAt` 자동 기록 + 기존 `AuditLog` 재사용.

### 3.2 Category (신규)

- 2~3단계 트리: 대분류 > 중분류 > 소분류 (예: 가전 > 대형가전 > 냉장고).
- 계층 반영 코드: `A`, `A-01`, `A-01-003`.
- 필드: `code`, `name`, `parentId?`, `depth(1~3)`, `isActive`.
- 관리 화면에서 추가/이름변경/비활성화. 삭제 대신 비활성화(soft delete 컨벤션 유지).
- 초기 목록: 엑셀 마스터 이관 시 품목 데이터에서 고유 분류를 추출해 생성.
- depth 4 이상은 비범위(필요해질 때 확장).

### 3.3 Product (신규)

| 필드 | 타입 | 비고 |
|---|---|---|
| `code` | String @unique | 기존 엑셀 코드 유지, 신규는 자동채번(`I-` + 5자리) |
| `name` | String | 상품명 |
| `categoryId` | FK → Category | |
| `partnerId` | FK → Partner | 어느 업체 상품인지 |
| `unitPrice` | Decimal | 단가 |
| `costPrice` | Decimal | 원가 |
| `transportRate` | Decimal? | 품목별 건당 운송요율. 거래처 기본값 override |
| `palletThreshold` | Decimal? | 파렛트 환산 임계값 override (미설정 시 전역 기본값 사용) |
| `maxUnitsPerPallet` | Int? | 파렛트당 최대 적재 수량 (환산 계산의 분모) |
| `isActive` | Boolean | |

### 3.4 TransportRate (신규 — 차량 단가 테이블)

건당 기본 요율과 별도 축. 차량을 지정해 운송한 건에 적용.

| 필드 | 비고 |
|---|---|
| `vehicleType` | 트럭 유형 (카고, 윙바디, 탑차 등) |
| `tonnage` | 톤수 (1t ~ 25t) |
| `containerSize` | 컨테이너 규격 (해당 시) |
| `specialEquipment` | 특장 구분 (해당 시) |
| `rate` | 단가 |
| `isActive` | |

### 3.5 StorageContract (신규 — 거래처별 보관 계약)

| 필드 | 비고 |
|---|---|
| `partnerId` | FK → Partner. 활성 계약은 거래처당 1건 |
| `contractType` | enum: `PALLET_DAILY`(파렛트×일수 단가) / `AREA_MONTHLY`(면적 월임대) / `AREA_YEARLY`(면적 년임대) |
| `palletDailyRate` | 파렛트 1일당 단가 (`PALLET_DAILY`일 때 필수) |
| `areaPyeong` | 계약 면적(평) (`AREA_*`일 때 필수) |
| `areaRate` | 평당 단가 (`AREA_*`일 때 필수) |
| `startDate` / `endDate` | 계약 기간 |

거래처 등록 시 계약 유형 선택과 해당 필드 입력을 필수로 강제한다.

### 3.6 WarehouseTransaction (신규 — 입출고 실적)

운송료·보관료 계산과 출고명세서의 원천 데이터.

| 필드 | 비고 |
|---|---|
| `type` | enum: `INBOUND` / `OUTBOUND` |
| `partnerId`, `productId` | FK |
| `quantity` | 수량 |
| `transactionDate` | 실적 일시 |
| `vehicleRateId` | FK → TransportRate? (차량 지정 건) |
| `source` | enum: `PWA` / `EXCEL` (입력 경로) |
| `createdBy` | 입력자 |

인덱스: `(partnerId, transactionDate)`, `(productId, transactionDate)` — 일 1만 건 규모에서 월 정산 집계 충분.

### 3.7 SettlementRecord (신규 — 계산 결과 스냅샷)

건별 계산 결과를 저장한다. 요율이 나중에 바뀌어도 과거 정산은 불변. 재계산은 관리자의 명시적 액션으로만.

| 필드 | 비고 |
|---|---|
| `transactionId` | FK → WarehouseTransaction (운송료 건) 또는 null (보관료 기간 집계 건) |
| `partnerId`, `periodYearMonth` | 정산 귀속 |
| `feeType` | enum: `TRANSPORT` / `STORAGE` |
| `amount` | 계산 금액 |
| `calculationDetail` | Json — 적용 요율 값·출처(품목/거래처/차량), 파렛트 환산 내역, 계산식. breakdown 화면의 근거 |

### 3.8 SystemSetting (신규)

키-값 전역 설정. MVP에서는 `pallet_threshold_default`(기본 70%) 1건. 관리 화면에서 수정 가능.

## 4. 계산 엔진

### 4.1 운송료 (건당)

```
적용 요율 = Product.transportRate ?? Partner.defaultTransportRate
차량 지정 건 = TransportRate.rate 추가 적용
운송료 = 적용 요율 (건당 고정)
```

- 계산 시 `calculationDetail`에 요율 출처(품목 override인지 거래처 기본인지)와 값을 기록한다.
- 요율 미설정 건은 계산 불가로 표시하고 정산 마감을 차단한다(오류 목록 제공).

### 4.2 보관료 (계약 유형별 분기)

**PALLET_DAILY (파렛트×일수):**

```
품목별 파렛트 수 = 만재 파렛트 수 + 잔여분 판정
  만재 파렛트 수 = floor(보관 수량 / maxUnitsPerPallet)
  잔여 적재율 = (보관 수량 % maxUnitsPerPallet) / maxUnitsPerPallet
  잔여 적재율 ≥ 임계값(품목 override ?? 전역 70%) → +1 파렛트
  잔여 적재율 < 임계값 → +0 (서비스 처리)
보관료 = Σ (일별 파렛트 수 × palletDailyRate)
```

- 일별 보관 수량은 `WarehouseTransaction`의 입고 누적 − 출고 누적으로 산출.
- 서비스 처리(0 파렛트) 건도 `calculationDetail`에 기록해 breakdown에서 확인 가능.

**AREA_MONTHLY / AREA_YEARLY (면적 임대):**

```
보관료 = areaPyeong × areaRate (월/년 주기 고정, 물량 무관)
```

### 4.3 정산 마감 플로우

1. 관리자가 월 선택 → 마감 실행.
2. 해당 월 전체 건 계산 → `SettlementRecord` 생성 → 거래처별 정산서 집계.
3. 기존 `SettlementPeriod`(OPEN/LOCKED) 모델을 재사용해 마감 잠금. 잠긴 월의 실적은 수정 불가(E2002 규칙과 동일 패턴).
4. 재계산: 관리자 명시적 액션으로만, 마감 해제(HQ_ADMIN) 후 가능.

## 5. 화면 요구사항 (PWA)

### 5.1 거래처 등록/관리 — HQ_ADMIN

- 기본: 거래처명, 코드(기존 유지/신규 자동채번), 사업자등록번호(10자리 체크섬 검증 + 중복 체크), 대표자, 업태/종목, 주소, 담당자/연락처.
- 정산: 건당 기본 운송요율, 보관 계약(유형 선택 + 유형별 필수 필드) — **등록 완료 조건**.
- 이력: 입력날짜 자동 기록, 수정 이력(AuditLog).

### 5.2 품목 등록/관리 — HQ_ADMIN

- 기본: 품목코드, 상품명, 카테고리 선택(트리), 거래처 연결.
- 단가: 단가, 원가, 품목별 운송요율(선택).
- 물류: 파렛트당 최대 적재 수량, 임계값 override(선택, 미입력 시 전역값 표시).

### 5.3 카테고리 관리 — HQ_ADMIN

- 트리 뷰(대>중>소), 추가/이름변경/비활성화, 계층 코드 자동 부여.

### 5.4 운송 단가표 관리 — HQ_ADMIN

- 차량 유형/톤수/컨테이너/특장별 단가 CRUD. 표 형태 일괄 편집.

### 5.5 입출고 실적 — WAREHOUSE_STAFF

- 직접 입력: 거래처 → 품목 검색 → 수량/일시/입·출고 구분. 모바일 우선(기존 Ionic 패턴).
- 엑셀 업로드: 파일 업로드 → 컬럼 매핑 → 검증 리포트(오류 행 강조, 부분 반영 없음) → 미리보기 → 확정.
- 단가·원가·요율 비노출.

### 5.6 건별 계산 근거 (breakdown) — HQ_ADMIN, 거래처

- 건 클릭 → 적용 요율과 출처, 파렛트 환산 과정(수량/최대적재/적재율/임계값/결과), 계산식, 금액.
- 분쟁 방지 목적: 거래처에게 동일 화면 제공(자사 건만).

### 5.7 월 정산서 — HQ_ADMIN

- 월 마감 → 거래처별 정산서 생성(운송료 + 보관료 집계) → 엑셀 다운로드.

### 5.8 대시보드 — HQ_ADMIN

- 오늘/이번 달 누적 운송료·보관료, 거래처별 상위 물량, 미계산(요율 누락) 건 알림.

### 5.9 거래처 포털 — PARTNER_COORDINATOR

- 자사 물량 현황, 출고명세서 조회·엑셀 다운로드, 월 정산서 조회·다운로드, 건별 breakdown.
- **메일 송부 업무 대체가 목표.** 자사 데이터 격리 필수.

## 6. 엑셀 입출력

### 6.1 마스터 이관 (1회성 + 반복 가능)

- 업체/품목 엑셀 업로드 → 컬럼 매핑 UI → 검증(사업자번호 체크섬·중복, 코드 중복, 필수값) → 카테고리 자동 추출 미리보기 → 확정.
- 기존 코드는 유지, 코드 없는 행만 자동채번.
- 오류 행은 반영하지 않고 오류 리포트 다운로드 제공(전체 롤백 아님, 정상 행만 반영할지 여부는 업로드 시 선택).

### 6.2 실적 업로드 (일상 운영)

- 입출고 실적 엑셀 → 동일한 검증→미리보기→확정 플로우.

### 6.3 다운로드

- 출고명세서, 월 정산서, 실적 내역, 마스터 목록. 기존 `Export` 모델·비동기 export 패턴 재사용.

## 7. 아키텍처

- **백엔드**: `apps/api`에 NestJS 모듈 추가 — `master-data`(partner/product/category/rates), `warehouse`(transactions), `settlement`(계산 엔진·마감·정산서). Prisma 마이그레이션으로 3.x 모델 추가.
- **프론트**: `apps/web`에 화면 추가. 기존 inject()/Signals/Ionic 패턴, 오프라인 우선 인프라(OfflineSyncQueue)는 실적 직접 입력 화면에 한해 재사용.
- **공유**: `packages/shared`에 DTO·계산 타입 추가.
- **엑셀 파싱**: 서버 사이드(업로드 파일 → 검증 → 반영). 라이브러리는 구현 시 기존 의존성 우선 확인 후 결정.
- **API 규약**: 기존 컨벤션 유지 — 이중 중첩 `response.data.data`, 에러 코드 체계(E1xxx~E5xxx), 상태 전이 400, 정산 잠금 E2002 패턴.

## 8. 성공 기준

1. 엑셀 마스터(업체·품목) 이관 완료 — 기존 코드 보존, 검증 통과율 리포트 제공.
2. 입출고 실적 입력(직접 + 엑셀) 후 건별 운송료·보관료가 breakdown 화면에서 계산 근거와 함께 확인 가능.
3. 월 마감 → 거래처별 정산서 생성 → 엑셀 다운로드 동작.
4. 거래처 계정 로그인 시 자사 데이터만 조회 가능(타사 데이터 접근 시 403).
5. 일 1만 건 실적 기준 월 정산 마감이 실용적 시간 내 완료(수 분 이내).

## 9. 비범위 (YAGNI)

- WMS: 로케이션 관리, 재고 실사, 피킹/패킹.
- TMS: 배차 최적화, 실시간 차량 추적.
- SCM: 발주/수급 계획.
- 외부 시스템 API 연동, 기존 `Order` 모델 자동 연동(후속 PRD).
- 거리·중량·CBM 기반 운송요율(현재 건당 고정 + 차량별 단가로 충분).
- 카테고리 depth 4 이상.
- Angular 19 EOL, Capacitor 8 등 유지보수 업그레이드 — 기존 `PRD.md` 트랙에서 별도 진행.

## 10. 미해결 사항 (구현 전 확정 필요)

- 실제 엑셀 파일 컬럼 구조 — 이관 매핑 설계 시 샘플 파일 필수. 확보 전까지 매핑 UI는 범용(컬럼 선택식)으로 설계.
- 차량 지정 건의 운송료가 "건당 요율 + 차량 단가" 합산인지 "차량 단가로 대체"인지 — 정산 담당자 확인 필요.
- 보관료 면적 계약의 청구 시점(선불/후불, 월할/일할) — 계약서 기준 확인 필요.
