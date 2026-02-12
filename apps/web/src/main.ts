/**
 * @fileoverview 애플리케이션 부트스트랩 설정
 * @description Angular 애플리케이션의 진입점으로, 필요한 모든 프로바이더를 설정합니다.
 *
 * 주요 설정:
 * - Ionic Angular 프레임워크 (iOS 스타일)
 * - 라우팅 및 프리로딩 전략
 * - HTTP 인터셉터 (인증, 오류 처리, 오프라인 지원)
 * - 서비스 워커 (PWA)
 * - 다국어 지원 (i18n) - 한국어 기본
 * - 전역 에러 핸들러
 * - Sentry 에러 모니터링
 */
import {
  enableProdMode,
  importProvidersFrom,
  isDevMode,
  APP_INITIALIZER,
  ErrorHandler,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { provideIonicAngular, IonicRouteStrategy } from '@ionic/angular/standalone';
import { RouteReuseStrategy } from '@angular/router';
import * as Sentry from '@sentry/angular';

// i18n (다국어 지원) 설정
import { TranslateModule, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { firstValueFrom } from 'rxjs';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { authInterceptor } from './app/core/interceptors/auth.interceptor';
import { apiResponseInterceptor } from './app/core/interceptors/api-response.interceptor';
import { errorInterceptor } from './app/core/interceptors/error.interceptor';
import { offlineInterceptor } from './app/core/interceptors/offline.interceptor';
import { GlobalErrorHandler } from './app/core/error/global-error-handler';

import { environment } from './environments/environment';

/**
 * Initialize Sentry for error monitoring
 * Only enabled in production with valid DSN
 */
if (environment.production && environment.sentryDsn) {
  Sentry.init({
    dsn: environment.sentryDsn,
    environment: 'production',
    release: `erp-web@${environment.appVersion}`,
    integrations: [Sentry.browserTracingIntegration()],
    // Performance monitoring sample rate (adjust based on traffic)
    tracesSampleRate: 0.1,
    // Only report errors from our domain
    allowUrls: [/https?:\/\/[^/]*\.your-domain\.com/],
  });
}

/**
 * HTTP 로더 팩토리 함수
 * @description 번역 파일을 HTTP를 통해 로드하는 로더를 생성합니다.
 * @param http - HttpClient 인스턴스
 * @returns TranslateHttpLoader 인스턴스
 *
 * 번역 파일 경로: /assets/i18n/{lang}.json
 * 예: /assets/i18n/ko.json, /assets/i18n/en.json
 */
export function HttpLoaderFactory(http: HttpClient): TranslateHttpLoader {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

/**
 * Translation Initializer Factory
 * @description 앱 부트스트랩 전에 번역 파일을 미리 로드합니다.
 * 이렇게 하면 화면이 렌더링되기 전에 번역이 준비됩니다.
 */
export function initializeTranslations(translate: TranslateService): () => Promise<void> {
  return async (): Promise<void> => {
    translate.setDefaultLang('ko');
    await firstValueFrom(translate.use('ko'));
  };
}

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideIonicAngular({
      mode: 'ios', // iOS 스타일로 일관된 UI 제공
      animated: true,
    }),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(
      withInterceptors([
        authInterceptor,
        apiResponseInterceptor,
        errorInterceptor,
        offlineInterceptor,
      ]),
    ),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    // i18n (다국어 지원) 프로바이더
    // 기본 언어: 한국어 (ko), 대체 언어: 영어 (en)
    importProvidersFrom(
      TranslateModule.forRoot({
        defaultLanguage: 'ko', // 기본 언어: 한국어
        useDefaultLang: true, // 키가 없으면 기본 언어 사용
        loader: {
          provide: TranslateLoader,
          useFactory: HttpLoaderFactory,
          deps: [HttpClient],
        },
      }),
    ),
    // 앱 부트스트랩 전에 번역 파일 미리 로드
    {
      provide: APP_INITIALIZER,
      useFactory: initializeTranslations,
      deps: [TranslateService],
      multi: true,
    },
  ],
}).catch((err) => {
  if (!environment.production) {
    console.error('Bootstrap error:', err);
  }
});
