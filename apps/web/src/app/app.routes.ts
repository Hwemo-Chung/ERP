import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';
import { noAuthGuard } from '@core/guards/no-auth.guard';
import { roleGuard } from '@core/guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'tabs',
    pathMatch: 'full',
  },
  {
    path: 'auth',
    canActivate: [noAuthGuard],
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },
  {
    path: 'tabs',
    canActivate: [authGuard],
    loadChildren: () => import('./features/tabs/tabs.routes').then(m => m.TABS_ROUTES),
  },
  {
    path: 'master-data',
    canActivate: [authGuard, roleGuard('HQ_ADMIN')],
    loadChildren: () =>
      import('./features/master-data/master-data.routes').then(m => m.MASTER_DATA_ROUTES),
  },
  {
    path: '**',
    redirectTo: 'tabs',
  },
];
