import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushProviderFactory, PushPayload } from './push-providers';

/**
 * Payload structure for push notification jobs
 */
export interface PushJobPayload {
  userId: string;
  notificationId: string;
  category: string;
}

/**
 * Quiet hours configuration structure
 */
interface QuietHoursConfig {
  enabled: boolean;
  start: string;
  end: string;
  timezone: string;
}

/**
 * Categories that bypass quiet hours (urgent notifications)
 */
const URGENT_CATEGORIES = ['settlement_locked', 'system_alert', 'emergency'];

/**
 * Notifications Processor
 *
 * Handles async push notification jobs from BullMQ queue.
 * Implements exponential backoff retry on failures.
 *
 * Complexity targets:
 * - Cyclomatic Complexity: <= 10
 * - Cognitive Complexity: <= 15
 */
@Processor('notifications')
export class NotificationsProcessor {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushProviderFactory: PushProviderFactory,
  ) {}

  /**
   * Process send-push job
   */
  @Process('send-push')
  async handleSendPush(job: Job<PushJobPayload>): Promise<void> {
    const { userId, notificationId, category } = job.data;

    // Validate required fields
    this.validateJobPayload(job.data);

    this.logger.debug(
      `Processing push job ${job.id} for user ${userId}, notification ${notificationId}`,
    );

    // Fetch notification
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      this.logger.warn(`Notification ${notificationId} not found, skipping job`);
      return;
    }

    // Fetch active subscriptions
    const subscriptions = await this.prisma.notificationSubscription.findMany({
      where: {
        userId,
        isActive: true,
        categoriesEnabled: { has: category },
      },
    });

    if (subscriptions.length === 0) {
      this.logger.debug(`No active subscriptions for user ${userId} with category ${category}`);
      return;
    }

    // Determine if notification is urgent
    const isUrgent = URGENT_CATEGORIES.includes(category);

    // Build push payload
    const payload = this.buildPushPayload(notification);

    // Process each subscription
    await Promise.allSettled(
      subscriptions.map((sub) => this.sendToSubscription(sub, payload, isUrgent)),
    );
  }

  /**
   * Handle job failure with logging
   */
  @OnQueueFailed()
  handleFailed(job: Job<PushJobPayload>, error: Error): void {
    const maxAttempts = job.opts?.attempts || 3;
    const isMaxAttemptsReached = job.attemptsMade >= maxAttempts;

    if (isMaxAttemptsReached) {
      this.logger.error(
        `Job ${job.id} failed after max attempts (${job.attemptsMade}): ${error.message}`,
        error.stack,
      );
    } else {
      this.logger.error(
        `Job ${job.id} failed (attempt ${job.attemptsMade}/${maxAttempts}): ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Validate job payload has required fields
   */
  private validateJobPayload(data: PushJobPayload): void {
    if (!data.userId || !data.notificationId || !data.category) {
      throw new BadRequestException(
        'Job payload must include userId, notificationId, and category',
      );
    }
  }

  /**
   * Send push notification to a single subscription
   */
  private async sendToSubscription(
    subscription: any,
    payload: PushPayload,
    isUrgent: boolean,
  ): Promise<void> {
    try {
      // Check quiet hours (skip for urgent notifications)
      if (!isUrgent && this.isWithinQuietHours(subscription.quietHours)) {
        this.logger.debug(
          `Skipping push to device ${subscription.deviceId} - within quiet hours`,
        );
        return;
      }

      // Get push provider
      const provider = this.pushProviderFactory.getProvider(subscription.pushProvider);

      if (!provider) {
        this.logger.warn(
          `Push provider ${subscription.pushProvider} not configured for device ${subscription.deviceId}`,
        );
        return;
      }

      // Send push
      const result = await provider.send(subscription.token, payload);

      if (result.success) {
        this.logger.debug(
          `Push sent to device ${subscription.deviceId}: ${result.messageId}`,
        );
      } else {
        this.logger.error(
          `Failed to send push to ${subscription.deviceId}: ${result.error}`,
        );

        // Deactivate invalid subscription
        if (result.shouldRemoveSubscription) {
          await this.deactivateSubscription(subscription.id, subscription.deviceId);
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Unexpected error sending push to ${subscription.deviceId}: ${errorMessage}`,
      );
    }
  }

  /**
   * Check if current time is within quiet hours
   */
  private isWithinQuietHours(quietHours: QuietHoursConfig | null): boolean {
    if (!quietHours?.enabled) {
      return false;
    }

    try {
      const timezone = quietHours.timezone || 'Asia/Seoul';
      const now = new Date();

      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      const parts = formatter.formatToParts(now);
      const currentHour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
      const currentMinute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
      const currentMinutes = currentHour * 60 + currentMinute;

      const [startHour, startMin] = quietHours.start.split(':').map(Number);
      const [endHour, endMin] = quietHours.end.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      // Handle overnight quiet hours
      if (startMinutes > endMinutes) {
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }

      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } catch (error) {
      this.logger.warn('Error checking quiet hours:', error);
      return false;
    }
  }

  /**
   * Deactivate invalid/expired subscription
   */
  private async deactivateSubscription(subscriptionId: string, deviceId: string): Promise<void> {
    await this.prisma.notificationSubscription.update({
      where: { id: subscriptionId },
      data: { isActive: false },
    });
    this.logger.log(`Deactivated subscription ${subscriptionId} for device ${deviceId}`);
  }

  /**
   * Build push payload from notification record
   */
  private buildPushPayload(notification: any): PushPayload {
    const basePayload: PushPayload = {
      title: notification.payload?.title || 'New Notification',
      body: notification.payload?.body || 'You have a new notification',
      data: {
        notificationId: notification.id,
        category: notification.category,
        orderId: notification.orderId,
        createdAt: notification.createdAt.toISOString(),
        ...notification.payload,
      },
    };

    return this.applyCategoryCustomizations(basePayload, notification);
  }

  /**
   * Apply category-specific customizations to payload
   */
  private applyCategoryCustomizations(payload: PushPayload, notification: any): PushPayload {
    const categoryConfigs: Record<string, Partial<PushPayload>> = {
      order_assigned: {
        icon: 'ic_order_assigned',
        sound: 'notification_assigned',
        tag: 'order_assignment',
        clickAction: `/orders/${notification.orderId}`,
      },
      order_status_changed: {
        icon: 'ic_order_status',
        sound: 'notification_status',
        tag: 'order_status',
        clickAction: `/orders/${notification.orderId}`,
      },
      settlement_ready: {
        icon: 'ic_settlement',
        sound: 'notification_settlement',
        tag: 'settlement',
        clickAction: '/settlement',
      },
      message_received: {
        icon: 'ic_message',
        sound: 'notification_message',
        tag: 'message',
        clickAction: '/messages',
      },
    };

    const config = categoryConfigs[notification.category] || {
      icon: 'ic_notification',
      sound: 'default',
      tag: 'general',
      clickAction: '/notifications',
    };

    return { ...payload, ...config };
  }
}
