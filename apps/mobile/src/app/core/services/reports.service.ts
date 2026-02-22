import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { LoggerService } from './logger.service';
import { inject } from '@angular/core';
import { BaseReportsService } from '@erp/shared';
import type {
  ProgressReport,
  ProgressDataItem,
  KpiSummary,
  ProgressItem,
  CustomerRecord,
  CustomerOrder,
  UnreturnedItemsResponse,
} from '@erp/shared';

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
  private readonly logger = inject(LoggerService);

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

    return this.http.get<ProgressDataItem[]>(`${this.baseUrl}/progress`, { params }).pipe(
      map((data) => {
        this.logger.log('[ReportsService] Raw API data:', {
          type: typeof data,
          isArray: Array.isArray(data),
          length: Array.isArray(data) ? data.length : 'N/A',
          first3: Array.isArray(data) ? data.slice(0, 3) : data,
        });
        return this.transformProgressData(data || [], options.groupBy);
      }),
    );
  }

  private transformProgressData(
    data: ProgressDataItem[],
    _groupBy: 'branch' | 'installer' | 'status' | 'date',
  ): ProgressReport {
    const items: ProgressItem[] = data.map((item) => ({
      id: item.key || '',
      name: item.name || item.key || 'Unknown',
      total: item.total || 0,
      completed: item.completed || 0,
      pending: item.pending || 0,
      rate: item.completionRate || 0,
    }));

    const summary: KpiSummary = {
      total: items.reduce((sum, i) => sum + i.total, 0),
      completed: items.reduce((sum, i) => sum + i.completed, 0),
      pending: items.reduce((sum, i) => sum + i.pending, 0),
      inProgress: 0,
      cancelled: 0,
      completionRate: 0,
      appointmentRate: 0,
      wastePickupRate: 0,
      defectRate: 0,
    };
    summary.completionRate =
      summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;

    return { items, summary };
  }

  override getCustomerDetail(
    customerId: string,
  ): Observable<CustomerRecord & { orders: CustomerOrder[] }> {
    return this.http.get<CustomerRecord & { orders: CustomerOrder[] }>(
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
    if (options.returnStatus) params = params.set('returnStatus', options.returnStatus);

    return this.http.get<UnreturnedItemsResponse>(`${this.baseUrl}/unreturned`, { params });
  }

  override markItemAsReturned(orderId: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.baseUrl}/unreturned/${orderId}/return`,
      {},
    );
  }
}
