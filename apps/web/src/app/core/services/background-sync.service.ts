import { Injectable, inject, effect, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { TranslateService } from '@ngx-translate/core';
import { NetworkService } from './network.service';
import { environment } from '@env/environment';
import { SyncQueueService } from './sync-queue.service';
import { UIStore } from '../../store/ui/ui.store';
import { db, SyncQueueEntry, BackgroundSyncTask } from '@app/core/db/database';

export type SyncOperation = SyncQueueEntry;
export type { BackgroundSyncTask } from '@app/core/db/database';

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
  private readonly translate = inject(TranslateService);

  private syncInProgress = false;
  private workerRegistration: ServiceWorkerRegistration | null = null;
  private isInitialized = false;

  readonly pendingTasksCount = signal(0);
  readonly syncStatus = signal<'idle' | 'syncing' | 'error'>('idle');

  constructor() {
    effect(() => {
      const isOffline = this.networkService.isOffline();
      if (!isOffline) {
        this.onNetworkOnline();
      }
    });

    this.registerSyncListener();
    this.initialize();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (!environment.production) {
      console.log('Skipping Service Worker registration in development mode');
      this.isInitialized = true;
      return;
    }

    try {
      if ('serviceWorker' in navigator) {
        this.workerRegistration = await navigator.serviceWorker.register('/ngsw-worker.js', {
          scope: '/',
        });
        console.log('Service Worker registered for background sync');
        this.isInitialized = true;
      }
    } catch (error) {
      console.error('Failed to register Service Worker:', error);
    }
  }

  async queueTask(
    dataType: string,
    operation: string,
    data: unknown,
    maxRetries = 3,
  ): Promise<string> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const task: BackgroundSyncTask = {
      id: taskId,
      dataType,
      operation,
      data,
      retries: 0,
      maxRetries,
      createdAt: Date.now(),
    };

    await db.backgroundSyncQueue.add(task);
    await this.updatePendingCount();

    if (this.workerRegistration && 'sync' in this.workerRegistration) {
      try {
        await (
          this.workerRegistration as ServiceWorkerRegistration & {
            sync: { register: (tag: string) => Promise<void> };
          }
        ).sync.register(`sync-${dataType}`);
      } catch (error) {
        console.warn('Background sync registration failed:', error);
      }
    }

    return taskId;
  }

  async getPendingTasks(): Promise<BackgroundSyncTask[]> {
    return db.backgroundSyncQueue.toArray();
  }

  async removeTask(taskId: string): Promise<void> {
    await db.backgroundSyncQueue.delete(taskId);
    await this.updatePendingCount();
  }

  async retryTask(taskId: string): Promise<void> {
    const task = await db.backgroundSyncQueue.get(taskId);
    if (!task || task.retries >= task.maxRetries) return;

    await db.backgroundSyncQueue.update(taskId, {
      retries: task.retries + 1,
      lastAttempt: Date.now(),
    });

    if (this.workerRegistration && 'sync' in this.workerRegistration) {
      await (
        this.workerRegistration as ServiceWorkerRegistration & {
          sync: { register: (tag: string) => Promise<void> };
        }
      ).sync.register(`sync-retry-${task.dataType}`);
    }
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
      console.log('[Sync] Sync already in progress, skipping...');
      return;
    }

    console.log('[Sync] Network online, starting sync...');
    this.syncInProgress = true;

    try {
      await this.processPendingOperations();
      this.uiStore.showToast(this.translate.instant('SYNC.SUCCESS.ALL_SYNCED'), 'success', 2000);
    } catch (error) {
      console.error('[Sync] Sync error:', error);
      this.uiStore.showToast(this.translate.instant('SYNC.WARNING.PARTIAL_SYNC'), 'warning', 3000);
    } finally {
      this.syncInProgress = false;
    }
  }

  async getPendingOperations(): Promise<SyncOperation[]> {
    return db.syncQueue.where('status').equals('pending').toArray();
  }

  async getFailedOperations(): Promise<SyncOperation[]> {
    return db.syncQueue.where('status').equals('failed').toArray();
  }

  async retryFailed(id: number): Promise<void> {
    const op = await db.syncQueue.get(id);
    if (!op) return;

    await db.syncQueue.update(id, { status: 'pending', retryCount: 0 });
    await this.processSingleOperation(op);
  }

  async clearQueue(): Promise<void> {
    await db.syncQueue.clear();
    console.warn('[Sync] Sync queue cleared');
  }

  private async updatePendingCount(): Promise<void> {
    const count = await db.backgroundSyncQueue.count();
    this.pendingTasksCount.set(count);
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
      console.warn('Background Sync not available:', error);
    }
  }

  private async processPendingOperations(): Promise<void> {
    const operations = await db.syncQueue.where('status').equals('pending').toArray();

    if (operations.length === 0) {
      console.log('[Sync] No pending operations');
      return;
    }

    const sorted = operations.sort((a, b) => a.priority - b.priority);
    console.log(`[Sync] Processing ${sorted.length} operations`);

    for (const op of sorted) {
      try {
        await this.processSingleOperation(op);
      } catch (error) {
        console.error(`[Sync] Failed to process operation:`, op, error);
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
      body: op.method !== 'GET' && op.method !== 'DELETE' ? JSON.stringify(op.body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    await db.syncQueue.delete(op.id!);
    console.log(`[Sync] ✓ ${op.type} ${op.url}`);
  }

  private async handleOperationFailure(op: SyncOperation): Promise<void> {
    const retryCount = op.retryCount + 1;

    if (retryCount >= op.maxRetries) {
      await db.syncQueue.update(op.id!, { status: 'failed', lastError: 'Max retries exceeded' });
      console.error(`[Sync] ✗ Max retries for ${op.type} ${op.url}. Stored for manual review.`);

      const label = this.translate.instant(OPERATION_LABEL_MAP[op.type] || op.type);
      this.uiStore.showToast(`${label} 동기화 실패. 관리자에 문의하세요.`, 'danger', 5000);
      return;
    }

    const backoffMs = RETRY_BACKOFF_MS[Math.min(retryCount - 1, RETRY_BACKOFF_MS.length - 1)];
    await db.syncQueue.update(op.id!, {
      retryCount,
      lastError: `Retry ${retryCount}/${op.maxRetries} in ${backoffMs}ms`,
    });

    console.log(
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
        console.log('[Sync] Service Worker sync complete');
        this.onNetworkOnline();
      }
    });
  }
}
