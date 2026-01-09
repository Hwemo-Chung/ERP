import { Injectable, computed, inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '@env/environment';
import { firstValueFrom } from 'rxjs';

import {
  ReportsState,
  KpiSummary,
  StatusCount,
  BranchProgress,
  WasteSummaryItem,
  CustomerHistoryItem,
  ReleaseSummaryItem,
  ReportsFilters,
  ExportConfig,
  ProgressItem,
} from './reports.models';
import { getErrorMessage } from '../../core/utils/error.util';

interface ProgressApiItem {
  key?: string;
  name?: string;
  total?: number;
  completed?: number;
  pending?: number;
  completionRate?: number;
}

const initialState: ReportsState = {
  summary: null,
  statusCounts: [],
  branchProgress: [],
  progressItems: [],
  currentGroupBy: 'branch',
  wasteSummary: [],
  customerHistory: [],
  releaseSummary: [],
  filters: {},
  isLoading: false,
  error: null,
  lastUpdated: null,
};

const buildParams = (
  filters?: ReportsFilters,
  additionalParams?: Record<string, string>,
): HttpParams => {
  let params = new HttpParams();

  if (filters?.level) params = params.set('level', filters.level);
  if (filters?.branchCode) params = params.set('branchCode', filters.branchCode);
  if (filters?.installerId) params = params.set('installerId', filters.installerId);
  if (filters?.dateFrom) params = params.set('dateFrom', filters.dateFrom);
  if (filters?.dateTo) params = params.set('dateTo', filters.dateTo);
  if (filters?.customerQuery) params = params.set('customer', filters.customerQuery);
  if (filters?.vendorCode) params = params.set('vendorCode', filters.vendorCode);
  if (filters?.wasteCode) params = params.set('wasteCode', filters.wasteCode);
  if (filters?.groupBy) params = params.set('groupBy', filters.groupBy);

  if (additionalParams) {
    Object.entries(additionalParams).forEach(([key, value]) => {
      params = params.set(key, value);
    });
  }

  return params;
};

@Injectable({ providedIn: 'root' })
export class ReportsStore extends signalStore(
  withState<ReportsState>(initialState),

  withComputed(({ summary, branchProgress, wasteSummary }) => ({
    totalCompletionRate: computed(() => {
      const s = summary();
      if (!s || s.total === 0) return 0;
      return Math.round((s.completed / s.total) * 100);
    }),

    topBranches: computed(() => {
      const branches = branchProgress();
      if (!Array.isArray(branches)) return [];
      return [...branches].sort((a, b) => b.completionRate - a.completionRate).slice(0, 5);
    }),

    lowPerformingBranches: computed(() => {
      const branches = branchProgress();
      if (!Array.isArray(branches)) return [];
      return [...branches]
        .filter((b) => b.completionRate < 70)
        .sort((a, b) => a.completionRate - b.completionRate);
    }),

    wasteTotals: computed(() => {
      const items = wasteSummary();
      if (!Array.isArray(items) || items.length === 0) {
        return { totalItems: 0, totalOrders: 0, uniqueCodes: 0 };
      }
      return {
        totalItems: items.reduce((sum, w) => sum + (w.quantity || 0), 0),
        totalOrders: items.reduce((sum, w) => sum + (w.orderCount || 0), 0),
        uniqueCodes: items.length,
      };
    }),

    hasData: computed(() => summary() !== null),
  })),

  withMethods((store, http = inject(HttpClient)) => {
    const handleError = (error: unknown, defaultMessage: string) => {
      const errorMessage = getErrorMessage(error) || defaultMessage;
      patchState(store, { error: errorMessage, isLoading: false });
      throw error;
    };

    return {
      async loadSummary(filters?: ReportsFilters): Promise<void> {
        patchState(store, { isLoading: true, error: null });

        try {
          const data = await firstValueFrom(
            http.get<{
              summary: KpiSummary;
              statusCounts: StatusCount[];
              byBranch?: BranchProgress[];
            }>(`${environment.apiUrl}/reports/summary`, { params: buildParams(filters) }),
          );

          patchState(store, {
            summary: data.summary,
            statusCounts: data.statusCounts || [],
            branchProgress: data.byBranch || [],
            filters: filters || {},
            isLoading: false,
            lastUpdated: Date.now(),
          });
        } catch (error: unknown) {
          handleError(error, 'Failed to load summary');
        }
      },

      async loadProgress(filters?: ReportsFilters): Promise<void> {
        patchState(store, { isLoading: true, error: null });

        const groupBy = filters?.groupBy || store.currentGroupBy() || 'branch';

        try {
          const params = buildParams(filters, { groupBy });

          const data = await firstValueFrom(
            http.get<ProgressApiItem[]>(`${environment.apiUrl}/reports/progress`, { params }),
          );

          const progressItems: ProgressItem[] = (data || []).map((item: ProgressApiItem) => ({
            key: item.key || '',
            label: item.name || item.key || 'Unknown',
            total: item.total || 0,
            completed: item.completed || 0,
            pending: item.pending || 0,
            completionRate: item.completionRate || 0,
          }));

          patchState(store, {
            progressItems,
            currentGroupBy: groupBy,
            filters: { ...store.filters(), ...filters, groupBy },
            isLoading: false,
            lastUpdated: Date.now(),
          });
        } catch (error: unknown) {
          handleError(error, 'Failed to load progress');
        }
      },

      async loadWasteSummary(filters?: ReportsFilters): Promise<void> {
        patchState(store, { isLoading: true, error: null });

        try {
          const data = await firstValueFrom(
            http.get<WasteSummaryItem[]>(`${environment.apiUrl}/reports/waste-summary`, {
              params: buildParams(filters),
            }),
          );

          patchState(store, {
            wasteSummary: data || [],
            filters: filters || {},
            isLoading: false,
            lastUpdated: Date.now(),
          });
        } catch (error: unknown) {
          handleError(error, 'Failed to load waste summary');
        }
      },

      async searchCustomerHistory(filters: ReportsFilters): Promise<void> {
        patchState(store, { isLoading: true, error: null });

        try {
          const data = await firstValueFrom(
            http.get<CustomerHistoryItem[]>(`${environment.apiUrl}/reports/customer-history`, {
              params: buildParams(filters),
            }),
          );

          patchState(store, {
            customerHistory: data || [],
            filters,
            isLoading: false,
            lastUpdated: Date.now(),
          });
        } catch (error: unknown) {
          handleError(error, 'Failed to search customer history');
        }
      },

      async loadReleaseSummary(filters?: ReportsFilters): Promise<void> {
        patchState(store, { isLoading: true, error: null });

        try {
          const data = await firstValueFrom(
            http.get<ReleaseSummaryItem[]>(`${environment.apiUrl}/reports/release-summary`, {
              params: buildParams(filters),
            }),
          );

          patchState(store, {
            releaseSummary: data || [],
            filters: filters || {},
            isLoading: false,
            lastUpdated: Date.now(),
          });
        } catch (error: unknown) {
          handleError(error, 'Failed to load release summary');
        }
      },

      async exportData(config: ExportConfig): Promise<Blob> {
        try {
          let params = buildParams({
            branchCode: config.branchCode,
            dateFrom: config.dateFrom,
            dateTo: config.dateTo,
          });
          params = params.set('type', config.type);
          params = params.set('format', config.format);
          if (config.status?.length) params = params.set('status', config.status.join(','));

          return await firstValueFrom(
            http.get(`${environment.apiUrl}/reports/export/${config.type}`, {
              params,
              responseType: 'blob',
            }),
          );
        } catch (error: unknown) {
          const errorMessage = getErrorMessage(error) || 'Failed to export data';
          patchState(store, { error: errorMessage });
          throw error;
        }
      },

      downloadFile(blob: Blob, filename: string): void {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(url);
      },

      setFilters(filters: ReportsFilters): void {
        patchState(store, { filters });
      },

      reset(): void {
        patchState(store, initialState);
      },

      clearError(): void {
        patchState(store, { error: null });
      },
    };
  }),
) {
  constructor() {
    super();
  }
}
