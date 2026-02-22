import { Injectable, inject } from '@angular/core';
import { ENVIRONMENT_CONFIG } from '../tokens/environment.token';
import { LoggerServiceInterface } from '../tokens/logger.token';

@Injectable({ providedIn: 'root' })
export class LoggerService implements LoggerServiceInterface {
  private readonly env = inject(ENVIRONMENT_CONFIG);

  log(message: string, ...args: unknown[]): void {
    if (!this.env.production) console.log(message, ...args);
  }
  warn(message: string, ...args: unknown[]): void {
    if (!this.env.production) console.warn(message, ...args);
  }
  error(message: string, ...args: unknown[]): void {
    console.error(message, ...args); // Always log errors
  }
  debug(message: string, ...args: unknown[]): void {
    if (!this.env.production) console.debug(message, ...args);
  }
  info(message: string, ...args: unknown[]): void {
    if (!this.env.production) console.info(message, ...args);
  }
}
