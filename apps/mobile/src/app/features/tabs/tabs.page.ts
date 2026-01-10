import { Component, inject } from '@angular/core';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  listOutline,
  gridOutline,
  personOutline,
  clipboardOutline,
  checkmarkDoneOutline,
  statsChartOutline,
  settingsOutline,
} from 'ionicons/icons';
import { SyncQueueService } from '@core/services/sync-queue.service';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="assignment">
          <ion-icon name="clipboard-outline"></ion-icon>
          <ion-label>배정</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="completion">
          <ion-icon name="checkmark-done-outline"></ion-icon>
          <ion-label>완료</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="dashboard">
          <ion-icon name="grid-outline"></ion-icon>
          <ion-label>대시보드</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="reports">
          <ion-icon name="stats-chart-outline"></ion-icon>
          <ion-label>리포트</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="settings">
          <ion-icon name="settings-outline"></ion-icon>
          <ion-label>설정</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
  styles: [
    `
      /* ============================================
     * FLOATING TAB BAR - Premium Navigation
     * Industrial-Luxury aesthetic for Logistics ERP
     * ============================================ */

      :host {
        --tab-bar-height: 64px;
        --tab-bar-margin: var(--space-3);
        --tab-bar-radius: var(--radius-2xl);
        --tab-icon-size: 22px;
        --tab-label-size: var(--font-size-2xs);
        --tab-active-color: var(--ion-color-primary);
        --tab-inactive-color: var(--text-tertiary);
        --tab-indicator-height: 3px;
        --tab-transition-duration: var(--transition-normal);
        --tab-transition-timing: var(--ease-out);

        /* Glassmorphism tokens */
        --glass-bg-light: rgba(255, 255, 255, 0.85);
        --glass-bg-dark: rgba(30, 41, 59, 0.9);
        --glass-blur: 20px;
        --glass-border-light: rgba(255, 255, 255, 0.3);
        --glass-border-dark: rgba(255, 255, 255, 0.08);
      }

      /* ============================================
     * TAB BAR CONTAINER - Floating Effect
     * ============================================ */
      ion-tab-bar {
        position: relative;
        height: var(--tab-bar-height);
        margin: 0 var(--tab-bar-margin) var(--tab-bar-margin);
        padding-bottom: 0;
        border-radius: var(--tab-bar-radius);
        border: 1px solid var(--glass-border-light);

        /* Glassmorphism effect */
        --background: var(--glass-bg-light);
        backdrop-filter: blur(var(--glass-blur));
        -webkit-backdrop-filter: blur(var(--glass-blur));

        /* Elevated floating shadow */
        box-shadow:
          0 4px 24px -4px rgba(0, 0, 0, 0.12),
          0 8px 16px -8px rgba(0, 0, 0, 0.08),
          inset 0 1px 0 0 rgba(255, 255, 255, 0.5);

        /* Remove default Ionic styling */
        --border: none;
        contain: layout style;

        /* Safe area handling for iOS */
        padding-bottom: env(safe-area-inset-bottom, 0);
      }

      /* ============================================
     * TAB BUTTON - Individual Tab Styling
     * ============================================ */
      ion-tab-button {
        --color: var(--tab-inactive-color);
        --color-selected: var(--tab-active-color);
        --padding-top: var(--space-2);
        --padding-bottom: var(--space-1-5);
        --background: transparent;
        --background-focused: transparent;
        --ripple-color: transparent;

        position: relative;
        flex: 1;
        max-width: 100px;
        min-height: 100%;
        transition:
          transform var(--tab-transition-duration) var(--tab-transition-timing),
          opacity var(--tab-transition-duration) var(--tab-transition-timing);

        /* Subtle opacity for inactive state */
        opacity: 0.7;
      }

      /* Active tab button */
      ion-tab-button.tab-selected {
        opacity: 1;
      }

      /* Press/tap animation */
      ion-tab-button:active {
        transform: scale(0.92);
        transition-duration: 50ms;
      }

      /* ============================================
     * ACTIVE INDICATOR - Bottom Bar Animation
     * ============================================ */
      ion-tab-button::after {
        content: '';
        position: absolute;
        bottom: var(--space-2);
        left: 50%;
        width: 0;
        height: var(--tab-indicator-height);
        background: linear-gradient(
          90deg,
          var(--ion-color-primary-tint),
          var(--ion-color-primary),
          var(--ion-color-primary-shade)
        );
        border-radius: var(--radius-full);
        transform: translateX(-50%);
        transition:
          width var(--transition-slow) var(--ease-bounce),
          opacity var(--tab-transition-duration) var(--tab-transition-timing);
        opacity: 0;
        box-shadow: 0 0 8px var(--ion-color-primary-tint);
      }

      ion-tab-button.tab-selected::after {
        width: 20px;
        opacity: 1;
      }

      /* ============================================
     * ICON STYLING - Elevated Active State
     * ============================================ */
      ion-tab-button ion-icon {
        font-size: var(--tab-icon-size);
        margin-bottom: var(--space-0-5);
        transition:
          transform var(--transition-slow) var(--ease-bounce),
          color var(--tab-transition-duration) var(--tab-transition-timing);
      }

      ion-tab-button.tab-selected ion-icon {
        transform: translateY(-2px) scale(1.1);
        color: var(--tab-active-color);
      }

      /* Icon subtle glow on active */
      ion-tab-button.tab-selected ion-icon::after {
        content: '';
        position: absolute;
        width: 100%;
        height: 100%;
        background: radial-gradient(
          circle,
          rgba(var(--ion-color-primary-rgb), 0.15) 0%,
          transparent 70%
        );
        filter: blur(8px);
        z-index: -1;
      }

      /* ============================================
     * LABEL STYLING - Typography Enhancement
     * ============================================ */
      ion-tab-button ion-label {
        font-size: var(--tab-label-size);
        font-weight: var(--font-weight-medium);
        letter-spacing: var(--letter-spacing-wide);
        text-transform: none;
        margin-top: 0;
        transition:
          transform var(--transition-slow) var(--ease-bounce),
          color var(--tab-transition-duration) var(--tab-transition-timing),
          font-weight var(--tab-transition-duration) var(--tab-transition-timing);
      }

      ion-tab-button.tab-selected ion-label {
        font-weight: var(--font-weight-semibold);
        color: var(--tab-active-color);
        transform: translateY(-1px);
      }

      /* ============================================
     * BADGE STYLING - Notification Indicator
     * ============================================ */
      ion-badge {
        position: absolute;
        top: var(--space-1);
        right: 50%;
        transform: translateX(calc(50% + 10px));
        min-width: 18px;
        height: 18px;
        padding: 0 var(--space-1);
        font-size: 10px;
        font-weight: var(--font-weight-bold);
        line-height: 18px;
        text-align: center;
        border-radius: var(--radius-full);
        background: linear-gradient(135deg, var(--ion-color-danger-tint), var(--ion-color-danger));
        color: var(--ion-color-danger-contrast);
        box-shadow:
          0 2px 8px rgba(var(--ion-color-danger-rgb), 0.4),
          inset 0 1px 0 rgba(255, 255, 255, 0.2);
        border: 2px solid var(--glass-bg-light);

        /* Pulse animation for attention */
        animation: badge-pulse 2s ease-in-out infinite;
      }

      @keyframes badge-pulse {
        0%,
        100% {
          transform: translateX(calc(50% + 10px)) scale(1);
        }
        50% {
          transform: translateX(calc(50% + 10px)) scale(1.05);
        }
      }

      /* Badge with larger numbers */
      ion-badge[data-count]::after {
        content: attr(data-count);
      }

      /* ============================================
     * DARK MODE SUPPORT
     * ============================================ */
      @media (prefers-color-scheme: dark) {
        :host {
          --tab-inactive-color: var(--text-tertiary);
          --tab-active-color: var(--ion-color-primary-tint);
        }

        ion-tab-bar {
          --background: var(--glass-bg-dark);
          border-color: var(--glass-border-dark);
          box-shadow:
            0 4px 32px -4px rgba(0, 0, 0, 0.5),
            0 8px 24px -8px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 0 rgba(255, 255, 255, 0.06);
        }

        ion-badge {
          border-color: var(--glass-bg-dark);
        }

        /* Enhanced glow in dark mode */
        ion-tab-button::after {
          box-shadow: 0 0 12px var(--ion-color-primary);
        }
      }

      /* Manual dark mode class support */
      :host-context(.dark),
      :host-context(.ion-palette-dark) {
        --tab-inactive-color: var(--text-tertiary);
        --tab-active-color: var(--ion-color-primary-tint);
      }

      :host-context(.dark) ion-tab-bar,
      :host-context(.ion-palette-dark) ion-tab-bar {
        --background: var(--glass-bg-dark);
        border-color: var(--glass-border-dark);
        box-shadow:
          0 4px 32px -4px rgba(0, 0, 0, 0.5),
          0 8px 24px -8px rgba(0, 0, 0, 0.4),
          inset 0 1px 0 0 rgba(255, 255, 255, 0.06);
      }

      :host-context(.dark) ion-badge,
      :host-context(.ion-palette-dark) ion-badge {
        border-color: var(--glass-bg-dark);
      }

      /* ============================================
     * REDUCED MOTION SUPPORT
     * Accessibility for users who prefer less motion
     * ============================================ */
      @media (prefers-reduced-motion: reduce) {
        ion-tab-button,
        ion-tab-button ion-icon,
        ion-tab-button ion-label,
        ion-tab-button::after,
        ion-badge {
          animation: none;
          transition: none;
        }

        ion-tab-button:active {
          transform: none;
        }

        ion-tab-button.tab-selected ion-icon {
          transform: none;
        }

        ion-tab-button.tab-selected ion-label {
          transform: none;
        }
      }

      /* ============================================
     * IOS SPECIFIC ADJUSTMENTS
     * ============================================ */
      :host-context(.ios) ion-tab-bar {
        /* Extra bottom padding for iOS home indicator */
        margin-bottom: calc(var(--tab-bar-margin) + env(safe-area-inset-bottom, 0));
      }

      /* ============================================
     * LANDSCAPE MODE OPTIMIZATION
     * ============================================ */
      @media (orientation: landscape) and (max-height: 500px) {
        :host {
          --tab-bar-height: 52px;
          --tab-icon-size: 20px;
        }

        ion-tab-button ion-label {
          display: none;
        }

        ion-tab-button::after {
          bottom: var(--space-1-5);
        }
      }

      /* ============================================
     * HOVER STATES (for web/tablet with pointer)
     * ============================================ */
      @media (hover: hover) and (pointer: fine) {
        ion-tab-button:not(.tab-selected):hover {
          opacity: 0.9;
        }

        ion-tab-button:not(.tab-selected):hover ion-icon {
          transform: translateY(-1px);
        }
      }
    `,
  ],
})
export class TabsPage {
  protected readonly syncQueue = inject(SyncQueueService);

  constructor() {
    addIcons({
      listOutline,
      gridOutline,
      personOutline,
      clipboardOutline,
      checkmarkDoneOutline,
      statsChartOutline,
      settingsOutline,
    });
  }
}
