import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap, catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  // Skip auth header for static assets (i18n, images, etc.)
  if (req.url.includes('/assets/')) {
    return next(req);
  }

  const authService = inject(AuthService);
  const token = authService.getAccessToken();

  // Skip auth header for login/refresh endpoints
  if (req.url.includes('/auth/login') || req.url.includes('/auth/refresh')) {
    return next(req);
  }

  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Token expired - try refresh
      if (error.status === 401 && !req.url.includes('/auth/refresh')) {
        return from(authService.refreshTokens()).pipe(
          switchMap((success) => {
            if (success) {
              const newToken = authService.getAccessToken();
              const newReq = req.clone({
                setHeaders: {
                  Authorization: `Bearer ${newToken}`,
                },
              });
              return next(newReq);
            }
            return throwError(() => error);
          })
        );
      }
      return throwError(() => error);
    })
  );
};
