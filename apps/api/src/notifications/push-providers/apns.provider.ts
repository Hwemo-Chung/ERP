import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as apn from 'apn';
import { PushProvider } from '@prisma/client';
import {
  IPushProvider,
  PushPayload,
  PushSendResult,
} from './push-provider.interface';

/**
 * APNs (Apple Push Notification service) Provider
 * Sends push notifications to iOS devices using HTTP/2 protocol
 * Reference: https://developer.apple.com/documentation/usernotifications
 */
@Injectable()
export class ApnsProvider implements IPushProvider {
  readonly type = PushProvider.APNS;
  private readonly logger = new Logger(ApnsProvider.name);

  private provider: apn.Provider | null = null;
  private isInitialized = false;

  constructor(private readonly configService: ConfigService) {
    this.initialize();
  }

  private initialize() {
    try {
      const keyId = this.configService.get<string>('APNS_KEY_ID');
      const teamId = this.configService.get<string>('APNS_TEAM_ID');
      const authKey = this.configService.get<string>('APNS_AUTH_KEY');

      if (
        !keyId ||
        !teamId ||
        !authKey ||
        keyId === 'replace-me' ||
        teamId === 'replace-me' ||
        authKey === 'replace-me'
      ) {
        this.logger.warn(
          'APNs provider not configured - missing credentials',
        );
        return;
      }

      // Determine if production or development environment
      const isProduction =
        this.configService.get<string>('NODE_ENV') === 'production';

      // Initialize APNs provider with token-based authentication
      this.provider = new apn.Provider({
        token: {
          key: authKey, // Path to .p8 file or string with key content
          keyId: keyId,
          teamId: teamId,
        },
        production: isProduction,
      });

      this.isInitialized = true;
      this.logger.log(
        `APNs provider initialized (${isProduction ? 'production' : 'development'})`,
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to initialize APNs provider:', errorMessage);
      this.isInitialized = false;
    }
  }

  isConfigured(): boolean {
    return this.isInitialized;
  }

  async send(token: string, payload: PushPayload): Promise<PushSendResult> {
    if (!this.isConfigured() || !this.provider) {
      return {
        success: false,
        error: 'APNs provider not configured',
      };
    }

    try {
      // Validate token format (APNs tokens are typically 64 hex characters)
      if (!token || typeof token !== 'string') {
        return {
          success: false,
          error: 'Invalid APNs token format',
          shouldRemoveSubscription: true,
        };
      }

      // Build APNs notification
      const notification = new apn.Notification({
        alert: {
          title: payload.title,
          body: payload.body,
        },
        topic: this.configService.get<string>('APNS_BUNDLE_ID') || 'com.erp.logistics', // Bundle ID
        badge: payload.badge,
        sound: payload.sound || 'default',
        category: payload.tag,
        mutableContent: 1, // Enable notification service extension
        contentAvailable: 1, // Wake app in background
        payload: payload.data || {},
        expiry: Math.floor(Date.now() / 1000) + 86400, // 24 hours
      });

      // Send notification
      const result = await this.provider.send(notification, token);

      // Check if send was successful
      if (result.sent && result.sent.length > 0) {
        this.logger.debug(
          `APNs notification sent successfully to ${token.substring(0, 20)}...`,
        );
        return {
          success: true,
          messageId: `apns-${Date.now()}`,
        };
      }

      // Check for failures
      if (result.failed && result.failed.length > 0) {
        const failure = result.failed[0];
        return this.handleFailure(failure, token);
      }

      // Unexpected result
      return {
        success: false,
        error: 'Unexpected APNs response',
        shouldRemoveSubscription: false,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown APNs error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Failed to send APNs notification: ${token.substring(0, 20)}...`,
        errorStack,
      );

      return {
        success: false,
        error: errorMessage,
        shouldRemoveSubscription: false,
      };
    }
  }

  /**
   * Handle APNs failures and determine if subscription should be removed
   */
  private handleFailure(
    failure: apn.ResponseFailure,
    token: string,
  ): PushSendResult {
    const status = failure.status;
    const response = failure.response;

    // Invalid device token - remove subscription
    if (status === '400' && response?.reason === 'BadDeviceToken') {
      this.logger.warn(`Invalid APNs token: ${token.substring(0, 20)}...`);
      return {
        success: false,
        error: 'Invalid device token',
        shouldRemoveSubscription: true,
      };
    }

    // Token is no longer active for the topic
    if (status === '410' || response?.reason === 'Unregistered') {
      this.logger.warn(
        `APNs token unregistered: ${token.substring(0, 20)}...`,
      );
      return {
        success: false,
        error: 'Device token unregistered',
        shouldRemoveSubscription: true,
      };
    }

    // Topic disallowed - wrong bundle ID
    if (status === '400' && response?.reason === 'TopicDisallowed') {
      this.logger.error('APNs topic disallowed - check bundle ID configuration');
      return {
        success: false,
        error: 'Topic disallowed',
        shouldRemoveSubscription: false,
      };
    }

    // Missing device token
    if (status === '400' && response?.reason === 'MissingDeviceToken') {
      this.logger.error(`Missing device token: ${token.substring(0, 20)}...`);
      return {
        success: false,
        error: 'Missing device token',
        shouldRemoveSubscription: true,
      };
    }

    // Bad certificate or authentication issue
    if (
      status === '403' &&
      (response?.reason === 'InvalidProviderToken' ||
        response?.reason === 'ExpiredProviderToken')
    ) {
      this.logger.error('APNs authentication error - check credentials');
      return {
        success: false,
        error: 'Authentication error',
        shouldRemoveSubscription: false,
      };
    }

    // Rate limited
    if (status === '429' || response?.reason === 'TooManyRequests') {
      this.logger.warn(`APNs rate limited: ${token.substring(0, 20)}...`);
      return {
        success: false,
        error: 'Rate limited',
        shouldRemoveSubscription: false,
      };
    }

    // Server error
    if (status === '500' || response?.reason === 'InternalServerError') {
      this.logger.error('APNs server error');
      return {
        success: false,
        error: 'APNs server error',
        shouldRemoveSubscription: false,
      };
    }

    // Shutdown - APNs is shutting down
    if (status === '503' || response?.reason === 'Shutdown') {
      this.logger.error('APNs service unavailable');
      return {
        success: false,
        error: 'Service unavailable',
        shouldRemoveSubscription: false,
      };
    }

    // Unknown error
    this.logger.error(
      `APNs send failed with status ${status}: ${token.substring(0, 20)}...`,
      response?.reason,
    );

    return {
      success: false,
      error: response?.reason || `APNs error: ${status}`,
      shouldRemoveSubscription: false,
    };
  }

  /**
   * Clean up provider on service destruction
   */
  async onModuleDestroy() {
    if (this.provider) {
      this.provider.shutdown();
      this.logger.log('APNs provider shut down');
    }
  }
}
