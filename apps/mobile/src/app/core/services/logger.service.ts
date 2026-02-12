import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class LoggerService {
  log(message: string, ...args: unknown[]): void {
    if (!environment.production) {
      console.log(message, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (!environment.production) {
      console.warn(message, ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    // Always log errors, even in production
    console.error(message, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    if (!environment.production) {
      console.debug(message, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (!environment.production) {
      console.info(message, ...args);
    }
  }
}
