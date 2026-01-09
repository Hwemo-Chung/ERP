/**
 * Error handling utilities
 * Shared between mobile and web apps
 */

/** HTTP error interface for type checking */
interface HttpErrorLike {
  status?: number;
  error?: {
    message?: string;
  };
}

/** Object with message property */
interface HasMessage {
  message?: string;
}

/**
 * Check if error is an HTTP error with status code
 */
export function isHttpError(error: unknown): error is HttpErrorLike & { status: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as HttpErrorLike).status === 'number'
  );
}

/**
 * Check if error has a message property
 */
export function hasMessage(error: unknown): error is HasMessage {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as HasMessage).message === 'string'
  );
}

export function extractErrorMessage(error: unknown, defaultMessage = 'An error occurred'): string {
  if (typeof error === 'string') {
    return error;
  }

  if (isHttpError(error) && error.error?.message) {
    return error.error.message;
  }

  if (hasMessage(error) && error.message) {
    return error.message;
  }

  return defaultMessage;
}
