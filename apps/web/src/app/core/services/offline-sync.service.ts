/**
 * Offline Data Synchronization Service
 * Implements ±3 day policy with Delta Sync
 * Section 5.4 of PRD: Offline Data Sync
 *
 * Features:
 * - Automatic sync on network recovery
 * - Delta sync (only changed data)
 * - Optimistic UI updates
 * - Conflict resolution via optimistic locking
 * - IndexedDB persistence
 */

import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { NetworkService } from './network.service';
import { SyncQueueService } from './sync-queue.service';
import { db } from '../db/database';
import { firstValueFrom } from 'rxjs';

export interface SyncMetadata {
  lastSyncTime: number;
  syncWindowDays: number; // ±3 days
  dataVersion: number;
}

@Injectable({ providedIn: 'root' })
export class OfflineSyncService {
  private http = inject(HttpClient);
  private networkService = inject(NetworkService);
  private syncQueue = inject(SyncQueueService);
  private apiUrl = `${environment.apiUrl}`;

  readonly isSyncing = signal(false);
  readonly syncError = signal<string | null>(null);
  readonly lastSyncTime = signal<number>(0);

  constructor() {
    // Auto-sync when network recovers
    this.networkService.onOnline$.subscribe(() => {
      this.syncData();
    });
  }

  /**
   * Initialize sync metadata for a data type
   */
  async initializeSyncMetadata(dataType: string) {
    const metadata: SyncMetadata = {
      lastSyncTime: Date.now(),
      syncWindowDays: 3,
      dataVersion: 1,
    };

    await db.table('syncMetadata').put(metadata, dataType);
  }

  /**
   * Get metadata for a data type
   */
  async getSyncMetadata(dataType: string): Promise<SyncMetadata | undefined> {
    return db.table('syncMetadata').get(dataType);
  }

  /**
   * Main sync entry point
   * Syncs all pending changes and fetches latest data
   */
  async syncData() {
    if (this.isSyncing()) return;

    this.isSyncing.set(true);
    this.syncError.set(null);

    try {
      // Step 1: Push local changes to server
      await this.pushLocalChanges();

      // Step 2: Pull latest data from server (Delta Sync)
      await this.pullRemoteChanges();

      // Step 3: Process sync queue
      await this.syncQueue.processPendingOperations();

      this.lastSyncTime.set(Date.now());
    } catch (error: any) {
      this.syncError.set(error?.message || 'Sync failed');
    } finally {
      this.isSyncing.set(false);
    }
  }

  /**
   * Push local changes to server
   * Uses version conflict detection
   */
  private async pushLocalChanges() {
    const pendingChanges = await db
      .table('syncQueue')
      .where('synced')
      .equals(0)
      .toArray();

    for (const change of pendingChanges) {
      try {
        await this.pushChange(change);
        await db.table('syncQueue').update(change.id, { synced: 1 });
      } catch (error: any) {
        // Conflict detected - add to conflict resolution queue
        if (error?.status === 409) {
          await db.table('conflictQueue').add({
            id: change.id,
            dataType: change.dataType,
            localVersion: change.version,
            serverVersion: error?.error?.version,
            localData: change.data,
            serverData: error?.error?.data,
            timestamp: Date.now(),
          });
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Push individual change to server
   */
  private async pushChange(change: any) {
    const url = `${this.apiUrl}/${change.dataType}/${change.entityId}`;

    switch (change.operation) {
      case 'CREATE':
        return firstValueFrom(this.http.post(url, change.data));
      case 'UPDATE':
        return firstValueFrom(this.http.put(url, {
          ...change.data,
          version: change.version,
        }));
      case 'DELETE':
        return firstValueFrom(this.http.delete(url));
      default:
        throw new Error(`Unknown operation: ${change.operation}`);
    }
  }

  /**
   * Pull remote changes using Delta Sync
   * Only fetches changed data since last sync
   */
  private async pullRemoteChanges() {
    const dataTypes = ['orders', 'assignments', 'completions', 'notifications'];

    for (const dataType of dataTypes) {
      try {
        const metadata = await this.getSyncMetadata(dataType);
        const lastSync = metadata?.lastSyncTime || 0;

        // Fetch changes since last sync
        const response = await firstValueFrom(
          this.http.get<{
            data: any[];
            timestamp: number;
          }>(`${this.apiUrl}/${dataType}/delta`, {
            params: { since: lastSync.toString() },
          })
        );

        // Merge with local data
        await this.mergeRemoteData(dataType, response.data);

        // Update metadata
        await db.table('syncMetadata').update(dataType, {
          lastSyncTime: response.timestamp,
          dataVersion: (metadata?.dataVersion || 0) + 1,
        });
      } catch (error: any) {
        console.warn(`Failed to sync ${dataType}:`, error);
        // Continue with other data types
      }
    }
  }

  /**
   * Merge remote data with local data
   * Respects local optimistic updates
   */
  private async mergeRemoteData(dataType: string, remoteData: any[]) {
    const table = db.table(dataType);

    for (const remoteItem of remoteData) {
      const localItem = await table.get(remoteItem.id);

      if (!localItem) {
        // New item from server
        await table.add(remoteItem);
      } else if (
        localItem.version !== undefined &&
        remoteItem.version !== undefined
      ) {
        // Version conflict - compare versions
        if (remoteItem.version > localItem.version) {
          // Server is newer - but preserve local edits if pending
          const hasPending = await db
            .table('syncQueue')
            .where({ entityId: remoteItem.id, synced: 0 })
            .count();

          if (!hasPending) {
            // Safe to update
            await table.update(remoteItem.id, remoteItem);
          }
          // Otherwise keep local version until sync completes
        }
      } else {
        // No version info - do simple merge
        await table.update(remoteItem.id, remoteItem);
      }
    }
  }

  /**
   * Resolve conflicts using Operational Transformation
   * User decision on conflict
   */
  async resolveConflict(
    conflictId: string,
    resolution: 'use-local' | 'use-server' | 'merge'
  ) {
    const conflict = await db
      .table('conflictQueue')
      .get(conflictId);

    if (!conflict) return;

    let resolvedData = conflict.localData;

    if (resolution === 'use-server') {
      resolvedData = conflict.serverData;
    } else if (resolution === 'merge') {
      // Simple merge: combine both versions
      resolvedData = { ...conflict.serverData, ...conflict.localData };
    }

    // Re-queue the resolved change
    await db.table('syncQueue').add({
      dataType: conflict.dataType,
      entityId: conflict.id,
      operation: 'UPDATE',
      data: resolvedData,
      version: conflict.serverVersion + 1,
      synced: 0,
      timestamp: Date.now(),
    });

    // Remove from conflict queue
    await db.table('conflictQueue').delete(conflictId);

    // Retry sync
    await this.syncData();
  }

  /**
   * Force sync - useful for critical operations
   */
  async forceSyncNow() {
    await this.syncData();
  }

  /**
   * Check if data is within sync window
   * Returns false if data is older than ±3 days
   */
  async isDataWithinWindow(dataType: string): Promise<boolean> {
    const metadata = await this.getSyncMetadata(dataType);
    if (!metadata) return false;

    const daysSinceSync = (Date.now() - metadata.lastSyncTime) / (1000 * 60 * 60 * 24);
    return daysSinceSync <= metadata.syncWindowDays;
  }

  /**
   * Prefetch data for offline use (±3 days)
   */
  async prefetchDataForOffline(dataType: string, daysBefore = 3, daysAfter = 3) {
    const now = new Date();
    const from = new Date(now.getTime() - daysBefore * 24 * 60 * 60 * 1000);
    const to = new Date(now.getTime() + daysAfter * 24 * 60 * 60 * 1000);

    const response = await firstValueFrom(
      this.http.get<any[]>(`${this.apiUrl}/${dataType}/prefetch`, {
        params: {
          from: from.toISOString(),
          to: to.toISOString(),
        },
      })
    );

    const table = db.table(dataType);
    for (const item of response) {
      await table.put(item);
    }

    await this.initializeSyncMetadata(dataType);
  }
}
