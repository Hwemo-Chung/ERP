import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Order } from '@erp/shared';
import { BaseReportsService } from '@erp/shared';
import type { ProgressReport, CustomerRecord, UnreturnedItemsResponse } from '@erp/shared';

export type {
  KpiSummary,
  ProgressItem,
  ProgressReport,
  ProgressDataItem,
  CustomerRecord,
  CustomerOrder,
  WasteStat,
  WasteSummary,
  ExportRequest,
  ExportResult,
  BranchOption,
  UnreturnedItem,
  UnreturnedSummary,
  UnreturnedItemsResponse,
} from '@erp/shared';

@Injectable({ providedIn: 'root' })
export class ReportsService extends BaseReportsService {
  override getProgress(options: {
    groupBy: 'branch' | 'installer' | 'status' | 'date';
    branchCode?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Observable<ProgressReport> {
    let params = new HttpParams().set('groupBy', options.groupBy);
    if (options.branchCode) params = params.set('branchCode', options.branchCode);
    if (options.dateFrom) params = params.set('dateFrom', options.dateFrom);
    if (options.dateTo) params = params.set('dateTo', options.dateTo);

    return this.http.get<ProgressReport>(`${this.baseUrl}/progress`, { params });
  }

  override getCustomerDetail(customerId: string): Observable<CustomerRecord & { orders: Order[] }> {
    return this.http.get<CustomerRecord & { orders: Order[] }>(
      `${this.baseUrl}/customers/${customerId}`,
    );
  }

  override getUnreturnedItems(options: {
    branchCode?: string;
    dateFrom?: string;
    dateTo?: string;
    returnStatus?: 'all' | 'returned' | 'unreturned';
  }): Observable<UnreturnedItemsResponse> {
    let params = new HttpParams();
    if (options.branchCode) params = params.set('branchCode', options.branchCode);
    if (options.dateFrom) params = params.set('dateFrom', options.dateFrom);
    if (options.dateTo) params = params.set('dateTo', options.dateTo);

    return this.http.get<UnreturnedItemsResponse>(`${this.baseUrl}/unreturned`, { params });
  }

  override markItemAsReturned(orderId: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.baseUrl}/unreturned/${orderId}/return`, {});
  }
}
