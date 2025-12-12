import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';
import { noAuthGuard } from '@core/guards/no-auth.guard';

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
    path: '**',
    redirectTo: 'tabs',
  },
];
