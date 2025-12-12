---
name: erp-api
description: This skill should be used when working with API calls, headers, error codes (E1xxx-E5xxx), pagination, or response structure in this ERP project.
---

## Required Headers

```
X-App-Version: 1.2.3
X-Device-Id: <UUID>
X-Platform: web|android|ios
Authorization: Bearer <JWT>
```

## Response Structure (CRITICAL)

```typescript
interface ApiResponse<T> {
  success: boolean;
  data: {
    data: T[];              // Double nesting!
    pagination: { nextCursor, hasMore, totalCount }
  }
}

// Access: response.data.data (NOT response.data)
const orders = response.data.data;  // Correct
```

## Pagination

```
GET /orders?cursor=eyJpZCI6MTIzfQ==&limit=20
```

## Error Codes

| Range | Category |
|-------|----------|
| E1xxx | Auth (E1001 비번, E1002 토큰만료) |
| E2xxx | Business (E2001 상태전환, E2002 정산잠김) |
| E3xxx | Validation (E3001 필수값) |
| E4xxx | External (E4001 Push, E4003 카메라) |
| E5xxx | System (E5003 Sync) |
