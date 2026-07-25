// apps/web/src/app/features/partner-portal/partner-portal.routes.ts
import { Routes } from '@angular/router';

export const PARTNER_PORTAL_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/portal-home/portal-home.page').then(m => m.PortalHomePage) },
  { path: 'my-transactions', loadComponent: () => import('./pages/my-transactions/my-transactions.page').then(m => m.MyTransactionsPage) },
  { path: 'my-statement', loadComponent: () => import('./pages/my-statement/my-statement.page').then(m => m.MyStatementPage) },
  // ponytail: reuses settlement-fees' BreakdownPage component as-is (no partner-specific
  // logic in it — it's already role-agnostic, backed by an API endpoint that already
  // enforces E4110 scoping for PARTNER_COORDINATOR). A dedicated /portal route entry
  // avoids widening the HQ_ADMIN-only /settlement-fees route guard just for this one page.
  { path: 'breakdown/:transactionId', loadComponent: () => import('../settlement-fees/pages/breakdown/breakdown.page').then(m => m.BreakdownPage) },
];
