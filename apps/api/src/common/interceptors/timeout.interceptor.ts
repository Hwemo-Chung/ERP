import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

/**
 * TimeoutInterceptor - Adds timeout to all API requests
 *
 * Features:
 * - Default 30 second timeout for all requests
 * - Throws RequestTimeoutException on timeout
 * - Can be customized per endpoint using metadata
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly defaultTimeout = 30000; // 30 seconds in milliseconds

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Get custom timeout from metadata if set, otherwise use default
    const customTimeout = this.getCustomTimeout(context);
    const timeoutDuration = customTimeout || this.defaultTimeout;

    return next.handle().pipe(
      timeout(timeoutDuration),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(
            () =>
              new RequestTimeoutException(
                `Request exceeded timeout of ${timeoutDuration}ms`,
              ),
          );
        }
        return throwError(() => err);
      }),
    );
  }

  /**
   * Get custom timeout from route metadata if set
   * This allows per-route timeout customization using @SetMetadata('timeout', 60000)
   */
  private getCustomTimeout(context: ExecutionContext): number | null {
    const handler = context.getHandler();
    const classRef = context.getClass();

    // Check handler metadata first, then class metadata
    const handlerTimeout = Reflect.getMetadata('timeout', handler);
    const classTimeout = Reflect.getMetadata('timeout', classRef);

    return handlerTimeout || classTimeout || null;
  }
}
