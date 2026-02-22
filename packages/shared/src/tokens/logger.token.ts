import { InjectionToken } from '@angular/core';

export interface LoggerServiceInterface {
  log(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
}

export const LOGGER_SERVICE_TOKEN = new InjectionToken<LoggerServiceInterface>(
  'LOGGER_SERVICE_TOKEN',
);
