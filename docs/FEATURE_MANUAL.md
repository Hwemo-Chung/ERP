# Logistics ERP Feature Manual
# 물류 ERP 기능 설명서

> Version: 1.0.0
> Last Updated: 2026-01-03
> Total Features: 24 FRs (100% Implemented)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [User Roles & Permissions](#2-user-roles--permissions)
3. [Order Management Features](#3-order-management-features)
4. [Assignment & Scheduling](#4-assignment--scheduling)
5. [Completion Processing](#5-completion-processing)
6. [Absence & Postpone Workflows](#6-absence--postpone-workflows)
7. [Reports & Dashboards](#7-reports--dashboards)
8. [Notification System](#8-notification-system)
9. [Settlement Management](#9-settlement-management)
10. [Offline Support](#10-offline-support)
11. [Mobile-Specific Features](#11-mobile-specific-features)
12. [API Reference Summary](#12-api-reference-summary)

---

## 1. System Overview

### 1.1 Purpose
Logistics ERP is an **Offline-First** order management system designed for logistics centers and field installers. It digitizes the entire workflow from order assignment to installation completion.

### 1.2 Supported Platforms

| Platform | Technology | Minimum Requirements |
|----------|------------|---------------------|
| Web (PWA) | Angular 19 + Ionic 8 | Chrome 90+, Safari 14+ |
| Android | Capacitor 6 | Android 8.0+ (API 26), 2GB RAM |
| iOS | Capacitor 6 | iOS 13+, iPhone 6s+ |

### 1.3 Core Design Principles

- **Offline-First**: Works without network, auto-syncs when online
- **State Machine**: Strict order status management ensures data integrity
- **Multi-Platform**: Single codebase for Web, Android, iOS
- **Real-time Updates**: WebSocket + Push notifications

---

## 2. User Roles & Permissions

### 2.1 Role Hierarchy

| Role | Korean | Access Level |
|------|--------|--------------|
| HQ_ADMIN | 본사 관리자 | Full system access, settlement unlock |
| BRANCH_MANAGER | 지사 매니저 | Branch-level management, settlement lock |
| PARTNER_OPS | 협력사 운영 | Partner operations, order updates |
| INSTALLER | 설치 기사 | Order execution, completion entry |

### 2.2 Permission Matrix

| Feature | HQ_ADMIN | BRANCH_MANAGER | PARTNER_OPS | INSTALLER |
|---------|:--------:|:--------------:|:-----------:|:---------:|
| View All Orders | ✅ | ✅ (Branch) | ✅ (Assigned) | ✅ (Assigned) |
| Assign Orders | ✅ | ✅ | ✅ | ❌ |
| Complete Orders | ✅ | ✅ | ✅ | ✅ |
| Lock Settlement | ✅ | ✅ | ❌ | ❌ |
| Unlock Settlement | ✅ | ❌ | ❌ | ❌ |
| View Reports | ✅ | ✅ | ✅ | ❌ |
| Export Data | ✅ | ✅ | ❌ | ❌ |

---

## 3. Order Management Features

### 3.1 Order Status Flow (State Machine)

```
UNASSIGNED → ASSIGNED → CONFIRMED → RELEASED → DISPATCHED
                                                    ↓
                    ┌──────────────────────────────┬────────────────┐
                    ↓                              ↓                ↓
                COMPLETED                     POSTPONED         ABSENT
                    ↓                              ↓                ↓
                COLLECTED                    DISPATCHED ←──────────┘
                                                    ↓
                                               CANCELLED
```

### 3.2 Status Definitions

| Status | Korean | Description |
|--------|--------|-------------|
| UNASSIGNED | 미배정 | New order, no installer assigned |
| ASSIGNED | 배정 | Installer provisionally assigned |
| CONFIRMED | 배정확정 | Assignment confirmed by manager |
| RELEASED | 출고확정 | Goods released from warehouse |
| DISPATCHED | 출문 | Installer departed for delivery |
| COMPLETED | 인수완료 | Delivery/installation successful |
| PARTIAL | 부분인수 | Partial delivery completed |
| POSTPONED | 연기 | Customer requested postponement |
| ABSENT | 부재 | Customer not available |
| COLLECTED | 회수완료 | Waste collection completed |
| CANCELLED | 취소 | Order cancelled |

### 3.3 Order Filtering (FR-01)

**Endpoint**: `GET /orders`

**Filter Parameters**:
- `search`: ERP order number or customer name
- `status[]`: Multiple status filter
- `branchCode`: Branch code filter
- `installerId`: Installer filter
- `dateFrom`, `dateTo`: Appointment date range
- `page`, `limit`: Pagination

**Response Time**: < 2 seconds for 10,000 records

### 3.4 Order Detail View

Displays:
- Order information (ERP number, dates, status)
- Customer information (name, address, phone)
- Product lines (product code, quantity, serial number)
- Status history with timestamps
- Attached files and photos

---

## 4. Assignment & Scheduling

### 4.1 Batch Assignment (FR-02, FR-03)

**Endpoint**: `POST /orders/bulk-assign`

**Features**:
- Assign multiple orders to a single installer
- Provisional (임시) assignment support
- Validation: max +15 days appointment change
- Partial failure handling with detailed error list

**Request Body**:
```json
{
  "orderIds": ["uuid1", "uuid2"],
  "installerId": "installer-uuid",
  "appointmentDate": "2026-01-15"
}
```

### 4.2 Appointment Date Change

**Validation Rules**:
- Maximum +15 days from current date
- Cannot change after RELEASED status
- Settlement-locked orders cannot be modified

### 4.3 Split Order Workflow (FR-10)

**Endpoint**: `POST /orders/{id}/split`

**Use Case**: Split multi-item orders into separate installer assignments

**Features**:
- Quantity control per line item
- Child orders inherit parent metadata
- Audit log captures actor and timestamp
- Original order maintains reference to splits

---

## 5. Completion Processing

### 5.1 Serial Number Capture (FR-04)

**Endpoint**: `POST /orders/{id}/complete`

**Features**:
- Required for status = COMPLETED
- Camera/barcode scanner integration
- Offline capture with later sync
- Validation: alphanumeric 10-20 characters

**Request Body**:
```json
{
  "serialNumbers": [
    { "lineId": "line-uuid", "serialNumber": "SN1234567890" }
  ],
  "memo": "Installation notes"
}
```

### 5.2 Waste Pickup Logging (FR-05)

**Endpoint**: `POST /orders/{id}/complete`

**Waste Product Codes** (P01-P21):
| Code | Category | Description |
|------|----------|-------------|
| P01 | 냉장고 | Refrigerator (large) |
| P02 | 냉장고 | Refrigerator (small) |
| P03 | 세탁기 | Washing machine (top) |
| P04 | 세탁기 | Washing machine (drum) |
| P05 | TV | Television |
| P06 | 에어컨 | Air conditioner (stand) |
| P07 | 에어컨 | Air conditioner (wall) |
| ... | ... | ... |

**Request Body**:
```json
{
  "wastePickup": [
    { "code": "P01", "quantity": 1 },
    { "code": "P03", "quantity": 1 }
  ]
}
```

### 5.3 Confirmation Certificate (FR-15)

**Endpoint**: `POST /orders/{id}/certificate`

**Features**:
- Digital signature capture (SignaturePad)
- PDF generation with customer details
- Filter by issued/not-issued status
- Download endpoint: `GET /reports/export/{orderId}/download`

---

## 6. Absence & Postpone Workflows

### 6.1 Absence Workflow (FR-14)

**Endpoint**: `POST /orders/{id}/transition`

**Reason Codes**:
- `NO_RESPONSE`: Customer did not respond
- `WRONG_ADDRESS`: Incorrect delivery address
- `CUSTOMER_REFUSED`: Customer refused delivery
- `OTHER`: Other reasons (requires notes)

**Features**:
- Auto-schedule retry visit
- Maximum 3 retries before escalation
- Absence count tracking per order
- Notes field for additional information

**Request Body**:
```json
{
  "status": "ABSENT",
  "version": 5,
  "reasonCode": "NO_RESPONSE",
  "notes": "Called 3 times, no answer"
}
```

### 6.2 Postpone Workflow (FR-13)

**Endpoint**: `POST /orders/{id}/transition`

**Features**:
- Capture reason code + new appointment date
- Maximum +15 days from original date
- Automatic notification to customer & installer

**Request Body**:
```json
{
  "status": "POSTPONED",
  "version": 5,
  "reasonCode": "CUSTOMER_REQUEST",
  "appointmentDate": "2026-01-20"
}
```

---

## 7. Reports & Dashboards

### 7.1 KPI Dashboard (FR-08)

**Endpoint**: `GET /reports/summary`

**Metrics**:
- 고객만족도 (Customer Satisfaction Rate)
- 약속방문준수율 (Appointment Compliance Rate)
- 폐가전 회수율 (Waste Collection Rate)
- 설치불량율 (Installation Defect Rate)

**Filters**:
- Date range
- Branch code
- Territory

### 7.2 Center Progress Dashboard (FR-11)

**Endpoint**: `GET /reports/summary?level=branch`

**Features**:
- Installer-wise progress counts per status
- Drill-down to order list
- Real-time updates via WebSocket

### 7.3 Customer History Search (FR-07)

**Endpoint**: `GET /orders?customer=...`

**Search By**:
- Vendor name
- Branch code
- Customer name
- Phone number

**Range**: Last 12 months minimum

### 7.4 ECOAS Export (FR-06)

**Endpoint**: `GET /reports/raw?type=ecoas`

**Features**:
- CSV matches legacy ECOAS schema
- Timestamp watermark
- VPN access required
- Date range filter

### 7.5 Unreturned Items Report (FR-24)

**Endpoint**: `GET /reports/unreturned`

**Features**:
- Cancelled orders pending item returns
- Filter by return status (all/returned/unreturned)
- Branch-level aggregation
- Mark as returned: `POST /reports/unreturned/{orderId}/return`

### 7.6 FDC Release Summary (FR-16)

**Endpoint**: `GET /reports/raw?type=release`

**Features**:
- Aggregate by FDC, model, quantity
- Printable PDF format
- 출고요청집계표 format

---

## 8. Notification System

### 8.1 Push Notification Categories (FR-09)

| Category | Description | Urgency |
|----------|-------------|---------|
| `order_assigned` | New order assigned | Normal |
| `order_status_changed` | Order status updated | Normal |
| `settlement_locked` | Settlement period locked | **Urgent** |
| `settlement_ready` | Settlement ready for review | Normal |
| `message_received` | New message received | Normal |
| `system_alert` | System alerts | **Urgent** |

### 8.2 Device Notification Preferences (FR-23)

**Endpoint**: `POST /notifications/subscribe`

**Features**:
- Per-device category toggles
- Quiet hours configuration
- Platform detection (Web/Android/iOS)

**Request Body**:
```json
{
  "deviceId": "device-uuid",
  "platform": "ANDROID",
  "pushProvider": "FCM",
  "token": { "fcmToken": "..." },
  "categoriesEnabled": ["order_assigned", "settlement_ready"]
}
```

### 8.3 Quiet Hours

**Configuration**:
```json
{
  "enabled": true,
  "start": "22:00",
  "end": "07:00",
  "timezone": "Asia/Seoul"
}
```

**Note**: Urgent notifications bypass quiet hours.

### 8.4 WebSocket Real-time Updates

**Events**:
- `order:updated` - Order status change
- `order:assigned` - New assignment
- `notification:new` - New notification
- `sync:conflict` - Offline sync conflict

---

## 9. Settlement Management

### 9.1 Settlement Period (FR-12)

**Endpoints**:
- `GET /settlement/current` - Current period
- `GET /settlement/history` - Period history
- `POST /settlement/{id}/lock` - Lock period
- `POST /settlement/{id}/unlock` - Unlock period (HQ_ADMIN only)

### 9.2 Auto-Lock Schedule

- **Period**: Weekly (Monday 00:00 - Sunday 23:59)
- **Auto-lock**: Sunday 23:59 (cron job)
- **Manual unlock**: HQ_ADMIN only

### 9.3 Settlement Lock Effects

When a period is locked:
- Orders within the period cannot be modified
- Status changes are blocked
- API returns error code `E2002`

**Error Response**:
```json
{
  "error": {
    "code": "E2002",
    "message": "Settlement period is locked",
    "details": {
      "periodId": "uuid",
      "lockedAt": "2026-01-01T00:00:00Z"
    }
  }
}
```

---

## 10. Offline Support

### 10.1 Data Synchronization

**Initial Load**:
- Login triggers download of ±3 days data
- Stored in IndexedDB via Dexie.js

**Delta Sync**:
- Only fetch changes since last sync
- Uses `updatedAt` timestamp comparison

### 10.2 Background Sync Queue

**Queue Priority**:
1. Status updates (critical)
2. Serial number entries
3. Photo uploads
4. Notes and memos

**Retry Logic**:
- Max 3 retries per operation
- Exponential backoff
- Manual retry option for failed items

### 10.3 Conflict Resolution (FR-17)

**Optimistic Locking**:
- Every order has `version` field
- Update requires matching version
- Mismatch triggers conflict dialog

**Conflict Dialog Options**:
- Accept server version
- Keep local version
- Merge manually

---

## 11. Mobile-Specific Features

### 11.1 Hardware Back Button (FR-21)

- Respects Ionic router stack
- Prompts before discarding unsaved forms
- No accidental logout

### 11.2 Biometric Login (FR-22)

**Endpoint**: Uses local device authentication

**Features**:
- Face ID / Fingerprint support
- Optional opt-in after initial login
- Fallback to password if biometric fails
- Requires valid refresh token

### 11.3 Camera Integration

**Services**:
- Barcode/QR scanner for serial numbers
- Photo capture for delivery proof
- Image compression (WebP, max 1024px)

### 11.4 Session Timeout (FR-19)

- 30-minute idle timeout
- Prompt for re-login without losing form data
- JWT refresh 5 minutes before expiry

### 11.5 File Attachments (FR-20)

**Endpoint**: `POST /orders/{id}/attachments`

**Limits**:
- Max 5MB per file
- Max 10 files per order
- Supported formats: JPG, PNG, PDF

---

## 12. API Reference Summary

### 12.1 Base URLs

| Environment | URL |
|-------------|-----|
| Development | `http://localhost:3000/api` |
| Production | `https://api.erp.example.com/api` |

### 12.2 Authentication

**Headers**:
```
Authorization: Bearer <jwt-token>
X-Device-Id: <device-uuid>
X-Timezone: Asia/Seoul
```

### 12.3 Response Format

**Success**:
```json
{
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

**Error**:
```json
{
  "error": {
    "code": "E1001",
    "message": "Error description",
    "details": { ... }
  }
}
```

### 12.4 Error Codes

| Range | Category | Example |
|-------|----------|---------|
| E1xxx | Authentication | E1001: Invalid token |
| E2xxx | Business Logic | E2002: Settlement locked |
| E3xxx | Validation | E3001: Invalid input |
| E4xxx | Not Found | E4001: Order not found |
| E5xxx | Server Error | E5001: Database error |

### 12.5 Rate Limits

| Endpoint Type | Limit |
|---------------|-------|
| Read (GET) | 100 req/min |
| Write (POST/PATCH) | 50 req/min |
| Bulk Operations | 10 req/min |

---

## Appendix A: Keyboard Shortcuts (Web)

| Shortcut | Action |
|----------|--------|
| `Ctrl + S` | Save current form |
| `Ctrl + F` | Focus search field |
| `Esc` | Close modal/dialog |
| `Enter` | Confirm action |

## Appendix B: Offline Indicators

| Icon | Status |
|------|--------|
| 🟢 | Online, synced |
| 🟡 | Online, pending sync |
| 🔴 | Offline |
| 🔄 | Syncing |

---

*Document End*
