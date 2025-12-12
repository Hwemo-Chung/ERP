import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Preferences } from '@capacitor/preferences';
import { firstValueFrom } from 'rxjs';

export type SupportedLanguage = 'ko' | 'en';

interface TranslationData {
  [key: string]: any;
}

@Injectable({
  providedIn: 'root',
})
export class TranslationService {
  private readonly http = inject(HttpClient);
  private readonly STORAGE_KEY = 'erp_language';
  private readonly DEFAULT_LANGUAGE: SupportedLanguage = 'ko';

  // State
  private readonly _currentLanguage = signal<SupportedLanguage>(this.DEFAULT_LANGUAGE);
  private readonly _translations = signal<TranslationData>({});
  private readonly _isLoading = signal(false);

  // Public selectors
  readonly currentLanguage = this._currentLanguage.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();

  /**
   * Initialize translation service
   * Loads saved language preference and translation data
   */
  async initialize(): Promise<void> {
    // Load saved language preference
    const saved = await Preferences.get({ key: this.STORAGE_KEY });
    const language = (saved.value as SupportedLanguage) || this.DEFAULT_LANGUAGE;

    await this.setLanguage(language);
  }

  /**
   * Set active language and load translations
   */
  async setLanguage(language: SupportedLanguage): Promise<void> {
    this._isLoading.set(true);

    try {
      const translations = await firstValueFrom(
        this.http.get<TranslationData>(`/assets/i18n/${language}.json`)
      );

      this._translations.set(translations);
      this._currentLanguage.set(language);

      // Save preference
      await Preferences.set({
        key: this.STORAGE_KEY,
        value: language,
      });
    } catch (error) {
      console.error(`Failed to load translations for ${language}:`, error);

      // Fallback to default language if not already trying it
      if (language !== this.DEFAULT_LANGUAGE) {
        console.warn(`Falling back to default language: ${this.DEFAULT_LANGUAGE}`);
        await this.setLanguage(this.DEFAULT_LANGUAGE);
      }
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Get translation by key path (e.g., 'PROFILE.TITLE')
   * Supports parameter replacement: translate('PROFILE.SYNC.PENDING_COUNT', { count: 5 })
   */
  translate(key: string, params?: Record<string, any>): string {
    const keys = key.split('.');
    let value: any = this._translations();

    // Navigate through nested keys
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Return key if translation not found
        return key;
      }
    }

    // If value is not a string, return the key
    if (typeof value !== 'string') {
      return key;
    }

    // Replace parameters if provided
    if (params) {
      return this.replaceParams(value, params);
    }

    return value;
  }

  /**
   * Get translation with Signal support
   * Returns a computed signal that updates when language changes
   */
  translateSignal(key: string, params?: Record<string, any>) {
    return computed(() => this.translate(key, params));
  }

  /**
   * Get instant translation (synchronous)
   * Use this when you need the value immediately
   */
  instant(key: string, params?: Record<string, any>): string {
    return this.translate(key, params);
  }

  /**
   * Check if a translation key exists
   */
  hasKey(key: string): boolean {
    const keys = key.split('.');
    let value: any = this._translations();

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return false;
      }
    }

    return typeof value === 'string';
  }

  /**
   * Get all supported languages
   */
  getSupportedLanguages(): { code: SupportedLanguage; name: string }[] {
    return [
      { code: 'ko', name: this.translate('LANGUAGES.KO') },
      { code: 'en', name: this.translate('LANGUAGES.EN') },
    ];
  }

  /**
   * Replace template parameters in translation string
   * Example: "Hello {{name}}" with { name: "John" } => "Hello John"
   */
  private replaceParams(text: string, params: Record<string, any>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? String(params[key]) : match;
    });
  }
}
