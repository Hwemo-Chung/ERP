import { InjectionToken } from '@angular/core';

export interface PlatformConfig {
  platform: 'web' | 'mobile';
  defaultRoute: string;
  supportsZoneless: boolean;
  hasBiometric: boolean;
  hasCapacitor: boolean;
}

export const PLATFORM_CONFIG = new InjectionToken<PlatformConfig>('PLATFORM_CONFIG');
