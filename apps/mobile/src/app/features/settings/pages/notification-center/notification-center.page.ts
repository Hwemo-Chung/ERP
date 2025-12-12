import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonList, IonItem, IonLabel, IonBadge, IonIcon, IonSpinner, IonSegment, IonSegmentButton, IonToggle, IonCard, IonCardHeader, IonCardTitle, IonCardContent } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { notificationsOutline, checkmarkCircleOutline, alertCircleOutline, swapHorizontalOutline, timeOutline, trashOutline } from 'ionicons/icons';

type NotifCategory = 'reassign' | 'delay' | 'customer' | 'system';
interface Notification { id: string; category: NotifCategory; title: string; message: string; createdAt: string; read: boolean; orderId?: string; }

@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [CommonModule, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonList, IonItem, IonLabel, IonBadge, IonIcon, IonSpinner, IonSegment, IonSegmentButton, IonToggle, IonCard, IonCardHeader, IonCardTitle, IonCardContent],
  template: `
    <ion-header>
      <ion-toolbar><ion-buttons slot="start"><ion-back-button defaultHref="/tabs/settings"></ion-back-button></ion-buttons><ion-title>알림 센터</ion-title>
        <ion-buttons slot="end"><ion-button (click)="markAllRead()">모두 읽음</ion-button></ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [value]="filter()" (ionChange)="filter.set($any($event).detail.value)">
          <ion-segment-button value="all"><ion-label>전체</ion-label></ion-segment-button>
          <ion-segment-button value="unread"><ion-label>안읽음</ion-label></ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <!-- Notification Settings -->
      <ion-card><ion-card-header><ion-card-title>알림 설정</ion-card-title></ion-card-header>
        <ion-card-content>
          <ion-item><ion-label>재배정 알림</ion-label><ion-toggle [checked]="settings().reassign" (ionChange)="toggleSetting('reassign')"></ion-toggle></ion-item>
          <ion-item><ion-label>지연 알림</ion-label><ion-toggle [checked]="settings().delay" (ionChange)="toggleSetting('delay')"></ion-toggle></ion-item>
          <ion-item><ion-label>고객 요청</ion-label><ion-toggle [checked]="settings().customer" (ionChange)="toggleSetting('customer')"></ion-toggle></ion-item>
        </ion-card-content>
      </ion-card>
      <!-- Notification List -->
      @if (isLoading()) { <div style="text-align:center;padding:48px"><ion-spinner></ion-spinner></div> }
      @else {
        <ion-list>
          @for (notif of filteredNotifications(); track notif.id) {
            <ion-item [class.unread]="!notif.read" (click)="openNotification(notif)" detail>
              <ion-icon [name]="getCategoryIcon(notif.category)" slot="start" [color]="getCategoryColor(notif.category)"></ion-icon>
              <ion-label><h3>{{ notif.title }}</h3><p>{{ notif.message }}</p><p style="font-size:11px;color:var(--ion-color-medium)">{{ notif.createdAt }}</p></ion-label>
              @if (!notif.read) { <ion-badge color="primary" slot="end">NEW</ion-badge> }
            </ion-item>
          } @empty { <div style="text-align:center;padding:48px;color:var(--ion-color-medium)">알림이 없습니다</div> }
        </ion-list>
      }
    </ion-content>
  `,
  styles: [`.unread { --background: var(--ion-color-primary-tint); }`],
})
export class NotificationCenterPage {
  private router: Router;
  isLoading = signal(false);
  filter = signal<'all' | 'unread'>('all');
  notifications = signal<Notification[]>([]);
  settings = signal({ reassign: true, delay: true, customer: true });
  constructor(router: Router) { this.router = router; addIcons({ notificationsOutline, checkmarkCircleOutline, alertCircleOutline, swapHorizontalOutline, timeOutline, trashOutline }); }
  filteredNotifications() { const f = this.filter(); return f === 'all' ? this.notifications() : this.notifications().filter(n => !n.read); }
  getCategoryIcon(c: NotifCategory) { const map: Record<NotifCategory, string> = { reassign: 'swap-horizontal-outline', delay: 'time-outline', customer: 'alert-circle-outline', system: 'notifications-outline' }; return map[c]; }
  getCategoryColor(c: NotifCategory) { const map: Record<NotifCategory, string> = { reassign: 'warning', delay: 'danger', customer: 'primary', system: 'medium' }; return map[c]; }
  toggleSetting(key: 'reassign' | 'delay' | 'customer') { this.settings.update(s => ({ ...s, [key]: !s[key] })); }
  markAllRead() { this.notifications.update(list => list.map(n => ({ ...n, read: true }))); }
  openNotification(n: Notification) { n.read = true; if (n.orderId) this.router.navigate(['/tabs/orders', n.orderId]); }
}
