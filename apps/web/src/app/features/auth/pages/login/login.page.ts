// apps/web/src/app/features/auth/pages/login/login.page.ts
// Square UI inspired design - minimal, clean, modern
// FR-22: Biometric Quick Login integration
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonSpinner, IonIcon, IonButton } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { eyeOutline, eyeOffOutline, arrowForward, cube, fingerPrintOutline } from 'ionicons/icons';
import { AuthService } from '@core/services/auth.service';
import { BiometricService } from '@core/services/biometric.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IonContent, IonSpinner, IonIcon, IonButton],
  template: `
    <ion-content class="login-content" [fullscreen]="true">
      <div class="login-wrapper">
        <!-- Left Panel - Branding -->
        <div class="brand-panel">
          <div class="brand-content">
            <div class="logo-box">
              <ion-icon name="cube"></ion-icon>
            </div>
            <h1>Logistics ERP</h1>
            <p>Streamline your delivery operations with our modern order management system.</p>
            <div class="features">
              <div class="feature"><span class="dot"></span>Real-time order tracking</div>
              <div class="feature"><span class="dot"></span>Smart assignment system</div>
              <div class="feature"><span class="dot"></span>Comprehensive reporting</div>
            </div>
          </div>
          <div class="brand-footer">© 2025 Logistics ERP</div>
        </div>

        <!-- Right Panel - Login Form -->
        <div class="form-panel">
          <div class="form-container">
            <!-- Mobile Logo -->
            <div class="mobile-logo">
              <div class="logo-box small"><ion-icon name="cube"></ion-icon></div>
              <span>Logistics ERP</span>
            </div>

            <div class="form-header">
              <h2>Welcome back</h2>
              <p>Enter your credentials to access your account</p>
            </div>

            <!-- Biometric Quick Login -->
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
                  {{ biometricService.getBiometryTypeName() }}로 로그인
                </ion-button>
                <div class="divider"><span>또는</span></div>
              </div>
            }

            <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
              <div class="input-group">
                <label for="username">Username</label>
                <input id="username" type="text" formControlName="username" 
                       placeholder="Enter your username" autocomplete="username" autocapitalize="off" />
                @if (loginForm.get('username')?.touched && loginForm.get('username')?.invalid) {
                  <span class="error-hint">Username required (min 3 chars)</span>
                }
              </div>

              <div class="input-group">
                <label for="password">Password</label>
                <div class="password-wrap">
                  <input id="password" [type]="showPassword() ? 'text' : 'password'" 
                         formControlName="password" placeholder="Enter your password" autocomplete="current-password" />
                  <button type="button" class="toggle-pw" (click)="togglePassword()">
                    <ion-icon [name]="showPassword() ? 'eye-off-outline' : 'eye-outline'"></ion-icon>
                  </button>
                </div>
                @if (loginForm.get('password')?.touched && loginForm.get('password')?.invalid) {
                  <span class="error-hint">Password required (min 4 chars)</span>
                }
              </div>

              @if (authService.error() || biometricError()) {
                <div class="error-box">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {{ authService.error() || biometricError() }}
                </div>
              }

              <button type="submit" class="submit-btn" [disabled]="loginForm.invalid || authService.isLoading()">
                @if (authService.isLoading()) {
                  <ion-spinner name="crescent"></ion-spinner>
                  <span>Signing in...</span>
                } @else {
                  <span>Sign in</span>
                  <ion-icon name="arrow-forward"></ion-icon>
                }
              </button>
            </form>

            <div class="form-footer">
              <p>Test: <code>admin</code> / <code>admin123!</code></p>
            </div>
          </div>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .login-content { --background: #fafafa; }
    .login-wrapper { display: flex; min-height: 100vh; }

    /* Brand Panel */
    .brand-panel {
      display: none; width: 45%; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: white; padding: 48px; flex-direction: column; justify-content: space-between;
    }
    @media (min-width: 768px) { .brand-panel { display: flex; } }
    .brand-content { flex: 1; display: flex; flex-direction: column; justify-content: center; }
    .logo-box {
      width: 64px; height: 64px; background: rgba(255,255,255,0.1); border-radius: 16px;
      display: flex; align-items: center; justify-content: center; margin-bottom: 32px;
    }
    .logo-box ion-icon { font-size: 32px; color: #60a5fa; }
    .logo-box.small { width: 40px; height: 40px; margin-bottom: 0; }
    .logo-box.small ion-icon { font-size: 20px; }
    .brand-panel h1 { font-size: 36px; font-weight: 700; margin: 0 0 16px 0; letter-spacing: -0.5px; }
    .brand-panel > .brand-content > p { font-size: 16px; color: #94a3b8; line-height: 1.6; margin: 0 0 48px 0; }
    .features { display: flex; flex-direction: column; gap: 16px; }
    .feature { display: flex; align-items: center; gap: 12px; font-size: 14px; color: #cbd5e1; }
    .dot { width: 8px; height: 8px; background: #60a5fa; border-radius: 50%; }
    .brand-footer { font-size: 13px; color: #64748b; }

    /* Form Panel */
    .form-panel { flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px; background: white; }
    @media (min-width: 768px) { .form-panel { width: 55%; padding: 48px; } }
    .form-container { width: 100%; max-width: 400px; }

    /* Mobile Logo */
    .mobile-logo { display: flex; align-items: center; gap: 12px; margin-bottom: 32px; }
    .mobile-logo .logo-box { background: linear-gradient(135deg, #3b82f6, #2563eb); }
    .mobile-logo .logo-box ion-icon { color: white; }
    .mobile-logo span { font-size: 20px; font-weight: 700; color: #0f172a; }
    @media (min-width: 768px) { .mobile-logo { display: none; } }

    .form-header { margin-bottom: 32px; }
    .form-header h2 { font-size: 28px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0; }
    .form-header p { font-size: 15px; color: #64748b; margin: 0; }

    /* Biometric Section */
    .biometric-section { margin-bottom: 24px; }
    .biometric-btn {
      --background: linear-gradient(135deg, #8b5cf6, #7c3aed);
      --background-hover: linear-gradient(135deg, #7c3aed, #6d28d9);
      --border-radius: 10px;
      --box-shadow: 0 4px 12px rgba(139,92,246,0.3);
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
    .divider::before, .divider::after {
      content: '';
      flex: 1;
      border-bottom: 1px solid #e2e8f0;
    }
    .divider span {
      padding: 0 12px;
    }

    /* Inputs */
    .input-group { margin-bottom: 20px; }
    .input-group label { display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 8px; }
    .input-group input {
      width: 100%; padding: 12px 16px; font-size: 15px; border: 1px solid #e2e8f0;
      border-radius: 10px; background: #f8fafc; color: #0f172a; transition: all 0.2s; outline: none; box-sizing: border-box;
    }
    .input-group input::placeholder { color: #94a3b8; }
    .input-group input:focus { border-color: #3b82f6; background: white; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
    .password-wrap { position: relative; }
    .password-wrap input { padding-right: 48px; }
    .toggle-pw {
      position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
      background: none; border: none; padding: 4px; cursor: pointer; color: #64748b;
    }
    .toggle-pw:hover { color: #3b82f6; }
    .toggle-pw ion-icon { font-size: 20px; }
    .error-hint { display: block; font-size: 13px; color: #ef4444; margin-top: 6px; }
    .error-box {
      display: flex; align-items: center; gap: 8px; padding: 12px 16px;
      background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; color: #dc2626; font-size: 14px; margin-bottom: 20px;
    }

    /* Submit */
    .submit-btn {
      width: 100%; padding: 14px 24px; font-size: 15px; font-weight: 600; color: white;
      background: linear-gradient(135deg, #3b82f6, #2563eb); border: none; border-radius: 10px;
      cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
      transition: all 0.2s; box-shadow: 0 4px 12px rgba(59,130,246,0.3);
    }
    .submit-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(59,130,246,0.4); }
    .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .submit-btn ion-icon { font-size: 18px; }
    .submit-btn ion-spinner { width: 20px; height: 20px; --color: white; }

    .form-footer { margin-top: 32px; text-align: center; }
    .form-footer p { font-size: 13px; color: #94a3b8; margin: 0; }
    .form-footer code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 12px; color: #475569; }
  `],
})
export class LoginPage implements OnInit {
  protected readonly authService = inject(AuthService);
  protected readonly biometricService = inject(BiometricService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  protected readonly showPassword = signal(false);
  protected readonly showBiometricButton = signal(false);
  protected readonly isBiometricLoading = signal(false);
  protected readonly biometricError = signal<string | null>(null);

  protected readonly loginForm: FormGroup = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(4)]],
  });

  constructor() { 
    addIcons({ eyeOutline, eyeOffOutline, arrowForward, cube, fingerPrintOutline }); 
  }

  async ngOnInit(): Promise<void> {
    // Check if biometric is available and enabled
    const available = await this.biometricService.checkAvailability();
    this.showBiometricButton.set(available && this.biometricService.config$.value.enabled);
  }

  protected togglePassword() { this.showPassword.update(v => !v); }

  protected async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) return;
    const { username, password } = this.loginForm.value;
    const success = await this.authService.login({ username, password });
    if (success) await this.router.navigate(['/tabs/orders']);
  }

  /**
   * FR-22: Biometric quick login
   */
  protected async loginWithBiometric(): Promise<void> {
    this.isBiometricLoading.set(true);
    this.biometricError.set(null);

    try {
      // Authenticate with biometric
      const result = await this.biometricService.authenticate();

      if (!result) {
        this.biometricError.set('생체 인증에 실패했습니다. 비밀번호로 로그인해주세요.');
        return;
      }

      // Login with refresh token
      const success = await this.authService.refreshAccessToken(result.refreshToken);

      if (success) {
        console.info(`[LoginPage] Biometric login success for user: ${result.userId}`);
        await this.router.navigate(['/tabs/orders']);
      } else {
        this.biometricError.set('인증 토큰이 만료되었습니다. 비밀번호로 로그인해주세요.');
        // Clear biometric data
        await this.biometricService.disableBiometric();
        this.showBiometricButton.set(false);
      }
    } catch (error: any) {
      console.error('[LoginPage] Biometric login failed:', error);
      this.biometricError.set('생체 인증에 실패했습니다. 다시 시도하거나 비밀번호로 로그인해주세요.');
    } finally {
      this.isBiometricLoading.set(false);
    }
  }
}
