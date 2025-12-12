import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

/**
 * LoggingInterceptor - Logs all incoming requests and responses with timing
 *
 * Features:
 * - Logs request method, URL, user ID, correlation ID
 * - Calculates and logs response time in milliseconds
 * - Sanitizes sensitive data (passwords) in request body
 * - Uses NestJS Logger with pino-style structured logging
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, headers, body } = request;
    const startTime = Date.now();

    // Extract user info from JWT payload (if authenticated)
    const user = request.user as JwtPayload | undefined;
    const userId = user?.sub || 'anonymous';

    // Extract correlation ID from headers
    const correlationId =
      (headers['x-correlation-id'] as string) || this.generateCorrelationId();

    // Sanitize request body for logging (remove passwords)
    const sanitizedBody = this.sanitizeRequestBody(body);

    // Log incoming request
    this.logger.log({
      msg: 'Incoming request',
      method,
      url,
      userId,
      correlationId,
      ...(method !== 'GET' && Object.keys(sanitizedBody).length > 0
        ? { body: sanitizedBody }
        : {}),
    });

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.log({
            msg: 'Request completed',
            method,
            url,
            userId,
            correlationId,
            duration: `${duration}ms`,
            statusCode: context.switchToHttp().getResponse().statusCode,
          });
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.error({
            msg: 'Request failed',
            method,
            url,
            userId,
            correlationId,
            duration: `${duration}ms`,
            error: error.message,
            stack: error.stack,
          });
        },
      }),
    );
  }

  /**
   * Sanitize request body by removing sensitive fields
   */
  private sanitizeRequestBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return {};
    }

    const sensitiveFields = [
      'password',
      'currentPassword',
      'newPassword',
      'confirmPassword',
      'token',
      'refreshToken',
      'secret',
      'apiKey',
    ];

    const sanitized = { ...body };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '***REDACTED***';
      }
    }

    return sanitized;
  }

  /**
   * Generate a simple correlation ID if not provided
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
