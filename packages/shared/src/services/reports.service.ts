import { inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { ENVIRONMENT_CONFIG } from '../tokens/environment.token';
import type {
  KpiSummary,
  ProgressReport,
  CustomerRecord,
  WasteSummary,
  ExportRequest,
  ExportResult,
  BranchOption,
  UnreturnedItemsResponse,
} from './reports.models';

export abstract class BaseReportsService {
  protected readonly http = inject(HttpClient);
  protected readonly baseUrl: string;
  protected readonly apiUrl: string;

  protected readonly _kpiSummary = signal<KpiSummary | null>(null);
  readonly kpiSummary = this._kpiSummary.asReadonly();

  constructor() {
    const env = inject(ENVIRONMENT_CONFIG);
    this.apiUrl = env.apiUrl;
    this.baseUrl = `${env.apiUrl}/reports`;
  }

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

  abstract getProgress(options: {
    groupBy: 'branch' | 'installer' | 'status' | 'date';
    branchCode?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Observable<ProgressReport>;

  searchCustomers(query: string, limit = 50): Observable<{ data: CustomerRecord[] }> {
    const params = new HttpParams().set('q', query).set('limit', String(limit));
    return this.http.get<{ data: CustomerRecord[] }>(`${this.baseUrl}/customers`, { params });
  }

  abstract getCustomerDetail(
    customerId: string,
  ): Observable<CustomerRecord & { orders: unknown[] }>;

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

  async requestExport(request: ExportRequest): Promise<ExportResult> {
    return firstValueFrom(this.http.post<ExportResult>(`${this.baseUrl}/raw`, request));
  }

  getExportStatus(exportId: string): Observable<ExportResult> {
    return this.http.get<ExportResult>(`${this.baseUrl}/export/${exportId}`);
  }

  downloadExport(exportId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/export/${exportId}/download`, {
      responseType: 'blob',
    });
  }

  abstract getUnreturnedItems(options: {
    branchCode?: string;
    dateFrom?: string;
    dateTo?: string;
    returnStatus?: 'all' | 'returned' | 'unreturned';
  }): Observable<UnreturnedItemsResponse>;

  abstract markItemAsReturned(orderId: string): Observable<{ success: boolean; message?: string }>;

  getBranches(): Observable<BranchOption[]> {
    return this.http.get<BranchOption[]>(`${this.apiUrl}/metadata/branches`);
  }
}
