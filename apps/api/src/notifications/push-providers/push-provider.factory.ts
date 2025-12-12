import { Injectable, Logger } from '@nestjs/common';
import { PushProvider } from '@prisma/client';
import { IPushProvider } from './push-provider.interface';
import { WebPushProvider } from './web-push.provider';
import { FcmProvider } from './fcm.provider';
import { ApnsProvider } from './apns.provider';

/**
 * Factory for creating appropriate push notification providers
 * Returns the correct provider instance based on PushProvider enum
 */
@Injectable()
export class PushProviderFactory {
  private readonly logger = new Logger(PushProviderFactory.name);

  constructor(
    private readonly webPushProvider: WebPushProvider,
    private readonly fcmProvider: FcmProvider,
    private readonly apnsProvider: ApnsProvider,
  ) {
    this.logProviderStatus();
  }

  /**
   * Get push provider instance based on provider type
   * @param providerType - Type of push provider (VAPID, FCM, APNS)
   * @returns IPushProvider instance or null if not configured
   */
  getProvider(providerType: PushProvider): IPushProvider | null {
    switch (providerType) {
      case PushProvider.VAPID:
        return this.webPushProvider.isConfigured()
          ? this.webPushProvider
          : null;

      case PushProvider.FCM:
        return this.fcmProvider.isConfigured() ? this.fcmProvider : null;

      case PushProvider.APNS:
        return this.apnsProvider.isConfigured() ? this.apnsProvider : null;

      default:
        this.logger.warn(`Unknown push provider type: ${providerType}`);
        return null;
    }
  }

  /**
   * Check if a specific provider is configured and ready to use
   * @param providerType - Type of push provider to check
   * @returns True if provider is configured
   */
  isProviderConfigured(providerType: PushProvider): boolean {
    const provider = this.getProvider(providerType);
    return provider !== null && provider.isConfigured();
  }

  /**
   * Get all configured providers
   * @returns Array of configured provider types
   */
  getConfiguredProviders(): PushProvider[] {
    const configured: PushProvider[] = [];

    if (this.webPushProvider.isConfigured()) {
      configured.push(PushProvider.VAPID);
    }
    if (this.fcmProvider.isConfigured()) {
      configured.push(PushProvider.FCM);
    }
    if (this.apnsProvider.isConfigured()) {
      configured.push(PushProvider.APNS);
    }

    return configured;
  }

  /**
   * Log status of all push providers on initialization
   */
  private logProviderStatus() {
    const configured = this.getConfiguredProviders();

    if (configured.length === 0) {
      this.logger.warn('No push providers configured - notifications will not be sent');
    } else {
      this.logger.log(`Push providers configured: ${configured.join(', ')}`);
    }

    // Log unconfigured providers
    const allProviders = [PushProvider.VAPID, PushProvider.FCM, PushProvider.APNS];
    const unconfigured = allProviders.filter(p => !configured.includes(p));

    if (unconfigured.length > 0) {
      this.logger.debug(`Push providers not configured: ${unconfigured.join(', ')}`);
    }
  }
}
