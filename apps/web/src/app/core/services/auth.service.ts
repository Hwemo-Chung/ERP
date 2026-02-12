import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import { environment } from '@env/environment';
import { firstValueFrom } from 'rxjs';
import { LoggerService } from './logger.service';

export interface User {
  id: string;
  loginId: string;
  name: string;
  email: string;
  phone: string;
  roles: string[];
  branchId: string;
  branchCode: string;
  branchName?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  error: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly logger = inject(LoggerService);

  // State
  private readonly _state = signal<AuthState>({
    user: null,
    tokens: null,
    isLoading: false,
    error: null,
  });

  // Selectors
  readonly user = computed(() => this._state().user);
  readonly isAuthenticated = computed(() => !!this._state().tokens);
  readonly isLoading = computed(() => this._state().isLoading);
  readonly error = computed(() => this._state().error);
  readonly roles = computed(() => this._state().user?.roles || []);

  private readonly STORAGE_KEYS = {
    ACCESS_TOKEN: 'erp_access_token',
    REFRESH_TOKEN: 'erp_refresh_token',
    USER: 'erp_user',
  };

  /**
   * Safely parse JSON from storage, handling corrupted data
   * Automatically clears corrupted data if clearKey is provided
   */
  private safeJsonParse<T>(value: string | null, clearKey?: string): T | null {
    if (!value || value === 'undefined' || value === 'null') {
      if (clearKey) {
        Preferences.remove({ key: clearKey }).catch((e) => void e);
      }
      return null;
    }
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.warn('[Auth] Failed to parse stored data for key:', clearKey, error);
      if (clearKey) {
        Preferences.remove({ key: clearKey }).catch((e) => void e);
      }
      return null;
    }
  }

  async initialize(): Promise<void> {
    try {
      // Restore tokens from storage
      const [accessToken, refreshToken, userJson] = await Promise.all([
        Preferences.get({ key: this.STORAGE_KEYS.ACCESS_TOKEN }),
        Preferences.get({ key: this.STORAGE_KEYS.REFRESH_TOKEN }),
        Preferences.get({ key: this.STORAGE_KEYS.USER }),
      ]);

      if (accessToken.value && refreshToken.value) {
        const tokens: AuthTokens = {
          accessToken: accessToken.value,
          refreshToken: refreshToken.value,
        };
        const user = this.safeJsonParse<User>(userJson.value, this.STORAGE_KEYS.USER);

        this._state.update((s) => ({ ...s, tokens, user }));
      }
    } catch (error) {
      this.logger.warn('[Auth] Failed to restore session from storage:', error);
      // Continue with unauthenticated state - user will need to login
    }
  }

  async login(credentials: LoginRequest): Promise<boolean> {
    this._state.update((s) => ({ ...s, isLoading: true, error: null }));

    try {
      // Note: apiResponseInterceptor unwraps { success, data } -> data
      const data = await firstValueFrom(
        this.http.post<{ accessToken: string; refreshToken: string; user: User }>(
          `${environment.apiUrl}/auth/login`,
          credentials,
        ),
      );

      const tokens: AuthTokens = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      };

      // Save to storage
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

      return true;
    } catch (err: unknown) {
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
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${environment.apiUrl}/auth/logout`, {}));
    } catch {
      // Ignore logout API errors
    }

    // Clear storage
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

    await this.router.navigate(['/auth/login']);
  }

  async refreshTokens(): Promise<boolean> {
    const currentTokens = this._state().tokens;
    if (!currentTokens?.refreshToken) {
      return false;
    }

    try {
      const response = await firstValueFrom(
        this.http.post<{ accessToken: string; refreshToken: string }>(
          `${environment.apiUrl}/auth/refresh`,
          { refreshToken: currentTokens.refreshToken },
        ),
      );

      const tokens: AuthTokens = {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      };

      await Promise.all([
        Preferences.set({ key: this.STORAGE_KEYS.ACCESS_TOKEN, value: tokens.accessToken }),
        Preferences.set({ key: this.STORAGE_KEYS.REFRESH_TOKEN, value: tokens.refreshToken }),
      ]);

      this._state.update((s) => ({ ...s, tokens }));
      return true;
    } catch {
      await this.logout();
      return false;
    }
  }

  /**
   * FR-22: Refresh access token from biometric refresh token
   * Used for biometric quick login flow
   */
  async refreshAccessToken(refreshToken: string): Promise<boolean> {
    this._state.update((s) => ({ ...s, isLoading: true, error: null }));

    try {
      // Note: apiResponseInterceptor unwraps { success, data } -> data
      const data = await firstValueFrom(
        this.http.post<{ accessToken: string; refreshToken: string; user: User }>(
          `${environment.apiUrl}/auth/refresh`,
          { refreshToken },
        ),
      );

      const tokens: AuthTokens = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      };

      // Save to storage
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

      this.logger.info(
        `[Auth] Biometric refresh token login success for user: ${data.user.loginId}`,
      );
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.warn('[Auth] Biometric refresh token expired or invalid:', msg);
      const httpBody = (err as Record<string, unknown>)?.['error'] as
        | Record<string, unknown>
        | undefined;
      this._state.update((s) => ({
        ...s,
        isLoading: false,
        error: (httpBody?.['message'] as string) || 'Token refresh failed',
      }));
      return false;
    }
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
