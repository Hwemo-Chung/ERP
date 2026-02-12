import { Routes } from '@angular/router';
import { roleGuard } from '@core/guards/role.guard';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/settings-menu/settings-menu.page').then((m) => m.SettingsMenuPage),
  },
  {
    path: 'settlement',
    loadComponent: () => import('./pages/settlement/settlement.page').then((m) => m.SettlementPage),
  },
  {
    path: 'split-order/:id',
    loadComponent: () =>
      import('./pages/split-order/split-order.page').then((m) => m.SplitOrderPage),
  },
  {
    path: 'notifications',
    loadComponent: () =>
      import('./pages/notification-center/notification-center.page').then(
        (m) => m.NotificationCenterPage,
      ),
  },
  {
    path: 'notification-settings',
    loadComponent: () =>
      import('./pages/notification-settings/notification-settings.page').then(
        (m) => m.NotificationSettingsPage,
      ),
  },
  {
    path: 'biometric',
    loadComponent: () =>
      import('./pages/biometric-settings/biometric-settings.page').then(
        (m) => m.BiometricSettingsPage,
      ),
  },
  {
    path: 'system',
    canActivate: [roleGuard('HQ_ADMIN')],
    loadComponent: () =>
      import('./pages/system-settings/system-settings.page').then((m) => m.SystemSettingsPage),
  },
  {
    path: 'customer-contacts',
    loadComponent: () =>
      import('./pages/customer-contact/customer-contact.page').then((m) => m.CustomerContactPage),
  },
];
