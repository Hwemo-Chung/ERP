export interface AuthServiceInterface {
  getAccessToken(): string | null;
  refreshTokens(): Promise<boolean>;
  isAuthenticated(): boolean;
  initialize(): Promise<void>;
}

export const AUTH_SERVICE_TOKEN = 'AUTH_SERVICE_TOKEN';
