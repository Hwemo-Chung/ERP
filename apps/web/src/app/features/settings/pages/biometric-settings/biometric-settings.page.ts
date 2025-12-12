/**
 * FR-22: Biometric Settings Page
 * PRD: Device-level biometric authentication preferences
 */
import { Component, ChangeDetectionStrategy, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { addIcons } from 'ionicons';
import { fingerPrintOutline, shieldCheckmarkOutline, lockClosedOutline } from 'ionicons/icons';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { BiometricService } from '../../../../core/services/biometric.service';
import { AuthStore } from '../../../../store/auth/auth.store';

@Component({
  selector: 'app-biometric-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
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
        <ion-title>생체 인증 설정</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (isLoading()) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      } @else if (!isAvailable()) {
        <!-- Not available -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>
              <ion-icon name="lock-closed-outline"></ion-icon>
              생체 인증 사용 불가
            </ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p>이 기기에서는 생체 인증을 사용할 수 없습니다.</p>
            <ion-note>
              • 웹 브라우저에서는 지원되지 않습니다<br>
              • 네이티브 앱(Android/iOS)에서만 사용 가능합니다<br>
              • 기기에 생체 인증이 등록되어 있어야 합니다
            </ion-note>
          </ion-card-content>
        </ion-card>
      } @else {
        <!-- Available -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>
              <ion-icon name="fingerprint-outline"></ion-icon>
              {{ biometryTypeName() }}
            </ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p>빠르고 안전한 로그인을 위해 생체 인증을 사용하세요.</p>
            
            <ion-list lines="none">
              <ion-item>
                <ion-icon slot="start" name="shield-checkmark-outline" color="primary"></ion-icon>
                <ion-label>
                  <h3>생체 인증 활성화</h3>
                  <p>다음 로그인부터 {{ biometryTypeName() }}로 간편하게 로그인할 수 있습니다</p>
                </ion-label>
                <ion-toggle
                  [(ngModel)]="isEnabled"
                  (ionChange)="onToggleChange($event)"
                  [disabled]="isProcessing()"
                ></ion-toggle>
              </ion-item>
            </ion-list>

            @if (isEnabled && lastUsedAt()) {
              <ion-note class="last-used">
                마지막 사용: {{ formatLastUsed(lastUsedAt()!) }}
              </ion-note>
            }
          </ion-card-content>
        </ion-card>

        <!-- Security Info -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>보안 정보</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list lines="none">
              <ion-item>
                <ion-icon slot="start" name="shield-checkmark-outline" color="success"></ion-icon>
                <ion-label class="ion-text-wrap">
                  <h3>안전한 저장</h3>
                  <p>인증 정보는 기기의 보안 저장소에 암호화되어 저장됩니다</p>
                </ion-label>
              </ion-item>
              <ion-item>
                <ion-icon slot="start" name="lock-closed-outline" color="success"></ion-icon>
                <ion-label class="ion-text-wrap">
                  <h3>기기 전용</h3>
                  <p>생체 인증은 이 기기에서만 작동하며 다른 기기와 공유되지 않습니다</p>
                </ion-label>
              </ion-item>
              <ion-item>
                <ion-icon slot="start" name="fingerprint-outline" color="success"></ion-icon>
                <ion-label class="ion-text-wrap">
                  <h3>재인증 필요</h3>
                  <p>30일 이상 사용하지 않으면 비밀번호로 다시 로그인해야 합니다</p>
                </ion-label>
              </ion-item>
            </ion-list>
          </ion-card-content>
        </ion-card>

        @if (isEnabled) {
          <ion-button
            expand="block"
            fill="outline"
            color="danger"
            (click)="testBiometric()"
            [disabled]="isProcessing()"
          >
            <ion-icon slot="start" name="fingerprint-outline"></ion-icon>
            생체 인증 테스트
          </ion-button>
        }
      }
    </ion-content>
  `,
  styles: [`
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

    ion-button {
      margin-top: 16px;
    }
  `],
})
export class BiometricSettingsPage implements OnInit, OnDestroy {
  private readonly biometricService = inject(BiometricService);
  private readonly authStore = inject(AuthStore);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly router = inject(Router);
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
    this.biometricService.config$
      .pipe(takeUntil(this.destroy$))
      .subscribe((config) => {
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
      const user = this.authStore.user();
      const refreshToken = localStorage.getItem('refresh_token');

      if (!user || !refreshToken) {
        throw new Error('User not authenticated');
      }

      await this.biometricService.enableBiometric(user.id, refreshToken);

      const toast = await this.toastCtrl.create({
        message: '생체 인증이 활성화되었습니다',
        duration: 2000,
        color: 'success',
      });
      await toast.present();
    } catch (error: any) {
      console.error('Failed to enable biometric:', error);

      // Revert toggle
      this.isEnabled.set(false);

      const toast = await this.toastCtrl.create({
        message: error.message || '생체 인증 활성화에 실패했습니다',
        duration: 3000,
        color: 'danger',
      });
      await toast.present();
    } finally {
      this.isProcessing.set(false);
    }
  }

  /**
   * Disable biometric authentication
   */
  private async disableBiometric(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: '생체 인증 비활성화',
      message: '생체 인증을 비활성화하시겠습니까? 다음 로그인부터 비밀번호를 입력해야 합니다.',
      buttons: [
        {
          text: '취소',
          role: 'cancel',
          handler: () => {
            this.isEnabled.set(true);
          },
        },
        {
          text: '비활성화',
          role: 'destructive',
          handler: async () => {
            this.isProcessing.set(true);

            try {
              await this.biometricService.disableBiometric();

              const toast = await this.toastCtrl.create({
                message: '생체 인증이 비활성화되었습니다',
                duration: 2000,
                color: 'success',
              });
              await toast.present();
            } catch (error) {
              console.error('Failed to disable biometric:', error);

              // Revert toggle
              this.isEnabled.set(true);

              const toast = await this.toastCtrl.create({
                message: '생체 인증 비활성화에 실패했습니다',
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
   * Test biometric authentication
   */
  async testBiometric(): Promise<void> {
    this.isProcessing.set(true);

    try {
      const result = await this.biometricService.authenticate();

      if (result) {
        const toast = await this.toastCtrl.create({
          message: '생체 인증에 성공했습니다',
          duration: 2000,
          color: 'success',
        });
        await toast.present();
      } else {
        throw new Error('Authentication failed');
      }
    } catch (error: any) {
      console.error('Biometric test failed:', error);

      const toast = await this.toastCtrl.create({
        message: '생체 인증에 실패했습니다',
        duration: 3000,
        color: 'danger',
      });
      await toast.present();
    } finally {
      this.isProcessing.set(false);
    }
  }

  /**
   * Format last used timestamp
   */
  protected formatLastUsed(timestamp: number): string {
    const date = new Date(timestamp);
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
