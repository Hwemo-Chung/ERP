// apps/web/src/app/features/settlement-fees/settlement-fees.routes.ts
import { Routes } from '@angular/router';

export const SETTLEMENT_FEES_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/fee-dashboard/fee-dashboard.page').then(m => m.FeeDashboardPage) },
  { path: 'close', loadComponent: () => import('./pages/monthly-close/monthly-close.page').then(m => m.MonthlyClosePage) },
  { path: 'breakdown/:transactionId', loadComponent: () => import('./pages/breakdown/breakdown.page').then(m => m.BreakdownPage) },
  { path: 'statement', loadComponent: () => import('./pages/statement/statement.page').then(m => m.StatementPage) },
];
