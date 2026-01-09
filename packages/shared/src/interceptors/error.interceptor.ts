import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastController } from '@ionic/angular/standalone';

const HTTP_ERROR_MESSAGES: Record<number, string> = {
  0: 'Unable to connect to server',
  400: 'Invalid request',
  403: 'Access denied',
  404: 'Resource not found',
  409: 'Conflict - data may have been modified',
  422: 'Validation failed',
  500: 'Server error. Please try again later.',
};

function getErrorMessage(error: HttpErrorResponse): string {
  if (error.error instanceof ErrorEvent) {
    return error.error.message;
  }

  const defaultMessage = HTTP_ERROR_MESSAGES[error.status];
  if (defaultMessage && error.status !== 400 && error.status !== 409 && error.status !== 422) {
    return defaultMessage;
  }

  return error.error?.message || defaultMessage || `Error: ${error.status}`;
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.includes('/assets/')) {
    return next(req);
  }

  const toastCtrl = inject(ToastController);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        return throwError(() => error);
      }

      const message = getErrorMessage(error);

      toastCtrl
        .create({
          message,
          duration: 3000,
          position: 'bottom',
          color: 'danger',
        })
        .then((toast) => toast.present());

      return throwError(() => error);
    }),
  );
};
