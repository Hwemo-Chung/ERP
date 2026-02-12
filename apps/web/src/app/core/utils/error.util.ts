/**
 * Type-safe error handling utilities
 * Replaces 'any' type in catch blocks with proper type guards
 */
import { environment } from '@env/environment';

/**
 * Type guard to check if value is an Error instance
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Type guard to check if value has a message property
 */
export function hasMessage(value: unknown): value is { message: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as { message: unknown }).message === 'string'
  );
}

/**
 * Type guard to check if value has a code property (API error)
 */
export function hasErrorCode(value: unknown): value is { code: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof (value as { code: unknown }).code === 'string'
  );
}

/**
 * Type guard to check if value is an HTTP error with status
 */
export function isHttpError(value: unknown): value is { status: number; message?: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    typeof (value as { status: unknown }).status === 'number'
  );
}

/**
 * Extract error message from unknown error type
 * Safe to use in catch blocks
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (hasMessage(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

/**
 * Extract error code from unknown error type
 * Returns null if no code found
 */
export function getErrorCode(error: unknown): string | null {
  if (hasErrorCode(error)) {
    return error.code;
  }
  // Check nested error structure (API response)
  if (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    hasErrorCode((error as { error: unknown }).error)
  ) {
    return (error as { error: { code: string } }).error.code;
  }
  return null;
}

/**
 * Extract HTTP status from unknown error type
 * Returns null if no status found
 */
export function getHttpStatus(error: unknown): number | null {
  if (isHttpError(error)) {
    return error.status;
  }
  return null;
}

/**
 * Safely log error to console with context
 */
export function logError(context: string, error: unknown): void {
  const message = getErrorMessage(error);
  const code = getErrorCode(error);
  const status = getHttpStatus(error);

  if (!environment.production) {
    console.error(`[${context}] Error:`, {
      message,
      ...(code && { code }),
      ...(status && { status }),
      raw: error,
    });
  }
}
