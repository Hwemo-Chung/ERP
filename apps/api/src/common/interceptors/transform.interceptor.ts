import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';

/**
 * Standard API response format
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

/**
 * TransformInterceptor - Wraps all successful responses in a standard format
 *
 * Features:
 * - Wraps responses in { success: true, data: <response>, timestamp: <ISO string> }
 * - Skips transformation for health check endpoints
 * - Maintains proper typing for response data
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();

    // Skip transformation for health check endpoints
    if (this.isHealthCheckEndpoint(request.url)) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }

  /**
   * Check if the endpoint is a health check endpoint
   */
  private isHealthCheckEndpoint(url: string): boolean {
    const healthCheckPaths = ['/api/health', '/health', '/api/v1/health'];
    return healthCheckPaths.some((path) => url.startsWith(path));
  }
}
