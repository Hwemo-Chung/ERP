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

/** i18n translation keys for OrderStatus labels */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.UNASSIGNED]: 'ORDER_STATUS.UNASSIGNED',
  [OrderStatus.ASSIGNED]: 'ORDER_STATUS.ASSIGNED',
  [OrderStatus.CONFIRMED]: 'ORDER_STATUS.CONFIRMED',
  [OrderStatus.RELEASED]: 'ORDER_STATUS.RELEASED',
  [OrderStatus.DISPATCHED]: 'ORDER_STATUS.DISPATCHED',
  [OrderStatus.POSTPONED]: 'ORDER_STATUS.POSTPONED',
  [OrderStatus.ABSENT]: 'ORDER_STATUS.ABSENT',
  [OrderStatus.COMPLETED]: 'ORDER_STATUS.COMPLETED',
  [OrderStatus.PARTIAL]: 'ORDER_STATUS.PARTIAL',
  [OrderStatus.COLLECTED]: 'ORDER_STATUS.COLLECTED',
  [OrderStatus.CANCELLED]: 'ORDER_STATUS.CANCELLED',
  [OrderStatus.REQUEST_CANCEL]: 'ORDER_STATUS.REQUEST_CANCEL',
};

/** Ionic color for each OrderStatus */
export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  [OrderStatus.UNASSIGNED]: 'danger',
  [OrderStatus.ASSIGNED]: 'warning',
  [OrderStatus.CONFIRMED]: 'success',
  [OrderStatus.RELEASED]: 'primary',
  [OrderStatus.DISPATCHED]: 'tertiary',
  [OrderStatus.POSTPONED]: 'warning',
  [OrderStatus.ABSENT]: 'medium',
  [OrderStatus.COMPLETED]: 'success',
  [OrderStatus.PARTIAL]: 'secondary',
  [OrderStatus.COLLECTED]: 'success',
  [OrderStatus.CANCELLED]: 'medium',
  [OrderStatus.REQUEST_CANCEL]: 'warning',
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
