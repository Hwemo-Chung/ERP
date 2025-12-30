import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { environment } from '@env/environment';
import { db } from '@core/db/database';
import { NetworkService } from '@core/services/network.service';
import { ConflictResolverService } from '../../../shared/services/conflict-resolver.service';

export interface Order {
  id: string;
  erpOrderNumber: string;
  status: string;
  appointmentDate?: string;
  appointmentSlot?: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  customerZipCode?: string;
  customerMemo?: string;
  installerId?: string;
  installerName?: string;
  branchId: string;
  branchCode?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  orderLines?: OrderLine[];
}

export interface OrderLine {
  id: string;
  productCode: string;
  productName: string;
  quantity: number;
  serialNumber?: string;
}

export interface OrderListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string[];
  branchCode?: string;
  installerId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UpdateStatusDto {
  status: string;
  version: number;
  memo?: string;
}

@Injectable({
  providedIn: 'root',
})
export class OrdersService {
  private readonly http = inject(HttpClient);
  private readonly networkService = inject(NetworkService);
  private readonly conflictResolver = inject(ConflictResolverService);
  private readonly translate = inject(TranslateService);
  private readonly apiUrl = `${environment.apiUrl}/orders`;

  async getOrders(params: OrderListParams): Promise<PaginatedResponse<Order>> {
    // If offline, get from IndexedDB
    if (this.networkService.isOffline()) {
      return this.getOrdersOffline(params);
    }

    // Build query params
    let httpParams = new HttpParams()
      .set('page', (params.page || 1).toString())
      .set('limit', (params.limit || 20).toString());

    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.branchCode) httpParams = httpParams.set('branchCode', params.branchCode);
    if (params.installerId) httpParams = httpParams.set('installerId', params.installerId);
    if (params.dateFrom) httpParams = httpParams.set('dateFrom', params.dateFrom);
    if (params.dateTo) httpParams = httpParams.set('dateTo', params.dateTo);
    if (params.status?.length) {
      params.status.forEach((s) => {
        httpParams = httpParams.append('status', s);
      });
    }

    const result = await firstValueFrom(
      this.http.get<PaginatedResponse<Order>>(this.apiUrl, { params: httpParams })
    );

    // Cache to IndexedDB for offline use
    await this.cacheOrders(result.items);

    return result;
  }

  async getOrder(id: string): Promise<Order | null> {
    // If offline, get from IndexedDB
    if (this.networkService.isOffline()) {
      const cached = await db.orders.get(id);
      return cached ? this.mapOfflineOrder(cached) : null;
    }

    const order = await firstValueFrom(
      this.http.get<Order>(`${this.apiUrl}/${id}`)
    );

    // Cache to IndexedDB
    if (order) {
      await this.cacheOrders([order]);
    }

    return order;
  }

  async updateStatus(id: string, dto: UpdateStatusDto): Promise<Order> {
    try {
      const result = await firstValueFrom(
        this.http.patch<Order>(`${this.apiUrl}/${id}/status`, dto)
      );

      // Update cache
      await db.orders.update(id, {
        status: result.status,
        version: result.version,
        localUpdatedAt: Date.now(),
        syncedAt: Date.now(),
      });

      return result;
    } catch (error) {
      // FR-17: Handle version conflict (409 Conflict)
      if (error instanceof HttpErrorResponse && error.status === 409) {
        const serverOrder = error.error?.data as Order;
        const localOrder = await this.getOrder(id);
        
        if (serverOrder && localOrder) {
          const resolution = await this.conflictResolver.resolveConflict(
            this.translate.instant('CONFLICT.ENTITY.ORDER'),
            { ...localOrder, updatedAt: new Date(localOrder.updatedAt) },
            { ...serverOrder, updatedAt: new Date(serverOrder.updatedAt) },
            {
              status: this.translate.instant('CONFLICT.FIELD.STATUS'),
              appointmentDate: this.translate.instant('CONFLICT.FIELD.APPOINTMENT_DATE'),
              appointmentSlot: this.translate.instant('CONFLICT.FIELD.APPOINTMENT_SLOT'),
              customerMemo: this.translate.instant('CONFLICT.FIELD.MEMO'),
            }
          );

          if (resolution === 'overwrite') {
            // Force update with new version
            return this.updateStatus(id, {
              ...dto,
              version: serverOrder.version,
            });
          } else if (resolution === 'refresh') {
            // Return server data
            return serverOrder;
          }
          
          // Cancel - throw to let caller handle
          throw new Error(this.translate.instant('CONFLICT.CANCELLED'));
        }
      }
      throw error;
    }
  }

  async bulkAssign(orderIds: string[], installerId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.apiUrl}/bulk/assign`, { orderIds, installerId })
    );
  }

  private async cacheOrders(orders: Order[]): Promise<void> {
    const offlineOrders = orders.map((order) => ({
      id: order.id,
      erpOrderNumber: order.erpOrderNumber,
      status: order.status,
      appointmentDate: order.appointmentDate,
      appointmentSlot: order.appointmentSlot,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerAddress: order.customerAddress,
      installerId: order.installerId,
      branchId: order.branchId,
      version: order.version,
      localUpdatedAt: Date.now(),
      syncedAt: Date.now(),
      orderLines: order.orderLines,
    }));

    await db.orders.bulkPut(offlineOrders);
  }

  private async getOrdersOffline(params: OrderListParams): Promise<PaginatedResponse<Order>> {
    let query = db.orders.orderBy('appointmentDate');

    // Apply filters
    const allOrders = await query.toArray();
    let filtered = allOrders;

    if (params.search) {
      const search = params.search.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.erpOrderNumber.toLowerCase().includes(search) ||
          o.customerName.toLowerCase().includes(search)
      );
    }

    if (params.status?.length) {
      filtered = filtered.filter((o) => params.status!.includes(o.status));
    }

    if (params.dateFrom) {
      filtered = filtered.filter((o) => o.appointmentDate && o.appointmentDate >= params.dateFrom!);
    }

    if (params.dateTo) {
      filtered = filtered.filter((o) => o.appointmentDate && o.appointmentDate <= params.dateTo!);
    }

    // Pagination
    const page = params.page || 1;
    const limit = params.limit || 20;
    const start = (page - 1) * limit;
    const paged = filtered.slice(start, start + limit);

    return {
      items: paged.map(this.mapOfflineOrder),
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit),
    };
  }

  private mapOfflineOrder(offline: any): Order {
    return {
      id: offline.id,
      erpOrderNumber: offline.erpOrderNumber,
      status: offline.status,
      appointmentDate: offline.appointmentDate,
      appointmentSlot: offline.appointmentSlot,
      customerName: offline.customerName,
      customerPhone: offline.customerPhone,
      customerAddress: offline.customerAddress,
      branchId: offline.branchId,
      installerId: offline.installerId,
      version: offline.version,
      createdAt: '',
      updatedAt: '',
      orderLines: offline.orderLines,
    };
  }
}
