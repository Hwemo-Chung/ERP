// apps/web/src/app/features/warehouse/warehouse.routes.ts
import { Routes } from '@angular/router';

export const WAREHOUSE_ROUTES: Routes = [
  { path: '', redirectTo: 'entry', pathMatch: 'full' },
  { path: 'entry', loadComponent: () => import('./pages/transaction-entry/transaction-entry.page').then(m => m.TransactionEntryPage) },
  { path: 'list', loadComponent: () => import('./pages/transaction-list/transaction-list.page').then(m => m.TransactionListPage) },
  { path: 'import', loadComponent: () => import('./pages/transaction-import/transaction-import.page').then(m => m.TransactionImportPage) },
];
