import {
  enableProdMode,
  isDevMode,
  provideExperimentalZonelessChangeDetection,
  importProvidersFrom,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withPreloading, PreloadAllModules, RouteReuseStrategy } from '@angular/router';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { provideIonicAngular, IonicRouteStrategy } from '@ionic/angular/standalone';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { authInterceptor } from './app/core/interceptors/auth.interceptor';
import { apiResponseInterceptor } from './app/core/interceptors/api-response.interceptor';
import { errorInterceptor } from './app/core/interceptors/error.interceptor';
import { offlineInterceptor } from './app/core/interceptors/offline.interceptor';

import { environment } from './environments/environment';

// AoT requires an exported function for factories
export function HttpLoaderFactory(http: HttpClient): TranslateHttpLoader {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
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
      ])
    ),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    // i18n Translation Module
    importProvidersFrom(
      TranslateModule.forRoot({
        defaultLanguage: 'ko',
        loader: {
          provide: TranslateLoader,
          useFactory: HttpLoaderFactory,
          deps: [HttpClient],
        },
      })
    ),
  ],
}).catch((err) => console.error('Bootstrap error:', err));
