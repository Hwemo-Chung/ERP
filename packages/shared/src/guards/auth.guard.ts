import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthServiceInterface, AUTH_SERVICE_TOKEN } from '../interceptors/auth.interface';

export const authGuard: CanActivateFn = async () => {
  const authService = inject<AuthServiceInterface>(AUTH_SERVICE_TOKEN as never);
  const router = inject(Router);

  await authService.initialize();

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/auth/login']);
};
