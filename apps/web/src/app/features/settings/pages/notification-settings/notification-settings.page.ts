/**
 * FR-23: Notification Settings Page
 * PRD: 기기별 알림 설정 - 카테고리별 뮤트/활성화 토글
 * 
 * 기능:
 * - 알림 카테고리별 on/off 설정
 * - 기기별 설정 저장
 * - 알림 채널: 재배정, 연체, 고객요청, 시스템
 */
import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonBackButton,
  IonButtons,
  IonList,
  IonItem,
  IonLabel,
  IonToggle,
  IonIcon,
  IonNote,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonBadge,
  IonSpinner,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  notificationsOutline,
  swapHorizontalOutline,
  warningOutline,
  personOutline,
  settingsOutline,
  volumeHighOutline,
  volumeMuteOutline,
  phonePortraitOutline,
} from 'ionicons/icons';
import { NotificationsService } from '../../../../core/services/notifications.service';

interface NotificationCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  color: string;
}

interface DeviceInfo {
  deviceId: string;
  platform: string;
  model: string;
  lastUsed: Date;
}

@Component({
  selector: 'app-notification-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonBackButton,
    IonButtons,
    IonList,
    IonItem,
    IonLabel,
    IonToggle,
    IonIcon,
    IonNote,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonBadge,
    IonSpinner,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/settings" text=""></ion-back-button>
        </ion-buttons>
        <ion-title>알림 설정</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (isLoading()) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      } @else {
        <!-- 마스터 토글 -->
        <ion-card>
          <ion-card-content>
            <ion-item lines="none">
              <ion-icon 
                [name]="masterEnabled() ? 'volume-high-outline' : 'volume-mute-outline'" 
                slot="start"
                [color]="masterEnabled() ? 'primary' : 'medium'">
              </ion-icon>
              <ion-label>
                <h2>알림 받기</h2>
                <p>이 기기에서 푸시 알림을 받습니다</p>
              </ion-label>
              <ion-toggle 
                [checked]="masterEnabled()" 
                (ionChange)="toggleMaster($event)">
              </ion-toggle>
            </ion-item>
          </ion-card-content>
        </ion-card>

        <!-- 카테고리별 설정 -->
        <h3 class="section-title">알림 카테고리</h3>
        <ion-card>
          <ion-list>
            @for (category of categories(); track category.id) {
              <ion-item>
                <ion-icon 
                  [name]="category.icon" 
                  slot="start"
                  [color]="category.color">
                </ion-icon>
                <ion-label>
                  <h3>{{ category.name }}</h3>
                  <p>{{ category.description }}</p>
                </ion-label>
                <ion-toggle 
                  [checked]="category.enabled" 
                  [disabled]="!masterEnabled()"
                  (ionChange)="toggleCategory(category.id, $event)">
                </ion-toggle>
              </ion-item>
            }
          </ion-list>
        </ion-card>

        <!-- 현재 기기 정보 -->
        <h3 class="section-title">현재 기기</h3>
        <ion-card>
          <ion-card-content>
            <ion-item lines="none">
              <ion-icon name="phone-portrait-outline" slot="start" color="primary"></ion-icon>
              <ion-label>
                <h3>{{ currentDevice().model }}</h3>
                <p>{{ currentDevice().platform }}</p>
                <ion-note>마지막 사용: {{ currentDevice().lastUsed | date:'short' }}</ion-note>
              </ion-label>
              <ion-badge color="success">현재 기기</ion-badge>
            </ion-item>
          </ion-card-content>
        </ion-card>

        <!-- 저장된 다른 기기들 -->
        @if (otherDevices().length > 0) {
          <h3 class="section-title">다른 기기</h3>
          <ion-card>
            <ion-list>
              @for (device of otherDevices(); track device.deviceId) {
                <ion-item>
                  <ion-icon name="phone-portrait-outline" slot="start" color="medium"></ion-icon>
                  <ion-label>
                    <h3>{{ device.model }}</h3>
                    <p>{{ device.platform }}</p>
                    <ion-note>마지막 사용: {{ device.lastUsed | date:'short' }}</ion-note>
                  </ion-label>
                </ion-item>
              }
            </ion-list>
          </ion-card>
        }
      }
    </ion-content>
  `,
  styles: [`
    .loading-container {
      display: flex;
      justify-content: center;
      padding: 48px;
    }

    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--ion-color-medium);
      margin: 24px 0 8px 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    ion-card {
      margin: 0 0 16px 0;
      border-radius: 12px;
    }

    ion-item h2, ion-item h3 {
      font-weight: 500;
    }

    ion-item p {
      font-size: 13px;
      color: var(--ion-color-medium);
    }
  `]
})
export class NotificationSettingsPage implements OnInit {
  private readonly toastCtrl = inject(ToastController);
  private readonly notificationsService = inject(NotificationsService);

  isLoading = signal(true);
  masterEnabled = signal(true);
  isSaving = signal(false);

  categories = signal<NotificationCategory[]>([
    {
      id: 'reassign',
      name: '재배정 알림',
      description: '주문 재배정 시 알림',
      icon: 'swap-horizontal-outline',
      enabled: true,
      color: 'primary',
    },
    {
      id: 'delay',
      name: '연체 알림',
      description: '처리 기한 초과 시 알림',
      icon: 'warning-outline',
      enabled: true,
      color: 'warning',
    },
    {
      id: 'customer',
      name: '고객 요청 알림',
      description: '고객 일정 변경/취소 요청 시 알림',
      icon: 'person-outline',
      enabled: true,
      color: 'success',
    },
    {
      id: 'system',
      name: '시스템 알림',
      description: '시스템 공지 및 업데이트 알림',
      icon: 'settings-outline',
      enabled: false,
      color: 'medium',
    },
  ]);

  currentDevice = signal<DeviceInfo>({
    deviceId: this.getDeviceId(),
    platform: this.detectPlatform(),
    model: this.detectModel(),
    lastUsed: new Date(),
  });

  otherDevices = signal<DeviceInfo[]>([]);

  constructor() {
    addIcons({ 
      notificationsOutline,
      swapHorizontalOutline,
      warningOutline,
      personOutline,
      settingsOutline,
      volumeHighOutline,
      volumeMuteOutline,
      phonePortraitOutline,
    });
  }

  async ngOnInit() {
    await this.loadSettings();
  }

  async loadSettings() {
    this.isLoading.set(true);
    try {
      // API에서 설정 로드
      await this.notificationsService.loadSettings();
      const settings = this.notificationsService.settings();
      
      // 마스터 토글 설정
      this.masterEnabled.set(settings.pushEnabled);
      
      // 카테고리별 설정 적용
      this.categories.update(categories => 
        categories.map(c => ({
          ...c,
          enabled: c.id === 'reassign' ? settings.reassign :
                   c.id === 'delay' ? settings.delay :
                   c.id === 'customer' ? settings.customer :
                   c.enabled
        }))
      );
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async toggleMaster(event: CustomEvent) {
    const enabled = event.detail.checked;
    this.masterEnabled.set(enabled);
    await this.saveSettings();
  }

  async toggleCategory(categoryId: string, event: CustomEvent) {
    const enabled = event.detail.checked;
    this.categories.update(categories => 
      categories.map(c => 
        c.id === categoryId ? { ...c, enabled } : c
      )
    );
    await this.saveSettings();
  }

  private async saveSettings() {
    this.isSaving.set(true);
    try {
      const categories = this.categories();
      const settings = {
        pushEnabled: this.masterEnabled(),
        reassign: categories.find(c => c.id === 'reassign')?.enabled ?? true,
        delay: categories.find(c => c.id === 'delay')?.enabled ?? true,
        customer: categories.find(c => c.id === 'customer')?.enabled ?? true,
      };
      
      await this.notificationsService.updateSettings(settings);
      
      const toast = await this.toastCtrl.create({
        message: '알림 설정이 저장되었습니다.',
        duration: 1500,
        color: 'success',
      });
      await toast.present();
    } catch (error) {
      const toast = await this.toastCtrl.create({
        message: '설정 저장에 실패했습니다.',
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    } finally {
      this.isSaving.set(false);
    }
  }

  private getDeviceId(): string {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = 'device-' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  private detectPlatform(): string {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return 'Android';
    if (/iPad|iPhone|iPod/.test(ua)) return 'iOS';
    return 'Web Browser';
  }

  private detectModel(): string {
    const ua = navigator.userAgent;
    const platform = navigator.platform || 'Unknown';
    
    if (/Chrome/.test(ua)) return `Chrome on ${platform}`;
    if (/Safari/.test(ua)) return `Safari on ${platform}`;
    if (/Firefox/.test(ua)) return `Firefox on ${platform}`;
    return `Browser on ${platform}`;
  }
}
