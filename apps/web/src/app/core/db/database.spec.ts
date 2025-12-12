import Dexie from 'dexie';
import { db, OfflineOrder, SyncQueueEntry, MetadataCache } from './database';

describe('ERPDatabase', () => {
  // Delete and recreate database once before all tests to reset auto-increment counters
  beforeAll(async () => {
    await db.delete();
    await db.open();
  });

  beforeEach(async () => {
    // Ensure database is open and clear all tables
    if (!db.isOpen()) {
      await db.open();
    }
    // Clear tables but note: auto-increment counters are NOT reset by clear()
    await db.orders.clear();
    await db.syncQueue.clear();
    await db.metadata.clear();
  });

  afterEach(async () => {
    // Clean up after each test
    if (db.isOpen()) {
      await db.orders.clear();
      await db.syncQueue.clear();
      await db.metadata.clear();
    }
  });

  afterAll(async () => {
    // Final cleanup
    if (db.isOpen()) {
      await db.delete();
    }
  });

  describe('Database Schema', () => {
    it('should create database with correct name', () => {
      expect(db.name).toBe('ERPLogistics');
    });

    it('should have orders table defined', () => {
      expect(db.orders).toBeDefined();
      expect(db.orders.name).toBe('orders');
    });

    it('should have syncQueue table defined', () => {
      expect(db.syncQueue).toBeDefined();
      expect(db.syncQueue.name).toBe('syncQueue');
    });

    it('should have metadata table defined', () => {
      expect(db.metadata).toBeDefined();
      expect(db.metadata.name).toBe('metadata');
    });
  });

  describe('Orders Table', () => {
    it('should store and retrieve orders by id', async () => {
      const order: OfflineOrder = {
        id: 'order-123',
        erpOrderNumber: 'ERP-001',
        status: 'ASSIGNED',
        customerName: 'Test Customer',
        branchId: 'branch-001',
        version: 1,
        localUpdatedAt: Date.now(),
      };

      await db.orders.add(order);
      const retrieved = await db.orders.get('order-123');

      expect(retrieved).toEqual(order);
    });

    it('should query orders by status', async () => {
      const orders: OfflineOrder[] = [
        {
          id: 'order-1',
          erpOrderNumber: 'ERP-001',
          status: 'ASSIGNED',
          customerName: 'Customer 1',
          branchId: 'branch-001',
          version: 1,
          localUpdatedAt: Date.now(),
        },
        {
          id: 'order-2',
          erpOrderNumber: 'ERP-002',
          status: 'CONFIRMED',
          customerName: 'Customer 2',
          branchId: 'branch-001',
          version: 1,
          localUpdatedAt: Date.now(),
        },
      ];

      await db.orders.bulkAdd(orders);
      const assignedOrders = await db.orders.where('status').equals('ASSIGNED').toArray();

      expect(assignedOrders.length).toBe(1);
      expect(assignedOrders[0].id).toBe('order-1');
    });

    it('should query orders by branchId', async () => {
      const orders: OfflineOrder[] = [
        {
          id: 'order-1',
          erpOrderNumber: 'ERP-001',
          status: 'ASSIGNED',
          customerName: 'Customer 1',
          branchId: 'branch-001',
          version: 1,
          localUpdatedAt: Date.now(),
        },
        {
          id: 'order-2',
          erpOrderNumber: 'ERP-002',
          status: 'ASSIGNED',
          customerName: 'Customer 2',
          branchId: 'branch-002',
          version: 1,
          localUpdatedAt: Date.now(),
        },
      ];

      await db.orders.bulkAdd(orders);
      const branchOrders = await db.orders.where('branchId').equals('branch-001').toArray();

      expect(branchOrders.length).toBe(1);
      expect(branchOrders[0].id).toBe('order-1');
    });
  });

  describe('SyncQueue Table', () => {
    it('should auto-increment id for sync queue entries', async () => {
      const entry: Omit<SyncQueueEntry, 'id'> = {
        type: 'completion',
        method: 'POST',
        url: '/api/orders/complete',
        body: { orderId: '123' },
        priority: 5,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      };

      const id1 = await db.syncQueue.add(entry as SyncQueueEntry);
      const id2 = await db.syncQueue.add(entry as SyncQueueEntry);

      expect(typeof id1).toBe('number');
      expect(typeof id2).toBe('number');
      // Auto-increment ensures sequential IDs within same session
      // IDs should be sequential (id2 > id1), but starting value depends on DB state
      expect(id2).toBeGreaterThan(id1 as number);
    });

    it('should retrieve sync queue entries ordered by timestamp', async () => {
      const entries: Omit<SyncQueueEntry, 'id'>[] = [
        {
          type: 'completion',
          method: 'POST',
          url: '/api/orders/1/complete',
          body: {},
          priority: 5,
          timestamp: 1000,
          retryCount: 0,
          maxRetries: 3,
          status: 'pending',
        },
        {
          type: 'status_change',
          method: 'PATCH',
          url: '/api/orders/2/status',
          body: {},
          priority: 5,
          timestamp: 500,
          retryCount: 0,
          maxRetries: 3,
          status: 'pending',
        },
      ];

      await db.syncQueue.bulkAdd(entries as SyncQueueEntry[]);
      const retrieved = await db.syncQueue.orderBy('timestamp').toArray();

      expect(retrieved.length).toBe(2);
      expect(retrieved[0].timestamp).toBe(500);
      expect(retrieved[1].timestamp).toBe(1000);
    });
  });

  describe('Metadata Table', () => {
    it('should store and retrieve metadata by key', async () => {
      const metadata: MetadataCache = {
        key: 'last_sync',
        data: { timestamp: Date.now() },
        updatedAt: Date.now(),
      };

      await db.metadata.put(metadata);
      const retrieved = await db.metadata.get('last_sync');

      expect(retrieved).toEqual(metadata);
    });
  });
});
