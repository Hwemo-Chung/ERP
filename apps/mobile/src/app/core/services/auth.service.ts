import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import { environment } from '@env/environment';
import { firstValueFrom } from 'rxjs';
import { LoggerService } from './logger.service';

export interface User {
  id: string;
  username: string;
  fullName: string;
  roles: string[];
  branchCode?: string;
  branchName?: string;
  locale: string;
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

  // Prevent concurrent refresh attempts
  private _refreshPromise: Promise<boolean> | null = null;
  private _isLoggingOut = false;
  private _initialized = false;

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

  /**
   * Check if a JWT token is expired
   */
  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000; // Convert to milliseconds
      // Consider expired if less than 30 seconds remaining
      return Date.now() >= exp - 30000;
    } catch {
      return true; // If we can't parse, consider it expired
    }
  }

  async initialize(): Promise<void> {
    // Skip if already initialized and authenticated
    if (this._initialized && this.isAuthenticated()) {
      return;
    }

    // Skip if currently in the middle of login/logout
    if (this._isLoggingOut) {
      return;
    }

    try {
      // Restore tokens from storage
      const [accessToken, refreshToken, userJson] = await Promise.all([
        Preferences.get({ key: this.STORAGE_KEYS.ACCESS_TOKEN }),
        Preferences.get({ key: this.STORAGE_KEYS.REFRESH_TOKEN }),
        Preferences.get({ key: this.STORAGE_KEYS.USER }),
      ]);

      if (accessToken.value && refreshToken.value) {
        // Check if access token is expired
        if (this.isTokenExpired(accessToken.value)) {
          this.logger.warn('[Auth] Stored access token is expired, clearing session');
          await this.clearStorage();
          this._initialized = true;
          return;
        }

        // Check if refresh token is also expired
        if (this.isTokenExpired(refreshToken.value)) {
          this.logger.warn('[Auth] Stored refresh token is expired, clearing session');
          await this.clearStorage();
          this._initialized = true;
          return;
        }

        const tokens: AuthTokens = {
          accessToken: accessToken.value,
          refreshToken: refreshToken.value,
        };
        const user = this.safeJsonParse<User>(userJson.value, this.STORAGE_KEYS.USER);

        this._state.update((s) => ({ ...s, tokens, user }));
      }

      this._initialized = true;
    } catch (error) {
      this.logger.warn('[Auth] Failed to restore session from storage:', error);
      await this.clearStorage();
      this._initialized = true;
    }
  }

  /**
   * Clear storage without making API calls or navigating
   */
  private async clearStorage(): Promise<void> {
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

  async login(credentials: LoginRequest): Promise<boolean> {
    this._state.update((s) => ({ ...s, isLoading: true, error: null }));

    try {
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

      // Mark as initialized after successful login
      this._initialized = true;

      return true;
    } catch (err: unknown) {
      this.logger.error('[Auth] Login failed:', err);
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
    if (this._isLoggingOut) {
      return;
    }
    this._isLoggingOut = true;

    try {
      const currentToken = this._state().tokens?.accessToken;

      this._state.set({
        user: null,
        tokens: null,
        isLoading: false,
        error: null,
      });

      await Promise.all([
        Preferences.remove({ key: this.STORAGE_KEYS.ACCESS_TOKEN }),
        Preferences.remove({ key: this.STORAGE_KEYS.REFRESH_TOKEN }),
        Preferences.remove({ key: this.STORAGE_KEYS.USER }),
      ]);

      if (currentToken) {
        try {
          await firstValueFrom(
            this.http.post(
              `${environment.apiUrl}/auth/logout`,
              {},
              { headers: { Authorization: `Bearer ${currentToken}` } },
            ),
          );
        } catch {
          // Ignore logout API errors
        }
      }

      await this.router.navigate(['/auth/login']);
    } finally {
      this._isLoggingOut = false;
      this._initialized = false;
    }
  }

  async refreshTokens(): Promise<boolean> {
    // If already refreshing, return the existing promise
    if (this._refreshPromise) {
      return this._refreshPromise;
    }

    // If already logging out, don't try to refresh
    if (this._isLoggingOut) {
      return false;
    }

    const currentTokens = this._state().tokens;
    if (!currentTokens?.refreshToken) {
      return false;
    }

    // Create and store the refresh promise
    this._refreshPromise = this._doRefresh(currentTokens.refreshToken);

    try {
      return await this._refreshPromise;
    } finally {
      this._refreshPromise = null;
    }
  }

  private async _doRefresh(refreshToken: string): Promise<boolean> {
    try {
      const data = await firstValueFrom(
        this.http.post<{ accessToken: string; refreshToken: string }>(
          `${environment.apiUrl}/auth/refresh`,
          { refreshToken },
        ),
      );

      const tokens: AuthTokens = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
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
