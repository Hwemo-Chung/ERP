/**
 * WebSocket Event Types
 * As defined in ARCHITECTURE.md Section 14
 */

export enum WsEventType {
  ORDER_UPDATED = 'ORDER_UPDATED',
  ASSIGNMENT_CHANGED = 'ASSIGNMENT_CHANGED',
  NOTIFICATION = 'NOTIFICATION',
  FORCE_REFRESH = 'FORCE_REFRESH',
  SETTLEMENT_LOCKED = 'SETTLEMENT_LOCKED',
  SETTLEMENT_UNLOCKED = 'SETTLEMENT_UNLOCKED',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export interface WsOrderUpdatedPayload {
  orderId: string;
  orderNo: string;
  newStatus: string;
  previousStatus: string;
  updatedBy: string;
  updatedAt: string;
}

export interface WsAssignmentChangedPayload {
  orderId: string;
  orderNo: string;
  installerId: string | null;
  installerName: string | null;
  previousInstallerId: string | null;
  assignedBy: string;
  assignedAt: string;
}

export interface WsNotificationPayload {
  id: string;
  category: string;
  title: string;
  body: string;
  orderId?: string;
  createdAt: string;
}

export interface WsForceRefreshPayload {
  reason: string;
  scope?: 'all' | 'orders' | 'installers' | 'settlements';
  affectedBranchCodes?: string[];
}

export interface WsSettlementPayload {
  settlementId: string;
  branchCode: string;
  periodStart: string;
  periodEnd: string;
  lockedBy?: string;
  lockedAt?: string;
}

export interface WsConnectedPayload {
  connectionId: string;
  serverTime: string;
  heartbeatInterval: number;
}

export interface WsErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type WsEvent =
  | { type: WsEventType.ORDER_UPDATED; payload: WsOrderUpdatedPayload }
  | { type: WsEventType.ASSIGNMENT_CHANGED; payload: WsAssignmentChangedPayload }
  | { type: WsEventType.NOTIFICATION; payload: WsNotificationPayload }
  | { type: WsEventType.FORCE_REFRESH; payload: WsForceRefreshPayload }
  | { type: WsEventType.SETTLEMENT_LOCKED; payload: WsSettlementPayload }
  | { type: WsEventType.SETTLEMENT_UNLOCKED; payload: WsSettlementPayload }
  | { type: WsEventType.CONNECTED; payload: WsConnectedPayload }
  | { type: WsEventType.ERROR; payload: WsErrorPayload };

/**
 * Client-to-server events
 */
export enum WsClientEventType {
  PING = 'ping',
  SUBSCRIBE_BRANCH = 'subscribe_branch',
  UNSUBSCRIBE_BRANCH = 'unsubscribe_branch',
  SUBSCRIBE_ORDER = 'subscribe_order',
  UNSUBSCRIBE_ORDER = 'unsubscribe_order',
}

export interface WsSubscribeBranchPayload {
  branchCode: string;
}

export interface WsSubscribeOrderPayload {
  orderId: string;
}
