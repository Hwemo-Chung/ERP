/**
 * Reports Store Models
 * Type definitions for reports and KPI dashboards per PRD FR-08, FR-11, FR-16
 */

export interface KpiSummary {
  total: number;
  completed: number;
  pending: number;
  cancelled: number;
  completionRate: number;
  wastePickupCount: number;
  wastePickupTotal: number;
}

export interface StatusCount {
  status: string;
  count: number;
  percentage: number;
}

export interface BranchProgress {
  branchCode: string;
  branchName: string;
  total: number;
  completed: number;
  pending: number;
  completionRate: number;
  installers: InstallerProgress[];
}

export interface InstallerProgress {
  installerId: string;
  installerName: string;
  total: number;
  completed: number;
  pending: number;
  completionRate: number;
}

export interface WasteSummaryItem {
  wasteCode: string;
  wasteName: string;
  quantity: number;
  orderCount: number;
}

export interface CustomerHistoryItem {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  appointmentDate: string;
  status: string;
  installerName: string;
  completedAt?: string;
  vendorCode?: string;
  branchCode: string;
}

export interface ReleaseSummaryItem {
  fdcCode: string;
  fdcName: string;
  modelCode: string;
  modelName: string;
  quantity: number;
}

export interface ExportConfig {
  type: 'ecoas' | 'completion' | 'pending' | 'waste' | 'release' | 'raw';
  format: 'csv' | 'xlsx' | 'pdf';
  dateFrom?: string;
  dateTo?: string;
  branchCode?: string;
  status?: string[];
}

export interface ReportsFilters {
  level?: 'nation' | 'branch' | 'installer';
  branchCode?: string;
  installerId?: string;
  dateFrom?: string;
  dateTo?: string;
  wasteCode?: string;
  customerQuery?: string;
  vendorCode?: string;
}

export interface ReportsState {
  summary: KpiSummary | null;
  statusCounts: StatusCount[];
  branchProgress: BranchProgress[];
  wasteSummary: WasteSummaryItem[];
  customerHistory: CustomerHistoryItem[];
  releaseSummary: ReleaseSummaryItem[];
  filters: ReportsFilters;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
}
