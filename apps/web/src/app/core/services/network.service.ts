import { Injectable, inject, signal } from '@angular/core';
import { Network, ConnectionStatus } from '@capacitor/network';
import { Subject } from 'rxjs';
import { LoggerService } from './logger.service';

@Injectable({
  providedIn: 'root',
})
export class NetworkService {
  private readonly _isOffline = signal(false);
  readonly isOffline = this._isOffline.asReadonly();

  private readonly _onOnline$ = new Subject<void>();
  readonly onOnline$ = this._onOnline$.asObservable();

  private readonly logger = inject(LoggerService);

  async initializeNetworkListener(): Promise<void> {
    // Get current status
    const status = await Network.getStatus();
    this._isOffline.set(!status.connected);

    // Listen for changes
    Network.addListener('networkStatusChange', (status: ConnectionStatus) => {
      const wasOffline = this._isOffline();
      this._isOffline.set(!status.connected);
      this.logger.log(`Network status changed: ${status.connected ? 'online' : 'offline'}`);

      // Emit onOnline$ when transitioning from offline to online
      if (wasOffline && status.connected) {
        this._onOnline$.next();
      }
    });
  }

  async checkConnection(): Promise<boolean> {
    const status = await Network.getStatus();
    return status.connected;
  }
}
