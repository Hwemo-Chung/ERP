import { ErrorHandler, Injectable, inject, isDevMode } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import * as Sentry from '@sentry/angular';
import { LoggerService } from '../services/logger.service';

/**
 * Error codes that should not be reported to Sentry
 * (expected errors, user-caused errors, etc.)
 */
const IGNORED_ERROR_CODES = ['E1001', 'E1002', 'E2006']; // auth, validation, conflict

/**
 * HTTP status codes that should not be reported to Sentry
 * (client errors are usually user-caused)
 */
const IGNORED_HTTP_STATUSES = [400, 401, 403, 404, 409, 422];

/**
 * Global Error Handler
 * @description Handles all uncaught errors in the application
 *
 * Features:
 * - Converts error codes (E1xxx~E5xxx) to user-friendly messages
 * - Displays toast notifications
 * - Reports errors to Sentry in production
 * - Follows complexity requirements (CC ≤ 10, Cognitive ≤ 15)
 *
 * @implements {ErrorHandler}
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly toastCtrl = inject(ToastController);
  private readonly translate = inject(TranslateService);
  private readonly logger = inject(LoggerService);

  /**
   * Handle application errors
   * @param error - Error object (can be any type)
   */
  handleError(error: unknown): void {
    this.logger.error('GlobalErrorHandler:', error);
    this.logToMonitoring(error);
    this.showUserMessage(error);
  }

  /**
   * Log error to Sentry monitoring service
   * @param error - Error object
   */
  private logToMonitoring(error: unknown): void {
    // Skip Sentry in development mode
    if (isDevMode()) {
      return;
    }

    // Skip ignored errors
    if (this.shouldIgnoreError(error)) {
      return;
    }

    // Report to Sentry with context
    const errorCode = this.extractErrorCode(error);
    const httpStatus = this.extractHttpStatus(error);

    Sentry.withScope((scope) => {
      if (errorCode) {
        scope.setTag('error_code', errorCode);
      }
      if (httpStatus) {
        scope.setTag('http_status', httpStatus.toString());
      }
      scope.setLevel(this.getSentryLevel(error));

      if (error instanceof Error) {
        Sentry.captureException(error);
      } else {
        Sentry.captureMessage(String(error), 'error');
      }
    });
  }

  /**
   * Determine if error should be ignored for Sentry reporting
   * @param error - Error object
   * @returns true if error should not be reported
   */
  private shouldIgnoreError(error: unknown): boolean {
    const code = this.extractErrorCode(error);
    if (code && IGNORED_ERROR_CODES.includes(code)) {
      return true;
    }

    const status = this.extractHttpStatus(error);
    if (status && IGNORED_HTTP_STATUSES.includes(status)) {
      return true;
    }

    return false;
  }

  /**
   * Extract HTTP status from error
   * @param error - Error object
   * @returns HTTP status code or null
   */
  private extractHttpStatus(error: unknown): number | null {
    if (error instanceof HttpErrorResponse) {
      return error.status;
    }
    return null;
  }

  /**
   * Get Sentry severity level based on error type
   * @param error - Error object
   * @returns Sentry severity level
   */
  private getSentryLevel(error: unknown): Sentry.SeverityLevel {
    if (error instanceof HttpErrorResponse && error.status >= 500) {
      return 'error';
    }
    return 'warning';
  }

  /**
   * Show user-friendly error message
   * @param error - Error object
   */
  private showUserMessage(error: unknown): void {
    const message = this.getErrorMessage(error);
    const color = this.getErrorColor(error);
    this.presentToast(message, color);
  }

  /**
   * Get user-friendly error message
   * @param error - Error object
   * @returns Translated error message
   */
  private getErrorMessage(error: unknown): string {
    const code = this.extractErrorCode(error);
    if (code) {
      return this.translate.instant(`errors.${code}`);
    }

    if (error instanceof HttpErrorResponse) {
      return this.getHttpErrorMessage(error);
    }

    return this.translate.instant('errors.unknown');
  }

  /**
   * Extract error code from error object
   * @param error - Error object
   * @returns Error code (e.g., 'E1001') or null
   */
  private extractErrorCode(error: unknown): string | null {
    if (error instanceof HttpErrorResponse) {
      return error.error?.code || error.error?.error || null;
    }
    return null;
  }

  /**
   * Get HTTP status code specific error message
   * @param error - HttpErrorResponse
   * @returns Translated error message
   */
  private getHttpErrorMessage(error: HttpErrorResponse): string {
    switch (error.status) {
      case 401:
        return this.translate.instant('errors.unauthorized');
      case 403:
        return this.translate.instant('errors.forbidden');
      case 404:
        return this.translate.instant('errors.not_found');
      case 409:
        return this.translate.instant('errors.conflict');
      case 500:
        return this.translate.instant('errors.server_error');
      default:
        return this.translate.instant('errors.network_error');
    }
  }

  /**
   * Determine toast color based on error severity
   * @param error - Error object
   * @returns Toast color ('danger' for 5xx, 'warning' for others)
   */
  private getErrorColor(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status >= 500) {
      return 'danger';
    }
    return 'warning';
  }

  /**
   * Present toast notification
   * @param message - Message to display
   * @param color - Toast color
   */
  private async presentToast(message: string, color: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'top',
      color,
    });
    await toast.present();
  }
}
