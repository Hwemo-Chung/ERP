import { Injectable, inject, effect } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { NetworkService } from './network.service';
import { SyncQueueService } from './sync-queue.service';
import { UIStore } from '../../store/ui/ui.store';
import { db } from '@app/core/db/database';
import { LoggerService } from './logger.service';

export interface SyncOperation {
  id?: number;
  type: 'completion' | 'status_change' | 'waste' | 'attachment' | 'note';
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  body: unknown;
  priority: number;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'syncing' | 'failed';
  lastError?: string;
}

const PRIORITY_MAP: Record<SyncOperation['type'], number> = {
  completion: 1,
  status_change: 2,
  waste: 3,
  attachment: 4,
  note: 5,
};

const OPERATION_LABEL_MAP: Record<SyncOperation['type'], string> = {
  completion: 'SYNC.OPERATION.COMPLETION',
  status_change: 'SYNC.OPERATION.STATUS_CHANGE',
  waste: 'SYNC.OPERATION.WASTE',
  attachment: 'SYNC.OPERATION.ATTACHMENT',
  note: 'SYNC.OPERATION.NOTE',
};

const RETRY_BACKOFF_MS = [1000, 5000, 15000, 60000, 300000];
const SYNC_TAG = 'erp-sync';

@Injectable({ providedIn: 'root' })
export class BackgroundSyncService {
  private readonly networkService = inject(NetworkService);
  private readonly syncQueue = inject(SyncQueueService);
  private readonly uiStore = inject(UIStore);
  private readonly swUpdate = inject(SwUpdate);
  private readonly logger = inject(LoggerService);

  private syncInProgress = false;

  constructor() {
    effect(() => {
      const isOffline = this.networkService.isOffline();
      if (!isOffline) {
        this.onNetworkOnline();
      }
    });

    this.registerSyncListener();
  }

  async enqueue(
    operation: Omit<
      SyncOperation,
      'id' | 'timestamp' | 'retryCount' | 'status' | 'priority' | 'maxRetries'
    >,
  ): Promise<void> {
    const item: SyncOperation = {
      type: operation.type,
      method: operation.method,
      url: operation.url,
      body: operation.body,
      priority: PRIORITY_MAP[operation.type] || 99,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      status: 'pending',
    };

    await db.syncQueue.add(item);
    await this.requestBackgroundSync();
  }

  async onNetworkOnline(): Promise<void> {
    if (this.syncInProgress) {
      this.logger.log('[Sync] Sync already in progress, skipping...');
      return;
    }

    this.logger.log('[Sync] Network online, starting sync...');
    this.syncInProgress = true;

    try {
      await this.processPendingOperations();
      this.uiStore.showToast('모든 변경사항이 동기화되었습니다', 'success', 2000);
    } catch (error) {
      this.logger.error('[Sync] Sync error:', error);
      this.uiStore.showToast('일부 변경사항을 동기화할 수 없습니다', 'warning', 3000);
    } finally {
      this.syncInProgress = false;
    }
  }

  async getPendingOperations(): Promise<SyncOperation[]> {
    const entries = await db.syncQueue.where('status').equals('pending').toArray();
    return entries as unknown as SyncOperation[];
  }

  async getFailedOperations(): Promise<SyncOperation[]> {
    const entries = await db.syncQueue.where('status').equals('failed').toArray();
    return entries as unknown as SyncOperation[];
  }

  async retryFailed(id: number): Promise<void> {
    const op = await db.syncQueue.get(id);
    if (!op || !op.type) return;

    await db.syncQueue.update(id, { status: 'pending', retryCount: 0 });
    await this.processSingleOperation(op as SyncOperation);
  }

  async clearQueue(): Promise<void> {
    await db.syncQueue.clear();
    this.logger.warn('[Sync] Sync queue cleared');
  }

  private async requestBackgroundSync(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('SyncManager' in window)) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      await (
        registration as ServiceWorkerRegistration & {
          sync: { register: (tag: string) => Promise<void> };
        }
      ).sync.register(SYNC_TAG);
    } catch (error) {
      this.logger.warn('Background Sync not available:', error);
    }
  }

  private async processPendingOperations(): Promise<void> {
    const entries = await db.syncQueue.where('status').equals('pending').toArray();

    if (entries.length === 0) {
      this.logger.log('[Sync] No pending operations');
      return;
    }

    const operations = entries.filter(
      (e): e is typeof e & { type: SyncOperation['type']; priority: number } =>
        e.type !== undefined && e.priority !== undefined,
    ) as SyncOperation[];

    const sorted = operations.sort((a, b) => a.priority - b.priority);
    this.logger.log(`[Sync] Processing ${sorted.length} operations`);

    for (const op of sorted) {
      try {
        await this.processSingleOperation(op);
      } catch (error) {
        this.logger.error(`[Sync] Failed to process operation:`, op, error);
        await this.handleOperationFailure(op);
      }
    }
  }

  private async processSingleOperation(op: SyncOperation): Promise<void> {
    await db.syncQueue.update(op.id!, { status: 'syncing' });

    const response = await fetch(op.url, {
      method: op.method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await this.getAuthToken()}`,
      },
      body: op.method !== 'DELETE' ? JSON.stringify(op.body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    await db.syncQueue.delete(op.id!);
    this.logger.log(`[Sync] ✓ ${op.type} ${op.url}`);
  }

  private async handleOperationFailure(op: SyncOperation): Promise<void> {
    const retryCount = op.retryCount + 1;

    if (retryCount >= op.maxRetries) {
      await db.syncQueue.update(op.id!, { status: 'failed', lastError: 'Max retries exceeded' });
      this.logger.error(`[Sync] ✗ Max retries for ${op.type} ${op.url}. Stored for manual review.`);
      this.uiStore.showToast(
        `${OPERATION_LABEL_MAP[op.type] || op.type} 동기화 실패. 관리자에 문의하세요.`,
        'danger',
        5000,
      );
      return;
    }

    const backoffMs = RETRY_BACKOFF_MS[Math.min(retryCount - 1, RETRY_BACKOFF_MS.length - 1)];
    await db.syncQueue.update(op.id!, {
      retryCount,
      lastError: `Retry ${retryCount}/${op.maxRetries} in ${backoffMs}ms`,
    });

    this.logger.log(
      `[Sync] ⟳ Retrying ${op.type} after ${backoffMs}ms (attempt ${retryCount}/${op.maxRetries})`,
    );

    setTimeout(() => {
      if (!this.networkService.isOffline()) {
        this.processPendingOperations();
      }
    }, backoffMs);
  }

  private async getAuthToken(): Promise<string> {
    const { Preferences } = await import('@capacitor/preferences');
    const result = await Preferences.get({ key: 'erp_access_token' });
    return result.value || '';
  }

  private registerSyncListener(): void {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SYNC_COMPLETE') {
        this.logger.log('[Sync] Service Worker sync complete');
        this.onNetworkOnline();
      }
    });
  }
}
