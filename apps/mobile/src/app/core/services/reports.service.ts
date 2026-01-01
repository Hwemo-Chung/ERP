/**
 * Reports Service
 * Handles reports API calls - KPI, Progress, Export
 */
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, firstValueFrom, map } from 'rxjs';
import { environment } from '@env/environment';

export interface KpiSummary {
  total: number;
  completed: number;
  pending: number;
  inProgress: number;
  cancelled: number;
  completionRate: number;
  appointmentRate: number;
  wastePickupRate: number;
  defectRate: number;
}

export interface ProgressItem {
  id: string;
  name: string;
  total: number;
  completed: number;
  pending: number;
  rate: number;
}

export interface ProgressReport {
  items: ProgressItem[];
  summary: KpiSummary;
}

export interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  address?: string;
  orderCount: number;
  lastOrderDate: string;
  lastOrderNumber: string;
}

export interface WasteStat {
  code: string;
  name: string;
  count: number;
}

export interface WasteSummary {
  totalCount: number;
  byCategory: WasteStat[];
  byDate?: { date: string; count: number }[];
}

export interface ExportRequest {
  type: 'ecoas' | 'completed' | 'pending' | 'waste' | 'unreturned' | 'raw';
  format: 'csv' | 'xlsx' | 'pdf';
  branchCode?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ExportResult {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  downloadUrl?: string;
  fileName?: string;
  error?: string;
}

/**
 * Unreturned Item - cancelled order with pending item return
 * Manual Reference: Slide 19 (2017.10.26 v0.9)
 */
export interface UnreturnedItem {
  orderId: string;
  orderNo: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  productName?: string;
  productCode?: string;
  cancelledAt: string;
  cancelReason?: string;
  isReturned: boolean;
  returnedAt?: string;
  returnedBy?: string;
  branchCode?: string;
  branchName?: string;
}

export interface UnreturnedSummary {
  totalCount: number;
  unreturnedCount: number;
  returnedCount: number;
}

export interface UnreturnedItemsResponse {
  items: UnreturnedItem[];
  totalCount: number;
  unreturnedCount: number;
  returnedCount: number;
  byBranch: {
    branchCode: string;
    branchName: string;
    unreturnedCount: number;
    returnedCount: number;
  }[];
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/reports`;

  // Local cache
  private readonly _kpiSummary = signal<KpiSummary | null>(null);
  readonly kpiSummary = this._kpiSummary.asReadonly();

  /**
   * Get KPI Summary
   */
  getSummary(options: {
    level: 'nation' | 'branch' | 'installer';
    branchCode?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Observable<KpiSummary> {
    let params = new HttpParams().set('level', options.level);
    if (options.branchCode) params = params.set('branchCode', options.branchCode);
    if (options.dateFrom) params = params.set('dateFrom', options.dateFrom);
    if (options.dateTo) params = params.set('dateTo', options.dateTo);

    return this.http.get<KpiSummary>(`${this.baseUrl}/summary`, { params });
  }

  /**
   * Get Progress Report
   * Transforms raw Prisma groupBy results into ProgressReport structure
   */
  getProgress(options: {
    groupBy: 'branch' | 'installer' | 'status' | 'date';
    branchCode?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Observable<ProgressReport> {
    let params = new HttpParams().set('groupBy', options.groupBy);
    if (options.branchCode) params = params.set('branchCode', options.branchCode);
    if (options.dateFrom) params = params.set('dateFrom', options.dateFrom);
    if (options.dateTo) params = params.set('dateTo', options.dateTo);

    // API returns raw Prisma groupBy results, transform to ProgressReport
    return this.http.get<any[]>(`${this.baseUrl}/progress`, { params }).pipe(
      map((data) => {
        console.log('[ReportsService] Raw API data:', {
          type: typeof data,
          isArray: Array.isArray(data),
          length: Array.isArray(data) ? data.length : 'N/A',
          first3: Array.isArray(data) ? data.slice(0, 3) : data,
        });
        return this.transformProgressData(data || [], options.groupBy);
      })
    );
  }

  /**
   * Transform API progress response to ProgressReport structure
   * API now returns pre-computed stats: { key, name, total, completed, pending, completionRate }
   */
  private transformProgressData(
    data: any[],
    _groupBy: 'branch' | 'installer' | 'status' | 'date'
  ): ProgressReport {
    // API already provides all needed fields - simple mapping
    const items: ProgressItem[] = data.map((item: any) => ({
      id: item.key || '',
      name: item.name || item.key || 'Unknown',
      total: item.total || 0,
      completed: item.completed || 0,
      pending: item.pending || 0,
      rate: item.completionRate || 0,
    }));

    // Calculate summary from items
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
    summary.completionRate = summary.total > 0
      ? Math.round((summary.completed / summary.total) * 100)
      : 0;

    return { items, summary };
  }

  /**
   * Search customer history
   */
  searchCustomers(query: string, limit = 50): Observable<{ data: CustomerRecord[] }> {
    const params = new HttpParams()
      .set('q', query)
      .set('limit', String(limit));
    return this.http.get<{ data: CustomerRecord[] }>(`${this.baseUrl}/customers`, { params });
  }

  /**
   * Get customer detail with order history
   */
  getCustomerDetail(customerId: string): Observable<CustomerRecord & { orders: any[] }> {
    return this.http.get<CustomerRecord & { orders: any[] }>(
      `${this.baseUrl}/customers/${customerId}`
    );
  }

  /**
   * Get waste summary
   */
  getWasteSummary(options: {
    branchCode?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Observable<WasteSummary> {
    let params = new HttpParams();
    if (options.branchCode) params = params.set('branchCode', options.branchCode);
    if (options.dateFrom) params = params.set('dateFrom', options.dateFrom);
    if (options.dateTo) params = params.set('dateTo', options.dateTo);

    return this.http.get<WasteSummary>(`${this.baseUrl}/waste-summary`, { params });
  }

  /**
   * Request export
   */
  async requestExport(request: ExportRequest): Promise<ExportResult> {
    return firstValueFrom(
      this.http.post<ExportResult>(`${this.baseUrl}/raw`, request)
    );
  }

  /**
   * Check export status
   */
  getExportStatus(exportId: string): Observable<ExportResult> {
    return this.http.get<ExportResult>(`${this.baseUrl}/export/${exportId}`);
  }

  /**
   * Download export file (returns blob)
   */
  downloadExport(exportId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/export/${exportId}/download`, {
      responseType: 'blob',
    });
  }

  /**
   * Get unreturned items (미환입 현황)
   * Manual Reference: Slide 19 (2017.10.26 v0.9)
   */
  getUnreturnedItems(options: {
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

  /**
   * Mark a cancelled order item as returned (환입 처리)
   */
  markItemAsReturned(orderId: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.baseUrl}/unreturned/${orderId}/return`,
      {}
    );
  }
}
