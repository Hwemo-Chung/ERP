/**
 * @fileoverview 다국어(i18n) 서비스
 * @description 애플리케이션의 언어 설정을 관리하고 번역 기능을 제공합니다.
 *
 * 주요 기능:
 * - 언어 변경 및 초기화
 * - 번역 문자열 조회
 * - 언어 설정 저장/복원
 *
 * 사용 예시:
 * ```typescript
 * // 컴포넌트에서 사용
 * translate = inject(I18nService);
 *
 * // 현재 언어 확인
 * const lang = this.translate.currentLang();
 *
 * // 언어 변경
 * this.translate.setLanguage('en');
 *
 * // 번역 텍스트 가져오기 (Observable)
 * this.translate.get('COMMON.OK').subscribe(text => console.log(text));
 *
 * // 즉시 번역 (이미 로드된 경우)
 * const text = this.translate.instant('COMMON.OK');
 * ```
 */
import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { LoggerService } from '../../core/services/logger.service';
import { LANGUAGE_CODES, DEFAULT_LANGUAGE, STORAGE_KEYS, type LanguageCode } from '../constants';

/**
 * 언어 정보 인터페이스
 */
export interface LanguageInfo {
  /** 언어 코드 */
  code: LanguageCode;
  /** 표시 이름 */
  name: string;
  /** 네이티브 이름 */
  nativeName: string;
}

/**
 * 지원 언어 목록
 * @description 앱에서 지원하는 언어 목록 (확장 가능)
 */
export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: LANGUAGE_CODES.KOREAN, name: 'Korean', nativeName: '한국어' },
  { code: LANGUAGE_CODES.ENGLISH, name: 'English', nativeName: 'English' },
];

@Injectable({
  providedIn: 'root',
})
export class I18nService {
  /** TranslateService 주입 */
  private translateService = inject(TranslateService);
  private readonly logger = inject(LoggerService);

  /** 현재 언어 상태 (Signal) */
  private _currentLang = signal<LanguageCode>(DEFAULT_LANGUAGE);

  /** 현재 언어 읽기 전용 시그널 */
  readonly currentLang = this._currentLang.asReadonly();

  /** 지원 언어 목록 */
  readonly supportedLanguages = SUPPORTED_LANGUAGES;

  constructor() {
    this.initializeLanguage();
  }

  /**
   * 언어 초기화
   * @description 저장된 언어 설정을 복원하거나 기본 언어를 설정합니다.
   */
  private initializeLanguage(): void {
    // 사용 가능한 언어 설정
    const langCodes = SUPPORTED_LANGUAGES.map((lang) => lang.code);
    this.translateService.addLangs(langCodes);

    // 기본 언어 설정
    this.translateService.setDefaultLang(DEFAULT_LANGUAGE);

    // 저장된 언어 또는 브라우저 언어 확인
    const savedLang = this.getSavedLanguage();
    const browserLang = this.translateService.getBrowserLang() as LanguageCode;

    // 우선순위: 저장된 언어 > 브라우저 언어 > 기본 언어
    let langToUse: LanguageCode = DEFAULT_LANGUAGE;

    if (savedLang && this.isValidLanguage(savedLang)) {
      langToUse = savedLang;
    } else if (browserLang && this.isValidLanguage(browserLang)) {
      langToUse = browserLang;
    }

    this.setLanguage(langToUse);
  }

  /**
   * 언어 변경
   * @param lang - 변경할 언어 코드
   * @returns 언어 변경 완료 Observable
   */
  setLanguage(lang: LanguageCode): Observable<unknown> {
    if (!this.isValidLanguage(lang)) {
      this.logger.warn(`[I18nService] 지원하지 않는 언어입니다: ${lang}`);
      lang = DEFAULT_LANGUAGE;
    }

    this._currentLang.set(lang);
    this.saveLanguage(lang);

    return this.translateService.use(lang);
  }

  /**
   * 번역 텍스트 조회 (Observable)
   * @param key - 번역 키 (예: 'COMMON.OK')
   * @param params - 보간 파라미터 (예: { count: 5 })
   * @returns 번역된 텍스트 Observable
   */
  get(key: string, params?: Record<string, unknown>): Observable<string> {
    return this.translateService.get(key, params);
  }

  /**
   * 즉시 번역 텍스트 조회
   * @param key - 번역 키
   * @param params - 보간 파라미터
   * @returns 번역된 텍스트 (로드되지 않은 경우 키 반환)
   */
  instant(key: string, params?: Record<string, unknown>): string {
    return this.translateService.instant(key, params);
  }

  /**
   * 다중 키 번역 조회
   * @param keys - 번역 키 배열
   * @returns 키-값 쌍의 번역 결과 Observable
   */
  getMany(keys: string[]): Observable<Record<string, string>> {
    return this.translateService.get(keys);
  }

  /**
   * 언어가 유효한지 확인
   * @param lang - 확인할 언어 코드
   * @returns 유효 여부
   */
  private isValidLanguage(lang: string): lang is LanguageCode {
    return SUPPORTED_LANGUAGES.some((l) => l.code === lang);
  }

  /**
   * 저장된 언어 설정 조회
   * @returns 저장된 언어 코드 또는 null
   */
  private getSavedLanguage(): LanguageCode | null {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SELECTED_LANGUAGE);
      return saved as LanguageCode | null;
    } catch {
      // localStorage 접근 불가 시 (SSR 등)
      return null;
    }
  }

  /**
   * 언어 설정 저장
   * @param lang - 저장할 언어 코드
   */
  private saveLanguage(lang: LanguageCode): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SELECTED_LANGUAGE, lang);
    } catch {
      // localStorage 접근 불가 시 무시
    }
  }

  /**
   * 현재 언어 정보 조회
   * @returns 현재 언어의 상세 정보
   */
  getCurrentLanguageInfo(): LanguageInfo {
    return (
      SUPPORTED_LANGUAGES.find((l) => l.code === this._currentLang()) ?? SUPPORTED_LANGUAGES[0]
    );
  }

  /**
   * 한국어 여부 확인
   * @returns 현재 언어가 한국어인지 여부
   */
  isKorean(): boolean {
    return this._currentLang() === LANGUAGE_CODES.KOREAN;
  }

  /**
   * 영어 여부 확인
   * @returns 현재 언어가 영어인지 여부
   */
  isEnglish(): boolean {
    return this._currentLang() === LANGUAGE_CODES.ENGLISH;
  }
}
