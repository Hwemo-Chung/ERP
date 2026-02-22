import Dexie, { Table } from 'dexie';
export type { OfflineOrder, SyncQueueEntry, MetadataCache, BackgroundSyncTask } from '@erp/shared';
import type { OfflineOrder, SyncQueueEntry, MetadataCache, BackgroundSyncTask } from '@erp/shared';

class ERPDatabase extends Dexie {
  orders!: Table<OfflineOrder, string>;
  syncQueue!: Table<SyncQueueEntry, number>;
  metadata!: Table<MetadataCache, string>;
  backgroundSyncQueue!: Table<BackgroundSyncTask, string>;

  constructor() {
    super('ERPLogistics');

    // Version 1: Initial schema
    this.version(1).stores({
      orders: 'id, orderNo, status, appointmentDate, installerId, branchId, localUpdatedAt',
      syncQueue: '++id, timestamp, method',
      metadata: 'key, updatedAt',
    });

    // Version 2: Added status and priority indexes to syncQueue
    this.version(2).stores({
      orders: 'id, orderNo, status, appointmentDate, installerId, branchId, localUpdatedAt',
      syncQueue: '++id, timestamp, method, status, priority',
      metadata: 'key, updatedAt',
    });

    // Version 3: Added backgroundSyncQueue table
    this.version(3).stores({
      orders: 'id, orderNo, status, appointmentDate, installerId, branchId, localUpdatedAt',
      syncQueue: '++id, timestamp, method, status, priority',
      metadata: 'key, updatedAt',
      backgroundSyncQueue: 'id, dataType, createdAt',
    });
  }
}

export const db = new ERPDatabase();
