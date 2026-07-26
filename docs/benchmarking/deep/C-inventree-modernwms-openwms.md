# 심층 벤치마킹 — InvenTree / ModernWMS / openwms(org.openwms) vs 국민트랜스 ERP

**작성일**: 2026-07-26 · **대상 저장소**: inventree/InvenTree(MIT), fjykTec/ModernWMS(Apache-2.0), openwms/org.openwms 계열(Apache-2.0)
**전제**: 세 라이선스 모두 코드 각색·이식을 허용(출처 표시 조건) — 아래 각 섹션에서 "코드 이식 후보"와 "아이디어만 참고"를 명시적으로 구분한다.
**Ground truth**: `docs/superpowers/specs/2026-07-25-masterdata-settlement-design.md`, `prisma/schema.prisma`, `apps/api/src/warehouse/transactions.service.ts`, `docs/benchmarking/2026-07-26-oss-benchmark.md`(1차 조사)

---

## 0. 저장소·라이선스 확인 (gh api 직접 조회)

| 저장소 | 라이선스(SPDX) | NOTICE 파일 | Attribution 요건 |
|---|---|---|---|
| `inventree/InvenTree` | **MIT** | 없음(`raw.githubusercontent.com/inventree/InvenTree/master/NOTICE` → 404) | 코드를 복사·각색해 배포 시 원저작권 고지 + MIT 라이선스 텍스트 유지. NOTICE 파일 의무 없음. |
| `fjykTec/ModernWMS` | **Apache-2.0** | 없음(404) | (a) 저작권/특허/상표 고지 보존 (b) License 사본 포함 (c) **수정한 파일에는 변경 사실을 명시** (d) 원본에 NOTICE 있으면 그대로 포함 — 원본에 NOTICE가 없으므로 (d)는 해당 없음, (a)(b)(c)는 유지 필요. |
| `openwms/org.openwms.common.service.lib` | **Apache-2.0** | 없음(404) | 상동. |
| `openwms/org.openwms.tms.transportation` | **Apache-2.0** | 없음(404) | 상동. |
| `openwms/org.openwms`(meta) | Apache-2.0 | — | 실제 도메인 모델 없음 — 아래 참고. |

`openwms/org.openwms`는 부모/서비스 레지스트리 저장소일 뿐 도메인 모델이 없다. 실제 `TransportUnit`/`Location`/`LocationGroup`은 `openwms/org.openwms.common.service.lib`에, `TransportOrder`는 `openwms/org.openwms.tms.transportation`에 있다(둘 다 Apache-2.0, `gh api repos/{...}/--jq .license.spdx_id`로 직접 확인).

---

## 1. 재고 단위 모델 — InvenTree StockItem이 "수량이 있는 개체"인 이유

### 1.1 StockItem 설계

`stock/models.py`의 `StockItem`(L426~)은 Part(추상 품목 정의)와 분리된 **"실물 로트/개체"**다:

```python
# stock/models.py L1053-1154
parent = models.ForeignKey('stock.StockItem', on_delete=models.SET_NULL, null=True, blank=True, related_name='children')
part = models.ForeignKey('part.Part', on_delete=models.CASCADE, related_name='stock_items', limit_choices_to={'virtual': False})
location = TreeForeignKey(StockLocation, on_delete=models.DO_NOTHING, related_name='stock_items', blank=True, null=True)
serial = models.CharField(max_length=100, blank=True, null=True)      # 개체 단위 추적
serial_int = models.IntegerField(default=0)                            # 정렬용 정수화된 serial
batch = models.CharField(max_length=100, blank=True, null=True, default=generate_batch_code)  # 로트 단위 추적
quantity = models.DecimalField(max_digits=15, decimal_places=5, validators=[MinValueValidator(0)], default=1)  # 수량 단위 추적
```

- **serial/batch/quantity가 서로 다른 축**이다: `serial`이 있으면 "개체 1개당 1행"(quantity는 항상 1), `serial`이 없으면 "동일 batch를 quantity만큼 보유한 뭉치"(파렛트·박스 단위에 대응). 이 셋을 한 모델에서 서로 배타적으로 사용하게 만든 것이 InvenTree의 핵심 설계.
- **parent/child로 split·merge 계보를 유지**한다.
  - `splitStock()`(L2721~): 원본 row는 그대로 두고 `pk=None`으로 새 StockItem을 만들어 quantity 일부를 이전, `new_stock.parent = self`로 계보 기록. `select_for_update` 없이 `lock_quantity()`로 행 잠금 후 처리.
  - `merge_stock_items()`(L2584~): 여러 StockItem을 하나로 흡수 — **pk 정렬 후 `select_for_update`로 잠가 동시성 데드락을 방지**하는 패턴이 인상적. quantity 합산, allocations 이전, 가중평균 단가 재계산 후 흡수된 항목은 delete.
  - `delete()`(L552~): 삭제 시 자식들을 자신의 parent로 재연결해 **계보 체인이 끊기지 않게** 한다.

### 1.2 StockItemTracking — 이력 원장

```python
# stock/models.py L3542-3617
class StockItemTracking(InvenTree.models.InvenTreeModel):
    tracking_type = models.IntegerField(default=StockHistoryCode.LEGACY)
    item = models.ForeignKey(StockItem, on_delete=models.SET_NULL, null=True, related_name='tracking_info')
    part = models.ForeignKey('part.part', on_delete=models.CASCADE, related_name='stock_tracking_info', null=True, blank=True)
    date = models.DateTimeField(auto_now_add=True, editable=False)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, blank=True, null=True)
    deltas = models.JSONField(null=True, blank=True)
```

`StockHistoryCode`(`stock/status_codes.py` L41-103)는 CREATED/EDITED/STOCK_COUNT/STOCK_MOVE/SPLIT_FROM_PARENT/MERGED_STOCK_ITEMS/BUILD_CONSUMED 등 **모든 상태·위치·수량 변화를 append-only로 기록**하는 이벤트 타입 enum이다. StockItem이 삭제돼도 `item`은 SET_NULL로 남아 이력은 보존된다(단 Part가 삭제되면 이력도 CASCADE 삭제).

### 1.3 우리 WarehouseTransaction과의 차이

`apps/api/src/warehouse/transactions.service.ts` + `prisma/schema.prisma`의 `WarehouseTransaction`은:
- **"개체"가 없다.** INBOUND/OUTBOUND 두 종류의 **평평한 수량 델타 이벤트**만 있고(partnerId/productId/quantity/transactionDate), "지금 몇 개가 어디 있는지"를 나타내는 별도 엔티티(StockItem에 해당)가 없다. 현재고는 매번 `SUM(inbound) - SUM(outbound)`로 즉석 계산된다(1차 벤치마크 문서가 지적한 `openingStock unbounded scan` 결함의 근본 원인).
- **batch/serial/parent-child 개념 자체가 없다.** 파렛트 수는 `floor(quantity / maxUnitsPerPallet)` 공식으로 **매번 재계산**될 뿐, 물리적 파렛트가 DB에 행으로 존재하지 않는다.
- **위치(location) 개념이 없다.** 창고가 하나뿐이라는 암묵적 가정.

### 1.4 파렛트 보관료 계산에 유리한 모델 형태 제안

spec §4.2의 공식(만재 파렛트 수 + 잔여 적재율 임계값)은 **"파렛트 개체"가 없어도 계산 가능**하다 — StockItem 같은 물리적 실체 모델이 당장 필요하지 않다는 뜻. 다만 현재 방식의 실질 문제는 **매 계산마다 전체 트랜잭션을 스캔**한다는 점(1차 벤치마크 Task 11 gap). InvenTree의 `PartStocktake`(§4에서 후술)처럼 **"스냅샷 테이블"**을 두는 것이 코드 이식보다 실용적이다:

- 제안: `StockBalance`(partnerId, productId, periodYearMonth, openingQty, closingQty) 1행/월 — WarehouseTransaction insert 시 트랜잭션 내에서 함께 갱신(또는 배치 job). StockItem처럼 batch/serial/parent-child 계보를 도입하는 것은 **현재 스펙 범위에서 과설계**(YAGNI) — 서비스 처리(damaged/quarantine) 단위 추적이나 위치별 재고가 실제로 필요해지는 시점(§9 WMS 후속 PRD)에만 StockItem급 모델을 도입할 것을 권장.
- 이식 성격: **아이디어만** (스냅샷 패턴은 자명한 설계라 코드 자체를 가져올 필요 없음, MIT 코드 이식 실익 없음).

---

## 2. 로케이션/구조 — 3개 저장소 비교와 우리 최소 도입안

### 2.1 InvenTree StockLocation — 임의 깊이 트리

```python
# stock/models.py L126-227
class StockLocation(..., InvenTree.models.PathStringMixin, InvenTree.models.InvenTreeTree):
    structural = models.BooleanField(default=False, help_text=_(
        'Stock items may not be directly located into a structural stock locations, but may be located to child locations.'))
    external = models.BooleanField(default=False)
    location_type = models.ForeignKey(StockLocationType, ..., null=True, blank=True)  # Warehouse/Room/Shelf/Drawer 타입 태그
```

- `InvenTreeTree` 기반 **임의 깊이 트리**(MPTT 유사, `TreeManager`), `PathStringMixin`이 "Warehouse/Room/Shelf" 형태의 `pathstring`을 유지.
- `structural=True`면 **그 위치엔 재고를 직접 놓을 수 없고 자식 위치에만 가능** — `clean()`에서 이미 재고가 있으면 structural 전환을 막는다(L291-303). "구역 vs 실제 보관 지점"을 한 필드로 구분하는 깔끔한 방법.
- `StockLocationType`은 이름/아이콘만 가진 태그 모델(창고/룸/선반/서랍 같은 **유형 분류**, 트리 깊이와 무관).

### 2.2 openwms — 좌표 기반 Location + LocationGroup + TransportUnit

`org.openwms.common.service.lib`의 `Location.java`(L58-140):
```java
@Table(name = Location.TABLE, uniqueConstraints = {
    @UniqueConstraint(name = "UC_LOC_ID", columnNames = {"C_AREA", "C_AISLE", "C_X", "C_Y", "C_Z"}), ... })
public class Location extends Target {
    @Embedded private LocationPK locationId;   // area/aisle/x/y/z 복합키
    private String plcCode; private String erpCode;
    private int noMaxTransportUnits = DEF_MAX_TU;  // 위치당 최대 TransportUnit 수
    private BigDecimal maximumWeight;
    private LocalDateTime lastMovement;
}
```
`LocationGroup.java`(L56-100)는 **물리적 트리와 독립적인 논리적 그룹**(같은 특성의 Location들을 묶음, infeed/outfeed `operationMode`, `groupStateIn`/`groupStateOut` 같은 자동화 제어 상태를 가짐). `TransportUnit.java`(L71-141)는 파렛트/박스/토트 같은 **물리적 운반 용기**로 `Barcode`(유일키), `actualLocation`/`targetLocation`, `parent`(용기 안의 용기 중첩) 필드를 가진다.

→ 이 모델은 **컨베이어/AS-RS 자동화 창고**를 겨냥한다(좌표 기반 위치, 이동 명령 상태기계). 국민트랜스처럼 사람이 직접 적재하는 창고에는 **좌표 복합키·LocationGroup 이원 구조가 과설계**다.

### 2.3 ModernWMS — 3단 평면 구조

`Entities/Models`(Apache-2.0):
- `WarehouseEntity.cs` — 창고(이름/도시/주소/담당자).
- `WarehouseareaEntity.cs` — 구역, **`parent_id` 자기참조**로 트리 가능하지만 실사용은 얕게(`area_property` byte로 구역 성격 구분 — 입고 대기/보관/피킹 등으로 추정).
- `GoodslocationEntity.cs` — 최종 빈(bin). `location_length/width/heigth/volume/load`(적재 용량), `roadway_number/shelf_number/layer_number/tag_number`(통로-선반-단-태그 좌표), 그리고 **warehouse_name/area_name을 그대로 복제 저장**(조회 성능을 위한 의도적 비정규화).

### 2.4 우리 최소 도입안

**창고(Warehouse) → 구역(Zone) → 랙-빈(Location)** 3단계가 실용적 — ModernWMS 구조를 참고하되 InvenTree의 `structural` 플래그 아이디어만 덧붙인다:

| 단계 | 근거 |
|---|---|
| 창고 | 국민트랜스는 다중 창고 가능성 있음(spec에 branch 개념 이미 존재) |
| 구역(Zone) | 보관료 계약(면적 임대)이 "구역" 단위로 걸릴 수 있어 최소 1단계 필요 |
| 랙-빈(Location) | 파렛트 물리적 위치 추적이 필요해지는 시점(§9 후속 WMS)에만 도입 — MVP에는 없어도 됨 |

openwms의 좌표 복합키·LocationGroup 이원화, InvenTree의 임의 깊이 MPTT 트리는 **모두 우리 규모(일 1만 건, 단일/소수 창고)에 과설계** — 3단 고정 깊이 FK 체인으로 충분하며 `pathstring`/MPTT 라이브러리 도입 불필요.

- 이식 성격: **코드 참고 가능**(ModernWMS Apache-2.0, InvenTree MIT) — 그러나 스택이 달라(.NET/Django) 실질은 **테이블 컬럼 설계 참고 후 Prisma로 재작성**. openwms는 아이디어만(자동화 개념이 우리 도메인과 안 맞음).

---

## 3. 바코드/QR 설계 — InvenTree 코드 이식 후보 (MIT)

### 3.1 InvenTree의 스캔 규약 — 플러그인 체인 + 타입코드 레지스트리

`plugin/base/barcodes/api.py`의 `BarcodeView`(L34-188)가 핵심 규약이다:

```python
# barcode_api.py L143-188 (BarcodeView.scan_barcode)
def scan_barcode(self, barcode: str, request, **kwargs):
    plugins = registry.with_mixin(PluginMixinEnum.BARCODE)
    plugin = None
    response = {}
    for current_plugin in plugins:
        try:
            result = current_plugin.scan(barcode, user=request.user, **kwargs)
        except PermissionDenied as exc:
            raise exc
        except Exception:
            log_error('BarcodeView.scan_barcode', plugin=current_plugin.slug)
            continue
        if result is None or len(result) == 0:
            continue
        if 'error' in result:
            if not response:
                plugin, response = current_plugin, result
        else:
            plugin, response = current_plugin, result
            break   # 첫 성공 매치에서 종료
    response['plugin'] = plugin.name if plugin else None
    response['barcode_data'] = barcode
    response['barcode_hash'] = hash_barcode(barcode)
    return response
```

`BarcodeScan(BarcodeView)`(L191-223)은 `POST /barcode/`에서 이 체인을 호출해 매치가 없으면 `E4xx`급 `ValidationError`, 있으면 `plugin`/`barcode_data`/`barcode_hash`/판별 결과를 반환한다. 모든 스캔(성공/실패 모두)은 `BarcodeScanResult`에 로깅되며(`log_scan()`, L40-104) 오래된 기록은 `BARCODE_RESULTS_MAX_NUM` 설정에 맞춰 자동 트리밍된다.

`plugin/base/barcodes/mixins.py`의 `BarcodeMixin`(L22-81)은 각 플러그인이 구현해야 하는 계약: `scan(barcode_data, user, **kwargs) -> dict | None`(매치 없으면 None), `generate(model_instance) -> str`(내부 QR 발급). `SupplierBarcodeMixin`(L83~)은 제조사/공급사 규격 바코드(Digikey 등 제3자 포맷)를 위한 확장 예시.

각 모델은 `barcode_model_type_code()` classmethod로 자신을 식별한다(`stock/models.py` L170-172 StockLocation→`'SL'`, L582-584 StockItem→`'SI'`). `plugin/base/barcodes/helper.py`의 `get_supported_barcode_model_codes_map()`(L60-66)이 이 코드→모델 클래스 매핑을 만들어, **내부 발급 QR은 `{type_code}:{pk}` 최소 정보만 인코딩하고 스캔 시 임의 엔티티로 역해석**된다.

### 3.2 ModernWMS — 필드 내장형 (단순 대안)

`SkuEntity.cs`(L47-49)는 별도 바코드 엔티티 없이 `bar_code` 컬럼을 SKU 테이블에 직접 둔다. README가 설명하는 "Barcode/QR Code Scanning + Inbound/Outbound Processing" 통합은 **스캔 즉시 입출고 폼의 SKU/수량 필드를 자동 채움**하는 워크플로우 수준 통합이며, InvenTree처럼 재사용 가능한 리졸버 모듈을 분리해두지 않았다 — Apache-2.0이지만 **뽑아올 재사용 모듈이 사실상 없다**(필드 배치 아이디어만 참고 가치).

### 3.3 우리 Ionic PWA + Capacitor 이식안

**이식 대상 (MIT, 출처 표시)**: `plugin/base/barcodes/api.py`의 `BarcodeView.scan_barcode` 루프 구조(L143-188)와 `helper.py`의 타입코드 레지스트리 패턴(L46-66), `stock/models.py`의 `barcode_model_type_code()` classmethod 관례.

구체 이식안:
1. Capacitor 바코드 스캔 플러그인(설치 여부 확인 후 기존 의존성 우선 — 신규 의존성 추가는 실제 구현 시 재확인)으로 원문 문자열만 얻는다.
2. NestJS에 `POST /warehouse/barcode/scan { barcode }` 신설 — InvenTree 패턴을 그대로 본떠 **리졸버 체인**을 둔다: (1) 내부 발급 QR 해시 매치(향후 `Product`/`Partner`에 QR 발급 기능 추가 시) → (2) `Product.code` 정확 매치 → (3) `Partner.code` 정확 매치. 첫 매치에서 종료, 결과에 `{ type, entity }` 반환.
3. `WarehouseTransaction` 직접 입력 화면(spec §5.5)에서 스캔 결과로 productId/partnerId 자동 채움 — 텍스트 검색 UX를 대체.
4. `BarcodeScanResult`처럼 스캔 성공/실패를 감사 로그로 남기는 것은 **아이디어만 채용**(스키마는 자체 설계, 코드 이식 불필요할 만큼 단순).

---

## 4. 재고 실사(Stocktake)

### 4.1 InvenTree — 값/수량 스냅샷 (재고 대사 아님)

`part/stocktake.py`의 `perform_stocktake()`(L18-236)는 **Part 단위로 전체 StockItem을 합산**해 `PartStocktake`(`part/models.py` L3325-3374) 행을 생성하는 **정기 스냅샷 잡**이다:

```python
# part/models.py L3325-3374
class PartStocktake(models.Model):
    part = models.ForeignKey(Part, on_delete=models.CASCADE, related_name='stocktakes')
    item_count = models.IntegerField(default=1)     # 시점의 StockItem 건수
    quantity = models.DecimalField(...)              # 총 재고 수량
    date = models.DateField(auto_now_add=True)
    cost_min = InvenTree.fields.InvenTreeModelMoneyField(null=True, blank=True)
    cost_max = InvenTree.fields.InvenTreeModelMoneyField(null=True, blank=True)
```

`STOCKTAKE_ENABLE` 전역 설정으로 켜고 끄며, 이미 오늘자 항목이 있으면 skip, part/category/location으로 범위를 좁힐 수 있고, `report_output`이 주어지면 CSV로 내보낸다. **"장부 대 실사 차이"를 기록하는 필드가 없다** — 이것은 재고 가치·수량의 시계열 스냅샷이지, 카운트 대사 워크플로우가 아니다. 실제 "실물 세니 다르더라"는 개별 `StockItem.quantity`를 수동 수정하고 `StockHistoryCode.STOCK_COUNT` 트래킹 엔트리(`stock/status_codes.py` L53)로 남기는 방식으로 처리된다.

### 4.2 ModernWMS — 진짜 대사(book vs counted) 워크플로우

```csharp
// StocktakingEntity.cs L26-81
public class StocktakingEntity : BaseModel {
    public string job_code { get; set; }
    public bool job_status { get; set; }          // 확정 여부
    public int sku_id { get; set; }
    public int goods_location_id { get; set; }
    public int book_qty { get; set; }              // 장부 수량
    public int counted_qty { get; set; }           // 실사 수량
    public int difference_qty { get; set; }        // 차이(장부-실사)
    public string handler { get; set; }
    public DateTime handle_time { get; set; }
}
```
SKU × 위치 단위로 book_qty/counted_qty/difference_qty를 나란히 저장하고 `handler`/`handle_time`으로 승인 이력을 남긴다 — 이게 일반적으로 말하는 "재고 실사"다.

### 4.3 우리 도입 최소 설계

spec §9가 재고 실사를 명시적으로 비범위 처리한 것은 타당하다 — **위치(location)/개체(StockItem)급 모델이 없는 지금은 "무엇을 셀지" 자체가 불분명**하기 때문. 1번 섹션에서 제안한 `StockBalance` 스냅샷이 도입된 이후(후속 PRD)라면:

- 제안 테이블: `(partnerId, productId, countedAt, bookQty, countedQty, differenceQty, handledBy, handledAt)` — **ModernWMS의 필드 구성을 그대로 본뜬 것**(Apache-2.0, 코드 자체는 자명해 복사할 것도 없지만 필드 셋 배치는 직접적 참고).
- InvenTree의 `PartStocktake`(가치 스냅샷)는 우리 `SettlementRecord`(계산 금액 스냅샷)와 목적이 겹쳐 **별도 도입 불필요** — 정산 스냅샷이 이미 이 역할을 한다.

---

## 5. ASN/DN(입출고 예정) — "예정 vs 실적" 분리에 주는 시사점

ModernWMS는 입고(ASN)와 출고(DN)에서 **같은 행 안에 "예정" 컬럼과 "실적" 컬럼을 나란히 둔다**:

```csharp
// AsnEntity.cs — 입고 예정
public int asn_qty { get; set; }        // 예정 수량
public int actual_qty { get; set; }     // 실제 하차 수량
public int sorted_qty { get; set; }     // 분류 완료 수량
public int shortage_qty { get; set; }   // 부족분
public int more_qty { get; set; }       // 초과분
public int damage_qty { get; set; }     // 파손분

// DispatchlistEntity.cs — 출고 예정
public int qty { get; set; }            // 예정 수량
public int picked_qty { get; set; }     // 피킹 완료 수량
public int actual_qty { get; set; }     // 실제 출고 수량
public int sign_qty { get; set; }       // 서명(인수) 확인 수량
```

`AsnmasterEntity`가 헤더(발주/입고 단위), `AsnEntity`가 라인(SKU별 예정·실적)인 마스터-디테일 구조다.

**시사점**: 우리 `WarehouseTransaction`은 **"실적"만 존재**한다 — 화주가 사전 통보한 "예정 수량"과 실제 입고 수량을 대조해 과부족/파손을 잡는 절차가 없다. spec §5.6/§5.9가 명시한 "분쟁 방지"·"메일 송부 업무 대체" 목표에 정확히 부합하는 확장 지점이지만 **현재 MVP 스펙에는 언급이 없다** — Phase 2 후보로 다음을 제안:

- `ExpectedTransaction`(또는 `WarehouseTransaction`에 `plannedQty` nullable 필드 + `varianceQty` computed) — 화주가 입고예정을 등록하면 실제 실적 입력 시 자동 대사.
- 이식 성격: **아이디어만**(Apache-2.0이라 코드 자체는 볼 수 있으나 .NET 엔티티 필드명 그대로 옮기는 것은 의미 없음 — 예정/실적 분리라는 설계 원칙만 채용).

---

## 6. 우리 도메인 매핑 표

| # | 개념 | 우리 스키마/모듈 | 코드이식 가능 여부(라이선스) | 난이도 |
|---|---|---|---|---|
| 1 | StockItem(수량+batch/serial+parent/child 계보) | 해당 없음(WarehouseTransaction은 순수 이벤트 로그) | 코드이식 가능(MIT) — 그러나 **현재 미도입 권장(YAGNI)**, §9 후속 WMS 시점에 재검토 | L |
| 2 | StockItemTracking(이력 원장) | `AuditLog`(범용) 로 부분 대체 가능 — 전용 테이블 아직 없음 | 아이디어만(패턴 자명) | S |
| 3 | 재고 스냅샷(기간 이월) | 신규 `StockBalance`(또는 유사) | 아이디어만(자체 설계, 1차 벤치마크 Task 11 이미 식별) | S |
| 4 | StockLocation(구조적 트리, `structural` 플래그) | 신규 `Warehouse`/`Zone`/`Location`(3단 고정) | 코드 참고 가능(MIT/Apache) — 스택 상이로 재작성 | M |
| 5 | LocationGroup/좌표기반 Location(openwms) | 해당 없음 — 도입 비권장 | 아이디어만(자동화 도메인 불일치) | L |
| 6 | 바코드 스캔 리졸버(플러그인 체인 + 타입코드) | 신규 `POST /warehouse/barcode/scan` | **코드 이식 가능(MIT)** — `barcode_api.py`/`helper.py` 구조 직접 참고 | M |
| 7 | 재고 실사(book/counted/difference) | 신규 `StockCount`(항목 3 선행 필요) | 코드 참고 가능(Apache-2.0, ModernWMS `StocktakingEntity`) | M(선행 항목 3 이후) |
| 8 | ASN(입고예정)/DN(출고예정) | 신규 `ExpectedTransaction` 또는 필드 확장 | 아이디어만(Apache-2.0, 필드명 재작성) | M |
| 9 | TransportUnit/TransportOrder(파렛트=물리 운반체+이동명령) | 해당 없음 — 도입 비권장(자동화 전제) | 아이디어만(Apache-2.0) | L |
| 10 | 요율/계약 유효기간 버저닝 | `TransportRateCard`/`StorageContract`에 `effective_from/to` | 해당 없음(자체 버그 수정, 1차 벤치마크 이미 최우선 권고) | S |

**참고**: 항목 10은 세 저장소 어디에도 직접 대응 코드가 없어(자체 결함 수정) 이 문서 범위 밖이지만, 1차 벤치마크(`2026-07-26-oss-benchmark.md`)의 최우선 권고와 일관되게 유지.

---

## 7. 읽은 파일 전체 목록 (URL)

**InvenTree** (`master` 브랜치, MIT):
- https://raw.githubusercontent.com/inventree/InvenTree/master/src/backend/InvenTree/stock/models.py (StockLocation L62-341, StockItem L426-700+, merge_stock_items L2584-2718, splitStock L2721-2803, StockItemTracking L3542-3617)
- https://raw.githubusercontent.com/inventree/InvenTree/master/src/backend/InvenTree/part/models.py (PartCategory L70-350+, PartStocktake L3325-3374)
- https://raw.githubusercontent.com/inventree/InvenTree/master/src/backend/InvenTree/stock/api.py (전체 클래스 목록 확인, grep으로 구조 파악)
- https://raw.githubusercontent.com/inventree/InvenTree/master/src/backend/InvenTree/stock/status_codes.py (StockStatus, StockHistoryCode 전체)
- https://raw.githubusercontent.com/inventree/InvenTree/master/src/backend/InvenTree/part/stocktake.py (perform_stocktake 전체, L1-237)
- https://raw.githubusercontent.com/inventree/InvenTree/master/src/backend/InvenTree/plugin/base/barcodes/mixins.py (BarcodeMixin L22-81, SupplierBarcodeMixin L83+)
- https://raw.githubusercontent.com/inventree/InvenTree/master/src/backend/InvenTree/plugin/base/barcodes/api.py (BarcodeView L34-188, BarcodeScan L191-223, url 목록 L873-899)
- https://raw.githubusercontent.com/inventree/InvenTree/master/src/backend/InvenTree/plugin/base/barcodes/helper.py (전체, L1-67)

**ModernWMS** (`master` 브랜치, Apache-2.0):
- https://raw.githubusercontent.com/fjykTec/ModernWMS/master/backend/ModernWMS.WMS/Entities/Models/Stock/StockEntity.cs
- https://raw.githubusercontent.com/fjykTec/ModernWMS/master/backend/ModernWMS.WMS/Entities/Models/Goodslocation/GoodslocationEntity.cs
- https://raw.githubusercontent.com/fjykTec/ModernWMS/master/backend/ModernWMS.WMS/Entities/Models/Warehousearea/WarehouseareaEntity.cs
- https://raw.githubusercontent.com/fjykTec/ModernWMS/master/backend/ModernWMS.WMS/Entities/Models/Warehouse/WarehouseEntity.cs
- https://raw.githubusercontent.com/fjykTec/ModernWMS/master/backend/ModernWMS.WMS/Entities/Models/Asn/AsnEntity.cs
- https://raw.githubusercontent.com/fjykTec/ModernWMS/master/backend/ModernWMS.WMS/Entities/Models/Dispatchlist/DispatchlistEntity.cs
- https://raw.githubusercontent.com/fjykTec/ModernWMS/master/backend/ModernWMS.WMS/Entities/Models/Stockmove/StockmoveEntity.cs
- https://raw.githubusercontent.com/fjykTec/ModernWMS/master/backend/ModernWMS.WMS/Entities/Models/Stocktaking/StocktakingEntity.cs
- https://raw.githubusercontent.com/fjykTec/ModernWMS/master/backend/ModernWMS.WMS/Entities/Models/Freightfee/FreightfeeEntity.cs
- https://raw.githubusercontent.com/fjykTec/ModernWMS/master/backend/ModernWMS.WMS/Entities/Models/Sku/SkuEntity.cs

**openwms** (Apache-2.0, 두 개의 별도 저장소):
- https://raw.githubusercontent.com/openwms/org.openwms.common.service.lib/master/src/main/java/org/openwms/common/transport/TransportUnit.java (L1-160)
- https://raw.githubusercontent.com/openwms/org.openwms.common.service.lib/master/src/main/java/org/openwms/common/location/Location.java (L1-140)
- https://raw.githubusercontent.com/openwms/org.openwms.common.service.lib/master/src/main/java/org/openwms/common/location/LocationGroup.java (L1-100)
- https://raw.githubusercontent.com/openwms/org.openwms.tms.transportation/master/src/main/java/org/openwms/tms/TransportOrder.java (L1-130)

**저장소 메타/라이선스 확인** (gh api):
- `gh api repos/inventree/InvenTree --jq .license.spdx_id` → MIT
- `gh api repos/fjykTec/ModernWMS --jq .license.spdx_id` → apache-2.0
- `gh api repos/openwms/org.openwms.common.service.lib --jq .license.spdx_id` → apache-2.0
- `gh api repos/openwms/org.openwms.tms.transportation --jq .license.spdx_id` → apache-2.0
- `gh api "search/code?q=class+TransportUnit+repo:openwms/org.openwms.common.service.lib"` 등으로 실제 도메인 모델 파일 경로 확인(openwms/org.openwms 자체엔 도메인 코드 없음, 별도 서비스 저장소로 분리됨)

**로컬 확인**: `docs/superpowers/specs/2026-07-25-masterdata-settlement-design.md`, `prisma/schema.prisma`, `apps/api/src/warehouse/transactions.service.ts`, `apps/api/src/warehouse/constants.ts`, `docs/benchmarking/2026-07-26-oss-benchmark.md`
