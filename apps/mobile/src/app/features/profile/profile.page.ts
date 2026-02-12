/**
 * Profile Page
 * Displays user information, sync status, notification preferences, and app settings
 * Per SDD section 7.2 RBAC and PRD user requirements
 *
 * Features:
 * - User info display with role badges
 * - Notification category preferences
 * - Language selector (ko, en)
 * - Sync status monitoring
 * - Dark mode toggle
 * - Logout with pending operations warning
 */

import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonAvatar,
  IonToggle,
  IonBadge,
  IonNote,
  IonSelect,
  IonSelectOption,
  AlertController,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  personCircleOutline,
  logOutOutline,
  notificationsOutline,
  moonOutline,
  informationCircleOutline,
  refreshOutline,
  cloudDoneOutline,
  cloudOfflineOutline,
  warningOutline,
  shieldCheckmarkOutline,
  businessOutline,
  alertCircleOutline,
  languageOutline,
} from 'ionicons/icons';
import { AuthService } from '@core/services/auth.service';
import { SyncQueueService } from '@core/services/sync-queue.service';
import { NetworkService } from '@core/services/network.service';
import { TranslationService, SupportedLanguage } from '@core/services/translation.service';
import { NotificationsService } from '@core/services/notifications.service';
import { LoggerService } from '@core/services/logger.service';
import { environment } from '@env/environment';
import { getRoleLabel, getRoleColor } from '@shared/constants/roles';
import {
  NotificationCategory,
  NotificationPreferences,
  NOTIFICATION_CATEGORIES,
  getDefaultNotificationPreferences,
  areAllNotificationsEnabled,
  toggleAllNotifications,
} from '@shared/constants/notification-categories';
import { SyncConflictListModal } from '@shared/components/sync-conflict/sync-conflict-list.modal';
import { TranslateModule } from '@ngx-translate/core';

interface SyncStatus {
  labelKey: string;
  color: string;
  icon: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    IonButton,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonAvatar,
    IonToggle,
    IonBadge,
    IonNote,
    IonSelect,
    IonSelectOption,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ t.instant('PROFILE.TITLE') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- User Info Card -->
      <ion-card>
        <ion-card-content class="user-card">
          <ion-avatar>
            <ion-icon name="person-circle-outline"></ion-icon>
          </ion-avatar>
          <div class="user-info">
            <h2>{{ authService.user()?.fullName || t.instant('PROFILE.USER_INFO.USERNAME') }}</h2>
            <p class="username">{{ authService.user()?.username || '-' }}</p>
            <div class="roles">
              @for (role of authService.roles(); track role) {
                <ion-badge [color]="getRoleColor(role)">
                  {{ getRoleLabel(role, t) }}
                </ion-badge>
              }
            </div>
          </div>
        </ion-card-content>
      </ion-card>

      <!-- Branch Info Card -->
      @if (authService.user()?.branchCode) {
        <ion-card>
          <ion-card-header>
            <ion-card-title>
              <ion-icon name="business-outline"></ion-icon>
              {{ t.instant('PROFILE.USER_INFO.BRANCH') }}
            </ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list lines="none">
              <ion-item>
                <ion-label>
                  <h3>{{ t.instant('PROFILE.USER_INFO.BRANCH_CODE') }}</h3>
                  <p>{{ authService.user()?.branchCode }}</p>
                </ion-label>
              </ion-item>
            </ion-list>
          </ion-card-content>
        </ion-card>
      }

      <!-- Conflict Alert Card (if conflicts exist) -->
      @if (syncQueue.conflictCount() > 0) {
        <ion-card class="conflict-card">
          <ion-card-header>
            <ion-card-title>
              <ion-icon name="alert-circle-outline" color="danger"></ion-icon>
              {{ t.instant('PROFILE.SYNC.CONFLICT_TITLE') }}
              <ion-badge color="danger">{{ syncQueue.conflictCount() }}</ion-badge>
            </ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p>{{ t.instant('PROFILE.SYNC.CONFLICT_MESSAGE') }}</p>
            <ion-button expand="block" color="danger" fill="outline" (click)="viewConflicts()">
              {{ t.instant('PROFILE.SYNC.RESOLVE_CONFLICTS') }}
            </ion-button>
          </ion-card-content>
        </ion-card>
      }

      <!-- Sync Status Card -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            <ion-icon [name]="syncStatus().icon"></ion-icon>
            {{ t.instant('PROFILE.SYNC.TITLE') }}
          </ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list lines="none">
            <ion-item>
              <ion-icon
                slot="start"
                [name]="networkService.isOffline() ? 'cloud-offline-outline' : 'cloud-done-outline'"
                [color]="networkService.isOffline() ? 'warning' : 'success'"
              ></ion-icon>
              <ion-label>
                <h3>{{ t.instant('PROFILE.SYNC.NETWORK') }}</h3>
                <p>
                  {{
                    t.instant(
                      networkService.isOffline() ? 'PROFILE.SYNC.OFFLINE' : 'PROFILE.SYNC.ONLINE'
                    )
                  }}
                </p>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-icon
                slot="start"
                [name]="
                  syncQueue.pendingCount() > 0 ? 'warning-outline' : 'shield-checkmark-outline'
                "
                [color]="syncQueue.pendingCount() > 0 ? 'warning' : 'success'"
              ></ion-icon>
              <ion-label>
                <h3>{{ t.instant('PROFILE.SYNC.PENDING_OPERATIONS') }}</h3>
                <p>
                  {{ t.instant('PROFILE.SYNC.PENDING_COUNT', { count: syncQueue.pendingCount() }) }}
                </p>
              </ion-label>
              @if (syncQueue.pendingCount() > 0) {
                <ion-button
                  fill="outline"
                  size="small"
                  slot="end"
                  (click)="forceSync()"
                  [disabled]="syncQueue.isSyncing() || networkService.isOffline()"
                >
                  {{
                    t.instant(
                      syncQueue.isSyncing() ? 'PROFILE.SYNC.SYNCING' : 'PROFILE.SYNC.SYNC_NOW'
                    )
                  }}
                </ion-button>
              }
            </ion-item>
            @if (lastSyncTime()) {
              <ion-item>
                <ion-label>
                  <ion-note>
                    {{ t.instant('PROFILE.SYNC.LAST_SYNC') }}:
                    {{ lastSyncTime() | date: 'MM/dd HH:mm' }}
                  </ion-note>
                </ion-label>
              </ion-item>
            }
          </ion-list>
        </ion-card-content>
      </ion-card>

      <!-- Notification Preferences Card -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            <ion-icon name="notifications-outline"></ion-icon>
            {{ t.instant('PROFILE.NOTIFICATIONS.TITLE') }}
          </ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list lines="full">
            <!-- Enable All Toggle -->
            <ion-item>
              <ion-icon slot="start" name="notifications-outline" color="primary"></ion-icon>
              <ion-label>
                <h3>{{ t.instant('PROFILE.NOTIFICATIONS.ENABLE_ALL') }}</h3>
              </ion-label>
              <ion-toggle
                slot="end"
                [checked]="allNotificationsEnabled()"
                (ionChange)="toggleAllNotifications($event)"
              ></ion-toggle>
            </ion-item>

            <!-- Individual Category Toggles -->
            @for (category of notificationCategories; track category.key) {
              <ion-item>
                <ion-icon slot="start" [name]="category.icon"></ion-icon>
                <ion-label>
                  <h3>{{ t.instant(category.titleKey) }}</h3>
                  <p>{{ t.instant(category.descriptionKey) }}</p>
                </ion-label>
                <ion-toggle
                  slot="end"
                  [checked]="notificationPrefs()[category.key]"
                  (ionChange)="toggleNotificationCategory(category.key, $event)"
                ></ion-toggle>
              </ion-item>
            }
          </ion-list>
        </ion-card-content>
      </ion-card>

      <!-- Settings Card -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ t.instant('PROFILE.SETTINGS.TITLE') }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list lines="full">
            <!-- Language Selector -->
            <ion-item>
              <ion-icon slot="start" name="language-outline"></ion-icon>
              <ion-label>{{ t.instant('PROFILE.SETTINGS.LANGUAGE') }}</ion-label>
              <ion-select
                slot="end"
                [value]="currentLanguage()"
                (ionChange)="changeLanguage($event)"
                interface="action-sheet"
              >
                @for (lang of supportedLanguages(); track lang.code) {
                  <ion-select-option [value]="lang.code">
                    {{ lang.name }}
                  </ion-select-option>
                }
              </ion-select>
            </ion-item>

            <!-- Dark Mode Toggle -->
            <ion-item>
              <ion-icon slot="start" name="moon-outline"></ion-icon>
              <ion-label>{{ t.instant('PROFILE.SETTINGS.DARK_MODE') }}</ion-label>
              <ion-toggle
                slot="end"
                [checked]="darkModeEnabled()"
                (ionChange)="toggleDarkMode($event)"
              ></ion-toggle>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>

      <!-- App Info Card -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ t.instant('PROFILE.APP_INFO.TITLE') }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list lines="none">
            <ion-item>
              <ion-icon slot="start" name="information-circle-outline"></ion-icon>
              <ion-label>
                <h3>{{ t.instant('PROFILE.APP_INFO.VERSION') }}</h3>
                <p>{{ version }}</p>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-label>
                <h3>{{ t.instant('PROFILE.APP_INFO.ENVIRONMENT') }}</h3>
                <p>{{ t.instant(environmentKey) }}</p>
              </ion-label>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>

      <!-- Logout Button -->
      <ion-button expand="block" color="danger" fill="outline" (click)="confirmLogout()">
        <ion-icon slot="start" name="log-out-outline"></ion-icon>
        {{ t.instant('PROFILE.LOGOUT.BUTTON') }}
      </ion-button>
    </ion-content>
  `,
  styles: [
    `
      .user-card {
        display: flex;
        align-items: center;
        gap: 16px;

        ion-avatar {
          width: 72px;
          height: 72px;
          background: var(--ion-color-light);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;

          ion-icon {
            width: 64px;
            height: 64px;
            color: var(--ion-color-primary);
          }
        }

        .user-info {
          flex: 1;

          h2 {
            margin: 0 0 4px 0;
            font-size: 20px;
            font-weight: 600;
          }

          .username {
            margin: 0 0 2px 0;
            font-size: 14px;
            color: var(--ion-color-medium);
          }

          .roles {
            margin-top: 8px;
            display: flex;
            flex-wrap: wrap;
            gap: 4px;

            ion-badge {
              font-size: 11px;
              padding: 4px 8px;
            }
          }
        }
      }

      ion-card-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;

        ion-icon {
          font-size: 20px;
        }
      }

      ion-item {
        --padding-start: 0;
        --inner-padding-end: 0;

        h3 {
          font-size: 14px;
          font-weight: 500;
          margin: 0 0 4px 0;
        }

        p {
          font-size: 13px;
          color: var(--ion-color-medium);
          margin: 0;
        }

        ion-note {
          font-size: 12px;
        }
      }

      ion-button[expand='block'] {
        margin-top: 24px;
        margin-bottom: 24px;
      }

      .conflict-card {
        border-left: 4px solid var(--ion-color-danger);
        background: var(--ion-color-danger-tint);

        p {
          margin: 0 0 12px 0;
          font-size: 14px;
          color: var(--ion-color-danger-shade);
        }
      }
    `,
  ],
})
export class ProfilePage implements OnInit {
  protected readonly authService = inject(AuthService);
  protected readonly syncQueue = inject(SyncQueueService);
  protected readonly networkService = inject(NetworkService);
  protected readonly t = inject(TranslationService);
  private readonly alertCtrl = inject(AlertController);
  private readonly modalCtrl = inject(ModalController);
  private readonly notificationsService = inject(NotificationsService);
  private readonly logger = inject(LoggerService);

  protected readonly version = environment.appVersion;
  protected readonly environmentKey = environment.production
    ? 'PROFILE.APP_INFO.ENV_PRODUCTION'
    : 'PROFILE.APP_INFO.ENV_DEVELOPMENT';

  // Notification categories configuration
  protected readonly notificationCategories = NOTIFICATION_CATEGORIES;

  // Settings state
  protected readonly notificationPrefs = signal<NotificationPreferences>(
    getDefaultNotificationPreferences(),
  );
  protected readonly darkModeEnabled = signal(false);
  protected readonly lastSyncTime = signal<Date | null>(null);
  protected readonly currentLanguage = this.t.currentLanguage;

  // Computed states
  protected readonly allNotificationsEnabled = computed(() =>
    areAllNotificationsEnabled(this.notificationPrefs()),
  );

  protected readonly supportedLanguages = computed(() => this.t.getSupportedLanguages());

  // Re-export helper functions for template use
  protected readonly getRoleLabel = getRoleLabel;
  protected readonly getRoleColor = getRoleColor;

  private readonly STORAGE_KEYS = {
    NOTIFICATIONS: 'erp_notification_prefs',
    DARK_MODE: 'erp_dark_mode',
  };

  constructor() {
    addIcons({
      personCircleOutline,
      logOutOutline,
      notificationsOutline,
      moonOutline,
      informationCircleOutline,
      refreshOutline,
      cloudDoneOutline,
      cloudOfflineOutline,
      warningOutline,
      shieldCheckmarkOutline,
      businessOutline,
      alertCircleOutline,
      languageOutline,
    });
  }

  async ngOnInit(): Promise<void> {
    await this.loadSettings();
  }

  /**
   * Compute sync status for display
   */
  protected syncStatus(): SyncStatus {
    if (this.syncQueue.isSyncing()) {
      return {
        labelKey: 'PROFILE.SYNC.SYNCING',
        color: 'primary',
        icon: 'refresh-outline',
      };
    }
    if (this.syncQueue.pendingCount() > 0) {
      return {
        labelKey: 'PROFILE.SYNC.SYNC_PENDING',
        color: 'warning',
        icon: 'warning-outline',
      };
    }
    return {
      labelKey: 'PROFILE.SYNC.SYNC_COMPLETED',
      color: 'success',
      icon: 'shield-checkmark-outline',
    };
  }

  protected async forceSync(): Promise<void> {
    await this.syncQueue.processQueue();
    this.lastSyncTime.set(new Date());
  }

  /**
   * View and resolve pending conflicts via list modal
   */
  protected async viewConflicts(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: SyncConflictListModal,
    });
    await modal.present();
  }

  /**
   * Toggle all notification categories at once
   */
  protected toggleAllNotifications(event: CustomEvent): void {
    const enabled = event.detail.checked;
    this.notificationPrefs.set(toggleAllNotifications(enabled));
    this.saveNotificationPreferences();
  }

  /**
   * Toggle individual notification category
   */
  protected toggleNotificationCategory(category: NotificationCategory, event: CustomEvent): void {
    const enabled = event.detail.checked;
    this.notificationPrefs.update((prefs) => ({
      ...prefs,
      [category]: enabled,
    }));
    this.saveNotificationPreferences();
  }

  /**
   * Change application language
   */
  protected async changeLanguage(event: CustomEvent): Promise<void> {
    const language = event.detail.value as SupportedLanguage;
    await this.t.setLanguage(language);
  }

  /**
   * Toggle dark mode
   */
  protected toggleDarkMode(event: CustomEvent): void {
    const enabled = event.detail.checked;
    this.darkModeEnabled.set(enabled);
    document.body.classList.toggle('dark', enabled);
    this.saveSettings();
  }

  /**
   * Confirm logout with pending operations warning
   */
  protected async confirmLogout(): Promise<void> {
    const pendingCount = this.syncQueue.pendingCount();
    const messageKey =
      pendingCount > 0 ? 'PROFILE.LOGOUT.PENDING_WARNING' : 'PROFILE.LOGOUT.CONFIRM_MESSAGE';

    const alert = await this.alertCtrl.create({
      header: this.t.instant('PROFILE.LOGOUT.CONFIRM_TITLE'),
      message: this.t.instant(messageKey, { count: pendingCount }),
      buttons: [
        {
          text: this.t.instant('COMMON.CANCEL'),
          role: 'cancel',
        },
        {
          text: this.t.instant('PROFILE.LOGOUT.BUTTON'),
          role: 'destructive',
          handler: () => this.authService.logout(),
        },
      ],
    });

    await alert.present();
  }

  /**
   * Load all settings from localStorage
   */
  private async loadSettings(): Promise<void> {
    // Load dark mode
    const darkMode = localStorage.getItem(this.STORAGE_KEYS.DARK_MODE) === 'true';
    this.darkModeEnabled.set(darkMode);

    // Apply dark mode if enabled
    if (darkMode) {
      document.body.classList.add('dark');
    }

    // Load notification preferences
    const notifPrefsJson = localStorage.getItem(this.STORAGE_KEYS.NOTIFICATIONS);
    if (notifPrefsJson) {
      try {
        const prefs = JSON.parse(notifPrefsJson) as NotificationPreferences;
        this.notificationPrefs.set(prefs);
      } catch (error) {
        this.logger.error('Failed to parse notification preferences:', error);
        this.notificationPrefs.set(getDefaultNotificationPreferences());
      }
    }
  }

  /**
   * Save general settings to localStorage
   */
  private saveSettings(): void {
    localStorage.setItem(this.STORAGE_KEYS.DARK_MODE, String(this.darkModeEnabled()));
  }

  /**
   * Save notification preferences to localStorage and sync with backend
   */
  private async saveNotificationPreferences(): Promise<void> {
    const prefs = this.notificationPrefs();

    // Save to localStorage for offline access
    localStorage.setItem(this.STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(prefs));

    // Sync with backend API if online
    if (!this.networkService.isOffline()) {
      try {
        // Convert notification preferences to API format
        const apiSettings = {
          reassign: prefs.ORDER_ASSIGNED,
          delay: prefs.STATUS_CHANGED,
          customer: prefs.ORDER_COMPLETED,
          pushEnabled: true, // Always enabled if any category is enabled
        };

        await this.notificationsService.updateSettings(apiSettings);
      } catch (error) {
        this.logger.error('[Profile] Failed to sync notification preferences:', error);
        // Preferences are saved locally, will sync on next attempt
      }
    }

    // Update push notification subscription via Capacitor (if available)
    this.updatePushSubscription(prefs);
  }

  /**
   * Update push notification subscription based on preferences
   */
  private async updatePushSubscription(prefs: NotificationPreferences): Promise<void> {
    try {
      // Dynamic import to avoid SSR issues
      const { PushNotifications } = await import('@capacitor/push-notifications');

      // Check if any notification is enabled
      const anyEnabled = Object.values(prefs).some((v) => v === true);

      if (anyEnabled) {
        // Request permission and register for push if not already done
        const permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive !== 'granted') {
          const result = await PushNotifications.requestPermissions();
          if (result.receive === 'granted') {
            await PushNotifications.register();
          }
        }
      }
      // Note: Unregistering push notifications when all are disabled
      // is typically not needed as the server-side filtering handles this
    } catch (error) {
      // Push notifications not available (web or permission denied)
      this.logger.debug('[Profile] Push notifications not available:', error);
    }
  }
}
