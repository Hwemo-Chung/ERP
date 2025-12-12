import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PushProvider } from '@prisma/client';
import {
  IPushProvider,
  PushPayload,
  PushSendResult,
} from './push-provider.interface';

/**
 * Web Push subscription structure (from browser Push API)
 */
interface WebPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Web Push (VAPID) Provider
 * Sends push notifications to web browsers using the Web Push Protocol
 * Reference: https://developer.mozilla.org/en-US/docs/Web/API/Push_API
 */
@Injectable()
export class WebPushProvider implements IPushProvider {
  readonly type = PushProvider.VAPID;
  private readonly logger = new Logger(WebPushProvider.name);

  private vapidPublicKey: string | undefined;
  private vapidPrivateKey: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.vapidPublicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    this.vapidPrivateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');

    if (this.isConfigured() && this.vapidPublicKey && this.vapidPrivateKey) {
      webpush.setVapidDetails(
        'mailto:support@erp-logistics.com',
        this.vapidPublicKey,
        this.vapidPrivateKey,
      );
      this.logger.log('Web Push provider initialized with VAPID credentials');
    } else {
      this.logger.warn(
        'Web Push provider not configured - missing VAPID keys',
      );
    }
  }

  isConfigured(): boolean {
    return !!(
      this.vapidPublicKey &&
      this.vapidPrivateKey &&
      this.vapidPublicKey !== 'replace-me' &&
      this.vapidPrivateKey !== 'replace-me'
    );
  }

  async send(
    subscription: WebPushSubscription,
    payload: PushPayload,
  ): Promise<PushSendResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Web Push provider not configured',
      };
    }

    try {
      // Validate subscription format
      if (!subscription?.endpoint || !subscription?.keys) {
        return {
          success: false,
          error: 'Invalid subscription format',
          shouldRemoveSubscription: true,
        };
      }

      // Build notification payload compatible with Service Worker
      const notificationPayload = JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/assets/icons/icon-192x192.png',
        badge: payload.badge,
        image: payload.image,
        data: {
          ...payload.data,
          url: payload.clickAction || '/',
        },
        tag: payload.tag || 'default',
        requireInteraction: false,
        vibrate: [200, 100, 200],
      });

      // Send push notification
      const result = await webpush.sendNotification(
        subscription,
        notificationPayload,
        {
          TTL: 86400, // 24 hours
          urgency: 'normal',
        },
      );

      this.logger.debug(
        `Web Push sent successfully to ${subscription.endpoint.substring(0, 50)}...`,
      );

      return {
        success: true,
        messageId: `webpush-${Date.now()}`,
      };
    } catch (error) {
      return this.handleError(error, subscription);
    }
  }

  /**
   * Handle Web Push errors and determine if subscription should be removed
   */
  private handleError(
    error: any,
    subscription: WebPushSubscription,
  ): PushSendResult {
    const statusCode = error?.statusCode;

    // 404 or 410 means subscription is no longer valid
    if (statusCode === 404 || statusCode === 410) {
      this.logger.warn(
        `Subscription expired or invalid (${statusCode}): ${subscription.endpoint.substring(0, 50)}...`,
      );
      return {
        success: false,
        error: 'Subscription expired or invalid',
        shouldRemoveSubscription: true,
      };
    }

    // 429 means rate limited
    if (statusCode === 429) {
      this.logger.warn(
        `Rate limited by push service: ${subscription.endpoint.substring(0, 50)}...`,
      );
      return {
        success: false,
        error: 'Rate limited',
        shouldRemoveSubscription: false,
      };
    }

    // 400 means bad request (likely invalid subscription format)
    if (statusCode === 400) {
      this.logger.error(
        `Bad request to push service: ${subscription.endpoint.substring(0, 50)}...`,
        error.message,
      );
      return {
        success: false,
        error: 'Invalid subscription format',
        shouldRemoveSubscription: true,
      };
    }

    // Other errors - log and don't remove subscription
    this.logger.error(
      `Failed to send web push: ${subscription.endpoint.substring(0, 50)}...`,
      error.stack,
    );

    return {
      success: false,
      error: error.message || 'Unknown error',
      shouldRemoveSubscription: false,
    };
  }
}
