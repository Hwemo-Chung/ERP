/**
 * Database Tests
 * Tests for Dexie.js IndexedDB wrapper
 * Uses mock in test environment via tsconfig.spec.json path mapping
 */

import { db, __configureDexieMock } from '@app/core/db/database';
import { OfflineOrder, SyncQueueEntry } from './database';

describe('ERPDatabase', () => {
  beforeEach(() => {
    // Reset mock state before each test
    __configureDexieMock.resetAll();
  });

  describe('orders table', () => {
    it('should add an order', async () => {
      const order: OfflineOrder = {
        id: 'order-1',
        erpOrderNumber: 'ERP-001',
        status: 'ASSIGNED',
        customerName: 'Test Customer',
        branchId: 'branch-1',
        version: 1,
        localUpdatedAt: Date.now(),
      };

      const id = await db.orders.add(order);
      expect(id).toBe('order-1');

      const retrieved = await db.orders.get('order-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.erpOrderNumber).toBe('ERP-001');
      expect(retrieved?.customerName).toBe('Test Customer');
    });

    it('should update an order', async () => {
      const order: OfflineOrder = {
        id: 'order-2',
        erpOrderNumber: 'ERP-002',
        status: 'ASSIGNED',
        customerName: 'Original Name',
        branchId: 'branch-1',
        version: 1,
        localUpdatedAt: Date.now(),
      };

      await db.orders.add(order);
      await db.orders.update('order-2', { customerName: 'Updated Name', version: 2 });

      const updated = await db.orders.get('order-2');
      expect(updated?.customerName).toBe('Updated Name');
      expect(updated?.version).toBe(2);
    });

    it('should delete an order', async () => {
      const order: OfflineOrder = {
        id: 'order-3',
        erpOrderNumber: 'ERP-003',
        status: 'ASSIGNED',
        customerName: 'Delete Me',
        branchId: 'branch-1',
        version: 1,
        localUpdatedAt: Date.now(),
      };

      await db.orders.add(order);
      await db.orders.delete('order-3');

      const deleted = await db.orders.get('order-3');
      expect(deleted).toBeUndefined();
    });

    it('should query orders by status', async () => {
      const orders: OfflineOrder[] = [
        {
          id: 'order-4',
          erpOrderNumber: 'ERP-004',
          status: 'ASSIGNED',
          customerName: 'Customer 4',
          branchId: 'branch-1',
          version: 1,
          localUpdatedAt: Date.now(),
        },
        {
          id: 'order-5',
          erpOrderNumber: 'ERP-005',
          status: 'COMPLETED',
          customerName: 'Customer 5',
          branchId: 'branch-1',
          version: 1,
          localUpdatedAt: Date.now(),
        },
        {
          id: 'order-6',
          erpOrderNumber: 'ERP-006',
          status: 'ASSIGNED',
          customerName: 'Customer 6',
          branchId: 'branch-1',
          version: 1,
          localUpdatedAt: Date.now(),
        },
      ];

      for (const order of orders) {
        await db.orders.add(order);
      }

      const assignedOrders = await db.orders.where('status').equals('ASSIGNED').toArray();
      expect(assignedOrders.length).toBe(2);
      expect(assignedOrders.every(o => o.status === 'ASSIGNED')).toBe(true);
    });

    it('should count orders', async () => {
      const orders: OfflineOrder[] = [
        {
          id: 'order-7',
          erpOrderNumber: 'ERP-007',
          status: 'ASSIGNED',
          customerName: 'Customer 7',
          branchId: 'branch-1',
          version: 1,
          localUpdatedAt: Date.now(),
        },
        {
          id: 'order-8',
          erpOrderNumber: 'ERP-008',
          status: 'ASSIGNED',
          customerName: 'Customer 8',
          branchId: 'branch-1',
          version: 1,
          localUpdatedAt: Date.now(),
        },
      ];

      for (const order of orders) {
        await db.orders.add(order);
      }

      const count = await db.orders.count();
      expect(count).toBe(2);
    });
  });

  describe('syncQueue table', () => {
    it('should add a sync queue entry with auto-increment id', async () => {
      const entry: SyncQueueEntry = {
        method: 'POST',
        url: '/orders',
        body: { test: 'data' },
        timestamp: Date.now(),
        retryCount: 0,
        status: 'PENDING',
      };

      const id = await db.syncQueue.add(entry);
      expect(id).toBeDefined();
      expect(typeof id).toBe('number');

      const retrieved = await db.syncQueue.get(id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.method).toBe('POST');
      expect(retrieved?.url).toBe('/orders');
    });

    it('should update a sync queue entry', async () => {
      const entry: SyncQueueEntry = {
        method: 'PUT',
        url: '/orders/1',
        body: { status: 'COMPLETED' },
        timestamp: Date.now(),
        retryCount: 0,
        status: 'PENDING',
      };

      const id = await db.syncQueue.add(entry);
      await db.syncQueue.update(id, { status: 'IN_PROGRESS', retryCount: 1 });

      const updated = await db.syncQueue.get(id);
      expect(updated?.status).toBe('IN_PROGRESS');
      expect(updated?.retryCount).toBe(1);
    });

    it('should delete a sync queue entry', async () => {
      const entry: SyncQueueEntry = {
        method: 'DELETE',
        url: '/orders/1',
        body: null,
        timestamp: Date.now(),
        retryCount: 0,
        status: 'PENDING',
      };

      const id = await db.syncQueue.add(entry);
      await db.syncQueue.delete(id);

      const deleted = await db.syncQueue.get(id);
      expect(deleted).toBeUndefined();
    });

    it('should query sync queue by status', async () => {
      const entries: SyncQueueEntry[] = [
        {
          method: 'POST',
          url: '/orders/1',
          body: {},
          timestamp: Date.now(),
          retryCount: 0,
          status: 'PENDING',
        },
        {
          method: 'POST',
          url: '/orders/2',
          body: {},
          timestamp: Date.now(),
          retryCount: 0,
          status: 'COMPLETED',
        },
        {
          method: 'POST',
          url: '/orders/3',
          body: {},
          timestamp: Date.now(),
          retryCount: 0,
          status: 'PENDING',
        },
      ];

      for (const entry of entries) {
        await db.syncQueue.add(entry);
      }

      const pendingEntries = await db.syncQueue
        .where('status')
        .equals('PENDING')
        .toArray();

      expect(pendingEntries.length).toBe(2);
      expect(pendingEntries.every(e => e.status === 'PENDING')).toBe(true);
    });

    it('should count sync queue entries by status', async () => {
      const entries: SyncQueueEntry[] = [
        {
          method: 'POST',
          url: '/orders/1',
          body: {},
          timestamp: Date.now(),
          retryCount: 0,
          status: 'PENDING',
        },
        {
          method: 'POST',
          url: '/orders/2',
          body: {},
          timestamp: Date.now(),
          retryCount: 0,
          status: 'PENDING',
        },
        {
          method: 'POST',
          url: '/orders/3',
          body: {},
          timestamp: Date.now(),
          retryCount: 0,
          status: 'FAILED',
        },
      ];

      for (const entry of entries) {
        await db.syncQueue.add(entry);
      }

      const pendingCount = await db.syncQueue
        .where('status')
        .equals('PENDING')
        .count();

      expect(pendingCount).toBe(2);
    });
  });

  describe('metadata table', () => {
    it('should store and retrieve metadata', async () => {
      const metadata = {
        key: 'last_sync',
        data: { timestamp: Date.now(), status: 'success' },
        updatedAt: Date.now(),
      };

      await db.metadata.add(metadata);

      const retrieved = await db.metadata.get('last_sync');
      expect(retrieved).toBeDefined();
      expect(retrieved?.key).toBe('last_sync');
    });

    it('should update metadata', async () => {
      const metadata = {
        key: 'app_settings',
        data: { theme: 'light' },
        updatedAt: Date.now(),
      };

      await db.metadata.add(metadata);
      await db.metadata.update('app_settings', {
        data: { theme: 'dark' },
        updatedAt: Date.now(),
      });

      const updated = await db.metadata.get('app_settings');
      expect((updated?.data as any).theme).toBe('dark');
    });
  });
});
