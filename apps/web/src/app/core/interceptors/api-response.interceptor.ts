import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs/operators';

interface ApiResponse {
  success: boolean;
  data: unknown;
  timestamp?: string;
}

/**
 * API Response Interceptor
 * Unwraps the standard API response format: { success, data, timestamp }
 * Extracts the 'data' field for cleaner service/store code
 */
export const apiResponseInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    map((event) => {
      if (event instanceof HttpResponse && event.body) {
        const body = event.body as ApiResponse;

        // Check if response follows our API wrapper format
        if (body.success === true && body.data !== undefined) {
          // Return unwrapped data
          return event.clone({ body: body.data });
        }
      }
      return event;
    })
  );
};
