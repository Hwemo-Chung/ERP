/**
 * FR-19: Session Timeout Modal Component
 * PRD: 세션 타임아웃 & 재인증 - 30분 유휴 타임아웃, 폼 데이터 보존
 * 
 * 기능:
 * - 30분 유휴 시 경고 표시
 * - 재로그인 프롬프트 (폼 데이터 손실 없이)
 * - 세션 연장 옵션
 */
import { Component, ChangeDetectionStrategy, inject, signal, input, output, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonIcon,
  IonItem,
  IonLabel,
  IonInput,
  IonSpinner,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  timeOutline, 
  lockClosedOutline, 
  logInOutline,
  refreshOutline,
} from 'ionicons/icons';

@Component({
  selector: 'app-session-timeout-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    IonModal,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonButtons,
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
              세션 만료
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
                <h2>세션이 곧 만료됩니다</h2>
                <p class="countdown">
                  <span class="time">{{ remainingMinutes() }}:{{ remainingSeconds() }}</span>
                </p>
                <p class="message">
                  보안을 위해 장시간 미사용 시 자동 로그아웃됩니다.<br>
                  작업을 계속하시려면 세션을 연장하세요.
                </p>

                <ion-button expand="block" (click)="extendSession()">
                  <ion-icon name="refresh-outline" slot="start"></ion-icon>
                  세션 연장
                </ion-button>
              </div>
            } @else {
              <!-- 만료됨 - 재로그인 필요 -->
              <div class="expired-section">
                <div class="icon-wrap danger">
                  <ion-icon name="lock-closed-outline"></ion-icon>
                </div>
                <h2>세션이 만료되었습니다</h2>
                <p class="message">
                  다시 로그인해 주세요.<br>
                  작성 중인 내용은 보존됩니다.
                </p>

                <form (ngSubmit)="onRelogin()">
                  <ion-item>
                    <ion-label position="stacked">비밀번호</ion-label>
                    <ion-input
                      type="password"
                      [(ngModel)]="password"
                      name="password"
                      placeholder="비밀번호를 입력하세요"
                      [disabled]="isLoading()"
                    ></ion-input>
                  </ion-item>

                  @if (errorMessage()) {
                    <p class="error-message">{{ errorMessage() }}</p>
                  }

                  <ion-button 
                    expand="block" 
                    type="submit" 
                    [disabled]="!password || isLoading()"
                  >
                    @if (isLoading()) {
                      <ion-spinner name="crescent"></ion-spinner>
                    } @else {
                      <ion-icon name="log-in-outline" slot="start"></ion-icon>
                      로그인
                    }
                  </ion-button>
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
  styles: [`
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
  `]
})
export class SessionTimeoutModalComponent implements OnInit, OnDestroy {
  isOpen = input<boolean>(false);
  warningSeconds = input<number>(300); // 5분 경고

  sessionExtended = output<void>();
  reloginSuccess = output<void>();

  isExpired = signal(false);
  isLoading = signal(false);
  errorMessage = signal('');
  password = '';

  private remainingTime = signal(300);
  private intervalId: any;

  remainingMinutes = () => Math.floor(this.remainingTime() / 60).toString().padStart(2, '0');
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

    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      // TODO: 실제 재인증 로직 연결
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 성공 시
      this.reloginSuccess.emit();
    } catch (error) {
      this.errorMessage.set('비밀번호가 올바르지 않습니다.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
