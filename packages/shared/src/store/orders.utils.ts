import {
  Order,
  OrderStatus,
  OrderFilterOptions,
  OrdersState,
  PaginationInfo,
} from '../models/orders.models';

interface AddressObject {
  city?: string;
  line1?: string;
  line2?: string;
  postal?: string;
}

export interface ServerStats {
  total: number;
  unassigned: number;
  assigned: number;
  confirmed: number;
  released: number;
  dispatched: number;
  completed: number;
  cancelled: number;
  pending: number;
}

export interface ExtendedOrdersState extends OrdersState {
  serverStats: ServerStats | null;
}

export const createInitialOrdersState = (): ExtendedOrdersState => ({
  orders: [],
  selectedOrder: null,
  filters: {},
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    hasMore: false,
  },
  isLoading: false,
  isLoadingMore: false,
  error: null,
  lastSyncTime: undefined,
  syncStatus: 'idle',
  serverStats: null,
});

export function formatAddress(address: AddressObject | string | undefined | null): string {
  if (!address) return '';
  if (typeof address === 'string') return address;
  const parts = [address.line1, address.line2, address.city].filter(Boolean);
  return parts.join(' ');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformOrder(order: any): Order {
  return {
    ...order,
    customerAddress: order.customerAddress || formatAddress(order.address),
  };
}

export function filterOrders(orders: Order[], filters: OrderFilterOptions): Order[] {
  let filtered = orders;

  if (filters.status?.length) {
    filtered = filtered.filter((o) => filters.status!.includes(o.status));
  }
  if (filters.branchCode) {
    filtered = filtered.filter((o) => o.branchCode === filters.branchCode);
  }
  if (filters.installerId) {
    filtered = filtered.filter((o) => o.installerId === filters.installerId);
  }
  if (filters.appointmentDate) {
    filtered = filtered.filter((o) => o.appointmentDate === filters.appointmentDate);
  }
  if (filters.customerName) {
    const query = filters.customerName.toLowerCase();
    filtered = filtered.filter((o) => o.customerName.toLowerCase().includes(query));
  }

  return filtered;
}

export function groupOrdersByStatus(orders: Order[]): Map<OrderStatus, Order[]> {
  const groups = new Map<OrderStatus, Order[]>();
  orders.forEach((o) => {
    const status = o.status;
    if (!groups.has(status)) {
      groups.set(status, []);
    }
    groups.get(status)!.push(o);
  });
  return groups;
}

export function calculateKpiMetrics(orders: Order[], serverStats: ServerStats | null): ServerStats {
  if (serverStats) {
    return serverStats;
  }

  return {
    total: orders.length,
    pending: orders.filter((o) => o.status === OrderStatus.UNASSIGNED).length,
    unassigned: orders.filter((o) => o.status === OrderStatus.UNASSIGNED).length,
    assigned: orders.filter((o) => o.status === OrderStatus.ASSIGNED).length,
    confirmed: orders.filter((o) => o.status === OrderStatus.CONFIRMED).length,
    released: orders.filter((o) => o.status === OrderStatus.RELEASED).length,
    dispatched: orders.filter((o) => o.status === OrderStatus.DISPATCHED).length,
    completed: orders.filter((o) => o.status === OrderStatus.COMPLETED).length,
    cancelled: orders.filter((o) => o.status === OrderStatus.CANCELLED).length,
  };
}

export function createPaginationInfo(page: number, limit: number, total: number): PaginationInfo {
  return {
    page,
    limit,
    total,
    hasMore: page * limit < total,
  };
}

export function createOptimisticOrder(order: Order, updates: Partial<Order>): Order {
  return {
    ...order,
    ...updates,
    version: order.version + 1,
    updatedAt: Date.now(),
  };
}
