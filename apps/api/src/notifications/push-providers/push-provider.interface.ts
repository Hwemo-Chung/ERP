import { PushProvider } from '@prisma/client';

/**
 * Push notification payload structure
 */
export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  sound?: string;
  icon?: string;
  image?: string;
  clickAction?: string;
  tag?: string;
}

/**
 * Push send result
 */
export interface PushSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  shouldRemoveSubscription?: boolean; // If subscription is invalid/expired
}

/**
 * Base interface for all push notification providers
 */
export interface IPushProvider {
  /**
   * Provider type identifier
   */
  readonly type: PushProvider;

  /**
   * Send push notification
   * @param token - Device token or subscription object
   * @param payload - Notification payload
   * @returns Send result with success status and optional message ID
   */
  send(token: any, payload: PushPayload): Promise<PushSendResult>;

  /**
   * Validate provider configuration
   * @returns True if provider is properly configured
   */
  isConfigured(): boolean;
}
