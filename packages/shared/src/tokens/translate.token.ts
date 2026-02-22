import { InjectionToken } from '@angular/core';

export interface TranslationProvider {
  instant(key: string): string;
}

export const TRANSLATE_SERVICE_TOKEN = new InjectionToken<TranslationProvider | null>(
  'TRANSLATE_SERVICE_TOKEN',
);
