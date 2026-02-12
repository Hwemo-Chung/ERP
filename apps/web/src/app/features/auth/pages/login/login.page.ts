/**
 * @fileoverview 로그인 페이지 컴포넌트
 * @description Square UI 디자인의 로그인 화면을 제공합니다.
 *
 * 주요 기능:
 * - 사용자명/비밀번호 로그인
 * - FR-22: 생체 인증 빠른 로그인 지원
 * - 다국어(i18n) 지원
 */
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonSpinner, IonIcon, IonButton } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { eyeOutline, eyeOffOutline, arrowForward, cube, fingerPrintOutline } from 'ionicons/icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '@core/services/auth.service';
import { BiometricService } from '@core/services/biometric.service';
import { LoggerService } from '@core/services/logger.service';
import { ROUTES } from '@shared/constants';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonContent,
    IonSpinner,
    IonIcon,
    IonButton,
    TranslateModule,
  ],
  template: `
    <ion-content class="login-content" [fullscreen]="true">
      <div class="login-wrapper">
        <!-- 좌측 패널 - 브랜딩 -->
        <div class="brand-panel">
          <div class="brand-content">
            <div class="logo-box">
              <ion-icon name="cube"></ion-icon>
            </div>
            <h1>{{ 'BRAND.TITLE' | translate }}</h1>
            <p>{{ 'BRAND.SUBTITLE' | translate }}</p>
            <div class="features">
              <div class="feature">
                <span class="dot"></span>{{ 'BRAND.FEATURES.REALTIME_TRACKING' | translate }}
              </div>
              <div class="feature">
                <span class="dot"></span>{{ 'BRAND.FEATURES.SMART_ASSIGNMENT' | translate }}
              </div>
              <div class="feature">
                <span class="dot"></span>{{ 'BRAND.FEATURES.COMPREHENSIVE_REPORTING' | translate }}
              </div>
            </div>
          </div>
          <div class="brand-footer">{{ 'BRAND.COPYRIGHT' | translate }}</div>
        </div>

        <!-- 우측 패널 - 로그인 폼 -->
        <div class="form-panel">
          <div class="form-container">
            <!-- 모바일 로고 -->
            <div class="mobile-logo">
              <div class="logo-box small"><ion-icon name="cube"></ion-icon></div>
              <span>{{ 'BRAND.TITLE' | translate }}</span>
            </div>

            <div class="form-header">
              <h2>{{ 'AUTH.LOGIN.WELCOME' | translate }}</h2>
              <p>{{ 'AUTH.LOGIN.SUBTITLE' | translate }}</p>
            </div>

            <!-- 생체 인증 빠른 로그인 -->
            @if (showBiometricButton()) {
              <div class="biometric-section">
                <ion-button
                  expand="block"
                  fill="outline"
                  class="biometric-btn"
                  (click)="loginWithBiometric()"
                  [disabled]="isBiometricLoading()"
                >
                  @if (isBiometricLoading()) {
                    <ion-spinner name="crescent" slot="start"></ion-spinner>
                  } @else {
                    <ion-icon slot="start" name="fingerprint-outline"></ion-icon>
                  }
                  {{
                    'AUTH.LOGIN.BIOMETRIC_LOGIN'
                      | translate: { type: biometricService.getBiometryTypeName() }
                  }}
                </ion-button>
                <div class="divider">
                  <span>{{ 'COMMON.OR' | translate }}</span>
                </div>
              </div>
            }

            <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
              <div class="input-group">
                <label for="username">{{ 'AUTH.LOGIN.USERNAME' | translate }}</label>
                <input
                  id="username"
                  type="text"
                  formControlName="username"
                  [placeholder]="'AUTH.LOGIN.USERNAME_PLACEHOLDER' | translate"
                  autocomplete="username"
                  autocapitalize="off"
                />
                @if (loginForm.get('username')?.touched && loginForm.get('username')?.invalid) {
                  <span class="error-hint">{{ 'AUTH.LOGIN.USERNAME_REQUIRED' | translate }}</span>
                }
              </div>

              <div class="input-group">
                <label for="password">{{ 'AUTH.LOGIN.PASSWORD' | translate }}</label>
                <div class="password-wrap">
                  <input
                    id="password"
                    [type]="showPassword() ? 'text' : 'password'"
                    formControlName="password"
                    [placeholder]="'AUTH.LOGIN.PASSWORD_PLACEHOLDER' | translate"
                    autocomplete="current-password"
                  />
                  <button type="button" class="toggle-pw" (click)="togglePassword()">
                    <ion-icon
                      [name]="showPassword() ? 'eye-off-outline' : 'eye-outline'"
                    ></ion-icon>
                  </button>
                </div>
                @if (loginForm.get('password')?.touched && loginForm.get('password')?.invalid) {
                  <span class="error-hint">{{ 'AUTH.LOGIN.PASSWORD_REQUIRED' | translate }}</span>
                }
              </div>

              @if (authService.error() || biometricError()) {
                <div class="error-box">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {{ authService.error() || biometricError() }}
                </div>
              }

              <button
                type="submit"
                class="submit-btn"
                [disabled]="loginForm.invalid || authService.isLoading()"
              >
                @if (authService.isLoading()) {
                  <ion-spinner name="crescent"></ion-spinner>
                  <span>{{ 'AUTH.LOGIN.SIGNING_IN' | translate }}</span>
                } @else {
                  <span>{{ 'AUTH.LOGIN.SIGN_IN' | translate }}</span>
                  <ion-icon name="arrow-forward"></ion-icon>
                }
              </button>
            </form>

            <div class="form-footer">
              <p>
                {{
                  'AUTH.LOGIN.TEST_ACCOUNT'
                    | translate: { username: 'admin', password: 'admin123!' }
                }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .login-content {
        --background: #fafafa;
      }
      .login-wrapper {
        display: flex;
        min-height: 100vh;
      }

      /* Brand Panel */
      .brand-panel {
        display: none;
        width: 45%;
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        color: white;
        padding: 48px;
        flex-direction: column;
        justify-content: space-between;
      }
      @media (min-width: 768px) {
        .brand-panel {
          display: flex;
        }
      }
      .brand-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .logo-box {
        width: 64px;
        height: 64px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 32px;
      }
      .logo-box ion-icon {
        font-size: 32px;
        color: #60a5fa;
      }
      .logo-box.small {
        width: 40px;
        height: 40px;
        margin-bottom: 0;
      }
      .logo-box.small ion-icon {
        font-size: 20px;
      }
      .brand-panel h1 {
        font-size: 36px;
        font-weight: 700;
        margin: 0 0 16px 0;
        letter-spacing: -0.5px;
      }
      .brand-panel > .brand-content > p {
        font-size: 16px;
        color: #94a3b8;
        line-height: 1.6;
        margin: 0 0 48px 0;
      }
      .features {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .feature {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 14px;
        color: #cbd5e1;
      }
      .dot {
        width: 8px;
        height: 8px;
        background: #60a5fa;
        border-radius: 50%;
      }
      .brand-footer {
        font-size: 13px;
        color: #64748b;
      }

      /* Form Panel */
      .form-panel {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: white;
      }
      @media (min-width: 768px) {
        .form-panel {
          width: 55%;
          padding: 48px;
        }
      }
      .form-container {
        width: 100%;
        max-width: 400px;
      }

      /* Mobile Logo */
      .mobile-logo {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 32px;
      }
      .mobile-logo .logo-box {
        background: linear-gradient(135deg, #3b82f6, #2563eb);
      }
      .mobile-logo .logo-box ion-icon {
        color: white;
      }
      .mobile-logo span {
        font-size: 20px;
        font-weight: 700;
        color: #0f172a;
      }
      @media (min-width: 768px) {
        .mobile-logo {
          display: none;
        }
      }

      .form-header {
        margin-bottom: 32px;
      }
      .form-header h2 {
        font-size: 28px;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 8px 0;
      }
      .form-header p {
        font-size: 15px;
        color: #64748b;
        margin: 0;
      }

      /* Biometric Section */
      .biometric-section {
        margin-bottom: 24px;
      }
      .biometric-btn {
        --background: linear-gradient(135deg, #8b5cf6, #7c3aed);
        --background-hover: linear-gradient(135deg, #7c3aed, #6d28d9);
        --border-radius: 10px;
        --box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
        font-weight: 600;
      }
      .divider {
        display: flex;
        align-items: center;
        text-align: center;
        margin: 20px 0;
        color: #94a3b8;
        font-size: 13px;
      }
      .divider::before,
      .divider::after {
        content: '';
        flex: 1;
        border-bottom: 1px solid #e2e8f0;
      }
      .divider span {
        padding: 0 12px;
      }

      /* Inputs */
      .input-group {
        margin-bottom: 20px;
      }
      .input-group label {
        display: block;
        font-size: 14px;
        font-weight: 500;
        color: #374151;
        margin-bottom: 8px;
      }
      .input-group input {
        width: 100%;
        padding: 12px 16px;
        font-size: 15px;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        background: #f8fafc;
        color: #0f172a;
        transition: all 0.2s;
        outline: none;
        box-sizing: border-box;
      }
      .input-group input::placeholder {
        color: #94a3b8;
      }
      .input-group input:focus {
        border-color: #3b82f6;
        background: white;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }
      .password-wrap {
        position: relative;
      }
      .password-wrap input {
        padding-right: 48px;
      }
      .toggle-pw {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        padding: 4px;
        cursor: pointer;
        color: #64748b;
      }
      .toggle-pw:hover {
        color: #3b82f6;
      }
      .toggle-pw ion-icon {
        font-size: 20px;
      }
      .error-hint {
        display: block;
        font-size: 13px;
        color: #ef4444;
        margin-top: 6px;
      }
      .error-box {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 16px;
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 10px;
        color: #dc2626;
        font-size: 14px;
        margin-bottom: 20px;
      }

      /* Submit */
      .submit-btn {
        width: 100%;
        padding: 14px 24px;
        font-size: 15px;
        font-weight: 600;
        color: white;
        background: linear-gradient(135deg, #3b82f6, #2563eb);
        border: none;
        border-radius: 10px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: all 0.2s;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
      }
      .submit-btn:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
      }
      .submit-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .submit-btn ion-icon {
        font-size: 18px;
      }
      .submit-btn ion-spinner {
        width: 20px;
        height: 20px;
        --color: white;
      }

      .form-footer {
        margin-top: 32px;
        text-align: center;
      }
      .form-footer p {
        font-size: 13px;
        color: #94a3b8;
        margin: 0;
      }
      .form-footer code {
        background: #f1f5f9;
        padding: 2px 6px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 12px;
        color: #475569;
      }
    `,
  ],
})
export class LoginPage implements OnInit {
  protected readonly authService = inject(AuthService);
  protected readonly biometricService = inject(BiometricService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly logger = inject(LoggerService);

  /** 비밀번호 표시 여부 */
  protected readonly showPassword = signal(false);
  /** 생체 인증 버튼 표시 여부 */
  protected readonly showBiometricButton = signal(false);
  /** 생체 인증 로딩 상태 */
  protected readonly isBiometricLoading = signal(false);
  /** 생체 인증 에러 메시지 */
  protected readonly biometricError = signal<string | null>(null);

  /** 로그인 폼 그룹 */
  protected readonly loginForm: FormGroup = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(4)]],
  });

  constructor() {
    addIcons({ eyeOutline, eyeOffOutline, arrowForward, cube, fingerPrintOutline });
  }

  /**
   * 컴포넌트 초기화
   * @description 생체 인증 가용성을 확인하고 버튼 표시 여부를 결정합니다.
   */
  async ngOnInit(): Promise<void> {
    const available = await this.biometricService.checkAvailability();
    this.showBiometricButton.set(available && this.biometricService.currentConfig.enabled);
  }

  /** 비밀번호 표시/숨김 토글 */
  protected togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  /**
   * 로그인 폼 제출 처리
   * @description 입력된 자격 증명으로 로그인을 시도합니다.
   */
  protected async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) return;
    const { username, password } = this.loginForm.value;
    const success = await this.authService.login({ username, password });
    if (success) await this.router.navigate([ROUTES.TABS.ORDERS]);
  }

  /**
   * 생체 인증 로그인
   * @description FR-22: 생체 인증으로 빠른 로그인을 수행합니다.
   */
  protected async loginWithBiometric(): Promise<void> {
    this.isBiometricLoading.set(true);
    this.biometricError.set(null);

    try {
      const result = await this.biometricService.authenticate();

      if (!result) {
        this.biometricError.set(this.translate.instant('AUTH.ERRORS.BIOMETRIC_FAILED'));
        return;
      }

      const success = await this.authService.refreshAccessToken(result.refreshToken);

      if (success) {
        this.logger.info(`[LoginPage] 생체 인증 로그인 성공: ${result.userId}`);
        await this.router.navigate([ROUTES.TABS.ORDERS]);
      } else {
        this.biometricError.set(this.translate.instant('AUTH.ERRORS.SESSION_EXPIRED'));
        await this.biometricService.disableBiometric();
        this.showBiometricButton.set(false);
      }
    } catch (error: unknown) {
      this.logger.error('[LoginPage] 생체 인증 로그인 실패:', error);
      this.biometricError.set(this.translate.instant('AUTH.ERRORS.BIOMETRIC_RETRY'));
    } finally {
      this.isBiometricLoading.set(false);
    }
  }
}
