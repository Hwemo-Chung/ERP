import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { db } from '@core/db/database';
import { NetworkService } from '@core/services/network.service';

export interface Order {
  id: string;
  orderNo: string;
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
  // API returns nested installer object
  installer?: { id: string; name: string; phone?: string };
  branchId: string;
  branchCode?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  // API returns 'lines', frontend uses 'orderLines' - support both
  lines?: OrderLine[];
  orderLines?: OrderLine[];
  // Absence tracking (FR-04)
  absenceRetryCount?: number;
  maxAbsenceRetries?: number;
}

export interface OrderLine {
  id: string;
  productCode?: string;
  productName?: string;
  // API returns itemCode/itemName from Prisma schema
  itemCode?: string;
  itemName?: string;
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
  // Status change fields (FR-04)
  reasonCode?: string;  // Reason code for status change (e.g., absence reason)
  notes?: string;
  appointmentDate?: string;
}

@Injectable({
  providedIn: 'root',
})
export class OrdersService {
  private readonly http = inject(HttpClient);
  private readonly networkService = inject(NetworkService);
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
  }

  async bulkAssign(orderIds: string[], installerId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.apiUrl}/bulk/assign`, { orderIds, installerId })
    );
  }

  private async cacheOrders(orders: Order[]): Promise<void> {
    const offlineOrders = orders.map((order) => ({
      id: order.id,
      orderNo: order.orderNo,
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
      // API returns 'lines', store as 'orderLines' for offline use
      orderLines: order.lines || order.orderLines,
      // Absence tracking (FR-04)
      absenceRetryCount: order.absenceRetryCount,
      maxAbsenceRetries: order.maxAbsenceRetries,
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
          o.orderNo.toLowerCase().includes(search) ||
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
      orderNo: offline.orderNo,
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
      // Absence tracking (FR-04)
      absenceRetryCount: offline.absenceRetryCount,
      maxAbsenceRetries: offline.maxAbsenceRetries,
    };
  }
}
