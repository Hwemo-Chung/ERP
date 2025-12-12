import { Component, inject } from '@angular/core';
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
  AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  personCircleOutline,
  logOutOutline,
  notificationsOutline,
  moonOutline,
  informationCircleOutline,
  refreshOutline,
} from 'ionicons/icons';
import { AuthService } from '@core/services/auth.service';
import { SyncQueueService } from '@core/services/sync-queue.service';
import { environment } from '@env/environment';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
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
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Profile</ion-title>
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
            <h2>{{ authService.user()?.name }}</h2>
            <p>{{ authService.user()?.email }}</p>
            <p class="roles">
              @for (role of authService.roles(); track role) {
                <span class="role-badge">{{ role }}</span>
              }
            </p>
          </div>
        </ion-card-content>
      </ion-card>

      <!-- Sync Status -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>Sync Status</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list lines="none">
            <ion-item>
              <ion-icon slot="start" name="refresh-outline"></ion-icon>
              <ion-label>
                <h3>Pending Sync</h3>
                <p>{{ syncQueue.pendingCount() }} operations</p>
              </ion-label>
              @if (syncQueue.pendingCount() > 0) {
                <ion-button
                  fill="outline"
                  size="small"
                  slot="end"
                  (click)="forceSync()"
                  [disabled]="syncQueue.isSyncing()"
                >
                  Sync Now
                </ion-button>
              }
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>

      <!-- Settings -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>Settings</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list lines="full">
            <ion-item>
              <ion-icon slot="start" name="notifications-outline"></ion-icon>
              <ion-label>Push Notifications</ion-label>
              <ion-toggle slot="end" [checked]="true"></ion-toggle>
            </ion-item>
            <ion-item>
              <ion-icon slot="start" name="moon-outline"></ion-icon>
              <ion-label>Dark Mode</ion-label>
              <ion-toggle slot="end" (ionChange)="toggleDarkMode($event)"></ion-toggle>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>

      <!-- App Info -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>About</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list lines="none">
            <ion-item>
              <ion-icon slot="start" name="information-circle-outline"></ion-icon>
              <ion-label>
                <h3>Version</h3>
                <p>{{ version }}</p>
              </ion-label>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>

      <!-- Logout Button -->
      <ion-button
        expand="block"
        color="danger"
        fill="outline"
        (click)="confirmLogout()"
      >
        <ion-icon slot="start" name="log-out-outline"></ion-icon>
        Logout
      </ion-button>
    </ion-content>
  `,
  styles: [`
    .user-card {
      display: flex;
      align-items: center;
      gap: 16px;

      ion-avatar {
        width: 64px;
        height: 64px;

        ion-icon {
          width: 100%;
          height: 100%;
          color: var(--ion-color-primary);
        }
      }

      .user-info {
        h2 {
          margin: 0 0 4px 0;
          font-size: 18px;
          font-weight: 600;
        }

        p {
          margin: 0;
          font-size: 14px;
          color: var(--ion-color-medium);
        }

        .roles {
          margin-top: 8px;
        }

        .role-badge {
          display: inline-block;
          padding: 2px 8px;
          margin-right: 4px;
          background: var(--ion-color-primary-tint);
          color: var(--ion-color-primary);
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
        }
      }
    }

    ion-button[expand="block"] {
      margin-top: 24px;
    }
  `],
})
export class ProfilePage {
  protected readonly authService = inject(AuthService);
  protected readonly syncQueue = inject(SyncQueueService);
  private readonly alertCtrl = inject(AlertController);

  protected readonly version = environment.appVersion;

  constructor() {
    addIcons({
      personCircleOutline,
      logOutOutline,
      notificationsOutline,
      moonOutline,
      informationCircleOutline,
      refreshOutline,
    });
  }

  protected async forceSync(): Promise<void> {
    await this.syncQueue.processQueue();
  }

  protected toggleDarkMode(event: CustomEvent): void {
    document.body.classList.toggle('dark', event.detail.checked);
  }

  protected async confirmLogout(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Logout',
      message: 'Are you sure you want to logout?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Logout',
          handler: () => this.authService.logout(),
        },
      ],
    });

    await alert.present();
  }
}
