import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { Platform, PushProvider, NotificationStatus } from '@prisma/client';
import { PushProviderFactory, PushPayload } from './push-providers';
import { PushJobPayload } from './notifications.processor';

/**
 * Quiet hours configuration structure
 */
export interface QuietHoursConfig {
  enabled: boolean;
  start: string;  // HH:mm format, e.g., "22:00"
  end: string;    // HH:mm format, e.g., "07:00"
  timezone: string; // e.g., "Asia/Seoul"
}

/**
 * Categories that bypass quiet hours (urgent notifications)
 */
const URGENT_CATEGORIES = ['settlement_locked', 'system_alert', 'emergency'];

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushProviderFactory: PushProviderFactory,
    @InjectQueue('notifications') private readonly notificationQueue: Queue<PushJobPayload>,
  ) {}

  /**
   * Subscribe device for push notifications
   */
  async subscribe(
    userId: string,
    data: {
      deviceId: string;
      platform: Platform;
      pushProvider: PushProvider;
      token: Record<string, unknown>;
      categoriesEnabled: string[];
    },
  ) {
    const existing = await this.prisma.notificationSubscription.findUnique({
      where: {
        userId_deviceId: { userId, deviceId: data.deviceId },
      },
    });

    if (existing) {
      // Update existing subscription
      return this.prisma.notificationSubscription.update({
        where: { id: existing.id },
        data: {
          platform: data.platform,
          pushProvider: data.pushProvider,
          token: JSON.parse(JSON.stringify(data.token)),
          categoriesEnabled: data.categoriesEnabled,
          isActive: true,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        },
      });
    }

    return this.prisma.notificationSubscription.create({
      data: {
        userId,
        deviceId: data.deviceId,
        platform: data.platform,
        pushProvider: data.pushProvider,
        token: JSON.parse(JSON.stringify(data.token)),
        categoriesEnabled: data.categoriesEnabled,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
  }

  /**
   * Unsubscribe device
   */
  async unsubscribe(subscriptionId: string) {
    const sub = await this.prisma.notificationSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!sub) {
      throw new NotFoundException('error.subscription_not_found');
    }

    await this.prisma.notificationSubscription.update({
      where: { id: subscriptionId },
      data: { isActive: false },
    });
  }

  /**
   * Get notifications for user
   */
  async getNotifications(
    userId: string,
    options: {
      category?: string;
      status?: NotificationStatus;
      limit?: number;
      cursor?: string;
    } = {},
  ) {
    const where: any = { userId };

    if (options.category) {
      where.category = options.category;
    }
    if (options.status) {
      where.status = options.status;
    }

    const take = options.limit || 20;
    const cursor = options.cursor ? { id: options.cursor } : undefined;

    const notifications = await this.prisma.notification.findMany({
      where,
      take: take + 1,
      skip: cursor ? 1 : 0,
      cursor,
      orderBy: { createdAt: 'desc' },
      include: {
        order: { select: { orderNo: true, customerName: true } },
      },
    });

    const hasMore = notifications.length > take;
    const data = hasMore ? notifications.slice(0, take) : notifications;

    return {
      data,
      pagination: {
        nextCursor: hasMore ? data[data.length - 1].id : null,
        hasMore,
      },
    };
  }

  /**
   * Mark notification as read
   */
  async acknowledge(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('error.notification_not_found');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: NotificationStatus.READ,
        readAt: new Date(),
      },
    });
  }

  /**
   * Create and send notification
   * Push notification is sent asynchronously via BullMQ queue
   */
  async createNotification(data: {
    userId: string;
    orderId?: string;
    category: string;
    payload: Record<string, unknown>;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: data.userId,
        orderId: data.orderId,
        category: data.category,
        payload: JSON.parse(JSON.stringify(data.payload)),
      },
    });

    // Queue push notification for async processing
    await this.queuePushNotification({
      userId: data.userId,
      notificationId: notification.id,
      category: data.category,
    });

    return notification;
  }

  /**
   * Queue push notification job for async processing
   */
  private async queuePushNotification(payload: PushJobPayload): Promise<void> {
    try {
      const job = await this.notificationQueue.add('send-push', payload, {
        priority: this.getJobPriority(payload.category),
      });
      this.logger.debug(
        `Queued push notification job ${job.id} for user ${payload.userId}`,
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to queue push notification for user ${payload.userId}: ${errorMessage}`,
      );
    }
  }

  /**
   * Get job priority based on notification category
   * Lower number = higher priority
   */
  private getJobPriority(category: string): number {
    if (URGENT_CATEGORIES.includes(category)) {
      return 1; // High priority for urgent notifications
    }
    return 10; // Normal priority
  }

  /**
   * Check if current time is within quiet hours
   */
  private isWithinQuietHours(quietHours: QuietHoursConfig | null): boolean {
    if (!quietHours || !quietHours.enabled) {
      return false;
    }

    try {
      const timezone = quietHours.timezone || 'Asia/Seoul';
      const now = new Date();

      // Get current time in the specified timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const parts = formatter.formatToParts(now);
      const currentHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
      const currentMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
      const currentMinutes = currentHour * 60 + currentMinute;

      // Parse start and end times
      const [startHour, startMin] = quietHours.start.split(':').map(Number);
      const [endHour, endMin] = quietHours.end.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      // Handle overnight quiet hours (e.g., 22:00 - 07:00)
      if (startMinutes > endMinutes) {
        // Quiet period spans midnight
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
      } else {
        // Quiet period within same day
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
      }
    } catch (error) {
      this.logger.warn('Error checking quiet hours:', error);
      return false;
    }
  }

  /**
   * Send push notification to user's devices
   */
  private async sendPush(userId: string, notification: any) {
    const subscriptions = await this.prisma.notificationSubscription.findMany({
      where: {
        userId,
        isActive: true,
        categoriesEnabled: { has: notification.category },
      },
    });

    if (subscriptions.length === 0) {
      this.logger.debug(`No active subscriptions for user ${userId} with category ${notification.category}`);
      return;
    }

    // Check if this is an urgent notification that bypasses quiet hours
    const isUrgent = URGENT_CATEGORIES.includes(notification.category);

    // Build push payload from notification
    const payload = this.buildPushPayload(notification);

    // Send to each subscription
    const sendPromises = subscriptions.map(async (sub) => {
      try {
        // Check quiet hours for this subscription (unless urgent)
        if (!isUrgent) {
          const quietHours = sub.quietHours as QuietHoursConfig | null;
          if (this.isWithinQuietHours(quietHours)) {
            this.logger.debug(
              `Skipping push to device ${sub.deviceId} - within quiet hours`,
            );
            return;
          }
        }

        // Get appropriate provider for this subscription
        const provider = this.pushProviderFactory.getProvider(sub.pushProvider);

        if (!provider) {
          this.logger.warn(
            `Push provider ${sub.pushProvider} not configured for device ${sub.deviceId}`,
          );
          return;
        }

        // Send push notification
        const result = await provider.send(sub.token, payload);

        if (result.success) {
          this.logger.debug(
            `Push sent to device ${sub.deviceId} (${sub.pushProvider}): ${result.messageId}`,
          );
        } else {
          this.logger.error(
            `Failed to send push to ${sub.deviceId} (${sub.pushProvider}): ${result.error}`,
          );

          // If subscription is invalid/expired, mark as inactive
          if (result.shouldRemoveSubscription) {
            await this.prisma.notificationSubscription.update({
              where: { id: sub.id },
              data: { isActive: false },
            });
            this.logger.log(
              `Deactivated subscription ${sub.id} for device ${sub.deviceId}`,
            );
          }
        }
      } catch (error: unknown) {
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.logger.error(
          `Unexpected error sending push to ${sub.deviceId}:`,
          errorStack,
        );
      }
    });

    // Send all pushes in parallel
    await Promise.allSettled(sendPromises);
  }

  /**
   * Build push notification payload from notification record
   */
  private buildPushPayload(notification: any): PushPayload {
    const payload: PushPayload = {
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

    // Add category-specific customizations
    switch (notification.category) {
      case 'order_assigned':
        payload.icon = 'ic_order_assigned';
        payload.sound = 'notification_assigned';
        payload.tag = 'order_assignment';
        payload.clickAction = `/orders/${notification.orderId}`;
        break;

      case 'order_status_changed':
        payload.icon = 'ic_order_status';
        payload.sound = 'notification_status';
        payload.tag = 'order_status';
        payload.clickAction = `/orders/${notification.orderId}`;
        break;

      case 'settlement_ready':
        payload.icon = 'ic_settlement';
        payload.sound = 'notification_settlement';
        payload.tag = 'settlement';
        payload.clickAction = '/settlement';
        break;

      case 'message_received':
        payload.icon = 'ic_message';
        payload.sound = 'notification_message';
        payload.tag = 'message';
        payload.clickAction = '/messages';
        break;

      default:
        payload.icon = 'ic_notification';
        payload.sound = 'default';
        payload.tag = 'general';
        payload.clickAction = '/notifications';
    }

    return payload;
  }

  /**
   * Get notification preferences for a device
   */
  async getPreferences(userId: string, deviceId: string) {
    const subscription = await this.prisma.notificationSubscription.findUnique({
      where: {
        userId_deviceId: { userId, deviceId },
      },
    });

    if (!subscription) {
      throw new NotFoundException('error.subscription_not_found');
    }

    return {
      deviceId: subscription.deviceId,
      platform: subscription.platform,
      categoriesEnabled: subscription.categoriesEnabled,
      isActive: subscription.isActive,
      quietHours: subscription.quietHours as QuietHoursConfig | null,
    };
  }

  /**
   * Update notification preferences for a device
   */
  async updatePreferences(
    userId: string,
    data: {
      deviceId: string;
      categoriesEnabled?: string[];
      quietHours?: {
        enabled: boolean;
        start?: string;
        end?: string;
        timezone?: string;
      };
    },
  ) {
    const subscription = await this.prisma.notificationSubscription.findUnique({
      where: {
        userId_deviceId: { userId, deviceId: data.deviceId },
      },
    });

    if (!subscription) {
      throw new NotFoundException('error.subscription_not_found');
    }

    const updateData: Record<string, unknown> = {};

    if (data.categoriesEnabled !== undefined) {
      updateData.categoriesEnabled = data.categoriesEnabled;
    }

    // Save quiet hours configuration to database
    if (data.quietHours !== undefined) {
      if (data.quietHours && data.quietHours.enabled) {
        // Validate quiet hours format
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (!timeRegex.test(data.quietHours.start || '') || !timeRegex.test(data.quietHours.end || '')) {
          this.logger.warn(`Invalid quiet hours format for device ${data.deviceId}`);
        } else {
          updateData.quietHours = {
            enabled: true,
            start: data.quietHours.start,
            end: data.quietHours.end,
            timezone: data.quietHours.timezone || 'Asia/Seoul',
          };
          this.logger.log(
            `Quiet hours enabled for device ${data.deviceId}: ${data.quietHours.start} - ${data.quietHours.end}`,
          );
        }
      } else {
        // Disable quiet hours
        updateData.quietHours = null;
        this.logger.log(`Quiet hours disabled for device ${data.deviceId}`);
      }
    }

    const updated = await this.prisma.notificationSubscription.update({
      where: { id: subscription.id },
      data: updateData,
    });

    return {
      deviceId: updated.deviceId,
      platform: updated.platform,
      categoriesEnabled: updated.categoriesEnabled,
      isActive: updated.isActive,
      quietHours: updated.quietHours as QuietHoursConfig | null,
    };
  }
}
