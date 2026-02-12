/**
 * App Initialization Service
 * Bootstraps all core services in proper order:
 * 1. Translation (i18n)
 * 2. Auth (restore session)
 * 3. Network listener
 * 4. Background sync
 * 5. Service Worker updates
 */

import { Injectable, inject } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { ToastController } from '@ionic/angular/standalone';
import { AuthService } from './auth.service';
import { NetworkService } from './network.service';
import { BackgroundSyncService } from './background-sync.service';
import { SyncQueueService } from './sync-queue.service';
import { TranslationService } from './translation.service';
import { LoggerService } from './logger.service';

@Injectable({ providedIn: 'root' })
export class AppInitService {
  private readonly translation = inject(TranslationService);
  private readonly auth = inject(AuthService);
  private readonly network = inject(NetworkService);
  private readonly sync = inject(BackgroundSyncService);
  private readonly syncQueue = inject(SyncQueueService);
  private readonly swUpdate = inject(SwUpdate);
  private readonly toastCtrl = inject(ToastController);
  private readonly logger = inject(LoggerService);

  /**
   * Initialize app - call from AppComponent.ngOnInit()
   */
  async initialize(): Promise<void> {
    this.logger.log('[App Init] Starting initialization...');

    try {
      // 1. Initialize translation service
      this.logger.log('[App Init] Loading translations...');
      await this.translation.initialize();

      // 2. Restore authentication session
      this.logger.log('[App Init] Restoring auth session...');
      await this.auth.initialize();

      // 3. Initialize network listener
      this.logger.log('[App Init] Initializing network listener...');
      await this.network.initializeNetworkListener();

      // 4. Set up background sync
      this.logger.log('[App Init] Setting up background sync...');
      // BackgroundSyncService is injected and auto-listens via effects

      // 5. Check for pending operations and resume if online
      if (!this.network.isOffline()) {
        this.logger.log('[App Init] Network online, checking pending operations...');
        const pending = await this.sync.getPendingOperations();
        if (pending.length > 0) {
          this.logger.log(`[App Init] Found ${pending.length} pending operations, syncing...`);
          await this.sync.onNetworkOnline();
        }
      }

      // 6. Check for Service Worker updates
      this.logger.log('[App Init] Checking for app updates...');
      this.setupUpdateListener();

      this.logger.log('[App Init] ✓ Initialization complete');
    } catch (error) {
      this.logger.error('[App Init] Initialization failed:', error);
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
    setInterval(
      () => {
        this.swUpdate.checkForUpdate();
      },
      60 * 60 * 1000,
    ); // Every hour

    // Listen for new version available
    this.swUpdate.versionUpdates.subscribe((evt) => {
      if (evt.type === 'VERSION_READY') {
        this.logger.log('[App Init] New version available');
        this.showUpdatePrompt();
      } else if (evt.type === 'VERSION_INSTALLATION_FAILED') {
        this.logger.error('[App Init] Version installation failed:', evt);
      }
    });
  }

  /**
   * Prompt user to update app
   */
  private async showUpdatePrompt(): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: this.translation.instant('APP.UPDATE_AVAILABLE'),
      duration: 0, // Don't auto-dismiss
      position: 'top',
      buttons: [
        {
          text: this.translation.instant('APP.UPDATE_LATER'),
          role: 'cancel',
        },
        {
          text: this.translation.instant('APP.UPDATE_NOW'),
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
