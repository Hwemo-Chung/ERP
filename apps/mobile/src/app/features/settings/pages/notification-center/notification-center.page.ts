import { Component, signal, inject, OnInit, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonButton, IonList, IonItem, IonLabel, IonBadge, IonIcon, IonSpinner,
  IonSegment, IonSegmentButton, IonToggle, IonCard, IonCardHeader,
  IonCardTitle, IonCardContent, IonRefresher, IonRefresherContent,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { notificationsOutline, checkmarkCircleOutline, alertCircleOutline, swapHorizontalOutline, timeOutline, trashOutline } from 'ionicons/icons';
import { NotificationsService, Notification, NotifCategory } from '../../../../core/services/notifications.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-notification-center',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, TranslateModule, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons,
    IonBackButton, IonButton, IonList, IonItem, IonLabel, IonBadge, IonIcon,
    IonSpinner, IonSegment, IonSegmentButton, IonToggle, IonCard, IonCardHeader,
    IonCardTitle, IonCardContent, IonRefresher, IonRefresherContent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/settings"></ion-back-button>
        </ion-buttons>
        <ion-title>알림 센터</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="markAllRead()" [disabled]="unreadCount() === 0">
            모두 읽음
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [value]="filter()" (ionChange)="filter.set($any($event).detail.value)">
          <ion-segment-button value="all">
            <ion-label>전체</ion-label>
          </ion-segment-button>
          <ion-segment-button value="unread">
            <ion-label>안읽음 ({{ unreadCount() }})</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- Notification Settings -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>알림 설정</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-item>
            <ion-label>재배정 알림</ion-label>
            <ion-toggle
              [checked]="settings().reassign"
              (ionChange)="toggleSetting('reassign', $any($event).detail.checked)"
            ></ion-toggle>
          </ion-item>
          <ion-item>
            <ion-label>지연 알림</ion-label>
            <ion-toggle
              [checked]="settings().delay"
              (ionChange)="toggleSetting('delay', $any($event).detail.checked)"
            ></ion-toggle>
          </ion-item>
          <ion-item>
            <ion-label>고객 요청</ion-label>
            <ion-toggle
              [checked]="settings().customer"
              (ionChange)="toggleSetting('customer', $any($event).detail.checked)"
            ></ion-toggle>
          </ion-item>
        </ion-card-content>
      </ion-card>

      <!-- Notification List -->
      @if (isLoading()) {
        <div class="center">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      } @else {
        <ion-list>
          @for (notif of filteredNotifications(); track notif.id) {
            <ion-item [class.unread]="!notif.read" (click)="openNotification(notif)" detail>
              <ion-icon
                [name]="getCategoryIcon(notif.category)"
                slot="start"
                [color]="getCategoryColor(notif.category)"
              ></ion-icon>
              <ion-label>
                <h3>{{ notif.title }}</h3>
                <p>{{ notif.message }}</p>
                <p class="timestamp">{{ formatDate(notif.createdAt) }}</p>
              </ion-label>
              @if (!notif.read) {
                <ion-badge color="primary" slot="end">NEW</ion-badge>
              }
            </ion-item>
          } @empty {
            <div class="empty">알림이 없습니다</div>
          }
        </ion-list>
      }
    </ion-content>
  `,
  styles: [`
    .unread { --background: var(--ion-color-primary-tint); }
    .center { display: flex; justify-content: center; padding: 48px; }
    .empty { text-align: center; padding: 48px; color: var(--ion-color-medium); }
    .timestamp { font-size: 11px; color: var(--ion-color-medium); }
    ion-card-title { font-size: 16px; }
  `],
})
export class NotificationCenterPage implements OnInit {
  private readonly router = inject(Router);
  private readonly notificationsService = inject(NotificationsService);
  private readonly toastCtrl = inject(ToastController);

  protected readonly isLoading = signal(false);
  protected readonly filter = signal<'all' | 'unread'>('all');

  // Use service signals directly
  protected readonly notifications = this.notificationsService.notifications;
  protected readonly settings = this.notificationsService.settings;
  protected readonly unreadCount = this.notificationsService.unreadCount;

  protected readonly filteredNotifications = computed(() => {
    const f = this.filter();
    const list = this.notifications();
    return f === 'all' ? list : list.filter(n => !n.read);
  });

  constructor() {
    addIcons({
      notificationsOutline, checkmarkCircleOutline, alertCircleOutline,
      swapHorizontalOutline, timeOutline, trashOutline,
    });
  }

  async ngOnInit(): Promise<void> {
    await this.loadData();
  }

  async loadData(): Promise<void> {
    this.isLoading.set(true);
    try {
      await Promise.all([
        this.notificationsService.loadNotifications(),
        this.notificationsService.loadSettings(),
      ]);
    } finally {
      this.isLoading.set(false);
    }
  }

  async onRefresh(event: any): Promise<void> {
    await this.loadData();
    event.target.complete();
  }

  getCategoryIcon(c: NotifCategory): string {
    const map: Record<NotifCategory, string> = {
      reassign: 'swap-horizontal-outline',
      delay: 'time-outline',
      customer: 'alert-circle-outline',
      system: 'notifications-outline',
    };
    return map[c];
  }

  getCategoryColor(c: NotifCategory): string {
    const map: Record<NotifCategory, string> = {
      reassign: 'warning',
      delay: 'danger',
      customer: 'primary',
      system: 'medium',
    };
    return map[c];
  }

  async toggleSetting(key: 'reassign' | 'delay' | 'customer', value: boolean): Promise<void> {
    try {
      await this.notificationsService.updateSettings({ [key]: value });
    } catch {
      const toast = await this.toastCtrl.create({
        message: '설정 저장 실패',
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    }
  }

  async markAllRead(): Promise<void> {
    await this.notificationsService.markAllAsRead();
    const toast = await this.toastCtrl.create({
      message: '모든 알림을 읽음 처리했습니다',
      duration: 2000,
      color: 'success',
    });
    await toast.present();
  }

  async openNotification(n: Notification): Promise<void> {
    await this.notificationsService.markAsRead(n.id);
    if (n.orderId) {
      this.router.navigate(['/tabs/orders', n.orderId]);
    }
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return date.toLocaleDateString('ko-KR');
  }
}
