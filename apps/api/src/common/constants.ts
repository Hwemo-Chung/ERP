/**
 * Common constants for the API
 */

// Redis injection token
export const REDIS_PROVIDER = 'REDIS_PROVIDER';

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  KPI: 60 * 60, // 1 hour
  METADATA: 60 * 60 * 24, // 24 hours
  SETTLEMENT_LOCK: 60 * 60 * 24 * 7, // 1 week
};

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};
