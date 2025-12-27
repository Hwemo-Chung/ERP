import { Injectable, signal } from '@angular/core';
import { Network, ConnectionStatus } from '@capacitor/network';

@Injectable({
  providedIn: 'root',
})
export class NetworkService {
  private readonly _isOffline = signal(false);
  readonly isOffline = this._isOffline.asReadonly();

  async initializeNetworkListener(): Promise<void> {
    // Get current status
    const status = await Network.getStatus();
    this._isOffline.set(!status.connected);

    // Listen for changes
    Network.addListener('networkStatusChange', (status: ConnectionStatus) => {
      this._isOffline.set(!status.connected);
      console.log(`Network status changed: ${status.connected ? 'online' : 'offline'}`);
    });
  }

  async checkConnection(): Promise<boolean> {
    const status = await Network.getStatus();
    return status.connected;
  }
}
