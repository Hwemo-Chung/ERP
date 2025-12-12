/**
 * Error Code Constants
 * Based on SDD section 8.1 Error Code Taxonomy
 *
 * Defines all error codes and their Korean labels for UI display
 */

export enum ErrorCode {
  // Authentication (E1xxx)
  INVALID_CREDENTIALS = 'E1001',
  TOKEN_EXPIRED = 'E1002',
  INSUFFICIENT_PERMISSIONS = 'E1003',
  SESSION_EXPIRED = 'E1004',
  BIOMETRIC_FAILED = 'E1005',

  // Business Rule Violation (E2xxx)
  INVALID_STATUS_TRANSITION = 'E2001',
  SETTLEMENT_LOCKED = 'E2002',
  APPOINTMENT_DATE_EXCEEDED = 'E2003',
  ORDER_ALREADY_COMPLETED = 'E2004',
  SPLIT_NOT_ALLOWED = 'E2005',
  VERSION_CONFLICT = 'E2006',

  // Validation (E3xxx)
  REQUIRED_FIELD_MISSING = 'E3001',
  INVALID_FORMAT = 'E3002',
  DUPLICATE_ENTRY = 'E3003',
  MAX_ITEMS_EXCEEDED = 'E3004',

  // External System (E4xxx)
  PUSH_GATEWAY_ERROR = 'E4001',
  STORAGE_UPLOAD_FAILED = 'E4002',

  // System/Infrastructure (E5xxx)
  DATABASE_CONNECTION_FAILED = 'E5001',
  REDIS_TIMEOUT = 'E5002',
}

/**
 * Korean labels for error codes
 */
export const ERROR_CODE_LABELS: Record<ErrorCode, string> = {
  // Authentication
  [ErrorCode.INVALID_CREDENTIALS]: '아이디 또는 비밀번호가 올바르지 않습니다',
  [ErrorCode.TOKEN_EXPIRED]: '인증이 만료되었습니다. 다시 로그인해 주세요',
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: '접근 권한이 없습니다',
  [ErrorCode.SESSION_EXPIRED]: '세션이 만료되었습니다',
  [ErrorCode.BIOMETRIC_FAILED]: '생체 인증에 실패했습니다',

  // Business Rule
  [ErrorCode.INVALID_STATUS_TRANSITION]: '상태 변경이 허용되지 않습니다',
  [ErrorCode.SETTLEMENT_LOCKED]: '정산 마감된 주문은 수정할 수 없습니다',
  [ErrorCode.APPOINTMENT_DATE_EXCEEDED]: '방문 예정일이 초과되었습니다',
  [ErrorCode.ORDER_ALREADY_COMPLETED]: '이미 완료된 주문입니다',
  [ErrorCode.SPLIT_NOT_ALLOWED]: '분할 처리가 허용되지 않습니다',
  [ErrorCode.VERSION_CONFLICT]: '다른 사용자가 수정한 내용과 충돌합니다',

  // Validation
  [ErrorCode.REQUIRED_FIELD_MISSING]: '필수 항목이 누락되었습니다',
  [ErrorCode.INVALID_FORMAT]: '형식이 올바르지 않습니다',
  [ErrorCode.DUPLICATE_ENTRY]: '이미 존재하는 데이터입니다',
  [ErrorCode.MAX_ITEMS_EXCEEDED]: '최대 항목 수를 초과했습니다',

  // External
  [ErrorCode.PUSH_GATEWAY_ERROR]: '알림 전송에 실패했습니다',
  [ErrorCode.STORAGE_UPLOAD_FAILED]: '파일 업로드에 실패했습니다',

  // System
  [ErrorCode.DATABASE_CONNECTION_FAILED]: '데이터베이스 연결에 실패했습니다',
  [ErrorCode.REDIS_TIMEOUT]: '캐시 서버 응답 시간 초과',
};

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Map error codes to severity
 */
export const ERROR_SEVERITY_MAP: Record<ErrorCode, ErrorSeverity> = {
  // Auth errors - recoverable
  [ErrorCode.INVALID_CREDENTIALS]: ErrorSeverity.WARNING,
  [ErrorCode.TOKEN_EXPIRED]: ErrorSeverity.INFO,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: ErrorSeverity.WARNING,
  [ErrorCode.SESSION_EXPIRED]: ErrorSeverity.INFO,
  [ErrorCode.BIOMETRIC_FAILED]: ErrorSeverity.WARNING,

  // Business rules - user action needed
  [ErrorCode.INVALID_STATUS_TRANSITION]: ErrorSeverity.WARNING,
  [ErrorCode.SETTLEMENT_LOCKED]: ErrorSeverity.ERROR,
  [ErrorCode.APPOINTMENT_DATE_EXCEEDED]: ErrorSeverity.WARNING,
  [ErrorCode.ORDER_ALREADY_COMPLETED]: ErrorSeverity.WARNING,
  [ErrorCode.SPLIT_NOT_ALLOWED]: ErrorSeverity.WARNING,
  [ErrorCode.VERSION_CONFLICT]: ErrorSeverity.ERROR,

  // Validation - user fixable
  [ErrorCode.REQUIRED_FIELD_MISSING]: ErrorSeverity.WARNING,
  [ErrorCode.INVALID_FORMAT]: ErrorSeverity.WARNING,
  [ErrorCode.DUPLICATE_ENTRY]: ErrorSeverity.WARNING,
  [ErrorCode.MAX_ITEMS_EXCEEDED]: ErrorSeverity.WARNING,

  // External - retry possible
  [ErrorCode.PUSH_GATEWAY_ERROR]: ErrorSeverity.ERROR,
  [ErrorCode.STORAGE_UPLOAD_FAILED]: ErrorSeverity.ERROR,

  // System - critical
  [ErrorCode.DATABASE_CONNECTION_FAILED]: ErrorSeverity.CRITICAL,
  [ErrorCode.REDIS_TIMEOUT]: ErrorSeverity.CRITICAL,
};

/**
 * Get error label by code
 */
export function getErrorLabel(code: string): string {
  return ERROR_CODE_LABELS[code as ErrorCode] || '알 수 없는 오류가 발생했습니다';
}

/**
 * Get error severity by code
 */
export function getErrorSeverity(code: string): ErrorSeverity {
  return ERROR_SEVERITY_MAP[code as ErrorCode] || ErrorSeverity.ERROR;
}

/**
 * Check if error is recoverable (user can retry)
 */
export function isRecoverableError(code: string): boolean {
  const severity = getErrorSeverity(code);
  return severity === ErrorSeverity.INFO || severity === ErrorSeverity.WARNING;
}

/**
 * Check if error requires conflict resolution UI
 */
export function isConflictError(code: string): boolean {
  return code === ErrorCode.VERSION_CONFLICT;
}
