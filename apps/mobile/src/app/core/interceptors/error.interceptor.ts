import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastController } from '@ionic/angular/standalone';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  // Skip interceptor for static assets (i18n, images, etc.)
  if (req.url.includes('/assets/')) {
    return next(req);
  }

  const toastCtrl = inject(ToastController);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let message = 'An error occurred';

      if (error.error instanceof ErrorEvent) {
        // Client-side error
        message = error.error.message;
      } else {
        // Server-side error
        switch (error.status) {
          case 0:
            message = 'Unable to connect to server';
            break;
          case 400:
            message = error.error?.message || 'Invalid request';
            break;
          case 401:
            // Handled by auth interceptor
            return throwError(() => error);
          case 403:
            message = 'Access denied';
            break;
          case 404:
            message = 'Resource not found';
            break;
          case 409:
            message = error.error?.message || 'Conflict - data may have been modified';
            break;
          case 422:
            message = error.error?.message || 'Validation failed';
            break;
          case 500:
            message = 'Server error. Please try again later.';
            break;
          default:
            message = error.error?.message || `Error: ${error.status}`;
        }
      }

      // Show toast for errors (except 401 which is handled separately)
      if (error.status !== 401) {
        toastCtrl
          .create({
            message,
            duration: 3000,
            position: 'bottom',
            color: 'danger',
          })
          .then((toast) => toast.present());
      }

      return throwError(() => error);
    }),
  );
};
