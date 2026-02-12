import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { PushProvider } from '@prisma/client';
import { IPushProvider, PushPayload, PushSendResult } from './push-provider.interface';

/**
 * FCM (Firebase Cloud Messaging) Provider
 * Sends push notifications to Android devices using Firebase Admin SDK
 * Uses HTTP v1 API (not legacy)
 * Reference: https://firebase.google.com/docs/cloud-messaging/migrate-v1
 */
@Injectable()
export class FcmProvider implements IPushProvider {
  readonly type = PushProvider.FCM;
  private readonly logger = new Logger(FcmProvider.name);

  private messaging: admin.messaging.Messaging | null = null;
  private isInitialized = false;

  constructor(private readonly configService: ConfigService) {
    this.initialize();
  }

  private initialize() {
    try {
      const fcmServerKey = this.configService.get<string>('FCM_SERVER_KEY');

      if (!fcmServerKey || fcmServerKey === 'replace-me') {
        this.logger.warn('FCM provider not configured - missing FCM_SERVER_KEY');
        return;
      }

      // FCM_SERVER_KEY should be a JSON string of the service account
      const serviceAccount = JSON.parse(fcmServerKey);

      // Initialize Firebase Admin SDK if not already initialized
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      }

      this.messaging = admin.messaging();
      this.isInitialized = true;
      this.logger.log('FCM provider initialized successfully');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to initialize FCM provider:', errorMessage);
      this.isInitialized = false;
    }
  }

  isConfigured(): boolean {
    return this.isInitialized;
  }

  async send(token: string, payload: PushPayload): Promise<PushSendResult> {
    if (!this.isConfigured() || !this.messaging) {
      return {
        success: false,
        error: 'FCM provider not configured',
      };
    }

    try {
      // Validate token format
      if (!token || typeof token !== 'string') {
        return {
          success: false,
          error: 'Invalid FCM token format',
          shouldRemoveSubscription: true,
        };
      }

      // Build FCM message using v1 API format
      const message: admin.messaging.Message = {
        token,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.image,
        },
        data: this.sanitizeData(payload.data || {}),
        android: {
          priority: 'high',
          notification: {
            icon: payload.icon || 'ic_notification',
            sound: payload.sound || 'default',
            tag: payload.tag,
            clickAction: payload.clickAction,
            channelId: 'order_updates',
          },
        },
        apns: {
          payload: {
            aps: {
              badge: payload.badge,
              sound: payload.sound || 'default',
            },
          },
        },
      };

      // Send message
      const messageId = await this.messaging.send(message);

      this.logger.debug(`FCM message sent successfully: ${messageId}`);

      return {
        success: true,
        messageId,
      };
    } catch (error: unknown) {
      return this.handleError(error, token);
    }
  }

  /**
   * Sanitize data payload - FCM only accepts string values
   */
  private sanitizeData(data: Record<string, unknown>): Record<string, string> {
    const sanitized: Record<string, string> = {};

    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) {
        continue;
      }

      if (typeof value === 'string') {
        sanitized[key] = value;
      } else if (typeof value === 'object') {
        sanitized[key] = JSON.stringify(value);
      } else {
        sanitized[key] = String(value);
      }
    }

    return sanitized;
  }

  /**
   * Handle FCM errors and determine if subscription should be removed
   */
  private handleError(error: unknown, token: string): PushSendResult {
    const fcmError = error as { code?: string; message?: string; stack?: string };
    const errorCode = fcmError?.code;
    const errorMessage = fcmError?.message || '';

    // Invalid registration token - remove subscription
    if (
      errorCode === 'messaging/invalid-registration-token' ||
      errorCode === 'messaging/registration-token-not-registered'
    ) {
      this.logger.warn(`Invalid FCM token: ${token.substring(0, 20)}...`);
      return {
        success: false,
        error: 'Invalid or unregistered token',
        shouldRemoveSubscription: true,
      };
    }

    // Invalid argument - likely malformed message or token
    if (errorCode === 'messaging/invalid-argument') {
      this.logger.error(`Invalid FCM argument: ${token.substring(0, 20)}...`, errorMessage);
      return {
        success: false,
        error: 'Invalid message format',
        shouldRemoveSubscription: true,
      };
    }

    // Quota exceeded / rate limited
    if (errorCode === 'messaging/quota-exceeded' || errorCode === 'messaging/too-many-requests') {
      this.logger.warn(`FCM rate limited: ${token.substring(0, 20)}...`);
      return {
        success: false,
        error: 'Rate limited',
        shouldRemoveSubscription: false,
      };
    }

    // Third-party auth error - check service account permissions
    if (errorCode === 'messaging/third-party-auth-error') {
      this.logger.error('FCM authentication error - check service account permissions');
      return {
        success: false,
        error: 'Authentication error',
        shouldRemoveSubscription: false,
      };
    }

    // Server unavailable - retry later
    if (errorCode === 'messaging/server-unavailable' || errorCode === 'messaging/internal-error') {
      this.logger.error(`FCM server error: ${errorMessage}`);
      return {
        success: false,
        error: 'FCM server unavailable',
        shouldRemoveSubscription: false,
      };
    }

    // Unknown error - log and don't remove subscription
    this.logger.error(`Failed to send FCM message: ${token.substring(0, 20)}...`, fcmError.stack);

    return {
      success: false,
      error: errorMessage || 'Unknown FCM error',
      shouldRemoveSubscription: false,
    };
  }
}
