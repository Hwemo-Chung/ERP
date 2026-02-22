import { InjectionToken } from '@angular/core';

export interface EnvironmentConfig {
  production: boolean;
  apiUrl: string;
  vapidPublicKey: string;
  appVersion: string;
  sentryDsn?: string; // web-only, optional
}

export const ENVIRONMENT_CONFIG = new InjectionToken<EnvironmentConfig>('ENVIRONMENT_CONFIG');
