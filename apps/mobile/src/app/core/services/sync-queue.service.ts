import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ModalController } from '@ionic/angular/standalone';
import { environment } from '@env/environment';
import { firstValueFrom } from 'rxjs';
import { db } from '@app/core/db/database';
import {
  SyncConflictModal,
  ConflictData,
} from '../../shared/components/sync-conflict/sync-conflict.modal';
import { SyncOperationStatus, SyncOperation, DEFAULT_SYNC_CONFIG, chunk } from '@erp/shared';
import { LoggerService } from './logger.service';

@Injectable({
  providedIn: 'root',
})
export class SyncQueueService {
  private readonly http = inject(HttpClient);
  private readonly modalCtrl = inject(ModalController);
  private readonly logger = inject(LoggerService);

  // State signals
  private readonly _pendingCount = signal(0);
  private readonly _conflictCount = signal(0);
  private readonly _isSyncing = signal(false);
  private readonly _lastSyncTime = signal<Date | null>(null);
  private readonly _lastError = signal<string | null>(null);

  // Public readonly signals
  readonly pendingCount = this._pendingCount.asReadonly();
  readonly conflictCount = this._conflictCount.asReadonly();
  readonly isSyncing = this._isSyncing.asReadonly();
  readonly lastSyncTime = this._lastSyncTime.asReadonly();
  readonly lastError = this._lastError.asReadonly();

  /**
   * Enqueue an operation for offline sync
   */
  async enqueue(operation: Omit<SyncOperation, 'id' | 'timestamp'>): Promise<void> {
    await db.syncQueue.add({
      ...operation,
      timestamp: Date.now(),
      retryCount: 0,
      status: SyncOperationStatus.PENDING,
    });
    await this.updateCounts();
  }

  /**
   * Process all pending operations in the queue
   */
  async processQueue(): Promise<void> {
    if (this._isSyncing()) return;

    this._isSyncing.set(true);
    this._lastError.set(null);

    try {
      const entries = await db.syncQueue
        .where('status')
        .equals(SyncOperationStatus.PENDING)
        .sortBy('timestamp');

      // Cast to SyncOperation[] for processing
      const operations = entries as unknown as SyncOperation[];

      // Process in batches
      const batches = chunk(operations, DEFAULT_SYNC_CONFIG.batchSize);

      for (const batch of batches) {
        await Promise.all(batch.map((op) => this.processOperation(op)));
      }

      this._lastSyncTime.set(new Date());
    } catch (error) {
      this.logger.error('Sync queue processing failed:', error);
      this._lastError.set('동기화 처리 중 오류가 발생했습니다');
    } finally {
      this._isSyncing.set(false);
      await this.updateCounts();
    }
  }

  /**
   * Process a single sync operation
   */
  private async processOperation(op: SyncOperation): Promise<void> {
    if (!op.id) return;

    try {
      // Mark as in progress
      await db.syncQueue.update(op.id, {
        status: SyncOperationStatus.IN_PROGRESS,
      });

      await this.executeOperation(op);

      // Success - remove from queue
      await db.syncQueue.delete(op.id);
    } catch (error) {
      await this.handleOperationError(op, error);
    }
  }

  /**
   * Execute HTTP request for operation
   */
  private async executeOperation(op: SyncOperation): Promise<unknown> {
    const url = op.url.startsWith('http') ? op.url : `${environment.apiUrl}${op.url}`;

    switch (op.method) {
      case 'POST':
        return firstValueFrom(this.http.post(url, op.body));
      case 'PUT':
        return firstValueFrom(this.http.put(url, op.body));
      case 'PATCH':
        return firstValueFrom(this.http.patch(url, op.body));
      case 'DELETE':
        return firstValueFrom(this.http.delete(url));
    }
  }

  /**
   * Handle operation error with conflict detection
   */
  private async handleOperationError(op: SyncOperation, error: unknown): Promise<void> {
    if (!op.id) return;

    const httpError = error as HttpErrorResponse;
    const retryCount = (op.retryCount || 0) + 1;

    // Check for version conflict (409)
    if (httpError.status === 409) {
      const serverData = httpError.error?.currentState || {};
      const conflictData: ConflictData = {
        entityType: op.entityType || 'order',
        entityId: op.entityId || '',
        serverVersion: httpError.error?.currentVersion || 0,
        localVersion: ((op.body as Record<string, unknown>)?.['version'] as number) || 0,
        serverData,
        localData: op.body as Record<string, unknown>,
        timestamp: Date.now(),
      };

      await db.syncQueue.update(op.id, {
        status: SyncOperationStatus.CONFLICT,
        conflictData,
      });

      // Show conflict resolution modal
      await this.showConflictModal(op.id, conflictData);
      return;
    }

    // Check max retries
    if (retryCount >= DEFAULT_SYNC_CONFIG.maxRetries) {
      this.logger.error('Max retries reached for sync operation:', op);
      await db.syncQueue.update(op.id, {
        status: SyncOperationStatus.FAILED,
        retryCount,
      });
      return;
    }

    // Update retry count and keep pending for retry
    await db.syncQueue.update(op.id, {
      status: SyncOperationStatus.PENDING,
      retryCount,
    });
  }

  /**
   * Show conflict resolution modal
   */
  private async showConflictModal(operationId: number, conflictData: ConflictData): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: SyncConflictModal,
      componentProps: { conflictData },
      backdropDismiss: false,
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();

    if (data?.resolved && data?.mergedData) {
      // Update operation with merged data and retry
      await db.syncQueue.update(operationId, {
        body: data.mergedData,
        status: SyncOperationStatus.PENDING,
        retryCount: 0,
        conflictData: undefined,
      });

      // Log conflict resolution
      this.logger.log('Conflict resolved:', {
        operationId,
        resolutionSummary: data.resolutionSummary,
      });

      // Retry immediately
      await this.processQueue();
    }
  }

  /**
   * Get all conflicts for display
   */
  async getConflicts(): Promise<SyncOperation[]> {
    const entries = await db.syncQueue
      .where('status')
      .equals(SyncOperationStatus.CONFLICT)
      .toArray();
    return entries as unknown as SyncOperation[];
  }

  /**
   * Resolve a specific conflict manually
   */
  async resolveConflict(operationId: number): Promise<void> {
    const operation = await db.syncQueue.get(operationId);
    if (operation?.conflictData) {
      await this.showConflictModal(operationId, operation.conflictData as ConflictData);
    }
  }

  /**
   * Clear all completed and failed operations
   */
  async clearCompleted(): Promise<void> {
    await db.syncQueue
      .where('status')
      .anyOf([SyncOperationStatus.COMPLETED, SyncOperationStatus.FAILED])
      .delete();
    await this.updateCounts();
  }

  /**
   * Clear entire queue (use with caution)
   */
  async clearQueue(): Promise<void> {
    await db.syncQueue.clear();
    this._pendingCount.set(0);
    this._conflictCount.set(0);
  }

  /**
   * Update pending and conflict counts
   */
  private async updateCounts(): Promise<void> {
    const [pendingCount, conflictCount] = await Promise.all([
      db.syncQueue.where('status').equals(SyncOperationStatus.PENDING).count(),
      db.syncQueue.where('status').equals(SyncOperationStatus.CONFLICT).count(),
    ]);

    this._pendingCount.set(pendingCount);
    this._conflictCount.set(conflictCount);
  }

  async initialize(): Promise<void> {
    await this.updateCounts();
  }
}
