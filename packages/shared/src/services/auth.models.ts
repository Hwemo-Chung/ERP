export interface User {
  id: string;
  loginId: string;
  username: string;
  name: string;
  fullName: string;
  email: string;
  phone: string;
  roles: string[];
  branchId: string;
  branchCode: string;
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

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  error: string | null;
}

export const AUTH_STORAGE_KEYS = {
  ACCESS_TOKEN: 'erp_access_token',
  REFRESH_TOKEN: 'erp_refresh_token',
  USER: 'erp_user',
} as const;
