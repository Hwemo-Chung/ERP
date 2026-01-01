# Changelog - 2026-01-04

## Bug Fixes and Improvements

### 1. Installer Name Display Issue (Critical)

**Problem**: Assignment-detail and order-detail pages showed "Not Assigned" (미배정) even when an installer was assigned.

**Root Cause**: API returns nested `installer: { id, name, phone }` object via Prisma relation, but frontend expected flat `installerName` field.

**Solution**: Updated Order interfaces and templates to support both formats with fallback chain.

**Files Modified**:
- `apps/mobile/src/app/store/orders/orders.models.ts` - Added `installer` object type
- `apps/web/src/app/store/orders/orders.models.ts` - Added `installer` object type
- `apps/mobile/src/app/features/orders/services/orders.service.ts` - Added `installer` to Order interface
- `apps/web/src/app/features/orders/services/orders.service.ts` - Added `installer` to Order interface
- `apps/mobile/src/app/features/assignment/pages/assignment-detail/assignment-detail.page.ts` - Template fallback
- `apps/web/src/app/features/assignment/pages/assignment-detail/assignment-detail.page.ts` - Template fallback
- `apps/mobile/src/app/features/orders/pages/order-detail/order-detail.page.ts` - Template fallback
- `apps/web/src/app/features/orders/pages/order-detail/order-detail.page.ts` - Template fallback

**Template Pattern Used**:
```html
{{ order()!.installer?.name || order()!.installerName || ('FALLBACK_KEY' | translate) }}
```

---

### 2. Order Status Translation Issue

**Problem**: Status badges displayed raw translation keys like `ORDER_STATUS.CONFIRMED` instead of translated text.

**Root Cause**: Two competing i18n key structures existed:
- Root level: `ORDER_STATUS.CONFIRMED` (existing)
- Nested level: `ORDERS.STATUS.CONFIRMED` (used by some pages)

**Solution**: Added `ORDERS.STATUS` object to all i18n files for compatibility.

**Files Modified**:
- `apps/mobile/src/assets/i18n/ko.json` - Added `ORDERS.STATUS` keys
- `apps/mobile/src/assets/i18n/en.json` - Added `ORDERS.STATUS` keys
- `apps/web/src/assets/i18n/ko.json` - Added `ORDERS.STATUS` keys
- `apps/web/src/assets/i18n/en.json` - Added `ORDERS.STATUS` keys

**Status Values Added**:
```json
"ORDERS": {
  "STATUS": {
    "UNASSIGNED": "미배정",
    "ASSIGNED": "배정",
    "CONFIRMED": "배정확정",
    "RELEASED": "출고확정",
    "DISPATCHED": "출문",
    "POSTPONED": "연기",
    "ABSENT": "부재",
    "COMPLETED": "인수",
    "PARTIAL": "부분인수",
    "COLLECTED": "회수",
    "CANCELLED": "취소",
    "REQUEST_CANCEL": "의뢰취소",
    "REVERTED": "복원"
  }
}
```

---

### 3. Address Display Issue (Previous Session)

**Problem**: Address field displayed `[object Object]` instead of formatted string.

**Root Cause**: API returns address as JSON object `{ line1, line2, city, postal }`, template used direct interpolation.

**Solution**: Added `getFormattedAddress()` helper method to handle both string and object formats.

---

### 4. Product Lines Display Issue (Previous Session)

**Problem**: Product list showed only quantities (× 1, × 2) without product names.

**Root Cause**: API returns `lines` array with `itemCode`/`itemName`, but frontend expected `orderLines` with `productName`.

**Solution**: Added fallback logic:
- Array: `o?.lines || o?.orderLines || []`
- Name: `line.itemName || line.productName`

---

## Technical Notes

### API Response Structure (Prisma)

```typescript
// API returns (from orders.service.ts)
{
  installer: { id: string, name: string, phone: string },  // nested object
  lines: [{ itemCode: string, itemName: string, quantity: number }],
  address: { line1: string, line2: string, city: string, postal: string }
}

// Frontend expected (legacy)
{
  installerName: string,  // flat field
  orderLines: [{ productCode: string, productName: string, quantity: number }],
  address: string
}
```

### Backward Compatibility Pattern

To maintain backward compatibility with cached data while supporting new API responses:

```typescript
// Interface supports both
interface Order {
  installerName?: string;  // legacy flat field
  installer?: { id: string; name: string; phone?: string };  // new nested object

  orderLines?: OrderLine[];  // legacy
  lines?: OrderLine[];  // new from API
}

// Template uses fallback chain
{{ order.installer?.name || order.installerName || 'Not Assigned' }}
```

---

## Build Verification

- Web build: ✅ Successful
- Mobile build: ✅ Successful
- No TypeScript errors
- Only warnings: Sass deprecation, bundle size budgets
