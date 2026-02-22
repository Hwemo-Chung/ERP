import Dexie, { Table } from 'dexie';
export type { OfflineOrder, SyncQueueEntry, MetadataCache } from '@erp/shared';
import type { OfflineOrder, SyncQueueEntry, MetadataCache } from '@erp/shared';

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
