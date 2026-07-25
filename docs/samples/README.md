# 샘플 엑셀 데이터 (이관 리허설용)

`scripts/generate-sample-excel.mjs`로 생성한 마스터데이터 이관 리허설용 샘플 파일입니다.
매니저/HQ_ADMIN이 `master-data → 이관` 화면에서 실제 엑셀 업로드 전에 매핑 설정과
검증 흐름(정상/오류 행 분리, 부분 커밋)을 연습해볼 수 있도록 의도적으로 오류 행을 2건씩
포함했습니다.

재생성이 필요하면 (컬럼/체크섬 로직 변경 등):

```bash
node scripts/generate-sample-excel.mjs
```

## partners-sample.xlsx (거래처, 10행 — 8 정상 / 2 오류)

| 열 | 필드명 (매핑 키) | 설명 |
|---|---|---|
| A | code | 거래처코드 (KM001~KM010) |
| B | name | 업체명 |
| C | businessRegistrationNo | 사업자등록번호 (000-00-00000) |
| D | representativeName | 대표자 |
| E | businessType | 업태 |
| F | businessCategory | 종목 |
| G | address | 주소 |
| H | contactName | 담당자 |
| I | phone | 연락처 |
| J | defaultTransportRate | 기본 운송요율 |

**의도된 오류 행:**
- `KM003` — 사업자등록번호 체크섬 오류 (마지막 자리 고의로 틀림) → `사업자등록번호 체크섬 오류`
- `KM007` — 업체명 누락 (빈 셀) → `업체명 누락`

나머지 8건은 정상 데이터이며, 사업자등록번호는 `packages/shared/src/utils/business-registration.ts`의
체크섬 알고리즘(가중치 `[1,3,7,1,3,7,1,3,5]`)으로 실제 검증을 통과하도록 생성했습니다.

## products-sample.xlsx (품목, 20행 — 18 정상 / 2 오류)

| 열 | 필드명 (매핑 키) | 설명 |
|---|---|---|
| A | code | 품목코드 (I-00001~I-00020) |
| B | name | 상품명 |
| C | categoryName | 분류 (대형가전/소형가전/가구) |
| D | unitPrice | 단가 |
| E | costPrice | 원가 |
| F | transportRate | 운송요율 |
| G | palletThreshold | 파렛트 적재 임계(%) |
| H | maxUnitsPerPallet | 파렛트당 최대적재 수량 |

**의도된 오류 행:**
- `I-00005` — 상품명 누락 (빈 셀) → `상품명 누락`
- `I-00015` — 분류 누락 (빈 셀) → `categoryName 누락`

품목 엑셀에는 거래처 컬럼이 없습니다 — 이관 화면에서 배치 단위로 선택한 거래처
(defaultPartnerId)가 커밋되는 모든 품목에 일괄 적용됩니다 (partners-sample과 동일한
"배치 기본값" 정책, `ExcelImportService.commitProducts` 참고).

## transactions-sample.xlsx (실적, 30행 — 28 정상 / 2 오류)

| 열 | 필드명 (매핑 키) | 설명 |
|---|---|---|
| A | partnerCode | 거래처코드 |
| B | productCode | 품목코드 |
| C | type | 구분 (입고/출고) |
| D | quantity | 수량 |
| E | transactionDate | 일자 (YYYY-MM-DD) |

**의도된 오류 행:**
- 거래처코드 `KM999` — 등록되지 않은 코드 (예: partners-sample의 `KM007`처럼 이관에
  실패한 거래처를 실적에서 참조한 상황을 재현) → `거래처 코드 없음: KM999`
- 수량 `0` — 0 이하 수량 → `수량 오류: 0`

정상 행은 partners-sample의 정상 8개 거래처와 products-sample의 정상 18개 품목만
참조하며, 품목-거래처 소속 관계도 일치하도록 생성되어 있습니다 (품목이 실제로는
어느 거래처에도 속하지 않는 "품목이 해당 거래처 소속 아님" 오류는 이 샘플에는
포함하지 않았습니다).

## 이관 화면에서 사용하는 방법

1. `master-data → 이관` 화면에서 대상 종류(거래처/품목/실적)를 선택하고 위 파일을 업로드합니다.
2. 컬럼 매핑 단계에서 위 표의 "열 → 필드명" 그대로 지정합니다 (예: 거래처는 A=code, B=name, …).
3. 파싱 결과에서 정상/오류 행이 표에 나눠 표시됩니다 — 오류 행의 사유 문구가 위 목록과
   일치하는지 확인해보면 매핑이 올바른지 검증할 수 있습니다.
4. "정상 행만 반영" 버튼으로 커밋하면, 위에서 명시한 정상 건수(거래처 8 / 품목 18 / 실적 28)만큼
   생성되고 오류 행은 반영되지 않습니다 (부분 성공).
