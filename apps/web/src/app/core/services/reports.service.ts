/**
 * Reports Service
 * Handles reports API calls - KPI, Progress, Export
 */
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { Order } from '@erp/shared';

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
  type: 'ecoas' | 'completed' | 'pending' | 'waste' | 'raw';
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

// Branch interface for dropdown
export interface BranchOption {
  code: string;
  name: string;
  region?: string;
}

// Unreturned Items interfaces
export interface UnreturnedItem {
  orderId: string;
  orderNo: string;
  customerName: string;
  customerPhone?: string;
  productName?: string;
  cancelledAt: string;
  cancelReason?: string;
  isReturned: boolean;
  returnedAt?: string;
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
  byBranch?: {
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

    return this.http.get<ProgressReport>(`${this.baseUrl}/progress`, { params });
  }

  /**
   * Search customer history
   */
  searchCustomers(query: string, limit = 50): Observable<{ data: CustomerRecord[] }> {
    const params = new HttpParams().set('q', query).set('limit', String(limit));
    return this.http.get<{ data: CustomerRecord[] }>(`${this.baseUrl}/customers`, { params });
  }

  /**
   * Get customer detail with order history
   */
  getCustomerDetail(customerId: string): Observable<CustomerRecord & { orders: Order[] }> {
    return this.http.get<CustomerRecord & { orders: Order[] }>(
      `${this.baseUrl}/customers/${customerId}`,
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
    return firstValueFrom(this.http.post<ExportResult>(`${this.baseUrl}/raw`, request));
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
   * Get unreturned items (cancelled orders with pending item returns)
   */
  getUnreturnedItems(options: {
    branchCode?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Observable<UnreturnedItemsResponse> {
    let params = new HttpParams();
    if (options.branchCode) params = params.set('branchCode', options.branchCode);
    if (options.dateFrom) params = params.set('dateFrom', options.dateFrom);
    if (options.dateTo) params = params.set('dateTo', options.dateTo);

    return this.http.get<UnreturnedItemsResponse>(`${this.baseUrl}/unreturned`, { params });
  }

  /**
   * Mark an unreturned item as returned
   * Requires HQ_ADMIN or BRANCH_MANAGER role
   */
  markItemAsReturned(orderId: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.baseUrl}/unreturned/${orderId}/return`, {});
  }

  /**
   * Get branches list for filtering
   */
  getBranches(): Observable<BranchOption[]> {
    return this.http.get<BranchOption[]>(`${environment.apiUrl}/metadata/branches`);
  }
}
