export const ERROR_CODES = {
  // E1xxx - Authentication errors
  E1002: 'error.token_required',

  // E2xxx - Order/Business logic errors
  E2000: 'error.unknown_order_error',
  E2001: 'error.invalid_state_transition',
  E2002: 'error.settlement_locked',
  E2003: 'error.max_absence_exceeded',
  E2006: 'error.version_conflict',
  E2017: 'error.order_locked',
  E2018: 'error.invalid_order_data',
  E2019: 'error.split_validation_failed',
  E2020: 'error.split_quantity_invalid',
  E2021: 'error.absence_limit_reached',
  E2022: 'error.absence_invalid_state',
  E2023: 'error.absence_processing_failed',
  E2024: 'error.postpone_validation_failed',
  E2025: 'error.postpone_date_invalid',
  E2026: 'error.postpone_state_invalid',
  E2027: 'error.postpone_processing_failed',
  E2030: 'error.batch_sync_partial_failure',

  // E5xxx - Server errors
  E5000: 'error.internal_server_error',
  E5001: 'error.connection_failed',
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export function getErrorMessage(code: string): string {
  return ERROR_CODES[code as ErrorCode] ?? `error.unknown (${code})`;
}

export function isKnownErrorCode(code: string): code is ErrorCode {
  return code in ERROR_CODES;
}
