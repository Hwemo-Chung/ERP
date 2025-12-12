/**
 * Notification Category Constants
 * Defines notification types and user preference categories
 * Per PRD notification requirements
 */

export enum NotificationCategory {
  ORDER_ASSIGNED = 'ORDER_ASSIGNED',
  ORDER_COMPLETED = 'ORDER_COMPLETED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  SETTLEMENT_LOCKED = 'SETTLEMENT_LOCKED',
  SYSTEM_ALERTS = 'SYSTEM_ALERTS',
}

/**
 * Notification category metadata
 */
export interface NotificationCategoryMeta {
  key: NotificationCategory;
  titleKey: string;
  descriptionKey: string;
  defaultEnabled: boolean;
  icon: string;
}

/**
 * Notification category configuration
 * Each category has i18n keys, default state, and icon
 */
export const NOTIFICATION_CATEGORIES: NotificationCategoryMeta[] = [
  {
    key: NotificationCategory.ORDER_ASSIGNED,
    titleKey: 'PROFILE.NOTIFICATIONS.CATEGORIES.ORDER_ASSIGNED',
    descriptionKey: 'PROFILE.NOTIFICATIONS.CATEGORIES.ORDER_ASSIGNED_DESC',
    defaultEnabled: true,
    icon: 'clipboard-outline',
  },
  {
    key: NotificationCategory.ORDER_COMPLETED,
    titleKey: 'PROFILE.NOTIFICATIONS.CATEGORIES.ORDER_COMPLETED',
    descriptionKey: 'PROFILE.NOTIFICATIONS.CATEGORIES.ORDER_COMPLETED_DESC',
    defaultEnabled: true,
    icon: 'checkmark-circle-outline',
  },
  {
    key: NotificationCategory.ORDER_CANCELLED,
    titleKey: 'PROFILE.NOTIFICATIONS.CATEGORIES.ORDER_CANCELLED',
    descriptionKey: 'PROFILE.NOTIFICATIONS.CATEGORIES.ORDER_CANCELLED_DESC',
    defaultEnabled: true,
    icon: 'close-circle-outline',
  },
  {
    key: NotificationCategory.STATUS_CHANGED,
    titleKey: 'PROFILE.NOTIFICATIONS.CATEGORIES.STATUS_CHANGED',
    descriptionKey: 'PROFILE.NOTIFICATIONS.CATEGORIES.STATUS_CHANGED_DESC',
    defaultEnabled: true,
    icon: 'swap-horizontal-outline',
  },
  {
    key: NotificationCategory.SETTLEMENT_LOCKED,
    titleKey: 'PROFILE.NOTIFICATIONS.CATEGORIES.SETTLEMENT_LOCKED',
    descriptionKey: 'PROFILE.NOTIFICATIONS.CATEGORIES.SETTLEMENT_LOCKED_DESC',
    defaultEnabled: true,
    icon: 'lock-closed-outline',
  },
  {
    key: NotificationCategory.SYSTEM_ALERTS,
    titleKey: 'PROFILE.NOTIFICATIONS.CATEGORIES.SYSTEM_ALERTS',
    descriptionKey: 'PROFILE.NOTIFICATIONS.CATEGORIES.SYSTEM_ALERTS_DESC',
    defaultEnabled: true,
    icon: 'alert-circle-outline',
  },
];

/**
 * User notification preferences
 */
export interface NotificationPreferences {
  [NotificationCategory.ORDER_ASSIGNED]: boolean;
  [NotificationCategory.ORDER_COMPLETED]: boolean;
  [NotificationCategory.ORDER_CANCELLED]: boolean;
  [NotificationCategory.STATUS_CHANGED]: boolean;
  [NotificationCategory.SETTLEMENT_LOCKED]: boolean;
  [NotificationCategory.SYSTEM_ALERTS]: boolean;
}

/**
 * Get default notification preferences
 */
export function getDefaultNotificationPreferences(): NotificationPreferences {
  return NOTIFICATION_CATEGORIES.reduce((prefs, category) => {
    prefs[category.key] = category.defaultEnabled;
    return prefs;
  }, {} as NotificationPreferences);
}

/**
 * Check if all notifications are enabled
 */
export function areAllNotificationsEnabled(prefs: NotificationPreferences): boolean {
  return Object.values(prefs).every((enabled) => enabled);
}

/**
 * Enable or disable all notification categories
 */
export function toggleAllNotifications(
  enabled: boolean
): NotificationPreferences {
  return NOTIFICATION_CATEGORIES.reduce((prefs, category) => {
    prefs[category.key] = enabled;
    return prefs;
  }, {} as NotificationPreferences);
}
