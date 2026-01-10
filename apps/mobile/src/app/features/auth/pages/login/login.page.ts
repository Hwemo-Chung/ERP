import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonItem,
  IonInput,
  IonButton,
  IonSpinner,
  IonIcon,
  IonCard,
  IonCardContent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  eyeOutline,
  eyeOffOutline,
  logInOutline,
  cubeOutline,
  alertCircleOutline,
  checkmarkCircle,
} from 'ionicons/icons';
import { AuthService } from '@core/services/auth.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    IonContent,
    IonItem,
    IonInput,
    IonButton,
    IonSpinner,
    IonIcon,
    IonCard,
    IonCardContent,
  ],
  template: `
    <ion-content class="login-content" [fullscreen]="true">
      <!-- Background decoration -->
      <div class="background-decoration" aria-hidden="true">
        <div class="gradient-orb gradient-orb--primary"></div>
        <div class="gradient-orb gradient-orb--secondary"></div>
        <div class="noise-overlay"></div>
      </div>

      <div class="login-container">
        <!-- Logo Section with entrance animation -->
        <header class="logo-section" role="banner">
          <div class="logo-wrapper">
            <div class="logo-ring"></div>
            <ion-icon name="cube-outline" class="logo-icon" aria-hidden="true"></ion-icon>
          </div>
          <h1 class="brand-title">{{ 'BRAND.TITLE' | translate }}</h1>
          <p class="brand-subtitle">{{ 'BRAND.SUBTITLE' | translate }}</p>
        </header>

        <!-- Login Card with glassmorphism effect -->
        <ion-card class="login-card">
          <ion-card-content>
            <h2 class="card-title" id="login-form-title">
              {{ 'AUTH.LOGIN.WELCOME_BACK' | translate }}
            </h2>

            <form
              [formGroup]="loginForm"
              (ngSubmit)="onSubmit()"
              aria-labelledby="login-form-title"
              role="form"
            >
              <div class="form-fields">
                <!-- Username Field -->
                <div class="field-group" [class.field-group--error]="isFieldInvalid('username')">
                  <ion-item
                    lines="none"
                    class="input-item"
                    [class.input-item--focused]="focusedField() === 'username'"
                    [class.input-item--error]="isFieldInvalid('username')"
                    [class.input-item--valid]="isFieldValid('username')"
                  >
                    <ion-input
                      formControlName="username"
                      type="text"
                      [label]="'AUTH.LOGIN.USERNAME' | translate"
                      labelPlacement="floating"
                      [placeholder]="'AUTH.LOGIN.USERNAME_PLACEHOLDER' | translate"
                      autocapitalize="off"
                      autocomplete="username"
                      [attr.aria-invalid]="isFieldInvalid('username')"
                      [attr.aria-describedby]="isFieldInvalid('username') ? 'username-error' : null"
                      (ionFocus)="onFieldFocus('username')"
                      (ionBlur)="onFieldBlur()"
                    ></ion-input>
                    <div class="field-indicator" slot="end" aria-hidden="true">
                      @if (isFieldValid('username')) {
                        <ion-icon name="checkmark-circle" class="indicator-valid"></ion-icon>
                      }
                    </div>
                  </ion-item>
                  @if (isFieldInvalid('username')) {
                    <p class="field-error" id="username-error" role="alert">
                      {{ getFieldError('username') | translate }}
                    </p>
                  }
                </div>

                <!-- Password Field -->
                <div class="field-group" [class.field-group--error]="isFieldInvalid('password')">
                  <ion-item
                    lines="none"
                    class="input-item"
                    [class.input-item--focused]="focusedField() === 'password'"
                    [class.input-item--error]="isFieldInvalid('password')"
                    [class.input-item--valid]="isFieldValid('password')"
                  >
                    <ion-input
                      formControlName="password"
                      [type]="showPassword() ? 'text' : 'password'"
                      [label]="'AUTH.LOGIN.PASSWORD' | translate"
                      labelPlacement="floating"
                      [placeholder]="'AUTH.LOGIN.PASSWORD_PLACEHOLDER' | translate"
                      autocomplete="current-password"
                      [attr.aria-invalid]="isFieldInvalid('password')"
                      [attr.aria-describedby]="isFieldInvalid('password') ? 'password-error' : null"
                      (ionFocus)="onFieldFocus('password')"
                      (ionBlur)="onFieldBlur()"
                    ></ion-input>
                    <ion-button
                      fill="clear"
                      slot="end"
                      class="password-toggle"
                      (click)="togglePasswordVisibility()"
                      [attr.aria-label]="
                        (showPassword() ? 'AUTH.LOGIN.HIDE_PASSWORD' : 'AUTH.LOGIN.SHOW_PASSWORD')
                          | translate
                      "
                      type="button"
                    >
                      <ion-icon
                        slot="icon-only"
                        [name]="showPassword() ? 'eye-off-outline' : 'eye-outline'"
                        aria-hidden="true"
                      ></ion-icon>
                    </ion-button>
                  </ion-item>
                  @if (isFieldInvalid('password')) {
                    <p class="field-error" id="password-error" role="alert">
                      {{ getFieldError('password') | translate }}
                    </p>
                  }
                </div>
              </div>

              <!-- API Error Message -->
              @if (authService.error()) {
                <div class="error-banner" role="alert" aria-live="polite">
                  <ion-icon name="alert-circle-outline" aria-hidden="true"></ion-icon>
                  <span>{{ authService.error() }}</span>
                </div>
              }

              <!-- Submit Button -->
              <ion-button
                expand="block"
                type="submit"
                [disabled]="loginForm.invalid || authService.isLoading()"
                class="login-button"
                [class.login-button--loading]="authService.isLoading()"
              >
                <span class="button-content">
                  @if (authService.isLoading()) {
                    <ion-spinner name="dots" class="loading-spinner"></ion-spinner>
                    <span class="loading-text">{{ 'AUTH.LOGIN.SIGNING_IN' | translate }}</span>
                  } @else {
                    <ion-icon slot="start" name="log-in-outline" aria-hidden="true"></ion-icon>
                    <span>{{ 'AUTH.LOGIN.SIGN_IN' | translate }}</span>
                  }
                </span>
              </ion-button>
            </form>
          </ion-card-content>
        </ion-card>

        <!-- Footer -->
        <footer class="login-footer" role="contentinfo">
          <p class="version-text">v{{ version }}</p>
        </footer>
      </div>
    </ion-content>
  `,
  styles: [
    `
      /* ========================================
       CSS Custom Properties (Theming)
       ======================================== */
      :host {
        --login-bg-start: #f0f4f8;
        --login-bg-end: #e2e8f0;
        --login-orb-primary: rgba(59, 130, 246, 0.15);
        --login-orb-secondary: rgba(16, 185, 129, 0.12);
        --login-card-bg: rgba(255, 255, 255, 0.85);
        --login-card-border: rgba(255, 255, 255, 0.6);
        --login-card-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
        --login-input-bg: rgba(248, 250, 252, 0.8);
        --login-input-border: #e2e8f0;
        --login-input-focus-border: var(--ion-color-primary);
        --login-input-error-border: var(--ion-color-danger);
        --login-input-valid-border: var(--ion-color-success);
        --login-text-primary: #1e293b;
        --login-text-secondary: #64748b;
        --login-text-muted: #94a3b8;
        --login-button-gradient: linear-gradient(135deg, var(--ion-color-primary) 0%, #2563eb 100%);
        --login-animation-duration: 0.3s;
        --login-animation-timing: cubic-bezier(0.4, 0, 0.2, 1);
      }

      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        :host {
          --login-bg-start: #0f172a;
          --login-bg-end: #1e293b;
          --login-orb-primary: rgba(59, 130, 246, 0.2);
          --login-orb-secondary: rgba(16, 185, 129, 0.15);
          --login-card-bg: rgba(30, 41, 59, 0.8);
          --login-card-border: rgba(71, 85, 105, 0.4);
          --login-card-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          --login-input-bg: rgba(15, 23, 42, 0.6);
          --login-input-border: #334155;
          --login-text-primary: #f1f5f9;
          --login-text-secondary: #94a3b8;
          --login-text-muted: #64748b;
        }
      }

      /* ========================================
       Main Container & Background
       ======================================== */
      .login-content {
        --background: linear-gradient(145deg, var(--login-bg-start) 0%, var(--login-bg-end) 100%);
      }

      .background-decoration {
        position: fixed;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
        z-index: 0;
      }

      .gradient-orb {
        position: absolute;
        border-radius: 50%;
        filter: blur(80px);
        animation: float 20s ease-in-out infinite;
      }

      .gradient-orb--primary {
        width: 500px;
        height: 500px;
        top: -200px;
        right: -150px;
        background: var(--login-orb-primary);
        animation-delay: 0s;
      }

      .gradient-orb--secondary {
        width: 400px;
        height: 400px;
        bottom: -150px;
        left: -100px;
        background: var(--login-orb-secondary);
        animation-delay: -10s;
      }

      .noise-overlay {
        position: absolute;
        inset: 0;
        opacity: 0.03;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
      }

      @keyframes float {
        0%,
        100% {
          transform: translate(0, 0) scale(1);
        }
        25% {
          transform: translate(30px, -30px) scale(1.05);
        }
        50% {
          transform: translate(-20px, 20px) scale(0.95);
        }
        75% {
          transform: translate(20px, 30px) scale(1.02);
        }
      }

      .login-container {
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        min-height: 100%;
        padding: 24px;
        z-index: 1;
        animation: fadeIn 0.6s var(--login-animation-timing);
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      /* ========================================
       Logo Section
       ======================================== */
      .logo-section {
        text-align: center;
        margin-bottom: 40px;
        animation: slideDown 0.7s var(--login-animation-timing) 0.1s backwards;
      }

      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateY(-30px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .logo-wrapper {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 100px;
        height: 100px;
        margin-bottom: 20px;
      }

      .logo-ring {
        position: absolute;
        inset: 0;
        border: 3px solid transparent;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-success))
          border-box;
        mask:
          linear-gradient(#fff 0 0) padding-box,
          linear-gradient(#fff 0 0);
        mask-composite: exclude;
        animation: pulse-ring 3s ease-in-out infinite;
      }

      @keyframes pulse-ring {
        0%,
        100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.7;
          transform: scale(1.05);
        }
      }

      .logo-icon {
        font-size: 56px;
        color: var(--ion-color-primary);
        animation: float-icon 4s ease-in-out infinite;
      }

      @keyframes float-icon {
        0%,
        100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-5px);
        }
      }

      .brand-title {
        font-size: 28px;
        font-weight: 800;
        letter-spacing: -0.02em;
        margin: 0 0 8px 0;
        background: linear-gradient(135deg, var(--ion-color-primary), #2563eb);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .brand-subtitle {
        font-size: 15px;
        font-weight: 500;
        color: var(--login-text-secondary);
        margin: 0;
        letter-spacing: 0.01em;
      }

      /* ========================================
       Login Card (Glassmorphism)
       ======================================== */
      .login-card {
        width: 100%;
        max-width: 380px;
        margin: 0;
        border-radius: 24px;
        background: var(--login-card-bg);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid var(--login-card-border);
        box-shadow: var(--login-card-shadow);
        overflow: visible;
        animation: slideUp 0.7s var(--login-animation-timing) 0.2s backwards;
      }

      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(40px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .login-card ion-card-content {
        padding: 32px 28px;
      }

      .card-title {
        font-size: 20px;
        font-weight: 700;
        color: var(--login-text-primary);
        text-align: center;
        margin: 0 0 28px 0;
        letter-spacing: -0.01em;
      }

      /* ========================================
       Form Fields
       ======================================== */
      .form-fields {
        display: flex;
        flex-direction: column;
        gap: 20px;
        margin-bottom: 24px;
      }

      .field-group {
        position: relative;
      }

      .input-item {
        --background: var(--login-input-bg);
        --border-radius: 14px;
        --padding-start: 18px;
        --padding-end: 12px;
        --inner-padding-end: 0;
        --min-height: 60px;
        border: 2px solid var(--login-input-border);
        border-radius: 14px;
        transition: all var(--login-animation-duration) var(--login-animation-timing);
        overflow: hidden;
      }

      .input-item::part(native) {
        padding-top: 8px;
        padding-bottom: 8px;
      }

      /* Focus state */
      .input-item--focused {
        border-color: var(--login-input-focus-border);
        box-shadow: 0 0 0 4px rgba(var(--ion-color-primary-rgb), 0.12);
        transform: translateY(-1px);
      }

      /* Error state */
      .input-item--error {
        border-color: var(--login-input-error-border);
        background: rgba(var(--ion-color-danger-rgb), 0.04);
      }

      .input-item--error.input-item--focused {
        box-shadow: 0 0 0 4px rgba(var(--ion-color-danger-rgb), 0.12);
      }

      /* Valid state */
      .input-item--valid {
        border-color: var(--login-input-valid-border);
      }

      .input-item ion-input {
        --color: var(--login-text-primary);
        --placeholder-color: var(--login-text-muted);
        --placeholder-opacity: 1;
        font-size: 16px;
        font-weight: 500;
      }

      /* Floating label styling */
      .input-item ion-input::part(label) {
        font-weight: 600;
        color: var(--login-text-secondary);
      }

      .input-item--focused ion-input::part(label) {
        color: var(--ion-color-primary);
      }

      .input-item--error ion-input::part(label) {
        color: var(--ion-color-danger);
      }

      /* Field indicator (checkmark) */
      .field-indicator {
        display: flex;
        align-items: center;
        padding-right: 8px;
      }

      .indicator-valid {
        color: var(--ion-color-success);
        font-size: 20px;
        animation: popIn 0.3s var(--login-animation-timing);
      }

      @keyframes popIn {
        from {
          opacity: 0;
          transform: scale(0.5);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      /* Password toggle button */
      .password-toggle {
        --padding-start: 8px;
        --padding-end: 8px;
        margin: 0;
        height: 40px;
        min-width: 40px;
        opacity: 0.6;
        transition: opacity var(--login-animation-duration) var(--login-animation-timing);
      }

      .password-toggle:hover,
      .password-toggle:focus {
        opacity: 1;
      }

      .password-toggle ion-icon {
        font-size: 20px;
        color: var(--login-text-secondary);
      }

      /* Field error message */
      .field-error {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 8px 4px 0;
        padding: 0;
        font-size: 13px;
        font-weight: 500;
        color: var(--ion-color-danger);
        animation: shake 0.4s var(--login-animation-timing);
      }

      @keyframes shake {
        0%,
        100% {
          transform: translateX(0);
        }
        20% {
          transform: translateX(-4px);
        }
        40% {
          transform: translateX(4px);
        }
        60% {
          transform: translateX(-4px);
        }
        80% {
          transform: translateX(4px);
        }
      }

      /* ========================================
       Error Banner (API errors)
       ======================================== */
      .error-banner {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 16px;
        margin-bottom: 20px;
        background: rgba(var(--ion-color-danger-rgb), 0.08);
        border: 1px solid rgba(var(--ion-color-danger-rgb), 0.2);
        border-radius: 12px;
        color: var(--ion-color-danger);
        font-size: 14px;
        font-weight: 500;
        animation: slideIn 0.4s var(--login-animation-timing);
      }

      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .error-banner ion-icon {
        font-size: 20px;
        flex-shrink: 0;
      }

      /* ========================================
       Login Button
       ======================================== */
      .login-button {
        --background: var(--login-button-gradient);
        --background-hover: var(--login-button-gradient);
        --background-activated: var(--login-button-gradient);
        --background-focused: var(--login-button-gradient);
        --border-radius: 14px;
        --box-shadow: 0 4px 14px rgba(var(--ion-color-primary-rgb), 0.35);
        --padding-top: 18px;
        --padding-bottom: 18px;
        margin: 0;
        font-size: 16px;
        font-weight: 700;
        letter-spacing: 0.02em;
        transition: all var(--login-animation-duration) var(--login-animation-timing);
        overflow: hidden;
        position: relative;
      }

      .login-button::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, transparent 50%);
        opacity: 0;
        transition: opacity var(--login-animation-duration) var(--login-animation-timing);
      }

      .login-button:hover:not([disabled])::before {
        opacity: 1;
      }

      .login-button:hover:not([disabled]) {
        --box-shadow: 0 8px 25px rgba(var(--ion-color-primary-rgb), 0.4);
        transform: translateY(-2px);
      }

      .login-button:active:not([disabled]) {
        transform: translateY(0);
        --box-shadow: 0 4px 14px rgba(var(--ion-color-primary-rgb), 0.35);
      }

      .login-button[disabled] {
        --background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%);
        --box-shadow: none;
        opacity: 0.7;
      }

      .login-button--loading {
        pointer-events: none;
      }

      .button-content {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
      }

      .loading-spinner {
        --color: #fff;
        width: 22px;
        height: 22px;
      }

      .loading-text {
        animation: pulse-text 1.5s ease-in-out infinite;
      }

      @keyframes pulse-text {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.7;
        }
      }

      /* ========================================
       Footer
       ======================================== */
      .login-footer {
        margin-top: 32px;
        text-align: center;
        animation: fadeIn 0.7s var(--login-animation-timing) 0.4s backwards;
      }

      .version-text {
        font-size: 13px;
        font-weight: 500;
        color: var(--login-text-muted);
        margin: 0;
        letter-spacing: 0.02em;
      }

      /* ========================================
       Accessibility: Focus visible
       ======================================== */
      ion-button:focus-visible,
      ion-input:focus-visible {
        outline: 2px solid var(--ion-color-primary);
        outline-offset: 2px;
      }

      /* Reduced motion preference */
      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }

      /* ========================================
       Responsive adjustments
       ======================================== */
      @media (max-width: 359px) {
        .login-card ion-card-content {
          padding: 24px 20px;
        }

        .brand-title {
          font-size: 24px;
        }

        .logo-wrapper {
          width: 80px;
          height: 80px;
        }

        .logo-icon {
          font-size: 44px;
        }
      }

      @media (min-height: 700px) {
        .logo-section {
          margin-bottom: 48px;
        }

        .login-footer {
          margin-top: 40px;
        }
      }
    `,
  ],
})
export class LoginPage {
  protected readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  protected readonly showPassword = signal(false);
  protected readonly focusedField = signal<string | null>(null);
  protected readonly version = '1.0.0';

  protected readonly loginForm: FormGroup = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(4)]],
  });

  constructor() {
    addIcons({
      eyeOutline,
      eyeOffOutline,
      logInOutline,
      cubeOutline,
      alertCircleOutline,
      checkmarkCircle,
    });
  }

  protected togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  protected onFieldFocus(fieldName: string): void {
    this.focusedField.set(fieldName);
  }

  protected onFieldBlur(): void {
    this.focusedField.set(null);
  }

  protected isFieldInvalid(fieldName: string): boolean {
    const control = this.loginForm.get(fieldName);
    return !!control && control.invalid && control.touched;
  }

  protected isFieldValid(fieldName: string): boolean {
    const control = this.loginForm.get(fieldName);
    return !!control && control.valid && control.touched;
  }

  protected getFieldError(fieldName: string): string {
    const control = this.loginForm.get(fieldName);
    if (!control || !control.errors) return '';

    if (control.errors['required']) {
      return `AUTH.LOGIN.ERRORS.${fieldName.toUpperCase()}_REQUIRED`;
    }
    if (control.errors['minlength']) {
      return `AUTH.LOGIN.ERRORS.${fieldName.toUpperCase()}_MIN_LENGTH`;
    }
    return 'AUTH.LOGIN.ERRORS.INVALID_FIELD';
  }

  protected async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { username, password } = this.loginForm.value;
    const success = await this.authService.login({ username, password });

    if (success) {
      await this.router.navigate(['/tabs/orders']);
    }
  }
}
