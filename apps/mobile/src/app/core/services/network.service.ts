import { Injectable, inject, signal } from '@angular/core';
import { Network } from '@capacitor/network';
import { LoggerService } from './logger.service';

@Injectable({
  providedIn: 'root',
})
export class NetworkService {
  private readonly _isOffline = signal(false);
  private readonly logger = inject(LoggerService);
  readonly isOffline = this._isOffline.asReadonly();

  async initializeNetworkListener(): Promise<void> {
    // Get current status
    const status = await Network.getStatus();
    this._isOffline.set(!status.connected);

    // Listen for changes
    Network.addListener('networkStatusChange', (status) => {
      this._isOffline.set(!status.connected);
      this.logger.log(`Network status changed: ${status.connected ? 'online' : 'offline'}`);
    });
  }

  async checkConnection(): Promise<boolean> {
    const status = await Network.getStatus();
    return status.connected;
  }
}
