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
  absenceRetryCount?: number;
  maxAbsenceRetries?: number;
  orderLines?: Array<{
    id: string;
    productCode?: string;
    productName?: string;
    itemCode?: string;
    itemName?: string;
    quantity: number;
  }>;
}

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

export interface MetadataCache {
  key: string;
  data: unknown;
  updatedAt: number;
}

export interface BackgroundSyncTask {
  id?: string;
  dataType: string;
  operation: string;
  data: unknown;
  retries: number;
  maxRetries: number;
  lastAttempt?: number;
  createdAt: number;
}
