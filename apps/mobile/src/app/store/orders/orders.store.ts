import { Injectable, computed, inject, signal, effect } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { firstValueFrom } from 'rxjs';

import { Order, OrderStatus, OrderFilterOptions, PaginationInfo } from './orders.models';
import {
  ServerStats,
  ExtendedOrdersState,
  createInitialOrdersState,
  filterOrders,
  groupOrdersByStatus,
  calculateKpiMetrics,
  transformOrder,
  extractErrorMessage,
  isHttpError,
} from '@erp/shared';
import { db } from '@app/core/db/database';
import { NetworkService } from '../../core/services/network.service';
import { SyncQueueService } from '../../core/services/sync-queue.service';
import { LoggerService } from '../../core/services/logger.service';

const initialState: ExtendedOrdersState = createInitialOrdersState();

@Injectable({ providedIn: 'root' })
export class OrdersStore extends signalStore(
  withState<ExtendedOrdersState>(initialState),

  withComputed((state) => {
    const orders = state.orders;
    const filters = state.filters;
    const pagination = state.pagination;
    const serverStats = state.serverStats as ReturnType<typeof signal<ServerStats | null>>;

    return {
      filteredOrders: computed(() => filterOrders(orders(), filters())),
      ordersByStatus: computed(() => groupOrdersByStatus(orders())),
      kpiMetrics: computed(() => calculateKpiMetrics(orders(), serverStats())),
      isLoaded: computed(() => pagination().total > 0 || orders().length > 0),
    };
  }),

  withMethods(
    (
      store,
      http = inject(HttpClient),
      networkService = inject(NetworkService),
      syncQueue = inject(SyncQueueService),
      logger = inject(LoggerService),
    ) => {
      const findOrder = (orderId: string): Order | undefined =>
        store.orders().find((o) => o.id === orderId);

      const updateOrderInStore = (orderId: string, updates: Partial<Order>) => {
        patchState(store, {
          orders: store
            .orders()
            .map((o) =>
              o.id === orderId
                ? { ...o, ...updates, version: o.version + 1, updatedAt: Date.now() }
                : o,
            ),
        });
      };

      const persistAndEnqueue = async (
        order: Order,
        method: 'POST' | 'PATCH',
        url: string,
        body: Record<string, unknown>,
      ) => {
        await db.orders.put({ ...order, localUpdatedAt: Date.now() });
        await syncQueue.enqueue({ method, url, body });
      };

      return {
        async loadOrders(branchCode?: string, page = 1, limit = 20): Promise<void> {
          patchState(store, { isLoading: true, error: null });

          try {
            const params = new URLSearchParams();
            if (branchCode) params.append('branchCode', branchCode);
            params.append('page', String(page));
            params.append('limit', String(limit));

            const response = await firstValueFrom(
              http.get<{
                data: Order[];
                pagination: { total: number; page: number; limit: number };
              }>(`${environment.apiUrl}/orders?${params}`),
            );

            const orders = response.data.map(transformOrder);
            const pagination: PaginationInfo = {
              page,
              limit,
              total: response.pagination.total,
              hasMore: page * limit < response.pagination.total,
            };

            await db.orders.bulkPut(
              orders.map((o) => ({
                ...o,
                localUpdatedAt: Date.now(),
                syncedAt: Date.now(),
              })),
            );

            patchState(store, {
              orders: page === 1 ? orders : [...store.orders(), ...orders],
              pagination,
              isLoading: false,
              lastSyncTime: Date.now(),
              syncStatus: 'idle',
            });
          } catch (error: unknown) {
            const errorMessage = extractErrorMessage(error) || 'Failed to load orders';
            patchState(store, {
              error: errorMessage,
              isLoading: false,
              syncStatus: 'error',
            });

            await this.loadOrdersFromCache(branchCode);
          }
        },

        async loadOrdersFromCache(branchCode?: string): Promise<void> {
          try {
            let orders = await db.orders.toArray();

            if (branchCode) {
              orders = orders.filter((o) => o.branchCode === branchCode);
            }

            patchState(store, {
              orders: orders.map(transformOrder),
              isLoading: false,
            });
          } catch (error) {
            logger.error('Failed to load from cache:', error);
          }
        },

        async loadStats(branchCode?: string): Promise<void> {
          try {
            const params = new URLSearchParams();
            if (branchCode && branchCode !== 'ALL') {
              params.append('branchCode', branchCode);
            }

            const stats = await firstValueFrom(
              http.get<ServerStats>(`${environment.apiUrl}/orders/stats?${params}`),
            );

            patchState(store, { serverStats: stats });
          } catch (error: unknown) {
            logger.warn('[OrdersStore] Failed to load stats:', error);
          }
        },

        async loadMoreOrders(branchCode?: string): Promise<void> {
          const pagination = store.pagination();
          if (!pagination.hasMore || store.isLoadingMore()) return;

          patchState(store, { isLoadingMore: true });
          await this.loadOrders(branchCode, pagination.page + 1, pagination.limit);
          patchState(store, { isLoadingMore: false });
        },

        selectOrder(orderId: string): void {
          const order = findOrder(orderId);
          patchState(store, { selectedOrder: order || null });
        },

        clearSelectedOrder(): void {
          patchState(store, { selectedOrder: null });
        },

        setFilters(filters: OrderFilterOptions): void {
          patchState(store, { filters });
        },

        clearFilters(): void {
          patchState(store, { filters: {} });
        },

        async assignOrder(
          orderId: string,
          installerId: string,
          appointmentDate: string,
        ): Promise<void> {
          const order = findOrder(orderId);
          if (!order) return;

          const updatedOrder: Order = {
            ...order,
            installerId,
            appointmentDate,
            status: OrderStatus.ASSIGNED,
            version: order.version + 1,
            updatedAt: Date.now(),
          };

          patchState(store, {
            orders: store.orders().map((o) => (o.id === orderId ? updatedOrder : o)),
          });

          await db.orders.put({
            ...updatedOrder,
            localUpdatedAt: updatedOrder.localUpdatedAt || Date.now(),
          });

          const payload = {
            installerId,
            appointmentDate,
            version: order.version,
          };

          if (networkService.isOffline()) {
            await syncQueue.enqueue({
              method: 'PATCH',
              url: `/orders/${orderId}`,
              body: payload,
            });
          } else {
            try {
              const response = await firstValueFrom(
                http.patch<Order>(`${environment.apiUrl}/orders/${orderId}`, payload),
              );

              const serverOrder: Order = {
                ...response,
                localUpdatedAt: Date.now(),
                syncedAt: Date.now(),
              };

              patchState(store, {
                orders: store.orders().map((o) => (o.id === orderId ? serverOrder : o)),
              });

              await db.orders.put({
                ...serverOrder,
                localUpdatedAt: serverOrder.localUpdatedAt || Date.now(),
              });
            } catch (error: unknown) {
              if (isHttpError(error) && error.status === 409) {
                patchState(store, {
                  orders: store.orders().map((o) => (o.id === orderId ? order : o)),
                  error: 'Order was updated by another user. Please retry.',
                });
                const fresh = await firstValueFrom(
                  http.get<Order>(`${environment.apiUrl}/orders/${orderId}`),
                );
                patchState(store, {
                  orders: store.orders().map((o) => (o.id === orderId ? fresh : o)),
                });
              } else {
                await syncQueue.enqueue({
                  method: 'PATCH',
                  url: `/orders/${orderId}`,
                  body: payload,
                });
              }
            }
          }
        },

        async completeOrder(
          orderId: string,
          completionData: {
            lines: Array<{ id: string; serialNumber: string }>;
            waste?: Array<{ code: string; quantity: number }>;
            notes?: string;
          },
        ): Promise<void> {
          const order = findOrder(orderId);
          if (!order) return;

          const updatedOrder: Order = {
            ...order,
            status: OrderStatus.COMPLETED,
            version: order.version + 1,
            updatedAt: Date.now(),
          };

          updateOrderInStore(orderId, { status: OrderStatus.COMPLETED });

          await persistAndEnqueue(updatedOrder, 'POST', `/orders/${orderId}/complete`, {
            status: OrderStatus.COMPLETED,
            lines: completionData.lines,
            waste: completionData.waste || [],
            notes: completionData.notes,
          });
        },

        async updateOrderStatus(
          orderId: string,
          status: OrderStatus,
          options?:
            | string
            | {
                installerId?: string;
                reasonCode?: string;
                notes?: string;
                appointmentDate?: string;
              },
        ): Promise<void> {
          const order = findOrder(orderId);
          if (!order) return;

          const opts = typeof options === 'string' ? { installerId: options } : options;

          const updatedOrder: Order = {
            ...order,
            status,
            installerId: opts?.installerId ?? order.installerId,
            absenceRetryCount:
              status === OrderStatus.ABSENT
                ? (order.absenceRetryCount || 0) + 1
                : order.absenceRetryCount,
            appointmentDate: opts?.appointmentDate ?? order.appointmentDate,
            version: order.version + 1,
            updatedAt: Date.now(),
          };

          patchState(store, {
            orders: store.orders().map((o) => (o.id === orderId ? updatedOrder : o)),
          });

          const body: Record<string, unknown> = {
            status,
            expectedVersion: order.version,
          };

          if (opts?.installerId) body['installerId'] = opts.installerId;
          if (opts?.reasonCode) body['reasonCode'] = opts.reasonCode;
          if (opts?.notes) body['notes'] = opts.notes;
          if (opts?.appointmentDate) body['appointmentDate'] = opts.appointmentDate;

          await persistAndEnqueue(updatedOrder, 'PATCH', `/orders/${orderId}`, body);
        },

        async updateOrderSerials(
          orderId: string,
          serialUpdates: Array<{ lineId: string; serialNumber: string }>,
        ): Promise<void> {
          const order = findOrder(orderId);
          if (!order) return;

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

          await persistAndEnqueue(updatedOrder, 'PATCH', `/orders/${orderId}/serials`, {
            serials: serialUpdates,
            version: order.version,
          });
        },

        async updateOrderWaste(
          orderId: string,
          wasteData: Array<{ code: string; quantity: number }>,
        ): Promise<void> {
          const order = findOrder(orderId);
          if (!order) return;

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

          await persistAndEnqueue(updatedOrder, 'PATCH', `/orders/${orderId}/waste`, {
            waste: wasteData,
            version: order.version,
          });
        },

        async updateOrderCompletion(
          orderId: string,
          completionData: {
            photos?: string[];
            notes?: string[];
            completedAt?: string;
          },
        ): Promise<void> {
          const order = findOrder(orderId);
          if (!order) return;

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

          await persistAndEnqueue(updatedOrder, 'PATCH', `/orders/${orderId}/completion`, {
            photos: completionData.photos,
            notes: completionData.notes,
            version: order.version,
          });
        },

        async issueCertificate(
          orderId: string,
          signatures: {
            customerSignature: string | null;
            installerSignature: string | null;
          },
        ): Promise<void> {
          const order = findOrder(orderId);
          if (!order) return;

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

          await persistAndEnqueue(updatedOrder, 'POST', `/orders/${orderId}/certificate`, {
            customerSignature: signatures.customerSignature,
            installerSignature: signatures.installerSignature,
            version: order.version,
          });
        },

        async splitOrder(
          orderId: string,
          splits: Array<{
            lineId: string;
            assignments: Array<{
              installerId?: string;
              installerName: string;
              quantity: number;
            }>;
          }>,
        ): Promise<{ success: boolean; childOrders?: Order[] }> {
          const order = findOrder(orderId);
          if (!order) {
            return { success: false };
          }

          patchState(store, { isLoading: true, error: null });

          try {
            const payload = {
              orderId,
              splits: splits.map((s) => ({
                lineId: s.lineId,
                assignments: s.assignments
                  .filter((a) => a.quantity > 0)
                  .map((a) => ({
                    installerId: a.installerId || undefined,
                    installerName: a.installerName,
                    quantity: a.quantity,
                  })),
              })),
              version: order.version,
            };

            const response = await firstValueFrom(
              http.post<{
                success: boolean;
                parentOrder: Order;
                childOrders: Order[];
              }>(`${environment.apiUrl}/orders/${orderId}/split`, payload),
            );

            if (response.success) {
              const allOrders = [
                ...store.orders().filter((o) => o.id !== orderId),
                response.parentOrder,
                ...response.childOrders,
              ];

              patchState(store, {
                orders: allOrders,
                isLoading: false,
              });

              await db.orders.bulkPut([
                { ...response.parentOrder, localUpdatedAt: Date.now(), syncedAt: Date.now() },
                ...response.childOrders.map((o) => ({
                  ...o,
                  localUpdatedAt: Date.now(),
                  syncedAt: Date.now(),
                })),
              ]);

              return { success: true, childOrders: response.childOrders };
            }

            patchState(store, { isLoading: false });
            return { success: false };
          } catch (error: unknown) {
            const errorMessage = extractErrorMessage(error) || 'Failed to split order';
            patchState(store, {
              error: errorMessage,
              isLoading: false,
            });

            if (isHttpError(error) && error.status === 409) {
              try {
                const fresh = await firstValueFrom(
                  http.get<Order>(`${environment.apiUrl}/orders/${orderId}`),
                );
                patchState(store, {
                  orders: store.orders().map((o) => (o.id === orderId ? fresh : o)),
                  error: 'Order was updated by another user. Please retry.',
                });
              } catch {
                // Intentionally ignored - reload failure is not critical
              }
            }

            return { success: false };
          }
        },

        revertOrder(orderId: string): void {
          db.orders.get(orderId).then((cached) => {
            if (cached) {
              patchState(store, {
                orders: store.orders().map((o) => (o.id === orderId ? (cached as Order) : o)),
              });
            }
          });
        },

        async syncPending(): Promise<void> {
          patchState(store, { syncStatus: 'syncing' });

          try {
            await syncQueue.processQueue();
            patchState(store, { syncStatus: 'idle', lastSyncTime: Date.now() });
          } catch (error) {
            patchState(store, { syncStatus: 'error', error: 'Sync failed' });
          }
        },
      };
    },
  ),
) {
  constructor() {
    super();

    const networkService = inject(NetworkService);

    effect(() => {
      const isOffline = networkService.isOffline();
      if (!isOffline) {
        this.syncPending();
      }
    });
  }
}
