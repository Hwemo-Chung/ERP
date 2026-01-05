// apps/web/src/app/features/profile/profile.page.ts
// User profile page - Settings, sync status, and logout
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonAvatar,
  IonToggle,
  AlertController,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  personCircleOutline,
  logOutOutline,
  notificationsOutline,
  moonOutline,
  informationCircleOutline,
  refreshOutline,
} from 'ionicons/icons';
import { AuthService } from '@core/services/auth.service';
import { SyncQueueService } from '@core/services/sync-queue.service';
import { environment } from '@env/environment';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    IonButton,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonAvatar,
    IonToggle,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <!-- 프로필 타이틀 -->
        <ion-title>{{ 'PROFILE.TITLE' | translate }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- User Info Card - 사용자 정보 카드 -->
      <ion-card>
        <ion-card-content class="user-card">
          <ion-avatar>
            <ion-icon name="person-circle-outline"></ion-icon>
          </ion-avatar>
          <div class="user-info">
            <h2>{{ authService.user()?.name }}</h2>
            <p>{{ authService.user()?.email }}</p>
            <p class="roles">
              @for (role of authService.roles(); track role) {
                <span class="role-badge">{{ role }}</span>
              }
            </p>
          </div>
        </ion-card-content>
      </ion-card>

      <!-- Sync Status - 동기화 상태 -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ 'PROFILE.SYNC_STATUS.TITLE' | translate }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list lines="none">
            <ion-item>
              <ion-icon slot="start" name="refresh-outline"></ion-icon>
              <ion-label>
                <h3>{{ 'PROFILE.SYNC_STATUS.PENDING' | translate }}</h3>
                <p>
                  {{ syncQueue.pendingCount() }}{{ 'PROFILE.SYNC_STATUS.OPERATIONS' | translate }}
                </p>
              </ion-label>
              @if (syncQueue.pendingCount() > 0) {
                <ion-button
                  fill="outline"
                  size="small"
                  slot="end"
                  (click)="forceSync()"
                  [disabled]="syncQueue.isSyncing()"
                >
                  {{ 'PROFILE.SYNC_STATUS.SYNC_NOW' | translate }}
                </ion-button>
              }
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>

      <!-- Settings - 설정 -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ 'PROFILE.SETTINGS.TITLE' | translate }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list lines="full">
            <ion-item>
              <ion-icon slot="start" name="notifications-outline"></ion-icon>
              <ion-label>{{ 'PROFILE.SETTINGS.PUSH_NOTIFICATIONS' | translate }}</ion-label>
              <ion-toggle slot="end" [checked]="true"></ion-toggle>
            </ion-item>
            <ion-item>
              <ion-icon slot="start" name="moon-outline"></ion-icon>
              <ion-label>{{ 'PROFILE.SETTINGS.DARK_MODE' | translate }}</ion-label>
              <ion-toggle slot="end" (ionChange)="toggleDarkMode($event)"></ion-toggle>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>

      <!-- App Info - 앱 정보 -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ 'PROFILE.ABOUT.TITLE' | translate }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list lines="none">
            <ion-item>
              <ion-icon slot="start" name="information-circle-outline"></ion-icon>
              <ion-label>
                <h3>{{ 'PROFILE.ABOUT.VERSION' | translate }}</h3>
                <p>{{ version }}</p>
              </ion-label>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>

      <!-- Logout Button - 로그아웃 버튼 -->
      <div class="logout-section">
        <ion-button color="danger" fill="outline" (click)="confirmLogout()">
          <ion-icon slot="start" name="log-out-outline"></ion-icon>
          {{ 'PROFILE.LOGOUT.BUTTON' | translate }}
        </ion-button>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .user-card {
        display: flex;
        align-items: center;
        gap: 16px;

        ion-avatar {
          width: 64px;
          height: 64px;

          ion-icon {
            width: 100%;
            height: 100%;
            color: var(--ion-color-primary);
          }
        }

        .user-info {
          h2 {
            margin: 0 0 4px 0;
            font-size: 18px;
            font-weight: 600;
          }

          p {
            margin: 0;
            font-size: 14px;
            color: var(--ion-color-medium);
          }

          .roles {
            margin-top: 8px;
          }

          .role-badge {
            display: inline-block;
            padding: 2px 8px;
            margin-right: 4px;
            background: var(--ion-color-primary-tint);
            color: var(--ion-color-primary);
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
          }
        }
      }

      ion-button[expand='block'] {
        margin-top: 24px;
      }
    `,
  ],
})
export class ProfilePage {
  protected readonly authService = inject(AuthService);
  protected readonly syncQueue = inject(SyncQueueService);
  private readonly alertCtrl = inject(AlertController);
  private readonly translate = inject(TranslateService);

  protected readonly version = environment.appVersion;

  constructor() {
    addIcons({
      personCircleOutline,
      logOutOutline,
      notificationsOutline,
      moonOutline,
      informationCircleOutline,
      refreshOutline,
    });
  }

  protected async forceSync(): Promise<void> {
    await this.syncQueue.processQueue();
  }

  protected toggleDarkMode(event: CustomEvent): void {
    document.body.classList.toggle('dark', event.detail.checked);
  }

  /**
   * 로그아웃 확인 다이얼로그 표시
   * Shows logout confirmation dialog
   */
  protected async confirmLogout(): Promise<void> {
    // async 핸들러 내에서 this 참조 문제 방지를 위해 캡처
    const translateService = this.translate;

    const alert = await this.alertCtrl.create({
      header: translateService.instant('PROFILE.LOGOUT.CONFIRM_TITLE'),
      message: translateService.instant('PROFILE.LOGOUT.CONFIRM_MESSAGE'),
      buttons: [
        { text: translateService.instant('PROFILE.LOGOUT.CANCEL'), role: 'cancel' },
        {
          text: translateService.instant('PROFILE.LOGOUT.CONFIRM'),
          handler: () => this.authService.logout(),
        },
      ],
    });

    await alert.present();
  }
}
