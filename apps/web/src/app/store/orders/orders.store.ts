/**
 * NgRx SignalStore for Orders state management
 * Implements fine-grained reactivity per SDD section 10.2
 *
 * Features:
 * - Signal-based reactive state with computed selectors
 * - Optimistic updates for better UX
 * - Offline-first with version conflict detection
 * - Pagination support for low-end devices
 */

import {
  Injectable,
  computed,
  inject,
  signal,
  effect,
} from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { firstValueFrom } from 'rxjs';

import {
  Order,
  OrderStatus,
  OrderFilterOptions,
  OrdersState,
  PaginationInfo,
} from './orders.models';
import { db } from '@app/core/db/database';
import { NetworkService } from '../../core/services/network.service';
import { SyncQueueService } from '../../core/services/sync-queue.service';

/** Address object from API */
interface AddressObject {
  city?: string;
  line1?: string;
  line2?: string;
  postal?: string;
}

/**
 * Format address object to display string
 */
function formatAddress(address: AddressObject | string | undefined | null): string {
  if (!address) return '';
  if (typeof address === 'string') return address;
  const parts = [address.line1, address.line2, address.city].filter(Boolean);
  return parts.join(' ');
}

/**
 * Transform API order data to include customerAddress string
 */
function transformOrder(order: any): Order {
  return {
    ...order,
    customerAddress: formatAddress(order.address),
  };
}

/** Server-side KPI statistics */
interface ServerStats {
  total: number;
  unassigned: number;
  assigned: number;
  confirmed: number;
  released: number;
  dispatched: number;
  completed: number;
  cancelled: number;
  pending: number;
}

interface ExtendedOrdersState extends OrdersState {
  serverStats: ServerStats | null;
}

const initialState: ExtendedOrdersState = {
  orders: [],
  selectedOrder: null,
  filters: {},
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    hasMore: false,
  },
  isLoading: false,
  isLoadingMore: false,
  error: null,
  lastSyncTime: undefined,
  syncStatus: 'idle',
  serverStats: null,
};

/**
 * Orders SignalStore
 * Manages orders state with optimistic updates and offline support
 */
@Injectable({ providedIn: 'root' })
export class OrdersStore extends signalStore(
  withState<ExtendedOrdersState>(initialState),

  withComputed((state) => {
    // Type-safe access to extended state
    const orders = state.orders;
    const filters = state.filters;
    const pagination = state.pagination;
    const serverStats = state.serverStats as ReturnType<typeof signal<ServerStats | null>>;

    return {
      // Computed: filtered orders
      filteredOrders: computed(() => {
        let filtered = orders();

        const f = filters();
        if (f.status?.length) {
          filtered = filtered.filter((o) => f.status!.includes(o.status));
        }
        if (f.branchCode) {
          filtered = filtered.filter((o) => o.branchCode === f.branchCode);
        }
        if (f.installerId) {
          filtered = filtered.filter((o) => o.installerId === f.installerId);
        }
        if (f.appointmentDate) {
          filtered = filtered.filter((o) => o.appointmentDate === f.appointmentDate);
        }
        if (f.customerName) {
          const query = f.customerName.toLowerCase();
          filtered = filtered.filter((o) =>
            o.customerName.toLowerCase().includes(query)
          );
        }

        return filtered;
      }),

      // Computed: grouped by status
      ordersByStatus: computed(() => {
        const groups = new Map<OrderStatus, Order[]>();
        orders().forEach((o) => {
          const status = o.status;
          if (!groups.has(status)) {
            groups.set(status, []);
          }
          groups.get(status)!.push(o);
        });
        return groups;
      }),

      // Computed: KPI metrics (uses serverStats if available, otherwise local count)
      kpiMetrics: computed(() => {
        const stats = serverStats();
        if (stats) {
          return stats;
        }
        // Fallback to local orders count (for offline or before stats load)
        const all = orders();
        return {
          total: all.length,
          pending: all.filter((o) => o.status === OrderStatus.UNASSIGNED).length,
          unassigned: all.filter((o) => o.status === OrderStatus.UNASSIGNED).length,
          assigned: all.filter((o) => o.status === OrderStatus.ASSIGNED).length,
          confirmed: all.filter((o) => o.status === OrderStatus.CONFIRMED).length,
          released: all.filter((o) => o.status === OrderStatus.RELEASED).length,
          dispatched: all.filter((o) => o.status === OrderStatus.DISPATCHED).length,
          completed: all.filter((o) => o.status === OrderStatus.COMPLETED).length,
          cancelled: all.filter((o) => o.status === OrderStatus.CANCELLED).length,
        };
      }),

      // Computed: UI state
      isLoaded: computed(() => pagination().total > 0 || orders().length > 0),
    };
  }),

  withMethods((store, http = inject(HttpClient), networkService = inject(NetworkService), syncQueue = inject(SyncQueueService)) => ({
    /**
     * Load orders from API with pagination
     */
    async loadOrders(branchCode?: string, page = 1, limit = 20): Promise<void> {
      patchState(store, { isLoading: true, error: null });

      try {
        const params = new URLSearchParams();
        if (branchCode) params.append('branchCode', branchCode);
        params.append('page', String(page));
        params.append('limit', String(limit));

        // Note: apiResponseInterceptor unwraps { success, data } -> data
        const response = await firstValueFrom(
          http.get<{
            data: Order[];
            pagination: { total: number; page: number; limit: number };
          }>(`${environment.apiUrl}/orders?${params}`)
        );

        // After interceptor: response = { data: Order[], pagination: {...} }
        // Transform address object to customerAddress string
        const orders = response.data.map(transformOrder);
        const pagination: PaginationInfo = {
          page,
          limit,
          total: response.pagination.total,
          hasMore: page * limit < response.pagination.total,
        };

        // Save to IndexedDB for offline access
        await db.orders.bulkPut(
          orders.map((o) => ({
            ...o,
            localUpdatedAt: Date.now(),
            syncedAt: Date.now(),
          }))
        );

        patchState(store, {
          orders: page === 1 ? orders : [...store.orders(), ...orders],
          pagination,
          isLoading: false,
          lastSyncTime: Date.now(),
          syncStatus: 'idle',
        });
      } catch (error: any) {
        const errorMessage = error?.error?.message || 'Failed to load orders';
        patchState(store, {
          error: errorMessage,
          isLoading: false,
          syncStatus: 'error',
        });

        // Fall back to IndexedDB
        await this.loadOrdersFromCache(branchCode);
      }
    },

    /**
     * Load orders from IndexedDB cache (offline fallback)
     */
    async loadOrdersFromCache(branchCode?: string): Promise<void> {
      try {
        let orders = await db.orders.toArray();

        if (branchCode) {
          orders = orders.filter((o) => o.branchCode === branchCode);
        }

        // Transform cached orders to ensure customerAddress is set
        const transformedOrders = orders.map(transformOrder);
        patchState(store, {
          orders: transformedOrders,
          isLoading: false,
        });
      } catch (error) {
        console.error('Failed to load from cache:', error);
      }
    },

    /**
     * Load order statistics from API (server-side counts)
     * These are the real totals, not affected by pagination
     */
    async loadStats(branchCode?: string): Promise<void> {
      try {
        const params = new URLSearchParams();
        if (branchCode && branchCode !== 'ALL') {
          params.append('branchCode', branchCode);
        }

        const stats = await firstValueFrom(
          http.get<ServerStats>(`${environment.apiUrl}/orders/stats?${params}`)
        );

        patchState(store, { serverStats: stats });
      } catch (error: any) {
        console.warn('[OrdersStore] Failed to load stats:', error);
        // Don't set error state - stats are supplementary to orders list
        // kpiMetrics will fall back to local order count
      }
    },

    /**
     * Load more orders (pagination)
     */
    async loadMoreOrders(branchCode?: string): Promise<void> {
      const pagination = store.pagination();
      if (!pagination.hasMore || store.isLoadingMore()) return;

      patchState(store, { isLoadingMore: true });
      await this.loadOrders(branchCode, pagination.page + 1, pagination.limit);
      patchState(store, { isLoadingMore: false });
    },

    /**
     * Select an order
     */
    selectOrder(orderId: string): void {
      const order = store.orders().find((o) => o.id === orderId);
      patchState(store, { selectedOrder: order || null });
    },

    /**
     * Clear selected order
     */
    clearSelectedOrder(): void {
      patchState(store, { selectedOrder: null });
    },

    /**
     * Update order filters
     */
    setFilters(filters: OrderFilterOptions): void {
      patchState(store, { filters });
    },

    /**
     * Clear filters
     */
    clearFilters(): void {
      patchState(store, { filters: {} });
    },

    /**
     * Optimistic update - assign order to installer
     * Updates local state immediately, syncs in background
     */
    async assignOrder(
      orderId: string,
      installerId: string,
      appointmentDate: string
    ): Promise<void> {
      const order = store.orders().find((o) => o.id === orderId);
      if (!order) return;

      // Optimistic update
      const updatedOrder: Order = {
        ...order,
        installerId,
        appointmentDate,
        status: OrderStatus.ASSIGNED,
        version: order.version + 1,
        updatedAt: Date.now(),
      };

      // Update store immediately
      patchState(store, {
        orders: store.orders().map((o) => (o.id === orderId ? updatedOrder : o)),
      });

      // Save to cache (ensure localUpdatedAt is set)
      await db.orders.put({
        ...updatedOrder,
        localUpdatedAt: updatedOrder.localUpdatedAt || Date.now(),
      });

      // Queue for sync
      const payload = {
        installerId,
        appointmentDate,
        version: order.version,
      };

      if (networkService.isOffline()) {
        // If offline, just queue it
        await syncQueue.enqueue({
          method: 'PATCH',
          url: `/orders/${orderId}`,
          body: payload,
          timestamp: Date.now(),
          retryCount: 0,
        });
      } else {
        // If online, sync immediately and handle conflicts
        try {
          const response = await firstValueFrom(
            http.patch<Order>(`${environment.apiUrl}/orders/${orderId}`, payload)
          );

          // Update with server response (including version)
          const serverOrder: Order = {
            ...response,
            localUpdatedAt: Date.now(),
            syncedAt: Date.now(),
          };

          patchState(store, {
            orders: store.orders().map((o) =>
              o.id === orderId ? serverOrder : o
            ),
          });

          await db.orders.put({
            ...serverOrder,
            localUpdatedAt: serverOrder.localUpdatedAt || Date.now(),
          });
        } catch (error: any) {
          if (error?.status === 409) {
            // Version conflict - revert optimistic update and notify user
            patchState(store, {
              orders: store.orders().map((o) => (o.id === orderId ? order : o)),
              error: 'Order was updated by another user. Please retry.',
            });
            // Reload the order from server
            const fresh = await firstValueFrom(
              http.get<Order>(`${environment.apiUrl}/orders/${orderId}`)
            );
            patchState(store, {
              orders: store.orders().map((o) =>
                o.id === orderId ? fresh : o
              ),
            });
          } else {
            // Other errors - queue for retry
            await syncQueue.enqueue({
              method: 'PATCH',
              url: `/orders/${orderId}`,
              body: payload,
              timestamp: Date.now(),
              retryCount: 0,
            });
          }
        }
      }
    },

    /**
     * Complete order with serial numbers and waste
     */
    async completeOrder(
      orderId: string,
      completionData: {
        lines: Array<{ id: string; serialNumber: string }>;
        waste?: Array<{ code: string; quantity: number }>;
        notes?: string;
      }
    ): Promise<void> {
      const order = store.orders().find((o) => o.id === orderId);
      if (!order) return;

      try {
        const payload = {
          status: OrderStatus.COMPLETED,
          lines: completionData.lines,
          waste: completionData.waste || [],
          notes: completionData.notes,
        };

        // Optimistic update
        const updatedOrder: Order = {
          ...order,
          status: OrderStatus.COMPLETED,
          version: order.version + 1,
          updatedAt: Date.now(),
        };

        patchState(store, {
          orders: store.orders().map((o) => (o.id === orderId ? updatedOrder : o)),
        });

        // Queue for sync (high priority)
        await syncQueue.enqueue({
          method: 'POST',
          url: `/orders/${orderId}/complete`,
          body: payload,
          timestamp: Date.now(),
          retryCount: 0,
        });

        // Save to cache (ensure localUpdatedAt is set)
        await db.orders.put({
          ...updatedOrder,
          localUpdatedAt: updatedOrder.localUpdatedAt || Date.now(),
        });
      } catch (error) {
        console.error('[OrdersStore] Failed to complete order:', error);
        throw error;
      }
    },

    /**
     * Update order status with optional additional data
     * @param orderId - Order ID
     * @param status - New status
     * @param options - Optional parameters (installerId, reasonCode, notes, appointmentDate)
     */
    async updateOrderStatus(
      orderId: string,
      status: OrderStatus,
      options?: string | {
        installerId?: string;
        reasonCode?: string;
        notes?: string;
        appointmentDate?: string;
      }
    ): Promise<void> {
      const order = store.orders().find((o) => o.id === orderId);
      if (!order) return;

      // Handle backward compatibility: if options is a string, treat as installerId
      const opts = typeof options === 'string' ? { installerId: options } : options;

      // Optimistic update
      const updatedOrder: Order = {
        ...order,
        status,
        installerId: opts?.installerId ?? order.installerId,
        // Increment absence retry count when transitioning to ABSENT (FR-04)
        absenceRetryCount: status === OrderStatus.ABSENT
          ? (order.absenceRetryCount || 0) + 1
          : order.absenceRetryCount,
        version: order.version + 1,
        updatedAt: Date.now(),
      };

      patchState(store, {
        orders: store.orders().map((o) => (o.id === orderId ? updatedOrder : o)),
      });

      // Build request body - use expectedVersion for API
      const body: {
        status: OrderStatus;
        expectedVersion: number;
        installerId?: string;
        reasonCode?: string;
        notes?: string;
        appointmentDate?: string;
      } = {
        status,
        expectedVersion: order.version,
      };
      if (opts?.installerId) {
        body.installerId = opts.installerId;
      }
      if (opts?.reasonCode) {
        body.reasonCode = opts.reasonCode;
      }
      if (opts?.notes) {
        body.notes = opts.notes;
      }
      if (opts?.appointmentDate) {
        body.appointmentDate = opts.appointmentDate;
      }

      // Queue for sync
      await syncQueue.enqueue({
        method: 'PATCH',
        url: `/orders/${orderId}`,
        body,
        timestamp: Date.now(),
        retryCount: 0,
      });

      // Save to cache
      await db.orders.put({
        ...updatedOrder,
        localUpdatedAt: Date.now(),
      });
    },

    /**
     * Update serial numbers for order lines
     */
    async updateOrderSerials(
      orderId: string,
      serialUpdates: Array<{ lineId: string; serialNumber: string }>
    ): Promise<void> {
      const order = store.orders().find((o) => o.id === orderId);
      if (!order) return;

      try {
        // Optimistic update
        const updatedOrder: Order = {
          ...order,
          lines: order.lines?.map((line) => {
            const update = serialUpdates.find((s) => s.lineId === line.id);
            return update ? { ...line, serialNumber: update.serialNumber } : line;
          }),
          version: order.version + 1,
          updatedAt: Date.now(),
        };

        patchState(store, {
          orders: store.orders().map((o) => (o.id === orderId ? updatedOrder : o)),
        });

        // Queue for sync
        await syncQueue.enqueue({
          method: 'PATCH',
          url: `/orders/${orderId}/serials`,
          body: { serials: serialUpdates, version: order.version },
          timestamp: Date.now(),
          retryCount: 0,
        });

        // Save to cache
        await db.orders.put({
          ...updatedOrder,
          localUpdatedAt: Date.now(),
        });
      } catch (error) {
        console.error('[OrdersStore] Failed to update order serials:', error);
        throw error;
      }
    },

    /**
     * Update order completion data (photos, notes)
     */
    async updateOrderCompletion(
      orderId: string,
      completionData: {
        photos?: string[];
        notes?: string[];
        completedAt?: string;
      }
    ): Promise<void> {
      const order = store.orders().find((o) => o.id === orderId);
      if (!order) return;

      try {
        // Optimistic update
        const updatedOrder: Order = {
          ...order,
          completion: {
            ...order.completion,
            photos: completionData.photos || order.completion?.photos,
            notes: completionData.notes?.join('\n') || order.completion?.notes,
            completedAt: completionData.completedAt
              ? new Date(completionData.completedAt).getTime()
              : order.completion?.completedAt,
          },
          version: order.version + 1,
          updatedAt: Date.now(),
        };

        patchState(store, {
          orders: store.orders().map((o) => (o.id === orderId ? updatedOrder : o)),
        });

        // Queue for sync
        await syncQueue.enqueue({
          method: 'PATCH',
          url: `/orders/${orderId}/completion`,
          body: {
            photos: completionData.photos,
            notes: completionData.notes,
            version: order.version,
          },
          timestamp: Date.now(),
          retryCount: 0,
        });

        // Save to cache
        await db.orders.put({
          ...updatedOrder,
          localUpdatedAt: Date.now(),
        });
      } catch (error) {
        console.error('[OrdersStore] Failed to update order completion:', error);
        throw error;
      }
    },

    /**
     * Update waste pickup data
     */
    async updateOrderWaste(
      orderId: string,
      wasteData: Array<{ code: string; quantity: number }>
    ): Promise<void> {
      const order = store.orders().find((o) => o.id === orderId);
      if (!order) return;

      try {
        // Optimistic update
        const updatedOrder: Order = {
          ...order,
          completion: {
            ...order.completion,
            waste: wasteData,
          },
          version: order.version + 1,
          updatedAt: Date.now(),
        };

        patchState(store, {
          orders: store.orders().map((o) => (o.id === orderId ? updatedOrder : o)),
        });

        // Queue for sync
        await syncQueue.enqueue({
          method: 'PATCH',
          url: `/orders/${orderId}/waste`,
          body: { waste: wasteData, version: order.version },
          timestamp: Date.now(),
          retryCount: 0,
        });

        // Save to cache
        await db.orders.put({
          ...updatedOrder,
          localUpdatedAt: Date.now(),
        });
      } catch (error) {
        console.error('[OrdersStore] Failed to update order waste:', error);
        throw error;
      }
    },

    /**
     * Issue installation certificate
     */
    async issueCertificate(
      orderId: string,
      signatures: {
        customerSignature: string | null;
        installerSignature: string | null;
      }
    ): Promise<void> {
      const order = store.orders().find((o) => o.id === orderId);
      if (!order) return;

      // Optimistic update
      const updatedOrder: Order = {
        ...order,
        completion: {
          ...order.completion,
          customerSignature: signatures.customerSignature || undefined,
          installerSignature: signatures.installerSignature || undefined,
          certificateIssuedAt: Date.now(),
        },
        version: order.version + 1,
        updatedAt: Date.now(),
      };

      patchState(store, {
        orders: store.orders().map((o) => (o.id === orderId ? updatedOrder : o)),
      });

      // Queue for sync
      await syncQueue.enqueue({
        method: 'POST',
        url: `/orders/${orderId}/certificate`,
        body: {
          customerSignature: signatures.customerSignature,
          installerSignature: signatures.installerSignature,
          version: order.version,
        },
        timestamp: Date.now(),
        retryCount: 0,
      });

      // Save to cache
      await db.orders.put({
        ...updatedOrder,
        localUpdatedAt: Date.now(),
      });
    },

    /**
     * Split order into multiple assignments (FR-10)
     * Creates child tasks inheriting metadata from parent order
     */
    async splitOrder(
      orderId: string,
      splits: Array<{
        lineId: string;
        assignments: Array<{
          installerId: string;
          installerName: string;
          quantity: number;
        }>;
      }>
    ): Promise<{ success: boolean; childOrders?: Order[] }> {
      const order = store.orders().find((o) => o.id === orderId);
      if (!order) return { success: false };

      patchState(store, { isLoading: true, error: null });

      const payload = {
        orderId,
        splits: splits.map(s => ({
          lineId: s.lineId,
          assignments: s.assignments.filter(a => a.quantity > 0).map(a => ({
            installerId: a.installerId || undefined,
            installerName: a.installerName,
            quantity: a.quantity,
          })),
        })),
        version: order.version,
      };

      try {
        const response = await firstValueFrom(
          http.post<{ success: boolean; parentOrder: Order; childOrders: Order[] }>(
            `${environment.apiUrl}/orders/${orderId}/split`,
            payload
          )
        );

        if (response.success) {
          // Update parent order and add child orders to store
          const allOrders = [
            ...store.orders().filter((o) => o.id !== orderId),
            response.parentOrder,
            ...response.childOrders,
          ];

          patchState(store, {
            orders: allOrders,
            isLoading: false,
          });

          // Cache all orders
          await db.orders.bulkPut([
            { ...response.parentOrder, localUpdatedAt: Date.now(), syncedAt: Date.now() },
            ...response.childOrders.map(o => ({
              ...o,
              localUpdatedAt: Date.now(),
              syncedAt: Date.now(),
            })),
          ]);

          return { success: true, childOrders: response.childOrders };
        }

        patchState(store, { isLoading: false });
        return { success: false };
      } catch (error: any) {
        const errorMessage = error?.error?.message || 'Failed to split order';
        patchState(store, {
          error: errorMessage,
          isLoading: false,
        });

        if (error?.status === 409) {
          // Version conflict - reload order
          try {
            const fresh = await firstValueFrom(
              http.get<Order>(`${environment.apiUrl}/orders/${orderId}`)
            );
            patchState(store, {
              orders: store.orders().map((o) => (o.id === orderId ? fresh : o)),
              error: 'Order was updated by another user. Please retry.',
            });
          } catch {
            // Ignore reload error
          }
        }

        return { success: false };
      }
    },

    /**
     * Revert optimistic update (on conflict)
     */
    revertOrder(orderId: string): void {
      // Reload from cache
      db.orders.get(orderId).then((cached) => {
        if (cached) {
          patchState(store, {
            orders: store.orders().map((o) => (o.id === orderId ? (cached as Order) : o)),
          });
        }
      });
    },

    /**
     * Sync all pending orders (called when network comes online)
     */
    async syncPending(): Promise<void> {
      patchState(store, { syncStatus: 'syncing' });

      try {
        await syncQueue.processQueue();
        patchState(store, { syncStatus: 'idle', lastSyncTime: Date.now() });
      } catch (error) {
        patchState(store, { syncStatus: 'error', error: 'Sync failed' });
      }
    },
  }))
) {
  constructor() {
    super();

    // Capture NetworkService in injection context (constructor)
    const networkService = inject(NetworkService);

    // Auto-sync when network comes online
    effect(
      () => {
        const isOffline = networkService.isOffline();
        if (!isOffline) {
          this.syncPending();
        }
      }
    );
  }
}
