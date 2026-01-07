/**
 * Reports SignalStore
 * Manages reports and KPI dashboard state per PRD FR-08, FR-11, FR-16
 * 
 * Features:
 * - KPI Summary metrics
 * - Branch/Installer progress tracking
 * - Waste pickup aggregation
 * - Customer history search
 * - Export functionality (CSV, XLSX, PDF)
 */

import {
  Injectable,
  computed,
  inject,
} from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
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

/** API response for progress items */
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

/**
 * Reports SignalStore
 */
@Injectable({ providedIn: 'root' })
export class ReportsStore extends signalStore(
  withState<ReportsState>(initialState),

  withComputed(({ summary, branchProgress, wasteSummary }) => ({
    // Computed: total completion rate
    totalCompletionRate: computed(() => {
      const s = summary();
      if (!s || s.total === 0) return 0;
      return Math.round((s.completed / s.total) * 100);
    }),

    // Computed: top performing branches
    topBranches: computed(() => {
      const branches = branchProgress();
      if (!Array.isArray(branches)) return [];
      return [...branches]
        .sort((a, b) => b.completionRate - a.completionRate)
        .slice(0, 5);
    }),

    // Computed: low performing branches (need attention)
    lowPerformingBranches: computed(() => {
      const branches = branchProgress();
      if (!Array.isArray(branches)) return [];
      return [...branches]
        .filter(b => b.completionRate < 70)
        .sort((a, b) => a.completionRate - b.completionRate);
    }),

    // Computed: waste summary totals
    wasteTotals: computed(() => {
      const items = wasteSummary();
      // Ensure items is an array before using reduce
      if (!Array.isArray(items) || items.length === 0) {
        return { totalItems: 0, totalOrders: 0, uniqueCodes: 0 };
      }
      return {
        totalItems: items.reduce((sum, w) => sum + (w.quantity || 0), 0),
        totalOrders: items.reduce((sum, w) => sum + (w.orderCount || 0), 0),
        uniqueCodes: items.length,
      };
    }),

    // Computed: has data loaded
    hasData: computed(() => summary() !== null),
  })),

  withMethods((store, http = inject(HttpClient)) => ({
    /**
     * Load KPI summary from API
     */
    async loadSummary(filters?: ReportsFilters): Promise<void> {
      patchState(store, { isLoading: true, error: null });

      try {
        let params = new HttpParams();
        if (filters?.level) params = params.set('level', filters.level);
        if (filters?.branchCode) params = params.set('branchCode', filters.branchCode);
        if (filters?.installerId) params = params.set('installerId', filters.installerId);
        if (filters?.dateFrom) params = params.set('dateFrom', filters.dateFrom);
        if (filters?.dateTo) params = params.set('dateTo', filters.dateTo);

        // Note: apiResponseInterceptor unwraps { success, data } -> data
        const data = await firstValueFrom(
          http.get<{
            summary: KpiSummary;
            statusCounts: StatusCount[];
            byBranch?: BranchProgress[];
          }>(`${environment.apiUrl}/reports/summary`, { params })
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
        const errorMessage = getErrorMessage(error) || 'Failed to load summary';
        patchState(store, {
          error: errorMessage,
          isLoading: false,
        });
        throw error;
      }
    },

    /**
     * Load progress dashboard data
     */
    async loadProgress(filters?: ReportsFilters): Promise<void> {
      patchState(store, { isLoading: true, error: null });

      const groupBy = filters?.groupBy || store.currentGroupBy() || 'branch';

      try {
        let params = new HttpParams();
        params = params.set('groupBy', groupBy);
        if (filters?.branchCode) params = params.set('branchCode', filters.branchCode);
        if (filters?.dateFrom) params = params.set('dateFrom', filters.dateFrom);
        if (filters?.dateTo) params = params.set('dateTo', filters.dateTo);

        // API returns structured progress data with completion stats
        const data = await firstValueFrom(
          http.get<ProgressApiItem[]>(`${environment.apiUrl}/reports/progress`, { params })
        );

        // Map API response to ProgressItem[] (API already provides all needed fields)
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
        const errorMessage = getErrorMessage(error) || 'Failed to load progress';
        patchState(store, {
          error: errorMessage,
          isLoading: false,
        });
        throw error;
      }
    },

    /**
     * Load waste summary data (FR-05, FR-16)
     */
    async loadWasteSummary(filters?: ReportsFilters): Promise<void> {
      patchState(store, { isLoading: true, error: null });

      try {
        let params = new HttpParams();
        if (filters?.branchCode) params = params.set('branchCode', filters.branchCode);
        if (filters?.dateFrom) params = params.set('dateFrom', filters.dateFrom);
        if (filters?.dateTo) params = params.set('dateTo', filters.dateTo);
        if (filters?.wasteCode) params = params.set('wasteCode', filters.wasteCode);

        // Note: apiResponseInterceptor unwraps { success, data } -> data
        const data = await firstValueFrom(
          http.get<WasteSummaryItem[]>(`${environment.apiUrl}/reports/waste-summary`, { params })
        );

        patchState(store, {
          wasteSummary: data || [],
          filters: filters || {},
          isLoading: false,
          lastUpdated: Date.now(),
        });
      } catch (error: unknown) {
        const errorMessage = getErrorMessage(error) || 'Failed to load waste summary';
        patchState(store, {
          error: errorMessage,
          isLoading: false,
        });
        throw error;
      }
    },

    /**
     * Search customer history (FR-07)
     */
    async searchCustomerHistory(filters: ReportsFilters): Promise<void> {
      patchState(store, { isLoading: true, error: null });

      try {
        let params = new HttpParams();
        if (filters.customerQuery) params = params.set('customer', filters.customerQuery);
        if (filters.vendorCode) params = params.set('vendorCode', filters.vendorCode);
        if (filters.branchCode) params = params.set('branchCode', filters.branchCode);
        if (filters.dateFrom) params = params.set('dateFrom', filters.dateFrom);
        if (filters.dateTo) params = params.set('dateTo', filters.dateTo);

        // Note: apiResponseInterceptor unwraps { success, data } -> data
        const data = await firstValueFrom(
          http.get<CustomerHistoryItem[]>(`${environment.apiUrl}/reports/customer-history`, { params })
        );

        patchState(store, {
          customerHistory: data || [],
          filters,
          isLoading: false,
          lastUpdated: Date.now(),
        });
      } catch (error: unknown) {
        const errorMessage = getErrorMessage(error) || 'Failed to search customer history';
        patchState(store, {
          error: errorMessage,
          isLoading: false,
        });
        throw error;
      }
    },

    /**
     * Load release summary by FDC (FR-16)
     */
    async loadReleaseSummary(filters?: ReportsFilters): Promise<void> {
      patchState(store, { isLoading: true, error: null });

      try {
        let params = new HttpParams();
        if (filters?.branchCode) params = params.set('branchCode', filters.branchCode);
        if (filters?.dateFrom) params = params.set('dateFrom', filters.dateFrom);
        if (filters?.dateTo) params = params.set('dateTo', filters.dateTo);

        // Note: apiResponseInterceptor unwraps { success, data } -> data
        const data = await firstValueFrom(
          http.get<ReleaseSummaryItem[]>(`${environment.apiUrl}/reports/release-summary`, { params })
        );

        patchState(store, {
          releaseSummary: data || [],
          filters: filters || {},
          isLoading: false,
          lastUpdated: Date.now(),
        });
      } catch (error: unknown) {
        const errorMessage = getErrorMessage(error) || 'Failed to load release summary';
        patchState(store, {
          error: errorMessage,
          isLoading: false,
        });
        throw error;
      }
    },

    /**
     * Export data (FR-06 ECOAS, CSV, XLSX, PDF)
     */
    async exportData(config: ExportConfig): Promise<Blob> {
      try {
        let params = new HttpParams();
        params = params.set('type', config.type);
        params = params.set('format', config.format);
        if (config.dateFrom) params = params.set('dateFrom', config.dateFrom);
        if (config.dateTo) params = params.set('dateTo', config.dateTo);
        if (config.branchCode) params = params.set('branchCode', config.branchCode);
        if (config.status?.length) params = params.set('status', config.status.join(','));

        const response = await firstValueFrom(
          http.get(`${environment.apiUrl}/reports/export/${config.type}`, {
            params,
            responseType: 'blob',
          })
        );

        return response;
      } catch (error: unknown) {
        const errorMessage = getErrorMessage(error) || 'Failed to export data';
        patchState(store, { error: errorMessage });
        throw error;
      }
    },

    /**
     * Download exported file
     */
    downloadFile(blob: Blob, filename: string): void {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
    },

    /**
     * Update filters
     */
    setFilters(filters: ReportsFilters): void {
      patchState(store, { filters });
    },

    /**
     * Clear all data
     */
    reset(): void {
      patchState(store, initialState);
    },

    /**
     * Clear error
     */
    clearError(): void {
      patchState(store, { error: null });
    },
  }))
) {
  constructor() {
    super();
  }
}
