import Dexie, { Table } from 'dexie';

// Order interface for offline storage
export interface OfflineOrder {
  id: string;
  orderNo: string;
  status: string;
  appointmentDate?: string;
  appointmentSlot?: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  installerId?: string;
  branchId: string;
  branchCode?: string;
  version: number;
  localUpdatedAt: number;
  syncedAt?: number;
  // Absence tracking (FR-04)
  absenceRetryCount?: number;
  maxAbsenceRetries?: number;
  // Nested data - supports both API field names (itemCode/itemName) and legacy (productCode/productName)
  orderLines?: Array<{
    id: string;
    productCode?: string;
    productName?: string;
    itemCode?: string;
    itemName?: string;
    quantity: number;
  }>;
}

// Sync queue entry
export interface SyncQueueEntry {
  id?: number;
  type?: 'completion' | 'status_change' | 'waste' | 'attachment' | 'note';
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  body: unknown;
  priority?: number;
  timestamp: number;
  retryCount: number;
  maxRetries?: number;
  status?:
    | 'pending'
    | 'syncing'
    | 'failed'
    | 'PENDING'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'CONFLICT'
    | 'FAILED';
  lastError?: string;
  entityType?: 'order' | 'completion';
  entityId?: string;
  conflictData?: unknown;
}

// Metadata cache
export interface MetadataCache {
  key: string;
  data: unknown;
  updatedAt: number;
}

class ERPDatabase extends Dexie {
  orders!: Table<OfflineOrder, string>;
  syncQueue!: Table<SyncQueueEntry, number>;
  metadata!: Table<MetadataCache, string>;

  constructor() {
    super('ERPLogistics');

    // Version 1: Initial schema
    this.version(1).stores({
      orders: 'id, orderNo, status, appointmentDate, installerId, branchId, localUpdatedAt',
      syncQueue: '++id, timestamp, method',
      metadata: 'key, updatedAt',
    });

    // Version 2: Added status and priority to syncQueue for background sync
    this.version(2).stores({
      orders: 'id, orderNo, status, appointmentDate, installerId, branchId, localUpdatedAt',
      syncQueue: '++id, timestamp, method, status, priority',
      metadata: 'key, updatedAt',
    });
  }
}

export const db = new ERPDatabase();
