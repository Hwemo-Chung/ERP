import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  statsChartOutline,
  peopleOutline,
  trashOutline,
  downloadOutline,
  returnDownBackOutline,
  chevronForward,
} from 'ionicons/icons';
import { TranslateModule } from '@ngx-translate/core';

interface ReportMenuItem {
  id: string;
  route: string;
  icon: string;
  titleKey: string;
  descKey: string;
  colorClass: string;
}

@Component({
  selector: 'app-reports-menu',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonIcon,
    TranslateModule,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>{{ 'REPORTS.TITLE' | translate }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="reports-container">
        <!-- Page Header -->
        <header class="page-header">
          <h1 class="page-title">{{ 'REPORTS.TITLE' | translate }}</h1>
          <p class="page-subtitle">{{ 'REPORTS.SUBTITLE' | translate }}</p>
        </header>

        <!-- Report Cards Grid -->
        <nav class="reports-grid" role="navigation" aria-label="Reports navigation">
          @for (item of menuItems; track item.id; let i = $index) {
            <a
              [routerLink]="item.route"
              class="report-card"
              [class]="item.colorClass"
              [style.animation-delay]="i * 60 + 'ms'"
            >
              <div class="card-content">
                <div class="icon-container">
                  <ion-icon [name]="item.icon" aria-hidden="true"></ion-icon>
                </div>
                <div class="text-content">
                  <h3 class="card-title">{{ item.titleKey | translate }}</h3>
                  <p class="card-description">{{ item.descKey | translate }}</p>
                </div>
              </div>
              <div class="card-arrow">
                <ion-icon name="chevron-forward" aria-hidden="true"></ion-icon>
              </div>
            </a>
          }
        </nav>
      </div>
    </ion-content>
  `,
  styles: [
    `
      /* ============================================
       * CSS Custom Properties - Report Colors
       * ============================================ */
      :host {
        /* Blue - Progress Dashboard */
        --report-blue: #2563eb;
        --report-blue-light: #dbeafe;
        --report-blue-dark: #1e40af;

        /* Purple - Customer History */
        --report-purple: #7c3aed;
        --report-purple-light: #ede9fe;
        --report-purple-dark: #5b21b6;

        /* Green - Waste Summary */
        --report-green: #059669;
        --report-green-light: #d1fae5;
        --report-green-dark: #047857;

        /* Orange - Unreturned Items */
        --report-orange: #ea580c;
        --report-orange-light: #ffedd5;
        --report-orange-dark: #c2410c;

        /* Teal - Export */
        --report-teal: #0891b2;
        --report-teal-light: #cffafe;
        --report-teal-dark: #0e7490;

        display: block;
        --background: var(--background-secondary);
      }

      ion-header {
        ion-toolbar {
          --background: transparent;
          --border-width: 0;
        }

        ion-title {
          font-size: var(--font-size-lg);
          font-weight: var(--font-weight-semibold);
          letter-spacing: var(--letter-spacing-tight);
        }
      }

      ion-content {
        --background: var(--background-secondary);
      }

      /* ============================================
       * Container
       * ============================================ */
      .reports-container {
        padding: var(--space-4);
        padding-bottom: calc(var(--space-8) + var(--ion-safe-area-bottom, 0px));
        max-width: 800px;
        margin: 0 auto;
      }

      /* ============================================
       * Page Header
       * ============================================ */
      .page-header {
        margin-bottom: var(--space-6);
        padding: var(--space-2) var(--space-1);
      }

      .page-title {
        font-family: var(--font-family-heading);
        font-size: var(--font-size-2xl);
        font-weight: var(--font-weight-bold);
        color: var(--text-primary);
        margin: 0 0 var(--space-1) 0;
        letter-spacing: var(--letter-spacing-tight);
        line-height: var(--line-height-tight);
      }

      .page-subtitle {
        font-size: var(--font-size-sm);
        color: var(--text-secondary);
        margin: 0;
        line-height: var(--line-height-normal);
      }

      /* ============================================
       * Reports Grid
       * ============================================ */
      .reports-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: var(--space-3);
      }

      /* Tablet and up: 2 columns */
      @media (min-width: 600px) {
        .reports-grid {
          grid-template-columns: repeat(2, 1fr);
          gap: var(--space-4);
        }
      }

      /* ============================================
       * Report Card
       * ============================================ */
      .report-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: var(--background-elevated);
        border-radius: var(--radius-xl);
        padding: var(--space-4);
        text-decoration: none;
        box-shadow: var(--shadow-sm);
        border: 1px solid var(--border-subtle);
        transition:
          transform var(--transition-normal) var(--ease-out),
          box-shadow var(--transition-normal) var(--ease-out),
          border-color var(--transition-normal) var(--ease-out);

        /* Entrance animation */
        animation: slideUp 0.4s var(--ease-out) backwards;

        &:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
          border-color: var(--border-default);
        }

        &:active {
          transform: translateY(0) scale(0.98);
          box-shadow: var(--shadow-xs);
        }
      }

      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(16px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .card-content {
        display: flex;
        align-items: center;
        gap: var(--space-4);
        flex: 1;
        min-width: 0;
      }

      /* ============================================
       * Icon Container with Colored Background
       * ============================================ */
      .icon-container {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        border-radius: var(--radius-lg);
        flex-shrink: 0;
        transition: transform var(--transition-normal) var(--ease-bounce);

        ion-icon {
          font-size: 24px;
        }
      }

      .report-card:hover .icon-container {
        transform: scale(1.05);
      }

      /* ============================================
       * Text Content
       * ============================================ */
      .text-content {
        flex: 1;
        min-width: 0;
      }

      .card-title {
        font-family: var(--font-family-heading);
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-semibold);
        color: var(--text-primary);
        margin: 0 0 var(--space-0-5) 0;
        line-height: var(--line-height-tight);
        letter-spacing: var(--letter-spacing-tight);
      }

      .card-description {
        font-size: var(--font-size-xs);
        color: var(--text-tertiary);
        margin: 0;
        line-height: var(--line-height-normal);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      /* ============================================
       * Card Arrow
       * ============================================ */
      .card-arrow {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        color: var(--text-placeholder);
        transition:
          color var(--transition-normal) var(--ease-out),
          transform var(--transition-normal) var(--ease-out);
        flex-shrink: 0;

        ion-icon {
          font-size: 18px;
        }
      }

      .report-card:hover .card-arrow {
        color: var(--text-secondary);
        transform: translateX(4px);
      }

      /* ============================================
       * Color Variants
       * ============================================ */

      /* Blue - Progress Dashboard */
      .color-blue .icon-container {
        background: var(--report-blue-light);
        color: var(--report-blue);
      }

      .color-blue:hover {
        border-color: var(--report-blue-light);
      }

      /* Purple - Customer History */
      .color-purple .icon-container {
        background: var(--report-purple-light);
        color: var(--report-purple);
      }

      .color-purple:hover {
        border-color: var(--report-purple-light);
      }

      /* Green - Waste Summary */
      .color-green .icon-container {
        background: var(--report-green-light);
        color: var(--report-green);
      }

      .color-green:hover {
        border-color: var(--report-green-light);
      }

      /* Orange - Unreturned Items */
      .color-orange .icon-container {
        background: var(--report-orange-light);
        color: var(--report-orange);
      }

      .color-orange:hover {
        border-color: var(--report-orange-light);
      }

      /* Teal - Export */
      .color-teal .icon-container {
        background: var(--report-teal-light);
        color: var(--report-teal);
      }

      .color-teal:hover {
        border-color: var(--report-teal-light);
      }

      /* ============================================
       * Dark Mode Adjustments
       * ============================================ */
      @media (prefers-color-scheme: dark) {
        :host {
          /* Darker, muted backgrounds with vibrant icons */
          --report-blue-light: rgba(37, 99, 235, 0.15);
          --report-blue: #60a5fa;

          --report-purple-light: rgba(124, 58, 237, 0.15);
          --report-purple: #a78bfa;

          --report-green-light: rgba(5, 150, 105, 0.15);
          --report-green: #34d399;

          --report-orange-light: rgba(234, 88, 12, 0.15);
          --report-orange: #fb923c;

          --report-teal-light: rgba(8, 145, 178, 0.15);
          --report-teal: #22d3ee;
        }

        .report-card {
          background: var(--background-elevated);
          border-color: var(--border-subtle);
        }

        .report-card:hover {
          background: var(--background-tertiary);
        }
      }

      /* Manual dark mode class support */
      :host-context(.dark),
      :host-context(.ion-palette-dark) {
        --report-blue-light: rgba(37, 99, 235, 0.15);
        --report-blue: #60a5fa;

        --report-purple-light: rgba(124, 58, 237, 0.15);
        --report-purple: #a78bfa;

        --report-green-light: rgba(5, 150, 105, 0.15);
        --report-green: #34d399;

        --report-orange-light: rgba(234, 88, 12, 0.15);
        --report-orange: #fb923c;

        --report-teal-light: rgba(8, 145, 178, 0.15);
        --report-teal: #22d3ee;

        .report-card {
          background: var(--background-elevated);
          border-color: var(--border-subtle);
        }

        .report-card:hover {
          background: var(--background-tertiary);
        }
      }

      /* ============================================
       * Reduced Motion
       * ============================================ */
      @media (prefers-reduced-motion: reduce) {
        .report-card {
          animation: none;
          transition: none;
        }

        .icon-container,
        .card-arrow {
          transition: none;
        }
      }
    `,
  ],
})
export class ReportsMenuPage {
  readonly menuItems: ReportMenuItem[] = [
    {
      id: 'progress',
      route: 'progress',
      icon: 'stats-chart-outline',
      titleKey: 'REPORTS.MENU.PROGRESS',
      descKey: 'REPORTS.MENU.PROGRESS_DESC',
      colorClass: 'color-blue',
    },
    {
      id: 'customer-history',
      route: 'customer-history',
      icon: 'people-outline',
      titleKey: 'REPORTS.MENU.CUSTOMER_HISTORY',
      descKey: 'REPORTS.MENU.CUSTOMER_HISTORY_DESC',
      colorClass: 'color-purple',
    },
    {
      id: 'waste-summary',
      route: 'waste-summary',
      icon: 'trash-outline',
      titleKey: 'REPORTS.MENU.WASTE_SUMMARY',
      descKey: 'REPORTS.MENU.WASTE_SUMMARY_DESC',
      colorClass: 'color-green',
    },
    {
      id: 'unreturned-items',
      route: 'unreturned-items',
      icon: 'return-down-back-outline',
      titleKey: 'REPORTS.MENU.UNRETURNED',
      descKey: 'REPORTS.MENU.UNRETURNED_DESC',
      colorClass: 'color-orange',
    },
    {
      id: 'export',
      route: 'export',
      icon: 'download-outline',
      titleKey: 'REPORTS.MENU.EXPORT',
      descKey: 'REPORTS.MENU.EXPORT_DESC',
      colorClass: 'color-teal',
    },
  ];

  constructor() {
    addIcons({
      statsChartOutline,
      peopleOutline,
      trashOutline,
      downloadOutline,
      returnDownBackOutline,
      chevronForward,
    });
  }
}
