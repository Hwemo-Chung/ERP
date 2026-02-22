import { signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import { firstValueFrom } from 'rxjs';
import { ENVIRONMENT_CONFIG } from '../tokens/environment.token';
import { LoggerService } from './logger.service';
import type { User, AuthTokens, LoginRequest, AuthState } from './auth.models';
import { AUTH_STORAGE_KEYS } from './auth.models';

export abstract class BaseAuthService {
  protected readonly http = inject(HttpClient);
  protected readonly router = inject(Router);
  protected readonly logger = inject(LoggerService);
  protected readonly env = inject(ENVIRONMENT_CONFIG);

  protected readonly _state = signal<AuthState>({
    user: null,
    tokens: null,
    isLoading: false,
    error: null,
  });

  readonly user = computed(() => this._state().user);
  readonly isAuthenticated = computed(() => !!this._state().tokens);
  readonly isLoading = computed(() => this._state().isLoading);
  readonly error = computed(() => this._state().error);
  readonly roles = computed(() => this._state().user?.roles || []);

  protected readonly STORAGE_KEYS = AUTH_STORAGE_KEYS;

  protected safeJsonParse<T>(value: string | null, clearKey?: string): T | null {
    if (!value || value === 'undefined' || value === 'null') {
      if (clearKey) {
        Preferences.remove({ key: clearKey }).catch((e: unknown) => void e);
      }
      return null;
    }
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.warn('[Auth] Failed to parse stored data for key:', clearKey, error);
      if (clearKey) {
        Preferences.remove({ key: clearKey }).catch((e: unknown) => void e);
      }
      return null;
    }
  }

  abstract initialize(): Promise<void>;

  async login(credentials: LoginRequest): Promise<boolean> {
    this._state.update((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const data = await firstValueFrom(
        this.http.post<{ accessToken: string; refreshToken: string; user: User }>(
          `${this.env.apiUrl}/auth/login`,
          credentials,
        ),
      );

      const tokens: AuthTokens = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      };

      await Promise.all([
        Preferences.set({ key: this.STORAGE_KEYS.ACCESS_TOKEN, value: tokens.accessToken }),
        Preferences.set({ key: this.STORAGE_KEYS.REFRESH_TOKEN, value: tokens.refreshToken }),
        Preferences.set({ key: this.STORAGE_KEYS.USER, value: JSON.stringify(data.user) }),
      ]);

      this._state.update((s) => ({
        ...s,
        tokens,
        user: data.user,
        isLoading: false,
      }));

      this.onLoginSuccess(data.user);
      return true;
    } catch (err: unknown) {
      return this.handleLoginError(err);
    }
  }

  protected onLoginSuccess(_user: User): void {}

  protected handleLoginError(err: unknown): false {
    const httpBody = (err as Record<string, unknown>)?.['error'] as
      | Record<string, unknown>
      | undefined;
    this._state.update((s) => ({
      ...s,
      isLoading: false,
      error: (httpBody?.['message'] as string) || 'Login failed',
    }));
    return false;
  }

  abstract logout(): Promise<void>;
  abstract refreshTokens(): Promise<boolean>;

  protected async clearStorage(): Promise<void> {
    await Promise.all([
      Preferences.remove({ key: this.STORAGE_KEYS.ACCESS_TOKEN }),
      Preferences.remove({ key: this.STORAGE_KEYS.REFRESH_TOKEN }),
      Preferences.remove({ key: this.STORAGE_KEYS.USER }),
    ]);
    this._state.set({
      user: null,
      tokens: null,
      isLoading: false,
      error: null,
    });
  }

  getAccessToken(): string | null {
    return this._state().tokens?.accessToken || null;
  }

  hasRole(role: string): boolean {
    return this.roles().includes(role);
  }

  hasAnyRole(roles: string[]): boolean {
    return roles.some((role) => this.hasRole(role));
  }
}
