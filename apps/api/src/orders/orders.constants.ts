import { OrderStatus } from '@prisma/client';

export const CANCELLABLE_STATUSES: OrderStatus[] = [
  OrderStatus.UNASSIGNED,
  OrderStatus.ASSIGNED,
  OrderStatus.CONFIRMED,
  OrderStatus.RELEASED,
  OrderStatus.DISPATCHED,
  OrderStatus.POSTPONED,
  OrderStatus.ABSENT,
];

export const EVENT_ALLOWED_STATUSES: OrderStatus[] = [
  OrderStatus.UNASSIGNED,
  OrderStatus.ASSIGNED,
  OrderStatus.CONFIRMED,
  OrderStatus.RELEASED,
  OrderStatus.DISPATCHED,
  OrderStatus.POSTPONED,
  OrderStatus.ABSENT,
];

export const REASSIGN_ALLOWED_STATUSES: OrderStatus[] = [
  OrderStatus.ASSIGNED,
  OrderStatus.CONFIRMED,
  OrderStatus.RELEASED,
  OrderStatus.DISPATCHED,
  OrderStatus.POSTPONED,
  OrderStatus.ABSENT,
];

export const SPLIT_ALLOWED_STATUSES: OrderStatus[] = [
  OrderStatus.UNASSIGNED,
  OrderStatus.ASSIGNED,
  OrderStatus.CONFIRMED,
];
