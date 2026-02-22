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

export interface ProgressDataItem {
  key?: string;
  name?: string;
  total?: number;
  completed?: number;
  pending?: number;
  completionRate?: number;
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

export interface CustomerOrder {
  id: string;
  orderNo: string;
  status: string;
  appointmentDate?: string;
  customerName?: string;
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

export interface BranchOption {
  code: string;
  name: string;
  region?: string;
}

// Manual Reference: Slide 19 (2017.10.26 v0.9)
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
