/**
 * FR-19: Session Timeout Modal Component
 * PRD: 세션 타임아웃 & 재인증 - 30분 유휴 타임아웃, 폼 데이터 보존
 *
 * 기능:
 * - 30분 유휴 시 경고 표시
 * - 재로그인 프롬프트 (폼 데이터 손실 없이)
 * - 세션 연장 옵션
 */
import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  input,
  output,
  OnInit,
  OnDestroy,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonInput,
  IonSpinner,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { timeOutline, lockClosedOutline, logInOutline, refreshOutline } from 'ionicons/icons';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-session-timeout-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    IonModal,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonIcon,
    IonItem,
    IonLabel,
    IonInput,
    IonSpinner,
  ],
  template: `
    <ion-modal [isOpen]="isOpen()" [backdropDismiss]="false">
      <ng-template>
        <ion-header>
          <ion-toolbar color="warning">
            <ion-title>
              <ion-icon name="time-outline"></ion-icon>
              {{ 'SESSION.MODAL_TITLE' | translate }}
            </ion-title>
          </ion-toolbar>
        </ion-header>

        <ion-content class="ion-padding">
          <div class="timeout-content">
            <!-- 카운트다운 표시 -->
            @if (!isExpired()) {
              <div class="countdown-section">
                <div class="icon-wrap warning">
                  <ion-icon name="time-outline"></ion-icon>
                </div>
                <h2>{{ 'SESSION.EXPIRING_SOON' | translate }}</h2>
                <p class="countdown">
                  <span class="time">{{ remainingMinutes() }}:{{ remainingSeconds() }}</span>
                </p>
                <p class="message">
                  {{ 'SESSION.SECURITY_MESSAGE' | translate }}
                </p>

                <div class="action-buttons">
                  <ion-button (click)="extendSession()">
                    <ion-icon name="refresh-outline" slot="start"></ion-icon>
                    {{ 'SESSION.EXTEND_BTN' | translate }}
                  </ion-button>
                </div>
              </div>
            } @else {
              <!-- 만료됨 - 재로그인 필요 -->
              <div class="expired-section">
                <div class="icon-wrap danger">
                  <ion-icon name="lock-closed-outline"></ion-icon>
                </div>
                <h2>{{ 'SESSION.EXPIRED_TITLE' | translate }}</h2>
                <p class="message">
                  {{ 'SESSION.EXPIRED_MESSAGE' | translate }}
                </p>

                <form (ngSubmit)="onRelogin()">
                  <ion-item>
                    <ion-label position="stacked">{{
                      'AUTH.LOGIN.PASSWORD' | translate
                    }}</ion-label>
                    <ion-input
                      type="password"
                      [(ngModel)]="password"
                      name="password"
                      [placeholder]="'AUTH.LOGIN.PASSWORD_PLACEHOLDER' | translate"
                      [disabled]="isLoading()"
                    ></ion-input>
                  </ion-item>

                  @if (errorMessage()) {
                    <p class="error-message">{{ errorMessage() }}</p>
                  }

                  <div class="action-buttons">
                    <ion-button type="submit" [disabled]="!password || isLoading()">
                      @if (isLoading()) {
                        <ion-spinner name="crescent"></ion-spinner>
                      } @else {
                        <ion-icon name="log-in-outline" slot="start"></ion-icon>
                        {{ 'AUTH.LOGIN.SIGN_IN' | translate }}
                      }
                    </ion-button>
                  </div>
                </form>
              </div>
            }

            <p class="unsaved-notice">
              <ion-icon name="information-circle-outline"></ion-icon>
              저장하지 않은 데이터가 있습니다. 로그인 후 계속 작업할 수 있습니다.
            </p>
          </div>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [
    `
      .timeout-content {
        text-align: center;
        padding: 24px 0;
      }

      .icon-wrap {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 24px;
      }

      .icon-wrap.warning {
        background: rgba(var(--ion-color-warning-rgb), 0.15);
      }

      .icon-wrap.danger {
        background: rgba(var(--ion-color-danger-rgb), 0.15);
      }

      .icon-wrap ion-icon {
        font-size: 40px;
      }

      .icon-wrap.warning ion-icon {
        color: var(--ion-color-warning);
      }

      .icon-wrap.danger ion-icon {
        color: var(--ion-color-danger);
      }

      h2 {
        font-size: 20px;
        font-weight: 600;
        margin-bottom: 8px;
      }

      .countdown .time {
        font-size: 48px;
        font-weight: 700;
        color: var(--ion-color-warning);
      }

      .message {
        color: var(--ion-color-medium);
        margin-bottom: 24px;
        line-height: 1.5;
      }

      form {
        text-align: left;
        margin-top: 16px;
      }

      ion-item {
        margin-bottom: 16px;
      }

      .error-message {
        color: var(--ion-color-danger);
        font-size: 14px;
        margin-bottom: 16px;
      }

      .unsaved-notice {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-top: 32px;
        padding: 12px;
        background: rgba(var(--ion-color-primary-rgb), 0.1);
        border-radius: 8px;
        font-size: 14px;
        color: var(--ion-color-primary);
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
export class SessionTimeoutModalComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly translate = inject(TranslateService);

  isOpen = input<boolean>(false);
  warningSeconds = input<number>(300); // 5분 경고

  sessionExtended = output<void>();
  reloginSuccess = output<void>();

  isExpired = signal(false);
  isLoading = signal(false);
  errorMessage = signal('');
  password = '';

  // Get current user's loginId for re-authentication
  protected readonly currentUsername = computed(() => this.authService.user()?.loginId ?? '');

  private remainingTime = signal(300);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  remainingMinutes = () =>
    Math.floor(this.remainingTime() / 60)
      .toString()
      .padStart(2, '0');
  remainingSeconds = () => (this.remainingTime() % 60).toString().padStart(2, '0');

  constructor() {
    addIcons({
      timeOutline,
      lockClosedOutline,
      logInOutline,
      refreshOutline,
    });
  }

  ngOnInit() {
    this.startCountdown();
  }

  ngOnDestroy() {
    this.stopCountdown();
  }

  private startCountdown() {
    this.remainingTime.set(this.warningSeconds());
    this.intervalId = setInterval(() => {
      const current = this.remainingTime();
      if (current <= 0) {
        this.isExpired.set(true);
        this.stopCountdown();
      } else {
        this.remainingTime.set(current - 1);
      }
    }, 1000);
  }

  private stopCountdown() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  extendSession() {
    this.stopCountdown();
    this.sessionExtended.emit();
  }

  async onRelogin() {
    if (!this.password) return;

    const username = this.currentUsername();
    if (!username) {
      this.errorMessage.set(this.translate.instant('SESSION.ERROR.USER_NOT_FOUND'));
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const success = await this.authService.login({
        username,
        password: this.password,
      });

      if (success) {
        this.password = '';
        this.reloginSuccess.emit();
      } else {
        const error = this.authService.error();
        this.errorMessage.set(error || this.translate.instant('SESSION.ERROR.INVALID_PASSWORD'));
      }
    } catch (error) {
      this.errorMessage.set(this.translate.instant('SESSION.ERROR.AUTH_FAILED'));
    } finally {
      this.isLoading.set(false);
    }
  }
}
