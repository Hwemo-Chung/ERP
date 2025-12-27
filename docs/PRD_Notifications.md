# Product Requirements Document: Notification System

**Version**: 1.0.0
**Status**: Draft
**Last Updated**: 2025-12-27
**Author**: System Architecture Team
**Stakeholders**: HQ Operations, Branch Managers, Partner Ops, Mobile Dev Team

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Context & Problem Statement](#2-business-context--problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [Scope & Boundaries](#4-scope--boundaries)
5. [System Architecture](#5-system-architecture)
6. [Functional Requirements](#6-functional-requirements)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [API Specification](#8-api-specification)
9. [Data Model](#9-data-model)
10. [Security & Privacy](#10-security--privacy)
11. [Error Handling & Resilience](#11-error-handling--resilience)
12. [Testing Strategy](#12-testing-strategy)
13. [Rollout Plan](#13-rollout-plan)
14. [Monitoring & Observability](#14-monitoring--observability)
15. [Dependencies & Risks](#15-dependencies--risks)
16. [Future Considerations](#16-future-considerations)

---

## 1. Executive Summary

### 1.1 Purpose

This document defines the comprehensive requirements for the Logistics ERP Notification System, which delivers real-time alerts and updates to branch schedulers, partner operations leads, installers, and HQ quality managers across web (PWA), Android, and iOS platforms.

### 1.2 Vision

Create a **unified, reliable, and intelligent notification infrastructure** that ensures critical business events reach the right users within seconds, regardless of device, network conditions, or application state, while respecting user preferences and regulatory requirements.

### 1.3 Key Outcomes

| Outcome | Target | Measurement |
|---------|--------|-------------|
| Real-time delivery | <3 seconds | P95 latency |
| Delivery success rate | >99.5% | Push delivery confirmation |
| User engagement | >40% | Notification open rate |
| System reliability | 99.9% | Uptime SLA |

---

## 2. Business Context & Problem Statement

### 2.1 Current State Analysis

The existing logistics workflow suffers from critical communication gaps:

| Pain Point | Business Impact | Frequency |
|------------|-----------------|-----------|
| Delayed assignment notifications | Installers miss job pickups, causing SLA breaches | 15-20 times/day |
| No real-time status updates | Branch managers make decisions on stale data | Continuous |
| Manual phone calls for urgent changes | Coordinator time wasted, errors in communication | 30+ calls/day |
| Missed cancellation alerts | Wasted trips, customer complaints | 5-10/day |
| Settlement deadline notifications | Missed cutoffs, payment delays | Weekly |

### 2.2 Root Cause Analysis

```
                    ┌─────────────────────┐
                    │   No Unified Push   │
                    │   Infrastructure    │
                    └──────────┬──────────┘
                               │
           ┌───────────────────┼───────────────────┐
           ▼                   ▼                   ▼
    ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
    │ Fragmented   │   │ No Offline   │   │ No Category  │
    │ Channels     │   │ Queue        │   │ Preferences  │
    └──────────────┘   └──────────────┘   └──────────────┘
           │                   │                   │
           ▼                   ▼                   ▼
    ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
    │ Missed       │   │ Lost         │   │ Notification │
    │ Alerts       │   │ Messages     │   │ Fatigue      │
    └──────────────┘   └──────────────┘   └──────────────┘
```

### 2.3 Competitive Analysis

| Feature | Our Target | Industry Standard | Market Leader |
|---------|------------|-------------------|---------------|
| Delivery latency | <3s | <10s | <1s |
| Multi-platform support | Web/Android/iOS | Android/iOS | All + Desktop |
| Offline resilience | Full queue + sync | Basic retry | Event sourcing |
| Personalization | Category + time-based | Category only | ML-based |
| Rich media | Images, actions | Text only | Full multimedia |

---

## 3. Goals & Success Metrics

### 3.1 Primary Goals

| Goal | Description | Priority |
|------|-------------|----------|
| **G1** | Reduce time from event to user awareness to <3 seconds | P0 |
| **G2** | Achieve 99.5% successful delivery rate across all platforms | P0 |
| **G3** | Enable granular user control over notification preferences | P1 |
| **G4** | Support offline-first notification queueing and sync | P1 |
| **G5** | Provide audit trail for compliance and debugging | P2 |

### 3.2 Key Performance Indicators (KPIs)

```
┌────────────────────────────────────────────────────────────────┐
│                    NOTIFICATION METRICS                        │
├────────────────────────────────────────────────────────────────┤
│  Delivery Rate    │  Open Rate      │  Latency (P95)          │
│  ████████████ 99% │  ████████ 45%   │  ██████ 2.1s            │
│                   │                 │                          │
│  Target: 99.5%    │  Target: 40%    │  Target: <3s            │
├────────────────────────────────────────────────────────────────┤
│  Error Rate       │  Opt-out Rate   │  Queue Depth            │
│  ░░ 0.3%          │  ░░░ 5%         │  ███ 127 pending        │
│                   │                 │                          │
│  Target: <1%      │  Target: <10%   │  Target: <1000          │
└────────────────────────────────────────────────────────────────┘
```

### 3.3 Success Criteria

| Metric | Baseline | Target | Measurement Method |
|--------|----------|--------|-------------------|
| Assignment notification delivery | 85% | 99.5% | FCM/APNs delivery receipts |
| Time to acknowledge | 15 min avg | 3 min avg | Notification tap timestamp |
| Missed urgent alerts | 5/day | 0/day | Escalation incident count |
| User satisfaction (notification) | 3.2/5 | 4.5/5 | In-app survey |

---

## 4. Scope & Boundaries

### 4.1 In Scope

| Category | Features |
|----------|----------|
| **Channels** | FCM (Android), APNs (iOS), Web Push (PWA), In-App, WebSocket |
| **Notification Types** | Push, Silent/Background, Local, Scheduled |
| **Categories** | Order status, Assignment, Settlement, System alerts, Messages |
| **Features** | Rich media, Action buttons, Grouping, Priority levels |
| **User Controls** | Per-category mute, Quiet hours, Device-level preferences |
| **Admin Tools** | Broadcast, Targeting, Analytics dashboard, A/B testing |

### 4.2 Out of Scope (v1.0)

| Feature | Reason | Future Version |
|---------|--------|----------------|
| SMS fallback | Cost and complexity | v2.0 |
| Email notifications | Separate system exists | v2.0 |
| ML-based personalization | Data insufficient | v3.0 |
| Cross-device sync of read status | Complexity | v2.0 |

### 4.3 Platform Requirements

| Platform | Min Version | Push Provider | Notes |
|----------|-------------|---------------|-------|
| Android | 8.0 (API 26) | FCM | Background restrictions apply |
| iOS | 13.0 | APNs | VoIP pushes for critical alerts |
| Web (PWA) | Chrome 90+ | Web Push (VAPID) | Service Worker required |

---

## 5. System Architecture

### 5.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            NOTIFICATION SYSTEM                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐  │
│  │  Event   │───▶│ Notification │───▶│    Push      │───▶│  Client  │  │
│  │  Source  │    │   Service    │    │   Gateway    │    │  Devices │  │
│  └──────────┘    └──────────────┘    └──────────────┘    └──────────┘  │
│       │                │                    │                   │       │
│       ▼                ▼                    ▼                   ▼       │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐  │
│  │  Order   │    │   User       │    │    FCM       │    │  Android │  │
│  │  Events  │    │   Prefs DB   │    │    APNs      │    │  iOS     │  │
│  │  Status  │    │   Token DB   │    │    WebPush   │    │  Web     │  │
│  │  Changes │    │              │    │              │    │          │  │
│  └──────────┘    └──────────────┘    └──────────────┘    └──────────┘  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     SUPPORTING INFRASTRUCTURE                    │   │
│  ├──────────────┬───────────────┬───────────────┬─────────────────┤   │
│  │   Redis      │   PostgreSQL  │   BullMQ      │   WebSocket     │   │
│  │   (Cache)    │   (Persist)   │   (Queue)     │   (Real-time)   │   │
│  └──────────────┴───────────────┴───────────────┴─────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Component Details

#### 5.2.1 Notification Service (Core)

```typescript
// Responsibility: Orchestrate notification lifecycle
interface NotificationService {
  // Create and persist notification
  create(data: NotificationPayload): Promise<Notification>;

  // Send to all user devices
  dispatch(notification: Notification): Promise<DispatchResult>;

  // Handle user acknowledgment
  acknowledge(notificationId: string, userId: string): Promise<void>;

  // Bulk operations
  broadcast(targetGroup: TargetGroup, payload: Payload): Promise<BatchResult>;
}
```

#### 5.2.2 Push Gateway (Multi-Provider)

```typescript
// Responsibility: Abstract push provider differences
interface PushGateway {
  providers: Map<PushProvider, PushProviderClient>;

  // Route to appropriate provider
  send(subscription: Subscription, payload: PushPayload): Promise<SendResult>;

  // Handle provider feedback
  handleFeedback(feedback: ProviderFeedback): Promise<void>;

  // Manage token lifecycle
  refreshToken(subscription: Subscription): Promise<void>;
}
```

#### 5.2.3 Subscription Manager

```typescript
// Responsibility: Manage device subscriptions
interface SubscriptionManager {
  // Register device
  subscribe(userId: string, device: DeviceInfo): Promise<Subscription>;

  // Remove device
  unsubscribe(subscriptionId: string): Promise<void>;

  // Update preferences
  updatePreferences(subscriptionId: string, prefs: Preferences): Promise<void>;

  // Get active subscriptions for user
  getActiveSubscriptions(userId: string): Promise<Subscription[]>;
}
```

### 5.3 Data Flow

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Event   │────▶│ Process │────▶│ Queue   │────▶│ Send    │────▶│ Confirm │
│ Trigger │     │ & Store │     │ Job     │     │ Push    │     │ Delivery│
└─────────┘     └─────────┘     └─────────┘     └─────────┘     └─────────┘
     │               │               │               │               │
     ▼               ▼               ▼               ▼               ▼
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│Order    │     │Check    │     │Retry    │     │Route to │     │Update   │
│Status   │     │User     │     │Logic    │     │FCM/APNs/│     │Status   │
│Change   │     │Prefs    │     │Applied  │     │WebPush  │     │in DB    │
└─────────┘     └─────────┘     └─────────┘     └─────────┘     └─────────┘
```

### 5.4 WebSocket Real-Time Layer

```typescript
// Real-time notification delivery for active clients
@WebSocketGateway({ namespace: '/notifications' })
export class NotificationsGateway {
  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, userId: string): void;

  @SubscribeMessage('acknowledge')
  handleAcknowledge(client: Socket, notificationId: string): void;

  // Broadcast to user's connected clients
  emitToUser(userId: string, event: string, data: any): void;
}
```

---

## 6. Functional Requirements

### 6.1 Notification Categories

| ID | Category | Priority | Sound | Vibration | LED | Action Required |
|----|----------|----------|-------|-----------|-----|-----------------|
| NC-01 | `ORDER_ASSIGNED` | HIGH | Custom | Long | Blue | View order |
| NC-02 | `ORDER_STATUS_CHANGED` | MEDIUM | Default | Short | Green | Optional |
| NC-03 | `APPOINTMENT_CHANGED` | HIGH | Urgent | Long | Orange | Confirm |
| NC-04 | `SETTLEMENT_DEADLINE` | CRITICAL | Alarm | Continuous | Red | Complete task |
| NC-05 | `CUSTOMER_REQUEST` | HIGH | Custom | Long | Purple | Respond |
| NC-06 | `SYSTEM_ALERT` | LOW | None | None | None | None |
| NC-07 | `MESSAGE_RECEIVED` | MEDIUM | Message | Short | Blue | View |

### 6.2 Core Features

#### FR-NTF-01: Push Notification Delivery

| Requirement | Details |
|-------------|---------|
| **Description** | Deliver push notifications to registered devices via FCM/APNs/Web Push |
| **Trigger** | Business event occurs (order status change, assignment, etc.) |
| **Pre-conditions** | User has active subscription, category enabled |
| **Success Criteria** | Notification appears on device within 3 seconds |
| **Error Handling** | Queue for retry, fallback to in-app notification |

```typescript
// Payload structure
interface PushPayload {
  title: string;              // Max 50 chars
  body: string;               // Max 200 chars
  icon?: string;              // Category-specific icon
  image?: string;             // Rich media URL (optional)
  data: {
    notificationId: string;
    category: NotificationCategory;
    orderId?: string;
    clickAction: string;      // Deep link
    timestamp: string;
  };
  android?: AndroidConfig;
  apns?: ApnsConfig;
  webpush?: WebPushConfig;
}
```

#### FR-NTF-02: Notification Grouping (Stacking)

| Requirement | Details |
|-------------|---------|
| **Description** | Group multiple notifications of same category to prevent notification spam |
| **Rules** | Group by category + orderId within 5 minute window |
| **Display** | Show count badge, expand to see individual items |
| **Platform** | Android (group key), iOS (thread-id), Web (tag) |

```typescript
// Grouping configuration
const groupingConfig: Record<NotificationCategory, GroupConfig> = {
  ORDER_STATUS_CHANGED: {
    groupKey: 'order_status',
    windowSeconds: 300,
    summaryTemplate: '{{count}}건의 주문 상태가 변경되었습니다',
  },
  // ...
};
```

#### FR-NTF-03: User Preference Management

| Requirement | Details |
|-------------|---------|
| **Description** | Allow users to control notification settings per device |
| **Granularity** | Per-category enable/disable, quiet hours, sound settings |
| **Sync** | Per-device settings (not synced across devices) |
| **Default** | All categories enabled, no quiet hours |

```typescript
interface NotificationPreferences {
  deviceId: string;
  categoriesEnabled: NotificationCategory[];
  quietHours?: {
    enabled: boolean;
    start: string;  // "22:00"
    end: string;    // "07:00"
    timezone: string;
  };
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}
```

#### FR-NTF-04: In-App Notification Center

| Requirement | Details |
|-------------|---------|
| **Description** | Persistent list of all notifications for the user |
| **Features** | Filter by category, mark as read, bulk actions |
| **Retention** | 90 days |
| **Pagination** | Cursor-based, 20 items per page |

#### FR-NTF-05: Action Buttons

| Requirement | Details |
|-------------|---------|
| **Description** | Enable quick actions directly from notification |
| **Actions** | Accept/Reject (assignment), Call customer, Navigate, Snooze |
| **Platform Support** | Android (full), iOS (full), Web (limited) |

```typescript
// Action button configuration
interface NotificationAction {
  id: string;
  title: string;
  icon?: string;
  action: 'accept' | 'reject' | 'call' | 'navigate' | 'snooze' | 'custom';
  url?: string;  // For custom actions
  requiresAuth: boolean;
}
```

#### FR-NTF-06: Silent/Background Notifications

| Requirement | Details |
|-------------|---------|
| **Description** | Update app data without user-visible notification |
| **Use Cases** | Sync order data, update cache, refresh tokens |
| **Platform** | content-available (APNs), data-only (FCM) |
| **Quota** | Max 100/day per device (iOS restriction) |

#### FR-NTF-07: Scheduled Notifications

| Requirement | Details |
|-------------|---------|
| **Description** | Schedule notifications for future delivery |
| **Use Cases** | Appointment reminders, settlement deadline warnings |
| **Accuracy** | ±1 minute of scheduled time |
| **Management** | Cancel, reschedule, update content |

```typescript
interface ScheduledNotification {
  id: string;
  scheduledFor: Date;
  timezone: string;
  payload: NotificationPayload;
  status: 'pending' | 'sent' | 'cancelled';
  recurrence?: {
    pattern: 'daily' | 'weekly' | 'monthly';
    endDate?: Date;
  };
}
```

#### FR-NTF-08: Admin Broadcast

| Requirement | Details |
|-------------|---------|
| **Description** | Send notifications to groups of users |
| **Targeting** | By role, branch, status, or custom filter |
| **Authorization** | HQ_ADMIN only |
| **Rate Limit** | Max 1 broadcast/minute, 10/hour |

### 6.3 Notification Triggers (Event Mapping)

| Business Event | Notification Category | Recipients | Priority |
|----------------|----------------------|------------|----------|
| Order created | `ORDER_ASSIGNED` | Assigned installer | HIGH |
| Order status changed | `ORDER_STATUS_CHANGED` | Branch manager, installer | MEDIUM |
| Appointment rescheduled | `APPOINTMENT_CHANGED` | Installer, customer (via SMS) | HIGH |
| Installer reassigned | `ORDER_ASSIGNED` | New installer, old installer | HIGH |
| Settlement period opened | `SETTLEMENT_DEADLINE` | All branch users | HIGH |
| Settlement period closing (24h) | `SETTLEMENT_DEADLINE` | Users with pending items | CRITICAL |
| Customer cancellation request | `CUSTOMER_REQUEST` | Branch coordinator | HIGH |
| System maintenance scheduled | `SYSTEM_ALERT` | All users | LOW |

---

## 7. Non-Functional Requirements

### 7.1 Performance

| Metric | Requirement | Measurement |
|--------|-------------|-------------|
| End-to-end latency | P50 <1s, P95 <3s, P99 <5s | Event to device |
| Throughput | 1,000 notifications/second | Sustained load |
| Concurrent connections | 10,000 WebSocket clients | Peak capacity |
| Queue depth | Process within 30 seconds | 99th percentile |

### 7.2 Reliability

| Metric | Requirement | Notes |
|--------|-------------|-------|
| Availability | 99.9% | Excluding provider outages |
| Durability | No message loss | Persistent queue |
| Retry policy | Exponential backoff, max 5 attempts | Provider failures |
| Failover | Automatic provider failover | FCM → APNs fallback N/A |

### 7.3 Scalability

```
                    Load Characteristics
     ┌────────────────────────────────────────────────┐
     │                                                │
  N  │                    ████                        │
  o  │               ████ ████ ████                   │
  t  │          ████ ████ ████ ████                   │
  i  │     ████ ████ ████ ████ ████ ████              │
  f  │████ ████ ████ ████ ████ ████ ████ ████         │
  s  └────────────────────────────────────────────────┘
         06   08   10   12   14   16   18   20   22

     Peak: 10AM-12PM (assignment), 4PM-6PM (completion)

     Scaling Strategy:
     - Horizontal: Add queue workers during peak
     - Vertical: Increase Redis cache for hot data
     - Geographic: Regional push gateways (future)
```

### 7.4 Security

| Requirement | Implementation |
|-------------|----------------|
| Token storage | Encrypted at rest (AES-256) |
| Transport | TLS 1.3 for all connections |
| Authentication | JWT with refresh token rotation |
| Authorization | Role-based category access |
| Audit | All subscription changes logged |

---

## 8. API Specification

### 8.1 REST Endpoints

#### Subscribe Device

```http
POST /api/notifications/subscribe
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "deviceId": "unique-device-id",
  "platform": "ANDROID" | "IOS" | "WEB",
  "pushProvider": "FCM" | "APNS" | "WEB_PUSH",
  "token": {
    "fcm": "fcm-token-string",
    // or "apns": "device-token",
    // or "webpush": { "endpoint": "...", "keys": { "p256dh": "...", "auth": "..." } }
  },
  "categoriesEnabled": ["ORDER_ASSIGNED", "ORDER_STATUS_CHANGED", "SETTLEMENT_DEADLINE"]
}

Response: 201 Created
{
  "success": true,
  "data": {
    "id": "subscription-uuid",
    "deviceId": "unique-device-id",
    "platform": "ANDROID",
    "categoriesEnabled": ["ORDER_ASSIGNED", "ORDER_STATUS_CHANGED", "SETTLEMENT_DEADLINE"],
    "createdAt": "2025-01-15T10:30:00Z",
    "expiresAt": "2026-01-15T10:30:00Z"
  }
}
```

#### Get Notifications

```http
GET /api/notifications?category=ORDER_STATUS_CHANGED&status=UNREAD&limit=20&cursor=abc123
Authorization: Bearer {jwt_token}

Response: 200 OK
{
  "success": true,
  "data": [
    {
      "id": "notification-uuid",
      "category": "ORDER_STATUS_CHANGED",
      "payload": {
        "title": "주문 상태 변경",
        "body": "주문 #12345가 '출문' 상태로 변경되었습니다.",
        "orderId": "order-uuid",
        "previousStatus": "RELEASED",
        "newStatus": "DISPATCHED"
      },
      "status": "UNREAD",
      "createdAt": "2025-01-15T10:30:00Z",
      "order": {
        "orderNo": "ORD-2025-12345",
        "customerName": "홍길동"
      }
    }
  ],
  "pagination": {
    "nextCursor": "xyz789",
    "hasMore": true
  }
}
```

#### Acknowledge Notification

```http
PATCH /api/notifications/{id}/ack
Authorization: Bearer {jwt_token}

Response: 200 OK
{
  "success": true,
  "data": {
    "id": "notification-uuid",
    "status": "READ",
    "readAt": "2025-01-15T10:35:00Z"
  }
}
```

#### Update Preferences

```http
PUT /api/notifications/preferences
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "deviceId": "unique-device-id",
  "categoriesEnabled": ["ORDER_ASSIGNED", "SETTLEMENT_DEADLINE"],
  "quietHours": {
    "enabled": true,
    "start": "22:00",
    "end": "07:00",
    "timezone": "Asia/Seoul"
  }
}

Response: 200 OK
{
  "success": true,
  "data": {
    "deviceId": "unique-device-id",
    "categoriesEnabled": ["ORDER_ASSIGNED", "SETTLEMENT_DEADLINE"],
    "quietHours": { ... },
    "updatedAt": "2025-01-15T10:40:00Z"
  }
}
```

### 8.2 WebSocket Events

```typescript
// Client → Server
interface ClientEvents {
  'subscribe': { userId: string };
  'acknowledge': { notificationId: string };
  'markAllRead': { category?: NotificationCategory };
}

// Server → Client
interface ServerEvents {
  'notification': Notification;
  'notification:updated': { id: string; status: NotificationStatus };
  'unreadCount': { count: number; byCategory: Record<string, number> };
  'error': { code: string; message: string };
}
```

### 8.3 Error Codes

| Code | HTTP Status | Description | Action |
|------|-------------|-------------|--------|
| `NTF_001` | 400 | Invalid device token | Re-register device |
| `NTF_002` | 404 | Subscription not found | Create new subscription |
| `NTF_003` | 404 | Notification not found | - |
| `NTF_004` | 403 | Category not allowed for role | Check permissions |
| `NTF_005` | 429 | Rate limit exceeded | Retry after delay |
| `NTF_006` | 500 | Push provider error | Retry with backoff |

---

## 9. Data Model

### 9.1 Database Schema

```sql
-- Notification Subscriptions
CREATE TABLE notification_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  device_id VARCHAR(255) NOT NULL,
  platform "Platform" NOT NULL,  -- ANDROID, IOS, WEB
  push_provider "PushProvider" NOT NULL,  -- FCM, APNS, WEB_PUSH
  token JSONB NOT NULL,
  categories_enabled TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  timezone VARCHAR(50) DEFAULT 'Asia/Seoul',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  UNIQUE (user_id, device_id)
);

CREATE INDEX idx_subscriptions_user_active ON notification_subscriptions(user_id, is_active);
CREATE INDEX idx_subscriptions_expires ON notification_subscriptions(expires_at) WHERE is_active = true;

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  order_id UUID REFERENCES orders(id),
  category VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  status "NotificationStatus" NOT NULL DEFAULT 'UNREAD',  -- UNREAD, READ, DISMISSED
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,

  CONSTRAINT valid_category CHECK (category IN (
    'ORDER_ASSIGNED', 'ORDER_STATUS_CHANGED', 'APPOINTMENT_CHANGED',
    'SETTLEMENT_DEADLINE', 'CUSTOMER_REQUEST', 'SYSTEM_ALERT', 'MESSAGE_RECEIVED'
  ))
);

CREATE INDEX idx_notifications_user_status ON notifications(user_id, status, created_at DESC);
CREATE INDEX idx_notifications_category ON notifications(category, created_at DESC);

-- Notification Delivery Log (for audit and debugging)
CREATE TABLE notification_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id),
  subscription_id UUID NOT NULL REFERENCES notification_subscriptions(id),
  provider "PushProvider" NOT NULL,
  status VARCHAR(20) NOT NULL,  -- PENDING, SENT, DELIVERED, FAILED, EXPIRED
  provider_message_id VARCHAR(255),
  error_code VARCHAR(50),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_delivery_log_notification ON notification_delivery_log(notification_id);
CREATE INDEX idx_delivery_log_status ON notification_delivery_log(status, created_at);

-- Scheduled Notifications
CREATE TABLE scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),  -- NULL for broadcast
  target_group JSONB,  -- For broadcast targeting
  payload JSONB NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Seoul',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',  -- PENDING, SENT, CANCELLED
  recurrence JSONB,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX idx_scheduled_pending ON scheduled_notifications(scheduled_for)
  WHERE status = 'PENDING';
```

### 9.2 Prisma Schema

```prisma
model NotificationSubscription {
  id                String          @id @default(uuid())
  userId            String          @map("user_id")
  deviceId          String          @map("device_id")
  platform          Platform
  pushProvider      PushProvider    @map("push_provider")
  token             Json
  categoriesEnabled String[]        @map("categories_enabled")
  isActive          Boolean         @default(true) @map("is_active")
  quietHoursStart   DateTime?       @map("quiet_hours_start") @db.Time
  quietHoursEnd     DateTime?       @map("quiet_hours_end") @db.Time
  timezone          String          @default("Asia/Seoul")
  createdAt         DateTime        @default(now()) @map("created_at")
  updatedAt         DateTime        @updatedAt @map("updated_at")
  expiresAt         DateTime        @map("expires_at")

  user              User            @relation(fields: [userId], references: [id])
  deliveryLogs      NotificationDeliveryLog[]

  @@unique([userId, deviceId])
  @@index([userId, isActive])
  @@map("notification_subscriptions")
}

model Notification {
  id            String              @id @default(uuid())
  userId        String              @map("user_id")
  orderId       String?             @map("order_id")
  category      String
  payload       Json
  status        NotificationStatus  @default(UNREAD)
  createdAt     DateTime            @default(now()) @map("created_at")
  readAt        DateTime?           @map("read_at")

  user          User                @relation(fields: [userId], references: [id])
  order         Order?              @relation(fields: [orderId], references: [id])
  deliveryLogs  NotificationDeliveryLog[]

  @@index([userId, status, createdAt(sort: Desc)])
  @@map("notifications")
}

enum Platform {
  ANDROID
  IOS
  WEB
}

enum PushProvider {
  FCM
  APNS
  WEB_PUSH
}

enum NotificationStatus {
  UNREAD
  READ
  DISMISSED
}
```

---

## 10. Security & Privacy

### 10.1 Data Classification

| Data Type | Classification | Encryption | Retention |
|-----------|---------------|------------|-----------|
| Push tokens | Sensitive | At-rest (AES-256) | Until unsubscribe |
| Notification content | Internal | At-rest | 90 days |
| Delivery logs | Operational | None | 30 days |
| User preferences | Personal | At-rest | Account lifetime |

### 10.2 Access Control

```typescript
// Role-based notification category access
const categoryPermissions: Record<Role, NotificationCategory[]> = {
  HQ_ADMIN: ['*'],  // All categories
  BRANCH_MANAGER: [
    'ORDER_ASSIGNED', 'ORDER_STATUS_CHANGED', 'APPOINTMENT_CHANGED',
    'SETTLEMENT_DEADLINE', 'CUSTOMER_REQUEST', 'SYSTEM_ALERT'
  ],
  COORDINATOR: [
    'ORDER_ASSIGNED', 'ORDER_STATUS_CHANGED', 'APPOINTMENT_CHANGED',
    'CUSTOMER_REQUEST', 'SYSTEM_ALERT'
  ],
  INSTALLER: [
    'ORDER_ASSIGNED', 'APPOINTMENT_CHANGED', 'SYSTEM_ALERT'
  ],
};
```

### 10.3 Compliance Requirements

| Requirement | Implementation |
|-------------|----------------|
| GDPR (if applicable) | Notification content excluded from data export |
| Audit trail | All subscription changes logged with actor |
| Data deletion | Cascade delete on user account deletion |
| Consent | Explicit opt-in required for push notifications |

---

## 11. Error Handling & Resilience

### 11.1 Retry Strategy

```typescript
const retryConfig = {
  maxAttempts: 5,
  backoff: {
    type: 'exponential',
    delay: 1000,  // Initial delay 1s
    maxDelay: 60000,  // Max delay 60s
  },
  retryOn: [
    'PROVIDER_UNAVAILABLE',
    'RATE_LIMITED',
    'NETWORK_ERROR',
  ],
  failFast: [
    'INVALID_TOKEN',
    'UNREGISTERED',
    'MESSAGE_TOO_LARGE',
  ],
};
```

### 11.2 Fallback Chain

```
┌──────────────┐
│ Push Failed  │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│ Retry Queue  │────▶│ Success?     │───Yes──▶ Done
└──────────────┘     └──────┬───────┘
                            │ No
                            ▼
                     ┌──────────────┐
                     │ In-App Only  │
                     │ (Persisted)  │
                     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │ User checks  │
                     │ notification │
                     │ center       │
                     └──────────────┘
```

### 11.3 Circuit Breaker

```typescript
const circuitBreakerConfig = {
  failureThreshold: 5,      // Open after 5 failures
  successThreshold: 3,       // Close after 3 successes
  timeout: 30000,            // Try half-open after 30s
  volumeThreshold: 10,       // Min requests before evaluating
};
```

---

## 12. Testing Strategy

### 12.1 Unit Tests

| Component | Coverage Target | Key Test Cases |
|-----------|----------------|----------------|
| NotificationService | 90% | Payload building, preference filtering |
| PushGateway | 85% | Provider routing, error handling |
| SubscriptionManager | 90% | Token validation, preference updates |

### 12.2 Integration Tests

| Scenario | Test Method |
|----------|-------------|
| End-to-end delivery | Mock push providers, verify DB state |
| WebSocket connection | Socket.io test client |
| Preference filtering | Create notifications, verify delivery |
| Retry logic | Simulate provider failures |

### 12.3 Load Tests

| Scenario | Target | Tool |
|----------|--------|------|
| Notification burst | 1,000/sec for 60s | k6 |
| Concurrent WebSocket | 10,000 connections | Artillery |
| Mixed workload | 500 push + 5,000 WS | Custom |

### 12.4 E2E Tests

```typescript
// Playwright test example
test('should receive push notification', async ({ page, device }) => {
  // 1. Login and subscribe
  await loginAsInstaller(page);
  await subscribeToPush(device);

  // 2. Trigger event
  await api.assignOrderToInstaller(orderId, installerId);

  // 3. Verify notification
  await expect(device.notifications).toContainEqual(
    expect.objectContaining({
      title: expect.stringContaining('새로운 배정'),
      body: expect.stringContaining(orderId),
    })
  );
});
```

---

## 13. Rollout Plan

### 13.1 Phase 1: Foundation (Week 1-2)

| Task | Owner | Status |
|------|-------|--------|
| Database schema migration | Backend | 🔲 |
| NotificationService core | Backend | 🔲 |
| FCM integration | Backend | 🔲 |
| Web Push (VAPID) setup | Backend | 🔲 |
| Subscription API | Backend | 🔲 |

### 13.2 Phase 2: Client Integration (Week 3-4)

| Task | Owner | Status |
|------|-------|--------|
| Android push registration | Mobile | 🔲 |
| iOS push registration | Mobile | 🔲 |
| Web Service Worker | Frontend | 🔲 |
| Notification center UI | Frontend | 🔲 |
| Preference settings UI | Frontend | 🔲 |

### 13.3 Phase 3: Event Integration (Week 5-6)

| Task | Owner | Status |
|------|-------|--------|
| Order status change events | Backend | 🔲 |
| Assignment events | Backend | 🔲 |
| Settlement events | Backend | 🔲 |
| WebSocket real-time | Backend | 🔲 |

### 13.4 Phase 4: Polish & Launch (Week 7-8)

| Task | Owner | Status |
|------|-------|--------|
| Load testing | QA | 🔲 |
| Security audit | Security | 🔲 |
| Documentation | Tech Writer | 🔲 |
| Beta rollout (10% users) | DevOps | 🔲 |
| Full rollout | DevOps | 🔲 |

---

## 14. Monitoring & Observability

### 14.1 Metrics Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│              NOTIFICATION SYSTEM HEALTH                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │ Delivery Rate    │  │ Latency P95      │  │ Error Rate     │ │
│  │   99.7%  ▲0.2%   │  │   1.8s   ▼0.3s   │  │   0.3%  ▼0.1%  │ │
│  └──────────────────┘  └──────────────────┘  └────────────────┘ │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Notifications / Minute                                    │   │
│  │ 150 ┤                     ████                            │   │
│  │ 100 ┤              ███████████████                        │   │
│  │  50 ┤       ███████████████████████████                   │   │
│  │   0 ┼──────────────────────────────────▶ Time             │   │
│  │       06:00    09:00    12:00    15:00    18:00           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────┐  ┌──────────────────────────────┐  │
│  │ By Category             │  │ By Platform                  │  │
│  │ ORDER_ASSIGNED    45%   │  │ Android      55%  ████████   │  │
│  │ STATUS_CHANGED    30%   │  │ iOS          35%  █████      │  │
│  │ SETTLEMENT        15%   │  │ Web          10%  ██         │  │
│  │ OTHER             10%   │  │                              │  │
│  └─────────────────────────┘  └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 14.2 Alerts

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| Delivery rate drop | <95% for 5 min | Critical | Page on-call |
| High latency | P95 >5s for 5 min | Warning | Investigate |
| Queue backlog | >5,000 pending | Warning | Scale workers |
| Provider error spike | >10% errors | Critical | Check provider status |
| Subscription expiry | >1,000 expiring/day | Info | Trigger re-registration |

### 14.3 Logging

```typescript
// Structured logging format
{
  "timestamp": "2025-01-15T10:30:00.123Z",
  "level": "info",
  "service": "notification-service",
  "traceId": "abc123",
  "event": "notification.sent",
  "data": {
    "notificationId": "uuid",
    "userId": "uuid",
    "category": "ORDER_ASSIGNED",
    "provider": "FCM",
    "latencyMs": 450,
    "success": true
  }
}
```

---

## 15. Dependencies & Risks

### 15.1 External Dependencies

| Dependency | Impact | Mitigation |
|------------|--------|------------|
| Firebase (FCM) | Android push delivery | Monitor FCM status, queue for retry |
| APNs | iOS push delivery | Certificate rotation alerts |
| Redis | Queue and cache | Sentinel for HA, persistent queues |
| PostgreSQL | Data persistence | Read replicas, connection pooling |

### 15.2 Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| FCM quota exceeded | Low | High | Monitor quota, implement backpressure |
| Token expiry | Medium | Medium | Proactive refresh, re-registration flow |
| Notification fatigue | Medium | High | Smart grouping, user controls |
| Data breach | Low | Critical | Encryption, access controls, audit |
| Provider outage | Low | High | Multi-provider support (future) |

---

## 16. Future Considerations

### 16.1 Version 2.0 Roadmap

| Feature | Priority | Effort |
|---------|----------|--------|
| SMS fallback for critical alerts | High | Medium |
| Email digest (daily summary) | Medium | Low |
| Cross-device read sync | Medium | Medium |
| Rich media (images, cards) | Low | Medium |

### 16.2 Version 3.0 Vision

| Feature | Description |
|---------|-------------|
| ML-based delivery optimization | Predict best time to send |
| Engagement analytics | A/B testing notification content |
| Multi-language support | Localized notification templates |
| Chatbot integration | Interactive notifications |

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| FCM | Firebase Cloud Messaging - Google's push service |
| APNs | Apple Push Notification service |
| VAPID | Voluntary Application Server Identification for Web Push |
| Silent push | Background notification that doesn't alert user |
| Deep link | URL that opens specific app screen |

## Appendix B: References

- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Apple Push Notification Service](https://developer.apple.com/documentation/usernotifications)
- [Web Push Protocol](https://datatracker.ietf.org/doc/html/rfc8030)
- [Capacitor Push Notifications](https://capacitorjs.com/docs/apis/push-notifications)

---

**Document History**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-12-27 | System Architecture Team | Initial draft |
