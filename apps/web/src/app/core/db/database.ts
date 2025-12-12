import Dexie, { Table } from 'dexie';

// Order interface for offline storage
export interface OfflineOrder {
  id: string;
  erpOrderNumber: string;
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
  // Nested data
  orderLines?: Array<{
    id: string;
    productCode: string;
    productName: string;
    quantity: number;
  }>;
}

// Sync queue entry - aligned with SyncOperation in background-sync.service.ts
export interface SyncQueueEntry {
  id?: number;
  type: 'completion' | 'status_change' | 'waste' | 'attachment' | 'note';
  method: string;
  url: string;
  body: unknown;
  priority: number;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'syncing' | 'failed';
  lastError?: string;
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
      orders: 'id, erpOrderNumber, status, appointmentDate, installerId, branchId, localUpdatedAt',
      syncQueue: '++id, timestamp, method',
      metadata: 'key, updatedAt',
    });

    // Version 2: Added status and priority indexes to syncQueue
    this.version(2).stores({
      orders: 'id, erpOrderNumber, status, appointmentDate, installerId, branchId, localUpdatedAt',
      syncQueue: '++id, timestamp, method, status, priority',
      metadata: 'key, updatedAt',
    });
  }
}

export const db = new ERPDatabase();
