import {
  enableProdMode,
  isDevMode,
  provideExperimentalZonelessChangeDetection,
  importProvidersFrom,
  APP_INITIALIZER,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import {
  provideRouter,
  withPreloading,
  PreloadAllModules,
  RouteReuseStrategy,
} from '@angular/router';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { provideIonicAngular, IonicRouteStrategy } from '@ionic/angular/standalone';
import { TranslateModule, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { firstValueFrom } from 'rxjs';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { authInterceptor } from './app/core/interceptors/auth.interceptor';
import { apiResponseInterceptor } from './app/core/interceptors/api-response.interceptor';
import { errorInterceptor } from './app/core/interceptors/error.interceptor';
import { offlineInterceptor } from './app/core/interceptors/offline.interceptor';

import { environment } from './environments/environment';
import { ENVIRONMENT_CONFIG, PLATFORM_CONFIG } from '@erp/shared';

// AoT requires an exported function for factories
export function HttpLoaderFactory(http: HttpClient): TranslateHttpLoader {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

/**
 * Translation Initializer Factory
 * Loads translations before app bootstrap to prevent untranslated keys from showing
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
    // Enable Zoneless mode for better performance on low-end devices
    provideExperimentalZonelessChangeDetection(),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular({
      mode: 'ios', // iOS style for consistent look
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
    // i18n Translation Module
    importProvidersFrom(
      TranslateModule.forRoot({
        defaultLanguage: 'ko',
        useDefaultLang: true, // Use default lang when key not found
        loader: {
          provide: TranslateLoader,
          useFactory: HttpLoaderFactory,
          deps: [HttpClient],
        },
      }),
    ),
    // Load translations before app bootstrap
    {
      provide: APP_INITIALIZER,
      useFactory: initializeTranslations,
      deps: [TranslateService],
      multi: true,
    },
    { provide: ENVIRONMENT_CONFIG, useValue: environment },
    {
      provide: PLATFORM_CONFIG,
      useValue: {
        platform: 'mobile',
        defaultRoute: '/tabs/assignment',
        supportsZoneless: true,
        hasBiometric: true,
        hasCapacitor: true,
      },
    },
  ],
}).catch((err) => {
  if (!environment.production) {
    console.error('Bootstrap error:', err);
  }
});
