import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp?: string;
  pagination?: unknown;
}

/**
 * API Response Interceptor
 * Automatically unwraps API responses from { success, data } format
 * to just the data portion for cleaner service code
 */
export const apiResponseInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    map((event) => {
      if (event instanceof HttpResponse && event.body) {
        const body = event.body as ApiResponse<unknown>;

        // Check if response matches our API wrapper format
        if (
          typeof body === 'object' &&
          'success' in body &&
          'data' in body &&
          body.success === true
        ) {
          // Return unwrapped data
          return event.clone({ body: body.data });
        }
      }
      return event;
    })
  );
};
