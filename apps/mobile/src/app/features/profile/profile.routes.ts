import { Routes } from '@angular/router';

/**
 * Profile Feature Routes
 * Lazy-loaded profile page with user settings
 */
export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./profile.page').then((m) => m.ProfilePage),
  },
];
