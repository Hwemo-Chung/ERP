import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { firstValueFrom } from 'rxjs';
import { db, SyncQueueEntry } from '@app/core/db/database';

// Re-export for backwards compatibility
export type SyncOperation = SyncQueueEntry;

@Injectable({
  providedIn: 'root',
})
export class SyncQueueService {
  private readonly http = inject(HttpClient);

  private readonly _pendingCount = signal(0);
  private readonly _isSyncing = signal(false);

  readonly pendingCount = this._pendingCount.asReadonly();
  readonly isSyncing = this._isSyncing.asReadonly();

  async enqueue(operation: Partial<SyncQueueEntry> & Pick<SyncQueueEntry, 'method' | 'url' | 'body' | 'timestamp'>): Promise<void> {
    const entry: Omit<SyncQueueEntry, 'id'> = {
      type: operation.type || 'note',
      method: operation.method,
      url: operation.url,
      body: operation.body,
      priority: operation.priority ?? 5,
      timestamp: operation.timestamp,
      retryCount: operation.retryCount ?? 0,
      maxRetries: operation.maxRetries ?? 3,
      status: operation.status || 'pending',
    };
    await db.syncQueue.add(entry);
    await this.updatePendingCount();
  }

  async processQueue(): Promise<void> {
    if (this._isSyncing()) return;

    this._isSyncing.set(true);

    try {
      const operations = await db.syncQueue
        .orderBy('timestamp')
        .limit(10)
        .toArray();

      for (const op of operations) {
        try {
          await this.executeOperation(op);
          if (op.id) {
            await db.syncQueue.delete(op.id);
          }
        } catch (error) {
          // Increment retry count
          if (op.id) {
            const retryCount = (op.retryCount || 0) + 1;
            if (retryCount >= 3) {
              // Move to dead letter queue or log
              console.error('Max retries reached for sync operation:', op);
              await db.syncQueue.delete(op.id);
            } else {
              await db.syncQueue.update(op.id, { retryCount });
            }
          }
        }
      }
    } finally {
      this._isSyncing.set(false);
      await this.updatePendingCount();
    }
  }

  private async executeOperation(op: SyncQueueEntry): Promise<void> {
    const url = op.url.startsWith('http') ? op.url : `${environment.apiUrl}${op.url}`;

    switch (op.method) {
      case 'POST':
        await firstValueFrom(this.http.post(url, op.body));
        break;
      case 'PUT':
        await firstValueFrom(this.http.put(url, op.body));
        break;
      case 'PATCH':
        await firstValueFrom(this.http.patch(url, op.body));
        break;
      case 'DELETE':
        await firstValueFrom(this.http.delete(url));
        break;
    }
  }

  private async updatePendingCount(): Promise<void> {
    const count = await db.syncQueue.count();
    this._pendingCount.set(count);
  }

  async clearQueue(): Promise<void> {
    await db.syncQueue.clear();
    this._pendingCount.set(0);
  }
}
