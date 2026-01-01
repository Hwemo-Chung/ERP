import { Routes } from '@angular/router';

export const REPORTS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/reports-menu/reports-menu.page').then(m => m.ReportsMenuPage) },
  { path: 'progress', loadComponent: () => import('./pages/progress-dashboard/progress-dashboard.page').then(m => m.ProgressDashboardPage) },
  { path: 'customer-history', loadComponent: () => import('./pages/customer-history/customer-history.page').then(m => m.CustomerHistoryPage) },
  { path: 'waste-summary', loadComponent: () => import('./pages/waste-summary/waste-summary.page').then(m => m.WasteSummaryPage) },
  { path: 'export', loadComponent: () => import('./pages/export-page/export-page.page').then(m => m.ExportPagePage) },
  { path: 'release-summary', loadComponent: () => import('./pages/release-summary/release-summary.page').then(m => m.ReleaseSummaryPage) },
  { path: 'unreturned-items', loadComponent: () => import('./pages/unreturned-items/unreturned-items.page').then(m => m.UnreturnedItemsPage) },
];
