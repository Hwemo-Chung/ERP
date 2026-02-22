import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { firstValueFrom } from 'rxjs';
import { BaseAuthService, type User, type AuthTokens, type LoginRequest } from '@erp/shared';

export type { User, AuthTokens, LoginRequest };

@Injectable({
  providedIn: 'root',
})
export class AuthService extends BaseAuthService {
  async initialize(): Promise<void> {
    try {
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
    }
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${this.env.apiUrl}/auth/logout`, {}));
    } catch {
      // Ignore logout API errors
    }

    await this.clearStorage();
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
          `${this.env.apiUrl}/auth/refresh`,
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

  async refreshAccessToken(refreshToken: string): Promise<boolean> {
    this._state.update((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const data = await firstValueFrom(
        this.http.post<{ accessToken: string; refreshToken: string; user: User }>(
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
}
