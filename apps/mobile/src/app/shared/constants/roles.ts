/**
 * User Role Constants
 * Based on SDD section 7.2 RBAC Matrix
 *
 * Defines user roles and their i18n-compatible labels for UI display
 */

import { TranslationService } from '@core/services/translation.service';

export enum UserRole {
  HQ_ADMIN = 'HQ_ADMIN',
  BRANCH_MANAGER = 'BRANCH_MANAGER',
  PARTNER_COORDINATOR = 'PARTNER_COORDINATOR',
  INSTALLER = 'INSTALLER',
}

/**
 * Role i18n key mapping
 * Maps roles to translation keys in i18n JSON files
 */
const USER_ROLE_I18N_KEYS: Record<UserRole, string> = {
  [UserRole.HQ_ADMIN]: 'ROLES.HQ_ADMIN',
  [UserRole.BRANCH_MANAGER]: 'ROLES.BRANCH_MANAGER',
  [UserRole.PARTNER_COORDINATOR]: 'ROLES.PARTNER_COORDINATOR',
  [UserRole.INSTALLER]: 'ROLES.INSTALLER',
};

/**
 * Role description i18n key mapping
 * Maps roles to description translation keys
 */
const USER_ROLE_DESC_I18N_KEYS: Record<UserRole, string> = {
  [UserRole.HQ_ADMIN]: 'ROLES.HQ_ADMIN_DESC',
  [UserRole.BRANCH_MANAGER]: 'ROLES.BRANCH_MANAGER_DESC',
  [UserRole.PARTNER_COORDINATOR]: 'ROLES.PARTNER_COORDINATOR_DESC',
  [UserRole.INSTALLER]: 'ROLES.INSTALLER_DESC',
};

/**
 * Korean labels for user roles (fallback when TranslationService is not available)
 * Used in Profile page and user management UI
 * @deprecated Use USER_ROLE_I18N_KEYS with TranslateService instead
 */
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.HQ_ADMIN]: 'ROLES.HQ_ADMIN',
  [UserRole.BRANCH_MANAGER]: 'ROLES.BRANCH_MANAGER',
  [UserRole.PARTNER_COORDINATOR]: 'ROLES.PARTNER_COORDINATOR',
  [UserRole.INSTALLER]: 'ROLES.INSTALLER',
};

/**
 * Role badge colors for UI display
 */
export const USER_ROLE_COLORS: Record<UserRole, string> = {
  [UserRole.HQ_ADMIN]: 'danger',
  [UserRole.BRANCH_MANAGER]: 'primary',
  [UserRole.PARTNER_COORDINATOR]: 'tertiary',
  [UserRole.INSTALLER]: 'success',
};

/**
 * Role descriptions for tooltips or detailed views (fallback)
 */
export const USER_ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  [UserRole.HQ_ADMIN]: '전체 시스템 관리 및 정산 잠금 해제 권한',
  [UserRole.BRANCH_MANAGER]: '지점 내 주문 관리 및 배정 권한',
  [UserRole.PARTNER_COORDINATOR]: '협력업체 주문 완료 처리 권한',
  [UserRole.INSTALLER]: '배정된 주문 설치 완료 권한',
};

/**
 * Get role label with i18n support
 * @param role - Role string
 * @param translationService - Optional TranslationService for i18n
 * @returns Translated role label or fallback
 */
export function getRoleLabel(
  role: string,
  translationService?: TranslationService
): string {
  const userRole = role as UserRole;

  // If translation service is provided, use i18n
  if (translationService && isValidRole(role)) {
    const i18nKey = USER_ROLE_I18N_KEYS[userRole];
    return translationService.instant(i18nKey);
  }

  // Fallback to static labels
  return USER_ROLE_LABELS[userRole] || role;
}

/**
 * Get role description with i18n support
 * @param role - Role string
 * @param translationService - Optional TranslationService for i18n
 * @returns Translated role description or fallback
 */
export function getRoleDescription(
  role: string,
  translationService?: TranslationService
): string {
  const userRole = role as UserRole;

  // If translation service is provided, use i18n
  if (translationService && isValidRole(role)) {
    const i18nKey = USER_ROLE_DESC_I18N_KEYS[userRole];
    return translationService.instant(i18nKey);
  }

  // Fallback to static descriptions
  return USER_ROLE_DESCRIPTIONS[userRole] || role;
}

/**
 * Get role color by role string
 */
export function getRoleColor(role: string): string {
  return USER_ROLE_COLORS[role as UserRole] || 'medium';
}

/**
 * Check if role string is valid
 */
export function isValidRole(role: string): boolean {
  return Object.values(UserRole).includes(role as UserRole);
}

/**
 * Get all roles for dropdown/select options with i18n support
 * @param translationService - Optional TranslationService for i18n
 */
export function getAllRoles(
  translationService?: TranslationService
): { value: UserRole; label: string }[] {
  return Object.values(UserRole).map((role) => ({
    value: role,
    label: getRoleLabel(role, translationService),
  }));
}
