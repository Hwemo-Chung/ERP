/**
 * FR-22: Biometric Settings Page
 * PRD: Device-level biometric authentication preferences
 */
import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
  IonToggle,
  IonIcon,
  IonNote,
  IonSpinner,
  IonButton,
  AlertController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { fingerPrintOutline, shieldCheckmarkOutline, lockClosedOutline } from 'ionicons/icons';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { BiometricService } from '../../../../core/services/biometric.service';
import { AuthService } from '../../../../core/services/auth.service';
import { LoggerService } from '../../../../core/services/logger.service';

@Component({
  selector: 'app-biometric-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonBackButton,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonList,
    IonItem,
    IonLabel,
    IonToggle,
    IonIcon,
    IonNote,
    IonSpinner,
    IonButton,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/settings"></ion-back-button>
        </ion-buttons>
        <!-- 생체 인증 설정 타이틀 -->
        <ion-title>{{ 'SETTINGS.BIOMETRIC.TITLE' | translate }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (isLoading()) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      } @else if (!isAvailable()) {
        <!-- Not available - 생체 인증 사용 불가 -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>
              <ion-icon name="lock-closed-outline"></ion-icon>
              {{ 'SETTINGS.BIOMETRIC.NOT_AVAILABLE_TITLE' | translate }}
            </ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p>{{ 'SETTINGS.BIOMETRIC.NOT_AVAILABLE' | translate }}</p>
            <ion-note>
              • {{ 'SETTINGS.BIOMETRIC.NOT_AVAILABLE_NOTES.WEB_BROWSER' | translate }}<br />
              • {{ 'SETTINGS.BIOMETRIC.NOT_AVAILABLE_NOTES.NATIVE_ONLY' | translate }}<br />
              • {{ 'SETTINGS.BIOMETRIC.NOT_AVAILABLE_NOTES.MUST_REGISTER' | translate }}
            </ion-note>
          </ion-card-content>
        </ion-card>
      } @else {
        <!-- Available - 생체 인증 가능 -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>
              <ion-icon name="finger-print-outline"></ion-icon>
              {{ biometryTypeName() }}
            </ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p>{{ 'SETTINGS.BIOMETRIC.QUICK_SECURE' | translate }}</p>

            <ion-list lines="none">
              <ion-item>
                <ion-icon slot="start" name="shield-checkmark-outline" color="primary"></ion-icon>
                <ion-label>
                  <h3>{{ 'SETTINGS.BIOMETRIC.ENABLE_LABEL' | translate }}</h3>
                  <p>
                    {{
                      'SETTINGS.BIOMETRIC.ENABLE_NEXT_LOGIN'
                        | translate: { type: biometryTypeName() }
                    }}
                  </p>
                </ion-label>
                <ion-toggle
                  [checked]="isEnabled()"
                  (ionChange)="onToggleChange($event)"
                  [disabled]="isProcessing()"
                ></ion-toggle>
              </ion-item>
            </ion-list>

            @if (isEnabled() && lastUsedAt()) {
              <ion-note class="last-used">
                {{ 'SETTINGS.BIOMETRIC.LAST_USED' | translate }}:
                {{ formatLastUsed(lastUsedAt()!) }}
              </ion-note>
            }
          </ion-card-content>
        </ion-card>

        <!-- Security Info - 보안 정보 -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>{{
              'SETTINGS.BIOMETRIC.SECURITY_INFO.TITLE' | translate
            }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list lines="none">
              <ion-item>
                <ion-icon slot="start" name="shield-checkmark-outline" color="success"></ion-icon>
                <ion-label class="ion-text-wrap">
                  <h3>{{ 'SETTINGS.BIOMETRIC.SECURITY_INFO.SAFE_STORAGE' | translate }}</h3>
                  <p>{{ 'SETTINGS.BIOMETRIC.SECURITY_INFO.SAFE_STORAGE_DESC' | translate }}</p>
                </ion-label>
              </ion-item>
              <ion-item>
                <ion-icon slot="start" name="lock-closed-outline" color="success"></ion-icon>
                <ion-label class="ion-text-wrap">
                  <h3>{{ 'SETTINGS.BIOMETRIC.SECURITY_INFO.DEVICE_ONLY' | translate }}</h3>
                  <p>{{ 'SETTINGS.BIOMETRIC.SECURITY_INFO.DEVICE_ONLY_DESC' | translate }}</p>
                </ion-label>
              </ion-item>
              <ion-item>
                <ion-icon slot="start" name="finger-print-outline" color="success"></ion-icon>
                <ion-label class="ion-text-wrap">
                  <h3>{{ 'SETTINGS.BIOMETRIC.SECURITY_INFO.REAUTH_REQUIRED' | translate }}</h3>
                  <p>{{ 'SETTINGS.BIOMETRIC.SECURITY_INFO.REAUTH_REQUIRED_DESC' | translate }}</p>
                </ion-label>
              </ion-item>
            </ion-list>
          </ion-card-content>
        </ion-card>

        @if (isEnabled()) {
          <div class="action-buttons">
            <ion-button
              fill="outline"
              color="danger"
              (click)="testBiometric()"
              [disabled]="isProcessing()"
            >
              <ion-icon slot="start" name="finger-print-outline"></ion-icon>
              {{ 'SETTINGS.BIOMETRIC.TEST_BUTTON' | translate }}
            </ion-button>
          </div>
        }
      }
    </ion-content>
  `,
  styles: [
    `
      .loading-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 200px;
      }

      ion-card-title {
        display: flex;
        align-items: center;
        gap: 8px;

        ion-icon {
          font-size: 24px;
        }
      }

      ion-note.last-used {
        display: block;
        margin-top: 12px;
        padding: 8px;
        background: var(--ion-color-light);
        border-radius: 4px;
      }

      ion-item {
        --padding-start: 0;
        margin-bottom: 8px;
      }

      .action-buttons {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 12px;
        margin-top: 16px;

        ion-button {
          flex: 0 1 auto;
          min-width: 140px;
          max-width: 200px;
          margin-top: 0;
        }

        @media (max-width: 767px) {
          flex-direction: column;
          align-items: center;

          ion-button {
            width: 100%;
            max-width: 100%;
          }
        }
      }
    `,
  ],
})
export class BiometricSettingsPage implements OnInit, OnDestroy {
  private readonly biometricService = inject(BiometricService);
  private readonly authService = inject(AuthService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly logger = inject(LoggerService);
  private readonly destroy$ = new Subject<void>();

  protected readonly isLoading = signal(true);
  protected readonly isAvailable = signal(false);
  protected readonly isEnabled = signal(false);
  protected readonly isProcessing = signal(false);
  protected readonly biometryTypeName = signal('');
  protected readonly lastUsedAt = signal<number | null>(null);

  constructor() {
    addIcons({
      fingerPrintOutline,
      shieldCheckmarkOutline,
      lockClosedOutline,
    });
  }

  ngOnInit(): void {
    this.loadBiometricStatus();
    this.subscribeToBiometricConfig();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load biometric availability and settings
   */
  private async loadBiometricStatus(): Promise<void> {
    try {
      const available = await this.biometricService.checkAvailability();
      this.isAvailable.set(available);

      if (available) {
        this.biometryTypeName.set(this.biometricService.getBiometryTypeName());
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Subscribe to biometric config changes
   */
  private subscribeToBiometricConfig(): void {
    this.biometricService.config$.pipe(takeUntil(this.destroy$)).subscribe((config) => {
      this.isEnabled.set(config.enabled);
      this.lastUsedAt.set(config.lastUsedAt);
    });
  }

  /**
   * Handle toggle change
   */
  async onToggleChange(event: any): Promise<void> {
    const enabled = event.detail.checked;

    if (enabled) {
      await this.enableBiometric();
    } else {
      await this.disableBiometric();
    }
  }

  /**
   * Enable biometric authentication
   */
  private async enableBiometric(): Promise<void> {
    this.isProcessing.set(true);

    try {
      const user = this.authService.user();
      const refreshToken = localStorage.getItem('refresh_token');

      if (!user || !refreshToken) {
        throw new Error('User not authenticated');
      }

      await this.biometricService.enableBiometric(user.id, refreshToken);

      // async 핸들러 내에서 this 참조 문제 방지를 위해 캡처
      const translateService = this.translate;

      const toast = await this.toastCtrl.create({
        message: translateService.instant('SETTINGS.BIOMETRIC.TOAST.ENABLE_SUCCESS'),
        duration: 2000,
        color: 'success',
      });
      await toast.present();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to enable biometric:', msg);

      // Revert toggle
      this.isEnabled.set(false);

      const translateService = this.translate;

      const toast = await this.toastCtrl.create({
        message: msg || translateService.instant('SETTINGS.BIOMETRIC.TOAST.ERROR'),
        duration: 3000,
        color: 'danger',
      });
      await toast.present();
    } finally {
      this.isProcessing.set(false);
    }
  }

  /**
   * 생체 인증 비활성화
   * Disable biometric authentication
   */
  private async disableBiometric(): Promise<void> {
    // async 핸들러 내에서 this 참조 문제 방지를 위해 캡처
    const translateService = this.translate;

    const alert = await this.alertCtrl.create({
      header: translateService.instant('SETTINGS.BIOMETRIC.CONFIRM_DISABLE.TITLE'),
      message: translateService.instant('SETTINGS.BIOMETRIC.CONFIRM_DISABLE.MESSAGE'),
      buttons: [
        {
          text: translateService.instant('SETTINGS.BIOMETRIC.CONFIRM_DISABLE.CANCEL'),
          role: 'cancel',
          handler: () => {
            this.isEnabled.set(true);
          },
        },
        {
          text: translateService.instant('SETTINGS.BIOMETRIC.CONFIRM_DISABLE.CONFIRM'),
          role: 'destructive',
          handler: async () => {
            this.isProcessing.set(true);

            try {
              await this.biometricService.disableBiometric();

              const toast = await this.toastCtrl.create({
                message: translateService.instant('SETTINGS.BIOMETRIC.TOAST.DISABLE_SUCCESS'),
                duration: 2000,
                color: 'success',
              });
              await toast.present();
            } catch (error) {
              this.logger.error('Failed to disable biometric:', error);

              // Revert toggle
              this.isEnabled.set(true);

              const toast = await this.toastCtrl.create({
                message: translateService.instant('SETTINGS.BIOMETRIC.TOAST.ERROR'),
                duration: 3000,
                color: 'danger',
              });
              await toast.present();
            } finally {
              this.isProcessing.set(false);
            }
          },
        },
      ],
    });

    await alert.present();
  }

  /**
   * 생체 인증 테스트
   * Test biometric authentication
   */
  async testBiometric(): Promise<void> {
    this.isProcessing.set(true);
    // async 핸들러 내에서 this 참조 문제 방지를 위해 캡처
    const translateService = this.translate;

    try {
      const result = await this.biometricService.authenticate();

      if (result) {
        const toast = await this.toastCtrl.create({
          message: translateService.instant('SETTINGS.BIOMETRIC.TOAST.TEST_SUCCESS'),
          duration: 2000,
          color: 'success',
        });
        await toast.present();
      } else {
        throw new Error('Authentication failed');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Biometric test failed:', msg);

      const toast = await this.toastCtrl.create({
        message: translateService.instant('SETTINGS.BIOMETRIC.TOAST.ERROR'),
        duration: 3000,
        color: 'danger',
      });
      await toast.present();
    } finally {
      this.isProcessing.set(false);
    }
  }

  /**
   * 마지막 사용 시간 포맷
   * Format last used timestamp
   */
  protected formatLastUsed(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return this.translate.instant('COMMON.TIME_AGO.JUST_NOW');
    if (diffMins < 60)
      return this.translate.instant('COMMON.TIME_AGO.MINUTES_AGO', { count: diffMins });
    if (diffHours < 24)
      return this.translate.instant('COMMON.TIME_AGO.HOURS_AGO', { count: diffHours });
    if (diffDays < 7)
      return this.translate.instant('COMMON.TIME_AGO.DAYS_AGO', { count: diffDays });

    // 7일 이상이면 locale에 맞게 날짜 표시
    const lang = this.translate.currentLang || 'ko';
    return date.toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US');
  }
}
