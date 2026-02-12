import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { Platform, PushProvider, NotificationStatus, Prisma, Notification } from '@prisma/client';
import { PushProviderFactory, PushPayload } from './push-providers';
import { PushJobPayload } from './notifications.processor';

export interface QuietHoursConfig {
  enabled: boolean;
  start: string;
  end: string;
  timezone: string;
}

const URGENT_CATEGORIES = ['settlement_locked', 'system_alert', 'emergency'];

const CATEGORY_PUSH_CONFIG: Record<
  string,
  { icon: string; sound: string; tag: string; clickAction: string }
> = {
  order_assigned: {
    icon: 'ic_order_assigned',
    sound: 'notification_assigned',
    tag: 'order_assignment',
    clickAction: '/orders/{orderId}',
  },
  order_status_changed: {
    icon: 'ic_order_status',
    sound: 'notification_status',
    tag: 'order_status',
    clickAction: '/orders/{orderId}',
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

const DEFAULT_PUSH_CONFIG = {
  icon: 'ic_notification',
  sound: 'default',
  tag: 'general',
  clickAction: '/notifications',
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushProviderFactory: PushProviderFactory,
    @InjectQueue('notifications') private readonly notificationQueue: Queue<PushJobPayload>,
  ) {}

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

  async getNotifications(
    userId: string,
    options: {
      category?: string;
      status?: NotificationStatus;
      limit?: number;
      cursor?: string;
    } = {},
  ) {
    const where: Prisma.NotificationWhereInput = { userId };

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

  private async queuePushNotification(payload: PushJobPayload): Promise<void> {
    try {
      const job = await this.notificationQueue.add('send-push', payload, {
        priority: this.getJobPriority(payload.category),
      });
      this.logger.debug(`Queued push notification job ${job.id} for user ${payload.userId}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to queue push notification for user ${payload.userId}: ${errorMessage}`,
      );
    }
  }

  private getJobPriority(category: string): number {
    return URGENT_CATEGORIES.includes(category) ? 1 : 10;
  }

  private isWithinQuietHours(quietHours: QuietHoursConfig | null): boolean {
    if (!quietHours || !quietHours.enabled) return false;

    try {
      const currentMinutes = this.getCurrentMinutesInTimezone(quietHours.timezone || 'Asia/Seoul');
      const startMinutes = this.parseTimeToMinutes(quietHours.start);
      const endMinutes = this.parseTimeToMinutes(quietHours.end);

      return startMinutes > endMinutes
        ? currentMinutes >= startMinutes || currentMinutes < endMinutes
        : currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } catch (error) {
      this.logger.warn('Error checking quiet hours:', error);
      return false;
    }
  }

  private getCurrentMinutesInTimezone(timezone: string): number {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
    return hour * 60 + minute;
  }

  private parseTimeToMinutes(time: string): number {
    const [hour, min] = time.split(':').map(Number);
    return hour * 60 + min;
  }

  private async sendPush(userId: string, notification: Notification) {
    const subscriptions = await this.prisma.notificationSubscription.findMany({
      where: { userId, isActive: true, categoriesEnabled: { has: notification.category } },
    });

    if (subscriptions.length === 0) {
      this.logger.debug(
        `No active subscriptions for user ${userId} with category ${notification.category}`,
      );
      return;
    }

    const isUrgent = URGENT_CATEGORIES.includes(notification.category);
    const payload = this.buildPushPayload(notification);

    await Promise.allSettled(
      subscriptions.map((sub) => this.sendToSubscription(sub, payload, isUrgent)),
    );
  }

  private async sendToSubscription(
    sub: {
      id: string;
      deviceId: string;
      pushProvider: PushProvider;
      token: unknown;
      quietHours: unknown;
    },
    payload: PushPayload,
    isUrgent: boolean,
  ) {
    try {
      if (!isUrgent && this.isWithinQuietHours(sub.quietHours as QuietHoursConfig | null)) {
        this.logger.debug(`Skipping push to device ${sub.deviceId} - within quiet hours`);
        return;
      }

      const provider = this.pushProviderFactory.getProvider(sub.pushProvider);
      if (!provider) {
        this.logger.warn(
          `Push provider ${sub.pushProvider} not configured for device ${sub.deviceId}`,
        );
        return;
      }

      const result = await provider.send(sub.token, payload);
      if (result.success) {
        this.logger.debug(
          `Push sent to device ${sub.deviceId} (${sub.pushProvider}): ${result.messageId}`,
        );
      } else {
        this.logger.error(
          `Failed to send push to ${sub.deviceId} (${sub.pushProvider}): ${result.error}`,
        );
        if (result.shouldRemoveSubscription) {
          await this.prisma.notificationSubscription.update({
            where: { id: sub.id },
            data: { isActive: false },
          });
          this.logger.log(`Deactivated subscription ${sub.id} for device ${sub.deviceId}`);
        }
      }
    } catch (error: unknown) {
      this.logger.error(
        `Unexpected error sending push to ${sub.deviceId}:`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private buildPushPayload(notification: Notification): PushPayload {
    const config = CATEGORY_PUSH_CONFIG[notification.category] || DEFAULT_PUSH_CONFIG;
    const clickAction = config.clickAction.replace('{orderId}', notification.orderId || '');
    const payload = notification.payload as Record<string, unknown> | null;

    return {
      title: (payload?.title as string) || 'New Notification',
      body: (payload?.body as string) || 'You have a new notification',
      data: {
        notificationId: notification.id,
        category: notification.category,
        orderId: notification.orderId,
        createdAt: notification.createdAt.toISOString(),
        ...(payload && typeof payload === 'object' ? payload : {}),
      },
      icon: config.icon,
      sound: config.sound,
      tag: config.tag,
      clickAction,
    };
  }

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

  async updatePreferences(
    userId: string,
    data: {
      deviceId: string;
      categoriesEnabled?: string[];
      quietHours?: { enabled: boolean; start?: string; end?: string; timezone?: string };
    },
  ) {
    const subscription = await this.prisma.notificationSubscription.findUnique({
      where: { userId_deviceId: { userId, deviceId: data.deviceId } },
    });

    if (!subscription) throw new NotFoundException('error.subscription_not_found');

    const updateData: Record<string, unknown> = {};

    if (data.categoriesEnabled !== undefined) {
      updateData.categoriesEnabled = data.categoriesEnabled;
    }

    if (data.quietHours !== undefined) {
      updateData.quietHours = this.buildQuietHoursUpdate(data.quietHours, data.deviceId);
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

  private buildQuietHoursUpdate(
    quietHours: { enabled: boolean; start?: string; end?: string; timezone?: string },
    deviceId: string,
  ): QuietHoursConfig | null {
    if (!quietHours || !quietHours.enabled) {
      this.logger.log(`Quiet hours disabled for device ${deviceId}`);
      return null;
    }

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(quietHours.start || '') || !timeRegex.test(quietHours.end || '')) {
      this.logger.warn(`Invalid quiet hours format for device ${deviceId}`);
      return null;
    }

    this.logger.log(
      `Quiet hours enabled for device ${deviceId}: ${quietHours.start} - ${quietHours.end}`,
    );
    return {
      enabled: true,
      start: quietHours.start!,
      end: quietHours.end!,
      timezone: quietHours.timezone || 'Asia/Seoul',
    };
  }
}
