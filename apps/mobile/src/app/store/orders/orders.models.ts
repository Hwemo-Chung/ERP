/**
 * Order-related models for state management
 * Based on SDD section 4.1 and API_SPEC
 */

export enum OrderStatus {
  UNASSIGNED = 'UNASSIGNED',       // 미배정
  ASSIGNED = 'ASSIGNED',           // 배정
  CONFIRMED = 'CONFIRMED',         // 배정확정
  RELEASED = 'RELEASED',           // 출고확정
  DISPATCHED = 'DISPATCHED',       // 출문
  POSTPONED = 'POSTPONED',         // 연기
  ABSENT = 'ABSENT',               // 부재
  COMPLETED = 'COMPLETED',         // 인수
  PARTIAL = 'PARTIAL',             // 부분인수
  COLLECTED = 'COLLECTED',         // 회수
  CANCELLED = 'CANCELLED',         // 취소
  REQUEST_CANCEL = 'REQUEST_CANCEL', // 의뢰취소
}

/**
 * Human-readable labels for order statuses
 */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.UNASSIGNED]: '미배정',
  [OrderStatus.ASSIGNED]: '배정',
  [OrderStatus.CONFIRMED]: '배정확정',
  [OrderStatus.RELEASED]: '출고확정',
  [OrderStatus.DISPATCHED]: '출문',
  [OrderStatus.POSTPONED]: '연기',
  [OrderStatus.ABSENT]: '부재',
  [OrderStatus.COMPLETED]: '인수',
  [OrderStatus.PARTIAL]: '부분인수',
  [OrderStatus.COLLECTED]: '회수',
  [OrderStatus.CANCELLED]: '취소',
  [OrderStatus.REQUEST_CANCEL]: '의뢰취소',
};

/**
 * UI colors for order statuses
 */
export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  [OrderStatus.UNASSIGNED]: 'warning',
  [OrderStatus.ASSIGNED]: 'primary',
  [OrderStatus.CONFIRMED]: 'secondary',
  [OrderStatus.RELEASED]: 'tertiary',
  [OrderStatus.DISPATCHED]: 'tertiary',
  [OrderStatus.POSTPONED]: 'warning',
  [OrderStatus.ABSENT]: 'danger',
  [OrderStatus.COMPLETED]: 'success',
  [OrderStatus.PARTIAL]: 'warning',
  [OrderStatus.COLLECTED]: 'success',
  [OrderStatus.CANCELLED]: 'medium',
  [OrderStatus.REQUEST_CANCEL]: 'danger',
};

export interface OrderLine {
  id: string;
  lineNumber: number;
  productCode: string;
  productName: string;
  quantity: number;
  serialNumber?: string;
}

export interface WasteEntry {
  code: string;
  quantity: number;
  date?: string;
}

export interface CompletionData {
  status?: OrderStatus;
  lines?: OrderLine[];
  waste?: WasteEntry[];
  notes?: string;
  completedAt?: number;
  photos?: string[];
  customerSignature?: string;
  installerSignature?: string;
  certificateIssuedAt?: number;
}

export interface Order {
  id: string;
  erpOrderNumber: string;
  branchId: string;
  branchCode: string;
  branchName?: string;
  status: OrderStatus;
  appointmentDate: string;
  appointmentSlot?: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  address?: string;
  installerId?: string;
  installerName?: string;
  version: number;

  // Nested data - support both 'lines' and 'orderLines' for compatibility
  lines?: OrderLine[];
  orderLines?: OrderLine[];

  // Completion details (if completed)
  completion?: CompletionData;

  // Metadata
  createdAt: number;
  updatedAt: number;
  localUpdatedAt?: number; // For offline tracking
  syncedAt?: number;
}

/**
 * Filter options for orders list
 */
export interface OrderFilterOptions {
  status?: OrderStatus[];
  branchCode?: string;
  installerId?: string;
  appointmentDate?: string;
  customerName?: string;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
}

/**
 * Pagination info
 */
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

/**
 * Orders state
 */
export interface OrdersState {
  orders: Order[];
  selectedOrder: Order | null;
  filters: OrderFilterOptions;
  pagination: PaginationInfo;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  lastSyncTime?: number;
  syncStatus: 'idle' | 'syncing' | 'error';
}
