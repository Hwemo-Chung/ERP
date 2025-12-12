import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const noAuthGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Initialize auth state from storage
  await authService.initialize();

  if (!authService.isAuthenticated()) {
    return true;
  }

  // Already logged in - redirect to home
  return router.createUrlTree(['/tabs/orders']);
};
