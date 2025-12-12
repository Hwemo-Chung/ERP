import { Routes } from '@angular/router';

export const ORDERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/order-list/order-list.page').then((m) => m.OrderListPage),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/order-detail/order-detail.page').then((m) => m.OrderDetailPage),
  },
  {
    path: ':id/postpone',
    loadComponent: () =>
      import('./pages/order-postpone/order-postpone.page').then((m) => m.OrderPostponePage),
  },
  {
    path: ':id/absence',
    loadComponent: () =>
      import('./pages/order-absence/order-absence.page').then((m) => m.OrderAbsencePage),
  },
];
