// apps/web/src/app/features/settings/pages/notification-center/notification-center.page.ts
import { Component, signal, computed, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton,
  IonList, IonItem, IonLabel, IonBadge, IonIcon, IonSpinner, IonSegment, IonSegmentButton,
  IonToggle, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonRefresher, IonRefresherContent,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { notificationsOutline, checkmarkCircleOutline, alertCircleOutline, swapHorizontalOutline, timeOutline, trashOutline } from 'ionicons/icons';
import { NotificationsService, Notification, NotifCategory } from '../../../../core/services/notifications.service';

@Component({
  selector: 'app-notification-center',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton,
    IonList, IonItem, IonLabel, IonBadge, IonIcon, IonSpinner, IonSegment, IonSegmentButton,
    IonToggle, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonRefresher, IonRefresherContent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/settings"></ion-back-button></ion-buttons>
        <ion-title>알림 센터</ion-title>
        <ion-buttons slot="end"><ion-button (click)="markAllRead()">모두 읽음</ion-button></ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [value]="filter()" (ionChange)="filter.set($any($event).detail.value)">
          <ion-segment-button value="all"><ion-label>전체</ion-label></ion-segment-button>
          <ion-segment-button value="unread"><ion-label>안읽음 ({{ unreadCount() }})</ion-label></ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- Settings -->
      <ion-card>
        <ion-card-header><ion-card-title>알림 설정</ion-card-title></ion-card-header>
        <ion-card-content>
          <ion-item><ion-label>재배정 알림</ion-label><ion-toggle [checked]="settings().reassign" (ionChange)="toggleSetting('reassign')"></ion-toggle></ion-item>
          <ion-item><ion-label>지연 알림</ion-label><ion-toggle [checked]="settings().delay" (ionChange)="toggleSetting('delay')"></ion-toggle></ion-item>
          <ion-item><ion-label>고객 요청</ion-label><ion-toggle [checked]="settings().customer" (ionChange)="toggleSetting('customer')"></ion-toggle></ion-item>
          <ion-item><ion-label>푸시 알림</ion-label><ion-toggle [checked]="settings().pushEnabled" (ionChange)="toggleSetting('pushEnabled')"></ion-toggle></ion-item>
        </ion-card-content>
      </ion-card>

      <!-- Notifications -->
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
              @if (!n.read) { <ion-badge color="primary" slot="end">NEW</ion-badge> }
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
    .time { font-size: 11px; color: var(--ion-color-medium); }
    ion-card-title { font-size: 16px; }
  `],
})
export class NotificationCenterPage implements OnInit {
  private readonly router = inject(Router);
  private readonly notifSvc = inject(NotificationsService);
  private readonly toastCtrl = inject(ToastController);

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

  async toggleSetting(key: 'reassign' | 'delay' | 'customer' | 'pushEnabled') {
    const current = this.settings();
    try {
      await this.notifSvc.updateSettings({ [key]: !current[key] });
    } catch {
      const toast = await this.toastCtrl.create({ message: '설정 저장 실패', duration: 2000, color: 'danger' });
      await toast.present();
    }
  }

  async markAllRead() {
    await this.notifSvc.markAllAsRead();
    const toast = await this.toastCtrl.create({ message: '모두 읽음 처리됨', duration: 1500, color: 'success' });
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

  formatTime(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '방금';
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}일 전`;
    return d.toLocaleDateString('ko-KR');
  }
}
