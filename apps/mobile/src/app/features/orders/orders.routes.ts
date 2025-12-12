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
];
