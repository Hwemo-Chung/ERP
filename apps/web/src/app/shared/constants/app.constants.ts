/**
 * @fileoverview 애플리케이션 공통 상수 정의
 * @description 모든 하드코딩된 값들을 중앙화하여 유지보수성을 향상시킵니다.
 * 
 * 사용 예시:
 * ```typescript
 * import { APP_CONSTANTS, ORDER_STATUS } from '@shared/constants';
 * ```
 */

/**
 * 지원 언어 코드
 * @description i18n에서 사용되는 언어 코드 상수
 */
export const LANGUAGE_CODES = {
  /** 한국어 */
  KOREAN: 'ko',
  /** 영어 */
  ENGLISH: 'en',
} as const;

/** 언어 코드 타입 */
export type LanguageCode = typeof LANGUAGE_CODES[keyof typeof LANGUAGE_CODES];

/**
 * 기본 언어 설정
 * @description 앱의 기본 언어는 한국어
 */
export const DEFAULT_LANGUAGE: LanguageCode = LANGUAGE_CODES.KOREAN;

/**
 * 주문 상태 코드
 * @description 주문의 진행 상태를 나타내는 상수
 */
export const ORDER_STATUS = {
  /** 대기 - 신규 주문, 아직 배정되지 않음 */
  PENDING: 'PENDING',
  /** 배정완료 - 설치기사에게 배정됨 */
  ASSIGNED: 'ASSIGNED',
  /** 배송중 - 설치기사가 출발함 */
  DISPATCHED: 'DISPATCHED',
  /** 설치중 - 현장에서 설치 진행 중 */
  IN_PROGRESS: 'IN_PROGRESS',
  /** 완료 - 설치 완료 */
  COMPLETED: 'COMPLETED',
  /** 취소 - 주문 취소됨 */
  CANCELLED: 'CANCELLED',
  /** 연기 - 설치 일정 연기 */
  POSTPONED: 'POSTPONED',
  /** 부재 - 고객 부재로 설치 불가 */
  ABSENCE: 'ABSENCE',
} as const;

/** 주문 상태 타입 */
export type OrderStatusType = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

/**
 * 사용자 역할 코드
 * @description 시스템 내 사용자 역할을 정의하는 상수
 */
export const USER_ROLES = {
  /** 본사 관리자 - 전체 시스템 관리 및 정산 잠금 해제 권한 */
  HQ_ADMIN: 'HQ_ADMIN',
  /** 지점장 - 지점 내 주문 관리 및 배정 권한 */
  BRANCH_MANAGER: 'BRANCH_MANAGER',
  /** 협력업체 관리자 - 협력업체 주문 완료 처리 권한 */
  PARTNER_COORDINATOR: 'PARTNER_COORDINATOR',
  /** 설치기사 - 배정된 주문 설치 완료 권한 */
  INSTALLER: 'INSTALLER',
} as const;

/** 사용자 역할 타입 */
export type UserRoleType = typeof USER_ROLES[keyof typeof USER_ROLES];

/**
 * 네비게이션 경로
 * @description 앱 내 라우팅 경로 상수
 */
export const ROUTES = {
  /** 인증 관련 */
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
  },
  /** 메인 탭 */
  TABS: {
    ROOT: '/tabs',
    DASHBOARD: '/tabs/dashboard',
    ORDERS: '/tabs/orders',
    ASSIGNMENT: '/tabs/assignment',
    COMPLETION: '/tabs/completion',
    PROFILE: '/tabs/profile',
  },
  /** 주문 관련 */
  ORDERS: {
    LIST: '/tabs/orders',
    DETAIL: '/tabs/orders/detail',
    ASSIGN: '/tabs/orders/assign',
    COMPLETE: '/tabs/orders/complete',
    POSTPONE: '/tabs/orders/postpone',
    ABSENCE: '/tabs/orders/absence',
  },
  /** 리포트 */
  REPORTS: {
    ROOT: '/tabs/reports',
  },
  /** 설정 */
  SETTINGS: {
    ROOT: '/tabs/settings',
  },
} as const;

/**
 * 로컬 스토리지 키
 * @description 브라우저 저장소에서 사용되는 키 상수
 */
export const STORAGE_KEYS = {
  /** 인증 토큰 */
  AUTH_TOKEN: 'auth_token',
  /** 리프레시 토큰 */
  REFRESH_TOKEN: 'refresh_token',
  /** 현재 사용자 정보 */
  CURRENT_USER: 'current_user',
  /** 선택된 언어 */
  SELECTED_LANGUAGE: 'selected_language',
  /** 다크 모드 설정 */
  DARK_MODE: 'dark_mode',
  /** 마지막 동기화 시간 */
  LAST_SYNC_TIME: 'last_sync_time',
  /** 오프라인 대기 작업 */
  OFFLINE_QUEUE: 'offline_queue',
} as const;

/**
 * API 엔드포인트 경로
 * @description 백엔드 API 경로 상수 (environment.apiUrl과 결합하여 사용)
 */
export const API_ENDPOINTS = {
  /** 인증 */
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    ME: '/auth/me',
  },
  /** 주문 */
  ORDERS: {
    ROOT: '/orders',
    DETAIL: (id: string) => `/orders/${id}`,
    ASSIGN: (id: string) => `/orders/${id}/assign`,
    COMPLETE: (id: string) => `/orders/${id}/complete`,
    CANCEL: (id: string) => `/orders/${id}/cancel`,
    POSTPONE: (id: string) => `/orders/${id}/postpone`,
    ABSENCE: (id: string) => `/orders/${id}/absence`,
    SUMMARY: '/orders/summary',
    TODAY: '/orders/today',
  },
  /** 설치기사 */
  INSTALLERS: {
    ROOT: '/installers',
    DETAIL: (id: string) => `/installers/${id}`,
    AVAILABLE: '/installers/available',
  },
  /** 리포트 */
  REPORTS: {
    DAILY: '/reports/daily',
    WEEKLY: '/reports/weekly',
    MONTHLY: '/reports/monthly',
  },
  /** 사용자 */
  USERS: {
    ROOT: '/users',
    PROFILE: '/users/profile',
  },
} as const;

/**
 * HTTP 상태 코드
 * @description 일반적으로 사용되는 HTTP 상태 코드 상수
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * 페이지네이션 기본값
 * @description 목록 조회 시 페이지네이션 기본 설정
 */
export const PAGINATION = {
  /** 기본 페이지 번호 */
  DEFAULT_PAGE: 1,
  /** 기본 페이지 크기 */
  DEFAULT_PAGE_SIZE: 20,
  /** 최대 페이지 크기 */
  MAX_PAGE_SIZE: 100,
} as const;

/**
 * 검색 설정
 * @description 검색 기능 관련 설정 상수
 */
export const SEARCH_CONFIG = {
  /** 디바운스 시간 (밀리초) */
  DEBOUNCE_TIME: 300,
  /** 최소 검색어 길이 */
  MIN_SEARCH_LENGTH: 2,
} as const;

/**
 * 날짜/시간 형식
 * @description 날짜 포맷팅에 사용되는 형식 문자열
 */
export const DATE_FORMATS = {
  /** 표시용 날짜 (YYYY년 MM월 DD일) */
  DISPLAY_DATE: 'yyyy년 MM월 dd일',
  /** 표시용 시간 (HH:mm) */
  DISPLAY_TIME: 'HH:mm',
  /** 표시용 날짜시간 */
  DISPLAY_DATETIME: 'yyyy년 MM월 dd일 HH:mm',
  /** API용 날짜 (ISO 형식) */
  API_DATE: 'yyyy-MM-dd',
  /** API용 날짜시간 (ISO 형식) */
  API_DATETIME: "yyyy-MM-dd'T'HH:mm:ss",
} as const;

/**
 * 반응형 레이아웃 브레이크포인트
 * @description 화면 크기에 따른 레이아웃 분기점 (픽셀)
 */
export const BREAKPOINTS = {
  /** 모바일 최대 너비 */
  MOBILE: 576,
  /** 태블릿 최대 너비 */
  TABLET: 768,
  /** 데스크탑 최소 너비 */
  DESKTOP: 992,
  /** 대형 화면 최소 너비 */
  LARGE: 1200,
  /** 웹 뷰 전환 기준 */
  WEB_VIEW: 1080,
} as const;

/**
 * 애플리케이션 설정
 * @description 앱 전역 설정 값
 */
export const APP_CONFIG = {
  /** 앱 이름 */
  APP_NAME: '물류 ERP',
  /** 앱 버전 (package.json에서 가져오는 것이 이상적) */
  VERSION: '1.0.0',
  /** 저작권 연도 */
  COPYRIGHT_YEAR: 2025,
  /** 새로고침 간격 (밀리초) */
  REFRESH_INTERVAL: 30000,
  /** 토스트 표시 시간 (밀리초) */
  TOAST_DURATION: 3000,
  /** 최대 재시도 횟수 */
  MAX_RETRY_ATTEMPTS: 3,
} as const;
