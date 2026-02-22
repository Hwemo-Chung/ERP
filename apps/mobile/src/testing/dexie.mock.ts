/**
 * Mock for Dexie.js IndexedDB
 * Provides in-memory testing for offline storage
 */

import { OfflineOrder, SyncQueueEntry, MetadataCache } from '../app/core/db/database';

// Mock storage
let mockOrders: Map<string, OfflineOrder> = new Map();
let mockSyncQueue: Map<number, SyncQueueEntry> = new Map();
let mockMetadata: Map<string, MetadataCache> = new Map();
let syncQueueIdCounter = 1;

// Generic mock table operations with configurable primary key
const createMockTable = <T, K extends string | number = string | number>(
  storage: Map<K, T>,
  primaryKeyField: keyof T = 'id' as keyof T,
  autoIncrement: boolean = false,
) => {
  let autoIncrementCounter = 1;

  type KeyedItem = Record<string | symbol, unknown>;
  type Comparable = string | number | boolean;

  const getKey = (item: T): K => (item as KeyedItem)[primaryKeyField as string] as K;

  const setKey = (item: T, key: K): void => {
    (item as KeyedItem)[primaryKeyField as string] = key;
  };

  return {
    async toArray(): Promise<T[]> {
      return Array.from(storage.values());
    },

    async get(key: K): Promise<T | undefined> {
      return storage.get(key);
    },

    async put(item: T): Promise<K> {
      let key: K;
      if (autoIncrement && getKey(item) === undefined) {
        key = autoIncrementCounter++ as K;
        setKey(item, key);
      } else {
        key = getKey(item);
      }
      storage.set(key, { ...item });
      return key;
    },

    async add(item: T): Promise<K> {
      let key: K;
      if (autoIncrement && getKey(item) === undefined) {
        key = autoIncrementCounter++ as K;
        setKey(item, key);
      } else {
        key = getKey(item);
      }
      const itemWithKey = { ...item, [primaryKeyField]: key };
      storage.set(key, itemWithKey);
      return key;
    },

    async bulkPut(items: T[]): Promise<number> {
      for (const item of items) {
        let key: K;
        if (autoIncrement && getKey(item) === undefined) {
          key = autoIncrementCounter++ as K;
          setKey(item, key);
        } else {
          key = getKey(item);
        }
        const itemWithKey = { ...item, [primaryKeyField]: key };
        storage.set(key, itemWithKey);
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
      const getField = (item: T): Comparable => (item as Record<string, Comparable>)[field];
      return {
        limit: (n: number) => ({
          toArray: async () => {
            const items = Array.from(storage.values());
            items.sort((a: T, b: T) => {
              const aVal = getField(a);
              const bVal = getField(b);
              if (aVal < bVal) return -1;
              if (aVal > bVal) return 1;
              return 0;
            });
            return items.slice(0, n);
          },
        }),
        toArray: async () => {
          const items = Array.from(storage.values());
          items.sort((a: T, b: T) => {
            const aVal = getField(a);
            const bVal = getField(b);
            if (aVal < bVal) return -1;
            if (aVal > bVal) return 1;
            return 0;
          });
          return items;
        },
      };
    },

    where(field: string) {
      const getField = (item: T): Comparable => (item as Record<string, Comparable>)[field];
      return {
        equals: (value: Comparable) => {
          const filtered = Array.from(storage.values()).filter(
            (item: T) => getField(item) === value,
          );
          return {
            toArray: async () => filtered,
            count: async () => filtered.length,
            first: async () => filtered[0],
            sortBy: async (sortField: string) => {
              const getSortField = (item: T): Comparable =>
                (item as Record<string, Comparable>)[sortField];
              return [...filtered].sort((a: T, b: T) => {
                const aVal = getSortField(a);
                const bVal = getSortField(b);
                if (aVal < bVal) return -1;
                if (aVal > bVal) return 1;
                return 0;
              });
            },
            delete: async () => {
              filtered.forEach((item: T) => {
                const key = getKey(item);
                if (key !== undefined) {
                  storage.delete(key);
                }
              });
              return filtered.length;
            },
          };
        },
        anyOf: (values: Comparable[]) => {
          const filtered = Array.from(storage.values()).filter((item: T) =>
            values.includes(getField(item)),
          );
          return {
            toArray: async () => filtered,
            count: async () => filtered.length,
            delete: async () => {
              filtered.forEach((item: T) => {
                const key = getKey(item);
                if (key !== undefined) {
                  storage.delete(key);
                }
              });
              return filtered.length;
            },
          };
        },
        above: (value: Comparable) => {
          const filtered = Array.from(storage.values()).filter((item: T) => getField(item) > value);
          return {
            toArray: async () => filtered,
            count: async () => filtered.length,
          };
        },
        below: (value: Comparable) => {
          const filtered = Array.from(storage.values()).filter((item: T) => getField(item) < value);
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
    syncQueueTable._resetAutoIncrement();
  },
  resetMetadata: () => {
    mockMetadata.clear();
  },
  resetAll: () => {
    mockOrders.clear();
    mockSyncQueue.clear();
    mockMetadata.clear();
    syncQueueIdCounter = 1;
    syncQueueTable._resetAutoIncrement();
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
