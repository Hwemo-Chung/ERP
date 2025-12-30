/**
 * App Initialization Service
 * Bootstraps all core services in proper order:
 * 1. Auth (restore session)
 * 2. Network listener
 * 3. Background sync
 * 4. Service Worker updates
 */

import { Injectable, inject } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { ToastController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from './auth.service';
import { NetworkService } from './network.service';
import { BackgroundSyncService } from './background-sync.service';
import { SyncQueueService } from './sync-queue.service';

@Injectable({ providedIn: 'root' })
export class AppInitService {
  private readonly auth = inject(AuthService);
  private readonly network = inject(NetworkService);
  private readonly sync = inject(BackgroundSyncService);
  private readonly syncQueue = inject(SyncQueueService);
  private readonly swUpdate = inject(SwUpdate);
  private readonly toastCtrl = inject(ToastController);
  private readonly translate = inject(TranslateService);

  /**
   * Initialize app - call from AppComponent.ngOnInit()
   */
  async initialize(): Promise<void> {
    console.log('[App Init] Starting initialization...');

    try {
      // 1. Restore authentication session
      console.log('[App Init] Restoring auth session...');
      await this.auth.initialize();

      // 2. Initialize network listener
      console.log('[App Init] Initializing network listener...');
      await this.network.initializeNetworkListener();

      // 3. Set up background sync
      console.log('[App Init] Setting up background sync...');
      // BackgroundSyncService is injected and auto-listens via effects

      // 4. Check for pending operations and resume if online
      if (!this.network.isOffline()) {
        console.log('[App Init] Network online, checking pending operations...');
        const pending = await this.sync.getPendingOperations();
        if (pending.length > 0) {
          console.log(`[App Init] Found ${pending.length} pending operations, syncing...`);
          await this.sync.onNetworkOnline();
        }
      }

      // 5. Check for Service Worker updates
      console.log('[App Init] Checking for app updates...');
      this.setupUpdateListener();

      console.log('[App Init] ✓ Initialization complete');
    } catch (error) {
      console.error('[App Init] Initialization failed:', error);
      // Don't throw - app should still work even if init partially fails
    }
  }

  /**
   * Set up Service Worker update listener
   */
  private setupUpdateListener(): void {
    if (!this.swUpdate.isEnabled) {
      return;
    }

    // Check for updates periodically
    setInterval(() => {
      this.swUpdate.checkForUpdate();
    }, 60 * 60 * 1000); // Every hour

    // Listen for new version available
    this.swUpdate.versionUpdates.subscribe((evt: any) => {
      if (evt.type === 'VERSION_READY') {
        console.log('[App Init] New version available');
        this.showUpdatePrompt();
      } else if (evt.type === 'VERSION_INSTALLATION_FAILED') {
        console.error('[App Init] Version installation failed:', evt);
      }
    });
  }

  /**
   * Prompt user to update app
   */
  private async showUpdatePrompt(): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: this.translate.instant('APP.UPDATE_AVAILABLE'),
      duration: 0, // Don't auto-dismiss
      position: 'top',
      buttons: [
        {
          text: this.translate.instant('APP.UPDATE_LATER'),
          role: 'cancel',
        },
        {
          text: this.translate.instant('APP.UPDATE_NOW'),
          handler: () => {
            this.swUpdate.activateUpdate().then(() => {
              window.location.reload();
            });
          },
        },
      ],
    });

    await toast.present();
  }
}
