import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap, catchError, throwError } from 'rxjs';
import { AuthServiceInterface, AUTH_SERVICE_TOKEN } from './auth.interface';

const SKIP_AUTH_PATHS = ['/assets/', '/auth/login', '/auth/refresh', '/auth/logout'];

function shouldSkipAuth(url: string): boolean {
  return SKIP_AUTH_PATHS.some((path) => url.includes(path));
}

function cloneWithAuth(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });
}

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  if (shouldSkipAuth(req.url)) {
    return next(req);
  }

  const authService = inject<AuthServiceInterface>(AUTH_SERVICE_TOKEN as never);
  const token = authService.getAccessToken();

  const authReq = token ? cloneWithAuth(req, token) : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/refresh')) {
        return from(authService.refreshTokens()).pipe(
          switchMap((success: boolean) => {
            if (success) {
              const newToken = authService.getAccessToken();
              return newToken ? next(cloneWithAuth(req, newToken)) : throwError(() => error);
            }
            return throwError(() => error);
          }),
        );
      }
      return throwError(() => error);
    }),
  );
};
