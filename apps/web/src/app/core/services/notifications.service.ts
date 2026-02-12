/**
 * Notifications Service
 * Handles push notifications and notification history
 */
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { WebSocketService } from './websocket.service';
import { LoggerService } from './logger.service';

export type NotifCategory = 'reassign' | 'delay' | 'customer' | 'system';

export interface Notification {
  id: string;
  category: NotifCategory;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  orderId?: string;
  userId: string;
}

export interface NotificationSettings {
  reassign: boolean;
  delay: boolean;
  customer: boolean;
  pushEnabled: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly http = inject(HttpClient);
  private readonly wsService = inject(WebSocketService);
  private readonly logger = inject(LoggerService);
  private readonly baseUrl = `${environment.apiUrl}/notifications`;

  // Local state
  private readonly _notifications = signal<Notification[]>([]);
  private readonly _settings = signal<NotificationSettings>({
    reassign: true,
    delay: true,
    customer: true,
    pushEnabled: true,
  });

  // Public signals
  readonly notifications = this._notifications.asReadonly();
  readonly settings = this._settings.asReadonly();
  readonly unreadCount = computed(() => this._notifications().filter((n) => !n.read).length);

  constructor() {
    this.initWebSocketListener();
  }

  private initWebSocketListener(): void {
    this.wsService.onMessage<Notification>('notification').subscribe((data) => {
      this._notifications.update((list) => [data, ...list]);
    });
  }

  /**
   * Load notifications from API
   */
  async loadNotifications(limit = 50): Promise<void> {
    try {
      // Note: apiResponseInterceptor unwraps { success, data } -> data
      const notifications = await firstValueFrom(
        this.http.get<Notification[]>(`${this.baseUrl}`, {
          params: { limit: String(limit) },
        }),
      );
      this._notifications.set(notifications || []);
    } catch (error) {
      this.logger.error('Failed to load notifications:', error);
    }
  }

  /**
   * Load notification settings
   */
  async loadSettings(): Promise<void> {
    try {
      const settings = await firstValueFrom(
        this.http.get<NotificationSettings>(`${this.baseUrl}/settings`),
      );
      this._settings.set(settings);
    } catch (error) {
      this.logger.error('Failed to load notification settings:', error);
    }
  }

  /**
   * Update notification settings
   */
  async updateSettings(settings: Partial<NotificationSettings>): Promise<void> {
    try {
      const updated = await firstValueFrom(
        this.http.patch<NotificationSettings>(`${this.baseUrl}/settings`, settings),
      );
      this._settings.set(updated);
    } catch (error) {
      this.logger.error('Failed to update settings:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      await firstValueFrom(this.http.patch(`${this.baseUrl}/${notificationId}/read`, {}));
      this._notifications.update((list) =>
        list.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
      );
    } catch (error) {
      // Optimistic update even on error
      this._notifications.update((list) =>
        list.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
      );
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${this.baseUrl}/mark-all-read`, {}));
      this._notifications.update((list) => list.map((n) => ({ ...n, read: true })));
    } catch (error) {
      // Optimistic update
      this._notifications.update((list) => list.map((n) => ({ ...n, read: true })));
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribeToPush(subscription: PushSubscription): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.baseUrl}/subscribe`, {
        endpoint: subscription.endpoint,
        keys: subscription.toJSON().keys,
      }),
    );
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      await firstValueFrom(this.http.delete(`${this.baseUrl}/${notificationId}`));
      this._notifications.update((list) => list.filter((n) => n.id !== notificationId));
    } catch (error) {
      this.logger.error('Failed to delete notification:', error);
    }
  }
}
