import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonList,
  IonItem,
  IonInput,
  IonButton,
  IonSpinner,
  IonIcon,
  IonText,
  IonCard,
  IonCardContent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { eyeOutline, eyeOffOutline, logInOutline, cubeOutline } from 'ionicons/icons';
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
    IonList,
    IonItem,
    IonInput,
    IonButton,
    IonSpinner,
    IonIcon,
    IonText,
    IonCard,
    IonCardContent,
  ],
  template: `
    <ion-content class="ion-padding">
      <div class="login-container">
        <div class="logo-section">
          <ion-icon name="cube-outline" class="logo-icon"></ion-icon>
          <h1>{{ 'BRAND.TITLE' | translate }}</h1>
          <p>{{ 'BRAND.SUBTITLE' | translate }}</p>
        </div>

        <ion-card>
          <ion-card-content>
            <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
              <ion-list>
                <ion-item>
                  <ion-input
                    formControlName="username"
                    type="text"
                    [label]="'AUTH.LOGIN.USERNAME' | translate"
                    labelPlacement="floating"
                    [placeholder]="'AUTH.LOGIN.USERNAME_PLACEHOLDER' | translate"
                    autocapitalize="off"
                    autocomplete="username"
                  ></ion-input>
                </ion-item>

                <ion-item>
                  <ion-input
                    formControlName="password"
                    [type]="showPassword() ? 'text' : 'password'"
                    [label]="'AUTH.LOGIN.PASSWORD' | translate"
                    labelPlacement="floating"
                    [placeholder]="'AUTH.LOGIN.PASSWORD_PLACEHOLDER' | translate"
                    autocomplete="current-password"
                  ></ion-input>
                  <ion-button
                    fill="clear"
                    slot="end"
                    (click)="togglePasswordVisibility()"
                  >
                    <ion-icon
                      slot="icon-only"
                      [name]="showPassword() ? 'eye-off-outline' : 'eye-outline'"
                    ></ion-icon>
                  </ion-button>
                </ion-item>
              </ion-list>

              @if (authService.error()) {
                <ion-text color="danger">
                  <p class="error-text">{{ authService.error() }}</p>
                </ion-text>
              }

              <ion-button
                expand="block"
                type="submit"
                [disabled]="loginForm.invalid || authService.isLoading()"
                class="login-button"
              >
                @if (authService.isLoading()) {
                  <ion-spinner name="crescent"></ion-spinner>
                } @else {
                  <ion-icon slot="start" name="log-in-outline"></ion-icon>
                  {{ 'AUTH.LOGIN.SIGN_IN' | translate }}
                }
              </ion-button>
            </form>
          </ion-card-content>
        </ion-card>

        <p class="version-text">v{{ version }}</p>
      </div>
    </ion-content>
  `,
  styles: [`
    .login-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: 100%;
      padding: 24px;
    }

    .logo-section {
      text-align: center;
      margin-bottom: 32px;

      .logo-icon {
        font-size: 80px;
        color: var(--ion-color-primary);
        margin-bottom: 16px;
      }

      h1 {
        font-size: 24px;
        font-weight: 700;
        margin: 0 0 8px 0;
        color: var(--ion-color-primary);
      }

      p {
        font-size: 14px;
        color: var(--ion-color-medium);
        margin: 0;
      }
    }

    ion-card {
      margin: 0 auto;
      max-width: 300px;
    }

    ion-list {
      margin-bottom: 16px;
    }

    ion-item {
      --padding-start: 0;
    }

    .error-text {
      font-size: 14px;
      text-align: center;
      margin: 8px 0;
    }

    .login-button {
      margin-top: 16px;
    }

    .version-text {
      text-align: center;
      font-size: 12px;
      color: var(--ion-color-medium);
      margin-top: 24px;
    }
  `],
})
export class LoginPage {
  protected readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  protected readonly showPassword = signal(false);
  protected readonly version = '1.0.0';

  protected readonly loginForm: FormGroup = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(4)]],
  });

  constructor() {
    addIcons({ eyeOutline, eyeOffOutline, logInOutline, cubeOutline });
  }

  protected togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  protected async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) return;

    const { username, password } = this.loginForm.value;
    const success = await this.authService.login({ username, password });

    if (success) {
      await this.router.navigate(['/tabs/orders']);
    }
  }
}
