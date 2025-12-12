import { Routes } from '@angular/router';

export const SETTINGS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/settings-menu/settings-menu.page').then(m => m.SettingsMenuPage) },
  { path: 'settlement', loadComponent: () => import('./pages/settlement/settlement.page').then(m => m.SettlementPage) },
  { path: 'split-order/:id', loadComponent: () => import('./pages/split-order/split-order.page').then(m => m.SplitOrderPage) },
  { path: 'notifications', loadComponent: () => import('./pages/notification-center/notification-center.page').then(m => m.NotificationCenterPage) },
];
