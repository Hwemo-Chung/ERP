import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { firstValueFrom } from 'rxjs';
import { BaseAuthService, type User, type AuthTokens, type LoginRequest } from '@erp/shared';

export type { User, AuthTokens, LoginRequest };

@Injectable({
  providedIn: 'root',
})
export class AuthService extends BaseAuthService {
  private _refreshPromise: Promise<boolean> | null = null;
  private _isLoggingOut = false;
  private _initialized = false;

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000;
      return Date.now() >= exp - 30000;
    } catch {
      return true;
    }
  }

  async initialize(): Promise<void> {
    if (this._initialized && this.isAuthenticated()) {
      return;
    }

    if (this._isLoggingOut) {
      return;
    }

    try {
      const [accessToken, refreshToken, userJson] = await Promise.all([
        Preferences.get({ key: this.STORAGE_KEYS.ACCESS_TOKEN }),
        Preferences.get({ key: this.STORAGE_KEYS.REFRESH_TOKEN }),
        Preferences.get({ key: this.STORAGE_KEYS.USER }),
      ]);

      if (accessToken.value && refreshToken.value) {
        if (this.isTokenExpired(accessToken.value)) {
          this.logger.warn('[Auth] Stored access token is expired, clearing session');
          await this.clearStorage();
          this._initialized = true;
          return;
        }

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

  protected override onLoginSuccess(_user: User): void {
    this._initialized = true;
  }

  protected override handleLoginError(err: unknown): false {
    this.logger.error('[Auth] Login failed:', err);
    return super.handleLoginError(err);
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
              `${this.env.apiUrl}/auth/logout`,
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
    if (this._refreshPromise) {
      return this._refreshPromise;
    }

    if (this._isLoggingOut) {
      return false;
    }

    const currentTokens = this._state().tokens;
    if (!currentTokens?.refreshToken) {
      return false;
    }

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
          `${this.env.apiUrl}/auth/refresh`,
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
}
