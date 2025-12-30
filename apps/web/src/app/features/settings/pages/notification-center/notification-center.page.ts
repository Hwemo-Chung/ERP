// apps/web/src/app/features/settings/pages/notification-center/notification-center.page.ts
// 알림 센터 페이지 - Notification center page
import { Component, signal, computed, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton,
  IonList, IonItem, IonLabel, IonBadge, IonIcon, IonSpinner, IonSegment, IonSegmentButton,
  IonToggle, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonRefresher, IonRefresherContent,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { notificationsOutline, checkmarkCircleOutline, alertCircleOutline, swapHorizontalOutline, timeOutline, trashOutline } from 'ionicons/icons';
import { NotificationsService, Notification, NotifCategory } from '../../../../core/services/notifications.service';

@Component({
  selector: 'app-notification-center',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, TranslateModule, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton,
    IonList, IonItem, IonLabel, IonBadge, IonIcon, IonSpinner, IonSegment, IonSegmentButton,
    IonToggle, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonRefresher, IonRefresherContent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/settings"></ion-back-button></ion-buttons>
        <!-- 알림 센터 타이틀 -->
        <ion-title>{{ 'SETTINGS.NOTIFICATION_CENTER.TITLE' | translate }}</ion-title>
        <ion-buttons slot="end"><ion-button (click)="markAllRead()">{{ 'SETTINGS.NOTIFICATION_CENTER.MARK_ALL_READ' | translate }}</ion-button></ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [value]="filter()" (ionChange)="filter.set($any($event).detail.value)">
          <ion-segment-button value="all"><ion-label>{{ 'SETTINGS.NOTIFICATION_CENTER.TAB_ALL' | translate }}</ion-label></ion-segment-button>
          <ion-segment-button value="unread"><ion-label>{{ 'SETTINGS.NOTIFICATION_CENTER.TAB_UNREAD' | translate }} ({{ unreadCount() }})</ion-label></ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- Settings - 알림 설정 -->
      <ion-card>
        <ion-card-header><ion-card-title>{{ 'SETTINGS.NOTIFICATION_CENTER.SETTINGS_TITLE' | translate }}</ion-card-title></ion-card-header>
        <ion-card-content>
          <ion-item><ion-label>{{ 'SETTINGS.NOTIFICATION_CENTER.SETTING_REASSIGN' | translate }}</ion-label><ion-toggle [checked]="settings().reassign" (ionChange)="toggleSetting('reassign')"></ion-toggle></ion-item>
          <ion-item><ion-label>{{ 'SETTINGS.NOTIFICATION_CENTER.SETTING_DELAY' | translate }}</ion-label><ion-toggle [checked]="settings().delay" (ionChange)="toggleSetting('delay')"></ion-toggle></ion-item>
          <ion-item><ion-label>{{ 'SETTINGS.NOTIFICATION_CENTER.SETTING_CUSTOMER' | translate }}</ion-label><ion-toggle [checked]="settings().customer" (ionChange)="toggleSetting('customer')"></ion-toggle></ion-item>
          <ion-item><ion-label>{{ 'SETTINGS.NOTIFICATION_CENTER.SETTING_PUSH' | translate }}</ion-label><ion-toggle [checked]="settings().pushEnabled" (ionChange)="toggleSetting('pushEnabled')"></ion-toggle></ion-item>
        </ion-card-content>
      </ion-card>

      <!-- Notifications - 알림 목록 -->
      @if (isLoading()) {
        <div class="center"><ion-spinner name="crescent"></ion-spinner></div>
      } @else {
        <ion-list>
          @for (n of filteredNotifications(); track n.id) {
            <ion-item [class.unread]="!n.read" (click)="openNotification(n)" detail button>
              <ion-icon [name]="getCategoryIcon(n.category)" slot="start" [color]="getCategoryColor(n.category)"></ion-icon>
              <ion-label>
                <h3>{{ n.title }}</h3>
                <p>{{ n.message }}</p>
                <p class="time">{{ formatTime(n.createdAt) }}</p>
              </ion-label>
              @if (!n.read) { <ion-badge color="primary" slot="end">{{ 'SETTINGS.NOTIFICATION_CENTER.NEW' | translate }}</ion-badge> }
            </ion-item>
          } @empty {
            <div class="empty">{{ 'SETTINGS.NOTIFICATION_CENTER.EMPTY' | translate }}</div>
          }
        </ion-list>
      }
    </ion-content>
  `,
  styles: [`
    .unread { --background: var(--ion-color-primary-tint); }
    .center { display: flex; justify-content: center; padding: 48px; }
    .empty { text-align: center; padding: 48px; color: var(--ion-color-medium); }
    .time { font-size: 11px; color: var(--ion-color-medium); }
    ion-card-title { font-size: 16px; }
  `],
})
export class NotificationCenterPage implements OnInit {
  private readonly router = inject(Router);
  private readonly notifSvc = inject(NotificationsService);
  private readonly toastCtrl = inject(ToastController);
  private readonly translate = inject(TranslateService);

  protected readonly isLoading = signal(false);
  protected readonly filter = signal<'all' | 'unread'>('all');

  // From service
  protected readonly notifications = this.notifSvc.notifications;
  protected readonly settings = this.notifSvc.settings;
  protected readonly unreadCount = this.notifSvc.unreadCount;

  protected readonly filteredNotifications = computed(() => {
    const f = this.filter();
    const list = this.notifications();
    return f === 'all' ? list : list.filter(n => !n.read);
  });

  constructor() {
    addIcons({ notificationsOutline, checkmarkCircleOutline, alertCircleOutline, swapHorizontalOutline, timeOutline, trashOutline });
  }

  ngOnInit() { this.loadData(); }

  async loadData() {
    this.isLoading.set(true);
    try {
      await Promise.all([
        this.notifSvc.loadNotifications(),
        this.notifSvc.loadSettings(),
      ]);
    } finally {
      this.isLoading.set(false);
    }
  }

  async onRefresh(e: any) {
    await this.loadData();
    e.target.complete();
  }

  /**
   * 알림 설정 토글
   * Toggle notification setting
   */
  async toggleSetting(key: 'reassign' | 'delay' | 'customer' | 'pushEnabled') {
    const current = this.settings();
    // async 핸들러 내에서 this 참조 문제 방지를 위해 캡처
    const translateService = this.translate;
    
    try {
      await this.notifSvc.updateSettings({ [key]: !current[key] });
    } catch {
      const toast = await this.toastCtrl.create({ message: translateService.instant('SETTINGS.NOTIFICATION_CENTER.TOAST.SETTING_ERROR'), duration: 2000, color: 'danger' });
      await toast.present();
    }
  }

  /**
   * 모두 읽음 처리
   * Mark all notifications as read
   */
  async markAllRead() {
    // async 핸들러 내에서 this 참조 문제 방지를 위해 캡처
    const translateService = this.translate;
    
    await this.notifSvc.markAllAsRead();
    const toast = await this.toastCtrl.create({ message: translateService.instant('SETTINGS.NOTIFICATION_CENTER.TOAST.MARK_ALL_READ'), duration: 1500, color: 'success' });
    await toast.present();
  }

  async openNotification(n: Notification) {
    await this.notifSvc.markAsRead(n.id);
    if (n.orderId) {
      this.router.navigate(['/tabs/orders', n.orderId]);
    }
  }

  getCategoryIcon(c: NotifCategory): string {
    const map: Record<NotifCategory, string> = {
      reassign: 'swap-horizontal-outline',
      delay: 'time-outline',
      customer: 'alert-circle-outline',
      system: 'notifications-outline',
    };
    return map[c] || 'notifications-outline';
  }

  getCategoryColor(c: NotifCategory): string {
    const map: Record<NotifCategory, string> = {
      reassign: 'warning',
      delay: 'danger',
      customer: 'primary',
      system: 'medium',
    };
    return map[c] || 'medium';
  }

  /**
   * 시간 포맷
   * Format time as relative string
   */
  formatTime(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return this.translate.instant('SETTINGS.NOTIFICATION_CENTER.TIME_AGO.JUST_NOW');
    if (mins < 60) return this.translate.instant('COMMON.TIME_AGO.MINUTES_AGO', { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return this.translate.instant('COMMON.TIME_AGO.HOURS_AGO', { count: hours });
    const days = Math.floor(hours / 24);
    if (days < 7) return this.translate.instant('COMMON.TIME_AGO.DAYS_AGO', { count: days });
    const lang = this.translate.currentLang || 'ko';
    return d.toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US');
  }
}
