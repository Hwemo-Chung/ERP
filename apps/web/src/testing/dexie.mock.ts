/**
 * Mock for Dexie.js IndexedDB
 * Provides in-memory testing for offline storage
 */

import type { OfflineOrder, SyncQueueEntry, MetadataCache } from '../app/core/db/database';

// Re-export types so they can be imported from this mock
export type { OfflineOrder, SyncQueueEntry, MetadataCache };

// Mock storage
let mockOrders: Map<string, OfflineOrder> = new Map();
let mockSyncQueue: Map<number, SyncQueueEntry> = new Map();
let mockMetadata: Map<string, MetadataCache> = new Map();
let syncQueueIdCounter = 1;

// Generic mock table operations with configurable primary key
const createMockTable = <T, K extends string | number = string | number>(
  storage: Map<K, T>,
  primaryKeyField: keyof T = 'id' as keyof T,
  autoIncrement: boolean = false
) => {
  let autoIncrementCounter = 1;

  return {
    async toArray(): Promise<T[]> {
      return Array.from(storage.values());
    },

    async get(key: K): Promise<T | undefined> {
      return storage.get(key);
    },

    async put(item: T): Promise<K> {
      let key: K;
      if (autoIncrement && (item as any)[primaryKeyField] === undefined) {
        key = (autoIncrementCounter++) as K;
        (item as any)[primaryKeyField] = key;
      } else {
        key = (item as any)[primaryKeyField] as K;
      }
      storage.set(key, { ...item });
      return key;
    },

    async add(item: T): Promise<K> {
      let key: K;
      if (autoIncrement && (item as any)[primaryKeyField] === undefined) {
        key = (autoIncrementCounter++) as K;
        (item as any)[primaryKeyField] = key;
      } else {
        key = (item as any)[primaryKeyField] as K;
      }
      storage.set(key, { ...item, [primaryKeyField]: key });
      return key;
    },

    async bulkPut(items: T[]): Promise<number> {
      for (const item of items) {
        let key: K;
        if (autoIncrement && (item as any)[primaryKeyField] === undefined) {
          key = (autoIncrementCounter++) as K;
          (item as any)[primaryKeyField] = key;
        } else {
          key = (item as any)[primaryKeyField] as K;
        }
        storage.set(key, { ...item, [primaryKeyField]: key });
      }
      return items.length;
    },

    async update(key: K, changes: Partial<T>): Promise<number> {
      const existing = storage.get(key);
      if (existing) {
        storage.set(key, { ...existing, ...changes });
        return 1;
      }
      return 0;
    },

    async delete(key: K): Promise<void> {
      storage.delete(key);
    },

    async clear(): Promise<void> {
      storage.clear();
      if (autoIncrement) {
        autoIncrementCounter = 1;
      }
    },

    async count(): Promise<number> {
      return storage.size;
    },

    orderBy(field: string) {
      return {
        limit: (n: number) => ({
          toArray: async () => {
            const items = Array.from(storage.values());
            items.sort((a: any, b: any) => {
              if (a[field] < b[field]) return -1;
              if (a[field] > b[field]) return 1;
              return 0;
            });
            return items.slice(0, n);
          },
        }),
        toArray: async () => {
          const items = Array.from(storage.values());
          items.sort((a: any, b: any) => {
            if (a[field] < b[field]) return -1;
            if (a[field] > b[field]) return 1;
            return 0;
          });
          return items;
        },
      };
    },

    where(field: string) {
      return {
        equals: (value: any) => {
          const filtered = Array.from(storage.values()).filter(
            (item: any) => item[field] === value
          );
          return {
            toArray: async () => filtered,
            count: async () => filtered.length,
            first: async () => filtered[0],
            sortBy: async (sortField: string) => {
              return [...filtered].sort((a: any, b: any) => {
                if (a[sortField] < b[sortField]) return -1;
                if (a[sortField] > b[sortField]) return 1;
                return 0;
              });
            },
            delete: async () => {
              filtered.forEach((item: any) => {
                const key = item[primaryKeyField];
                if (key !== undefined) {
                  storage.delete(key as K);
                }
              });
              return filtered.length;
            },
          };
        },
        anyOf: (values: any[]) => {
          const filtered = Array.from(storage.values()).filter((item: any) =>
            values.includes(item[field])
          );
          return {
            toArray: async () => filtered,
            count: async () => filtered.length,
            delete: async () => {
              filtered.forEach((item: any) => {
                const key = item[primaryKeyField];
                if (key !== undefined) {
                  storage.delete(key as K);
                }
              });
              return filtered.length;
            },
          };
        },
        above: (value: any) => {
          const filtered = Array.from(storage.values()).filter(
            (item: any) => item[field] > value
          );
          return {
            toArray: async () => filtered,
            count: async () => filtered.length,
          };
        },
        below: (value: any) => {
          const filtered = Array.from(storage.values()).filter(
            (item: any) => item[field] < value
          );
          return {
            toArray: async () => filtered,
            count: async () => filtered.length,
          };
        },
      };
    },

    // Reset auto-increment counter (for testing)
    _resetAutoIncrement: () => {
      autoIncrementCounter = 1;
    },
  };
};

// Create table instances
const ordersTable = createMockTable<OfflineOrder, string>(mockOrders, 'id', false);
const syncQueueTable = createMockTable<SyncQueueEntry, number>(mockSyncQueue, 'id', true);
const metadataTable = createMockTable<MetadataCache, string>(mockMetadata, 'key', false);

// Mock database
export const db = {
  orders: ordersTable,
  syncQueue: syncQueueTable,
  metadata: metadataTable,
};

// Test helpers
export const __configureDexieMock = {
  resetOrders: () => {
    mockOrders.clear();
  },
  resetSyncQueue: () => {
    mockSyncQueue.clear();
    syncQueueIdCounter = 1;
    (syncQueueTable as any)._resetAutoIncrement();
  },
  resetMetadata: () => {
    mockMetadata.clear();
  },
  resetAll: () => {
    mockOrders.clear();
    mockSyncQueue.clear();
    mockMetadata.clear();
    syncQueueIdCounter = 1;
    (syncQueueTable as any)._resetAutoIncrement();
  },
  getOrders: () => Array.from(mockOrders.values()),
  getSyncQueue: () => Array.from(mockSyncQueue.values()),
  getMetadata: () => Array.from(mockMetadata.values()),
  setOrders: (orders: OfflineOrder[]) => {
    mockOrders.clear();
    orders.forEach((order) => mockOrders.set(order.id, order));
  },
  setSyncQueue: (entries: SyncQueueEntry[]) => {
    mockSyncQueue.clear();
    entries.forEach((entry) => {
      if (entry.id !== undefined) {
        mockSyncQueue.set(entry.id, entry);
      }
    });
  },
};
