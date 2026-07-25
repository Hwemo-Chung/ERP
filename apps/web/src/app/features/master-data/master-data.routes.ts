// apps/web/src/app/features/master-data/master-data.routes.ts
import { Routes } from '@angular/router';

export const MASTER_DATA_ROUTES: Routes = [
  { path: 'partners', loadComponent: () => import('./pages/partner-list/partner-list.page').then(m => m.PartnerListPage) },
  { path: 'partners/new', loadComponent: () => import('./pages/partner-form/partner-form.page').then(m => m.PartnerFormPage) },
  { path: 'products', loadComponent: () => import('./pages/product-list/product-list.page').then(m => m.ProductListPage) },
  { path: 'products/new', loadComponent: () => import('./pages/product-form/product-form.page').then(m => m.ProductFormPage) },
  { path: 'categories', loadComponent: () => import('./pages/category-tree/category-tree.page').then(m => m.CategoryTreePage) },
  { path: 'rate-cards', loadComponent: () => import('./pages/rate-cards/rate-cards.page').then(m => m.RateCardsPage) },
  { path: 'import', loadComponent: () => import('./pages/master-import/master-import.page').then(m => m.MasterImportPage) },
];
