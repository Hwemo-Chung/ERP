/**
 * Background Sync Service
 * Per SDD section 5.2 - Offline Sync Flow
 * Integrates with Angular Service Worker for Background Sync API
 * Retries pending operations when network becomes available
 *
 * Priority order (per SDD 9.2):
 * 1. Completion (KPI-affecting)
 * 2. Status changes
 * 3. Waste pickup
 * 4. Attachments
 * 5. Notes
 */

import { Injectable, inject, effect } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { NetworkService } from './network.service';
import { SyncQueueService } from './sync-queue.service';
import { UIStore } from '../../store/ui/ui.store';
import { db } from '@app/core/db/database';

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

@Injectable({ providedIn: 'root' })
export class BackgroundSyncService {
  private readonly networkService = inject(NetworkService);
  private readonly syncQueue = inject(SyncQueueService);
  private readonly uiStore = inject(UIStore);
  private readonly swUpdate = inject(SwUpdate);

  private syncInProgress = false;
  private readonly SYNC_TAG = 'erp-sync';
  private readonly RETRY_BACKOFF_MS = [1000, 5000, 15000, 60000, 300000]; // 1s, 5s, 15s, 1min, 5min

  constructor() {
    // Listen for network online event
    effect(
      () => {
        const isOffline = this.networkService.isOffline();
        if (!isOffline) {
          this.onNetworkOnline();
        }
      },
      { allowSignalWrites: true }
    );

    // Handle service worker sync event
    this.registerSyncListener();
  }

  /**
   * Enqueue operation with priority
   */
  async enqueue(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount' | 'status' | 'priority' | 'maxRetries'>): Promise<void> {
    const priority = this.calculatePriority(operation.type);

    const item: SyncOperation = {
      type: operation.type,
      method: operation.method,
      url: operation.url,
      body: operation.body,
      priority,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      status: 'pending',
    };

    await db.syncQueue.add(item);

    // Request background sync
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await (registration as any).sync.register(this.SYNC_TAG);
      } catch (error) {
        console.warn('Background Sync not available:', error);
      }
    }
  }

  /**
   * Process all pending operations when network comes online
   */
  async onNetworkOnline(): Promise<void> {
    if (this.syncInProgress) {
      console.log('[Sync] Sync already in progress, skipping...');
      return;
    }

    console.log('[Sync] Network online, starting sync...');
    this.syncInProgress = true;

    try {
      await this.processPendingOperations();
      this.uiStore.showToast('모든 변경사항이 동기화되었습니다', 'success', 2000);
    } catch (error) {
      console.error('[Sync] Sync error:', error);
      this.uiStore.showToast('일부 변경사항을 동기화할 수 없습니다', 'warning', 3000);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Process all pending sync operations in priority order
   */
  private async processPendingOperations(): Promise<void> {
    const entries = await db.syncQueue
      .where('status')
      .equals('pending')
      .toArray();

    if (entries.length === 0) {
      console.log('[Sync] No pending operations');
      return;
    }

    // Filter entries with required fields and cast to SyncOperation
    const operations = entries.filter(
      (e): e is typeof e & { type: SyncOperation['type']; priority: number } =>
        e.type !== undefined && e.priority !== undefined
    ) as SyncOperation[];

    // Sort by priority (lower number = higher priority)
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

  /**
   * Process a single operation with retries
   */
  private async processSingleOperation(op: SyncOperation): Promise<void> {
    // Mark as syncing
    await db.syncQueue.update(op.id!, { status: 'syncing' });

    try {
      // Execute operation (will use HttpClient with auth interceptor)
      const response = await fetch(op.url, {
        method: op.method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`,
        },
        body: op.method !== 'DELETE' ? JSON.stringify(op.body) : undefined,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Success - remove from queue
      await db.syncQueue.delete(op.id!);
      console.log(`[Sync] ✓ ${op.type} ${op.url}`);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle operation failure with exponential backoff
   */
  private async handleOperationFailure(op: SyncOperation): Promise<void> {
    const retryCount = op.retryCount + 1;

    if (retryCount >= op.maxRetries) {
      // Max retries exceeded - move to dead letter queue
      await db.syncQueue.update(op.id!, {
        status: 'failed',
        lastError: 'Max retries exceeded',
      });

      console.error(
        `[Sync] ✗ Max retries for ${op.type} ${op.url}. Stored for manual review.`
      );

      this.uiStore.showToast(
        `${this.getOperationLabel(op.type)} 동기화 실패. 관리자에 문의하세요.`,
        'danger',
        5000
      );
    } else {
      // Retry with exponential backoff
      const backoffMs = this.RETRY_BACKOFF_MS[Math.min(retryCount - 1, this.RETRY_BACKOFF_MS.length - 1)];

      await db.syncQueue.update(op.id!, {
        retryCount,
        lastError: `Retry ${retryCount}/${op.maxRetries} in ${backoffMs}ms`,
      });

      console.log(
        `[Sync] ⟳ Retrying ${op.type} after ${backoffMs}ms (attempt ${retryCount}/${op.maxRetries})`
      );

      // Schedule retry
      setTimeout(() => {
        if (!this.networkService.isOffline()) {
          this.processPendingOperations();
        }
      }, backoffMs);
    }
  }

  /**
   * Get operations by status (for UI feedback)
   */
  async getPendingOperations(): Promise<SyncOperation[]> {
    const entries = await db.syncQueue
      .where('status')
      .equals('pending')
      .toArray();
    return entries as unknown as SyncOperation[];
  }

  /**
   * Get failed operations (dead letter queue)
   */
  async getFailedOperations(): Promise<SyncOperation[]> {
    const entries = await db.syncQueue
      .where('status')
      .equals('failed')
      .toArray();
    return entries as unknown as SyncOperation[];
  }

  /**
   * Retry failed operation manually
   */
  async retryFailed(id: number): Promise<void> {
    const op = await db.syncQueue.get(id);
    if (!op || !op.type) return;

    await db.syncQueue.update(id, {
      status: 'pending',
      retryCount: 0,
    });

    await this.processSingleOperation(op as SyncOperation);
  }

  /**
   * Clear sync queue (dangerous - use with caution)
   */
  async clearQueue(): Promise<void> {
    await db.syncQueue.clear();
    console.warn('[Sync] Sync queue cleared');
  }

  /**
   * Calculate priority for operation type
   */
  private calculatePriority(type: SyncOperation['type']): number {
    const priorityMap: Record<SyncOperation['type'], number> = {
      completion: 1,
      status_change: 2,
      waste: 3,
      attachment: 4,
      note: 5,
    };
    return priorityMap[type] || 99;
  }

  /**
   * Get human-readable label for operation type
   */
  private getOperationLabel(type: SyncOperation['type']): string {
    const labelMap: Record<SyncOperation['type'], string> = {
      completion: 'SYNC.OPERATION.COMPLETION',
      status_change: 'SYNC.OPERATION.STATUS_CHANGE',
      waste: 'SYNC.OPERATION.WASTE',
      attachment: 'SYNC.OPERATION.ATTACHMENT',
      note: 'SYNC.OPERATION.NOTE',
    };
    return labelMap[type] || type;
  }

  /**
   * Get auth token for sync requests
   */
  private async getAuthToken(): Promise<string> {
    const { Preferences } = await import('@capacitor/preferences');
    const result = await Preferences.get({ key: 'erp_access_token' });
    return result.value || '';
  }

  /**
   * Register for Service Worker sync event
   */
  private registerSyncListener(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SYNC_COMPLETE') {
          console.log('[Sync] Service Worker sync complete');
          this.onNetworkOnline();
        }
      });
    }
  }
}
