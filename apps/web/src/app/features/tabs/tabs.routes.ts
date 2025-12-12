import { Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

export const TABS_ROUTES: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'assignment',
        loadChildren: () =>
          import('../assignment/assignment.routes').then((m) => m.ASSIGNMENT_ROUTES),
      },
      {
        path: 'completion',
        loadChildren: () =>
          import('../completion/completion.routes').then((m) => m.COMPLETION_ROUTES),
      },
      {
        path: 'orders',
        loadChildren: () =>
          import('../orders/orders.routes').then((m) => m.ORDERS_ROUTES),
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('../dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'reports',
        loadChildren: () =>
          import('../reports/reports.routes').then((m) => m.REPORTS_ROUTES),
      },
      {
        path: 'settings',
        loadChildren: () =>
          import('../settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('../profile/profile.page').then((m) => m.ProfilePage),
      },
      {
        path: '',
        redirectTo: 'orders',
        pathMatch: 'full',
      },
    ],
  },
];
