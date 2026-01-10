import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonBadge,
  IonListHeader,
  IonNote,
  IonRippleEffect,
  AlertController,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  walletOutline,
  notificationsOutline,
  personOutline,
  logOutOutline,
  chevronForwardOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-settings-menu',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TranslateModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    IonBadge,
    IonListHeader,
    IonNote,
    IonRippleEffect,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>설정</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <!-- Profile Header Section -->
      <section class="profile-header" routerLink="/tabs/profile">
        <div class="profile-avatar">
          <span class="avatar-text">{{ userInitials() }}</span>
          <div class="avatar-ring"></div>
        </div>
        <div class="profile-info">
          <h2 class="profile-name">{{ user()?.fullName || 'User' }}</h2>
          <p class="profile-role">
            <ion-icon name="shield-checkmark-outline" class="role-icon"></ion-icon>
            {{ primaryRole() }}
          </p>
        </div>
        <ion-icon name="chevron-forward-outline" class="profile-chevron"></ion-icon>
        <ion-ripple-effect></ion-ripple-effect>
      </section>

      <!-- Settings Groups -->
      <div class="settings-container">
        <!-- Account & Business Section -->
        <section class="settings-section">
          <div class="section-header">
            <span class="section-title">계정 및 업무</span>
          </div>

          <ion-list class="settings-list" lines="none">
            <ion-item routerLink="settlement" detail="false" class="settings-item" button>
              <div class="icon-wrapper icon-wallet" slot="start">
                <ion-icon name="wallet-outline"></ion-icon>
              </div>
              <ion-label>
                <h3>정산 관리</h3>
                <p>주간 정산 기간 관리</p>
              </ion-label>
              <ion-icon name="chevron-forward-outline" slot="end" class="item-chevron"></ion-icon>
            </ion-item>

            <ion-item routerLink="notifications" detail="false" class="settings-item" button>
              <div class="icon-wrapper icon-notification" slot="start">
                <ion-icon name="notifications-outline"></ion-icon>
              </div>
              <ion-label>
                <h3>알림 센터</h3>
                <p>푸시 알림 설정 및 이력</p>
              </ion-label>
              @if (notificationCount() > 0) {
                <ion-badge class="notification-badge" slot="end">{{
                  notificationCount()
                }}</ion-badge>
              }
              <ion-icon name="chevron-forward-outline" slot="end" class="item-chevron"></ion-icon>
            </ion-item>
          </ion-list>
        </section>

        <!-- Logout Section -->
        <section class="settings-section logout-section">
          <button class="logout-button ion-activatable" (click)="confirmLogout()">
            <div class="icon-wrapper icon-danger">
              <ion-icon name="log-out-outline"></ion-icon>
            </div>
            <span class="logout-text">로그아웃</span>
            <ion-ripple-effect></ion-ripple-effect>
          </button>
        </section>

        <!-- App Version -->
        <div class="app-version">
          <span>ERP Logistics v1.0.0</span>
        </div>
      </div>
    </ion-content>
  `,
  styles: [
    `
      /* ============================================
     * PROFILE HEADER
     * ============================================ */
      .profile-header {
        position: relative;
        display: flex;
        align-items: center;
        gap: var(--space-4);
        padding: var(--space-6);
        margin: var(--space-4);
        background: var(--background-elevated);
        border-radius: var(--radius-xl);
        box-shadow: var(--shadow-md);
        cursor: pointer;
        overflow: hidden;
        transition:
          transform var(--transition-normal) var(--ease-out),
          box-shadow var(--transition-normal) var(--ease-out);

        &::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(
            90deg,
            var(--ion-color-primary) 0%,
            var(--ion-color-tertiary) 100%
          );
        }

        &:active {
          transform: scale(0.98);
          box-shadow: var(--shadow-sm);
        }
      }

      .profile-avatar {
        position: relative;
        width: 56px;
        height: 56px;
        border-radius: var(--radius-full);
        background: linear-gradient(
          135deg,
          var(--ion-color-primary) 0%,
          var(--ion-color-tertiary) 100%
        );
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .avatar-text {
        color: white;
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-bold);
        letter-spacing: var(--letter-spacing-tight);
        text-transform: uppercase;
      }

      .avatar-ring {
        position: absolute;
        inset: -3px;
        border-radius: var(--radius-full);
        border: 2px solid var(--ion-color-primary);
        opacity: 0.3;
      }

      .profile-info {
        flex: 1;
        min-width: 0;
      }

      .profile-name {
        margin: 0 0 var(--space-1) 0;
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--text-primary);
        line-height: var(--line-height-tight);
      }

      .profile-role {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        margin: 0;
        font-size: var(--font-size-sm);
        color: var(--text-secondary);
      }

      .role-icon {
        font-size: 14px;
        color: var(--ion-color-success);
      }

      .profile-chevron {
        color: var(--text-tertiary);
        font-size: 20px;
        flex-shrink: 0;
      }

      /* ============================================
     * SETTINGS CONTAINER
     * ============================================ */
      .settings-container {
        padding: 0 var(--space-4) var(--space-8);
      }

      /* ============================================
     * SETTINGS SECTION
     * ============================================ */
      .settings-section {
        margin-bottom: var(--space-6);
      }

      .section-header {
        padding: var(--space-2) var(--space-4);
        margin-bottom: var(--space-2);
      }

      .section-title {
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--text-tertiary);
        text-transform: uppercase;
        letter-spacing: var(--letter-spacing-wider);
      }

      /* ============================================
     * SETTINGS LIST
     * ============================================ */
      .settings-list {
        background: var(--background-elevated);
        border-radius: var(--radius-xl);
        box-shadow: var(--shadow-sm);
        overflow: hidden;
        padding: var(--space-2);
      }

      .settings-item {
        --padding-start: var(--space-3);
        --padding-end: var(--space-3);
        --inner-padding-end: 0;
        --background: transparent;
        --background-hover: var(--state-hover);
        --background-activated: var(--state-pressed);
        border-radius: var(--radius-lg);
        margin-bottom: var(--space-1);
        transition: background-color var(--transition-fast) var(--ease-out);

        &:last-child {
          margin-bottom: 0;
        }

        ion-label {
          margin: var(--space-3) 0;

          h3 {
            margin: 0 0 var(--space-0-5) 0;
            font-size: var(--font-size-base);
            font-weight: var(--font-weight-medium);
            color: var(--text-primary);
            line-height: var(--line-height-snug);
          }

          p {
            margin: 0;
            font-size: var(--font-size-sm);
            color: var(--text-secondary);
            line-height: var(--line-height-normal);
          }
        }
      }

      /* ============================================
     * ICON WRAPPERS
     * ============================================ */
      .icon-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: var(--radius-lg);
        margin-right: var(--space-3);
        flex-shrink: 0;

        ion-icon {
          font-size: 22px;
        }
      }

      .icon-wallet {
        background: rgba(var(--ion-color-success-rgb), 0.12);

        ion-icon {
          color: var(--ion-color-success);
        }
      }

      .icon-notification {
        background: rgba(var(--ion-color-warning-rgb), 0.12);

        ion-icon {
          color: var(--ion-color-warning-shade);
        }
      }

      .icon-danger {
        background: rgba(var(--ion-color-danger-rgb), 0.12);

        ion-icon {
          color: var(--ion-color-danger);
        }
      }

      .item-chevron {
        color: var(--text-placeholder);
        font-size: 18px;
        margin-left: var(--space-2);
      }

      /* ============================================
     * NOTIFICATION BADGE
     * ============================================ */
      .notification-badge {
        --background: var(--ion-color-danger);
        --color: white;
        --padding-start: var(--space-2);
        --padding-end: var(--space-2);
        min-width: 22px;
        height: 22px;
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-bold);
        border-radius: var(--radius-full);
        margin-right: var(--space-1);
        animation: badge-pulse 2s ease-in-out infinite;
      }

      @keyframes badge-pulse {
        0%,
        100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.05);
        }
      }

      /* ============================================
     * LOGOUT SECTION
     * ============================================ */
      .logout-section {
        margin-top: var(--space-8);
      }

      .logout-button {
        position: relative;
        display: flex;
        align-items: center;
        width: 100%;
        padding: var(--space-4);
        background: var(--background-elevated);
        border: 1px solid rgba(var(--ion-color-danger-rgb), 0.2);
        border-radius: var(--radius-xl);
        box-shadow: var(--shadow-sm);
        cursor: pointer;
        overflow: hidden;
        transition: all var(--transition-normal) var(--ease-out);

        &:active {
          transform: scale(0.98);
          background: rgba(var(--ion-color-danger-rgb), 0.04);
        }

        &:hover {
          border-color: rgba(var(--ion-color-danger-rgb), 0.4);
          box-shadow: var(--shadow-danger);
        }
      }

      .logout-text {
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-medium);
        color: var(--ion-color-danger);
      }

      /* ============================================
     * APP VERSION
     * ============================================ */
      .app-version {
        display: flex;
        justify-content: center;
        padding: var(--space-8) 0 var(--space-4);

        span {
          font-size: var(--font-size-xs);
          color: var(--text-placeholder);
          letter-spacing: var(--letter-spacing-wide);
        }
      }

      /* ============================================
     * DARK MODE ADJUSTMENTS
     * ============================================ */
      @media (prefers-color-scheme: dark) {
        .profile-header {
          background: var(--background-secondary);
          box-shadow: var(--shadow-lg);
        }

        .settings-list {
          background: var(--background-secondary);
          box-shadow: var(--shadow-md);
        }

        .logout-button {
          background: var(--background-secondary);
          border-color: rgba(var(--ion-color-danger-rgb), 0.3);
        }

        .icon-wallet {
          background: rgba(var(--ion-color-success-rgb), 0.15);
        }

        .icon-notification {
          background: rgba(var(--ion-color-warning-rgb), 0.15);
        }

        .icon-danger {
          background: rgba(var(--ion-color-danger-rgb), 0.15);
        }
      }

      /* ============================================
     * REDUCED MOTION
     * ============================================ */
      @media (prefers-reduced-motion: reduce) {
        .profile-header,
        .logout-button,
        .settings-item {
          transition: none;
        }

        .notification-badge {
          animation: none;
        }
      }
    `,
  ],
})
export class SettingsMenuPage {
  private authService = inject(AuthService);
  private alertController = inject(AlertController);
  private router = inject(Router);
  private translate = inject(TranslateService);

  readonly user = this.authService.user;

  readonly userInitials = computed(() => {
    const fullName = this.user()?.fullName;
    if (!fullName) return 'U';

    const names = fullName.trim().split(/\s+/);
    if (names.length >= 2) {
      return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
  });

  readonly primaryRole = computed(() => {
    const roles = this.user()?.roles || [];
    if (roles.length === 0) return 'User';

    const roleDisplayMap: Record<string, string> = {
      HQ_ADMIN: 'HQ Administrator',
      HQ_MANAGER: 'HQ Manager',
      BRANCH_MANAGER: 'Branch Manager',
      DRIVER: 'Driver',
      INSTALLER: 'Installer',
    };

    const priorityOrder = ['HQ_ADMIN', 'HQ_MANAGER', 'BRANCH_MANAGER', 'DRIVER', 'INSTALLER'];

    for (const role of priorityOrder) {
      if (roles.includes(role)) {
        return roleDisplayMap[role] || role;
      }
    }

    return roleDisplayMap[roles[0]] || roles[0];
  });

  readonly notificationCount = computed(() => 3);

  constructor() {
    addIcons({
      walletOutline,
      notificationsOutline,
      personOutline,
      logOutOutline,
      chevronForwardOutline,
      shieldCheckmarkOutline,
    });
  }

  async confirmLogout() {
    const title = await this.translate.get('PROFILE.LOGOUT.CONFIRM_TITLE').toPromise();
    const message = await this.translate.get('PROFILE.LOGOUT.CONFIRM_MESSAGE').toPromise();
    const cancelBtn = await this.translate.get('COMMON.BUTTONS.CANCEL').toPromise();
    const logoutBtn = await this.translate.get('PROFILE.LOGOUT.BUTTON').toPromise();

    const alert = await this.alertController.create({
      header: title,
      message: message,
      buttons: [
        {
          text: cancelBtn,
          role: 'cancel',
        },
        {
          text: logoutBtn,
          role: 'destructive',
          handler: () => {
            this.logout();
          },
        },
      ],
    });
    await alert.present();
  }

  private logout() {
    this.authService.logout();
    this.router.navigate(['/auth/login'], { replaceUrl: true });
  }
}
