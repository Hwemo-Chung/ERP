# API Specification (v0.1)

Base URL: `https://<vpn-domain>/api`
Authentication: Bearer JWT (obtained via `/auth/login`), VPN connection required.
Content-Type: `application/json` unless noted.

### Required Client Headers
| Header | Description |
| --- | --- |
| `X-App-Version` | Semantic version from Capacitor app / PWA build to aid rollout control. |
| `X-Device-Id` | Stable UUID per device (Secure Storage); used for push targeting & audit. |
| `X-Platform` | `web`, `android`, or `ios` for server-side feature flags. |

## 1. Auth
| Method | Endpoint | Description |
| --- | --- | --- |
| POST | /auth/login | Authenticate with username/password; returns JWT + refresh token. |
| POST | /auth/refresh | Exchange refresh token for new JWT. |
| POST | /auth/logout | Revoke refresh token. |

### POST /auth/login
Request
```json
{
  "username": "branch01",
  "password": "••••"
}
```
Response
```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresIn": 3600,
  "user": {
    "id": "u_123",
    "role": "BRANCH_MANAGER",
    "branchCode": "B001"
  }
}
```

## 2. Orders & Assignment
| Method | Endpoint | Notes |
| --- | --- | --- |
| GET | /orders | Filters: `branchCode`, `status`, `installerId`, `appointmentDate`, `customerName`, pagination.
| POST | /orders/bulk-status | Batch update statuses (assignment, confirmation, etc.).
| PATCH | /orders/{orderId} | Update single order metadata (appointment date, installer, notes).
| POST | /orders/{orderId}/split | Create split orders from a multi-item request.
| POST | /orders/{orderId}/events | Append special notes (특이사항) with type tags.
| POST | /orders/import | (Future) Bulk load from CSV or integration.

### POST /orders/bulk-status
```json
{
  "orders": ["SO123", "SO456"],
  "action": "ASSIGN",
  "payload": {
    "installerId": "inst_09",
    "appointmentDate": "2025-12-12"
  }
}
```
Response: `202 Accepted` + job ID for async progress.

## 3. Completion & Waste
| Method | Endpoint | Notes |
| --- | --- | --- |
| POST | /orders/{orderId}/complete | Submit completion payload (serials, waste pickup, outcome).
| PATCH | /orders/{orderId}/completion | Amend completion (requires reason).
| POST | /orders/{orderId}/waste | Log waste pickup entries (P codes + quantity).
| GET | /waste/codes | Static list of allowed waste appliance codes.

### POST /orders/{orderId}/complete
```json
{
  "status": "IN_SU",
  "lines": [
    {
      "lineId": "ln1",
      "serialNumber": "ABC1234567",
      "quantity": 1
    }
  ],
  "waste": [
    {"code": "P01", "quantity": 1}
  ],
  "notes": "Installed and collected old unit"
}
```

## 4. Cancellation & Amendments
| Method | Endpoint | Notes |
| --- | --- | --- |
| POST | /orders/{orderId}/cancel | Cancel before 출고확정; requires reason code.
| POST | /orders/{orderId}/revert | Revert to 미처리 and optionally reschedule (<=+5 days).
| POST | /orders/{orderId}/reassign | Change center/installer (status must be 출문).

## 5. Reporting & Exports
| Method | Endpoint | Notes |
| --- | --- | --- |
| GET | /reports/summary | KPI cards filtered by `level=nation|branch|installer`.
| GET | /reports/progress | Equivalent to 진행현황 tables; query params for grouping.
| GET | /reports/raw | `type=uncompleted|completed|ecoas|waste|return|delivery`; returns CSV download URL.
| GET | /reports/install-confirmation | Generate PDF for 설치확인서 per order.
| GET | /reports/export/{exportId} | Download previously generated file (signed URL).
| GET | /reports/unreturned | List cancelled orders with pending item returns (미환입 현황).
| POST | /reports/unreturned/{orderId}/return | Mark cancelled order item as returned (환입 처리).

### GET /reports/unreturned
Query parameters:
- `branchCode` (optional): Filter by branch
- `dateFrom` (optional): Start date for cancellation filter (YYYY-MM-DD)
- `dateTo` (optional): End date for cancellation filter (YYYY-MM-DD)
- `returnStatus` (optional): `all` | `returned` | `unreturned`

Response
```json
{
  "items": [
    {
      "orderId": "uuid",
      "orderNo": "SO12345",
      "customerName": "홍길동",
      "productName": "세탁기",
      "cancelledAt": "2025-12-20T10:30:00Z",
      "cancelReason": "CUSTOMER_REQUEST",
      "isReturned": false,
      "returnedAt": null,
      "branchCode": "B001",
      "branchName": "서울센터"
    }
  ],
  "totalCount": 50,
  "unreturnedCount": 35,
  "returnedCount": 15,
  "byBranch": [
    { "branchCode": "B001", "branchName": "서울센터", "unreturnedCount": 20, "returnedCount": 10 }
  ]
}
```

### POST /reports/unreturned/{orderId}/return
Response
```json
{
  "success": true,
  "message": "Item marked as returned successfully"
}
```

### GET /reports/raw example
`/reports/raw?type=ecoas&branchCode=B001&start=2025-12-01&end=2025-12-10`
Response
```json
{
  "exportId": "exp_789",
  "status": "READY",
  "downloadUrl": "https://storage/v1/exp_789.csv?signature=...",
  "expiresAt": "2025-12-17T00:00:00Z"
}
```

## 6. Notifications
| Method | Endpoint | Notes |
| --- | --- | --- |
| POST | /notifications/subscribe | Register per-device token (Web Push or FCM/APNs) + category preferences.
| DELETE | /notifications/subscribe/{subscriptionId} | Revoke a device token (logout/uninstall).
| GET | /notifications | List unread alarms, filter by category/device.
| PATCH | /notifications/{id}/ack | Mark as read.

### POST /notifications/subscribe
Request (Web push example)
```json
{
  "deviceId": "A1B2C3D4",           // generated client-side & persisted in Secure Storage
  "platform": "web",                // web | android | ios
  "pushProvider": "vapid",          // vapid | fcm | apns
  "token": {
    "endpoint": "https://push.service/v3/...",
    "p256dh": "...",
    "auth": "..."
  },
  "categoriesEnabled": ["REASSIGN", "DELAY"]
}
```

Response
```json
{
  "subscriptionId": "sub_123",
  "expiresAt": "2026-01-10T00:00:00Z"
}
```

### DELETE /notifications/subscribe/{subscriptionId}
- Removes token + preferences; invoked on logout, uninstall, or when user disables push on a device.

## 7. Metadata
| Method | Endpoint | Notes |
| --- | --- | --- |
| GET | /metadata/branches | Branch list for dropdowns.
| GET | /metadata/installers | Filter by branch, active flag.
| GET | /metadata/statuses | Returns canonical state machine + labels per language.

## Error Handling
- Standard error payload:
```json
{
  "timestamp": "2025-12-10T02:12:30Z",
  "path": "/orders/bulk-status",
  "error": "VALIDATION_ERROR",
  "message": "Appointment date cannot exceed +15 days"
}
```

## Rate Limits
- Auth endpoints: 5 req/min per IP.
- Order modifications: 60 req/min per user.
- Exports: 5 concurrent per user.

## API Versioning
Versioning via URL path prefix: `/api/v1/...`
- Current: `v1`
- Deprecation policy: Announce 3 months before sunset; return `Deprecation` header.
- Breaking changes increment major version.

## Health & Readiness
| Method | Endpoint | Description |
| --- | --- | --- |
| GET | /health | Liveness probe; returns 200 if process alive. |
| GET | /ready | Readiness probe; checks DB + Redis connectivity. |

### GET /health
Response: `200 OK`
```json
{ "status": "ok", "timestamp": "2025-12-10T00:00:00Z" }
```

### GET /ready
Response: `200 OK` or `503 Service Unavailable`
```json
{
  "status": "ready",
  "checks": {
    "database": { "status": "up", "latencyMs": 12 },
    "redis": { "status": "up", "latencyMs": 2 },
    "storage": { "status": "up" }
  }
}
```

## Pagination
Use cursor-based pagination for large lists.

### Query Parameters
- `cursor` (string, optional): Opaque cursor from previous response.
- `limit` (integer, default 20, max 100): Items per page.

### Response Envelope
```json
{
  "data": [...],
  "pagination": {
    "nextCursor": "eyJpZCI6MTIzfQ==",
    "hasMore": true,
    "totalCount": 1542
  }
}
```

## Sorting & Filtering
### Sorting
- `sort` (string): Field name with optional direction, e.g., `appointmentDate:desc`.
- Multiple sorts: `sort=status:asc,appointmentDate:desc`.

### Filtering
- Simple equality: `?status=배정`
- Multiple values: `?status[in]=배정,배정확정`
- Range: `?appointmentDate[gte]=2025-12-01&appointmentDate[lte]=2025-12-31`
- Search: `?customerName[contains]=김`

## Idempotency
For mutating requests (POST, PATCH, DELETE), include `X-Idempotency-Key` header.
- Key: UUID or client-generated unique string.
- Server stores key + response in Redis for 24 hours.
- Duplicate request returns cached response.

### Example
```http
POST /api/v1/orders/bulk-status HTTP/1.1
X-Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{ "orders": ["SO123"], "action": "ASSIGN", ... }
```

## Job Status (Async Operations)
| Method | Endpoint | Description |
| --- | --- | --- |
| GET | /jobs/{jobId} | Check status of async bulk operation. |

### GET /jobs/{jobId}
Response
```json
{
  "jobId": "job_abc123",
  "status": "IN_PROGRESS",
  "progress": { "completed": 45, "total": 100 },
  "errors": [
    { "orderId": "SO789", "error": "INVALID_STATUS_TRANSITION" }
  ],
  "createdAt": "2025-12-10T01:00:00Z",
  "completedAt": null
}
```

## File Attachments
| Method | Endpoint | Description |
| --- | --- | --- |
| POST | /orders/{orderId}/attachments | Upload file (multipart/form-data). |
| GET | /orders/{orderId}/attachments | List attachments. |
| DELETE | /orders/{orderId}/attachments/{attachmentId} | Remove attachment. |

### POST /orders/{orderId}/attachments
- Max file size: 5MB.
- Allowed types: image/jpeg, image/png, application/pdf.
- Max 10 attachments per order.

Response
```json
{
  "attachmentId": "att_123",
  "fileName": "install_photo.jpg",
  "url": "https://storage/v1/att_123?signature=...",
  "uploadedAt": "2025-12-10T02:00:00Z"
}
```

## WebSocket API
Endpoint: `wss://<vpn-domain>/ws`

### Connection
- Auth: `Sec-WebSocket-Protocol: Bearer <jwt>`
- Heartbeat: Client sends `{"type":"ping"}` every 30s.

### Server Events
```typescript
// Order updated
{ "type": "ORDER_UPDATED", "payload": { "orderId": "SO123", "newStatus": "배정확정" } }

// Assignment changed
{ "type": "ASSIGNMENT_CHANGED", "payload": { "orderId": "SO123", "installerId": "inst_09" } }

// New notification
{ "type": "NOTIFICATION", "payload": { "id": "n_456", "category": "REASSIGN", "message": "..." } }

// Force refresh (e.g., settlement lock)
{ "type": "FORCE_REFRESH", "payload": { "reason": "SETTLEMENT_LOCKED" } }
```

## CORS Configuration
- Allowed Origins: VPN domain only (e.g., `https://erp.internal.company.com`).
- Allowed Methods: GET, POST, PATCH, DELETE, OPTIONS.
- Allowed Headers: Authorization, Content-Type, X-Idempotency-Key.
- Credentials: true.
- Max Age: 86400 (24h).
