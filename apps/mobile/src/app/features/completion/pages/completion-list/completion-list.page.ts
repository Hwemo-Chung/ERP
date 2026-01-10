// apps/mobile/src/app/features/completion/pages/completion-list/completion-list.page.ts
import {
  Component,
  signal,
  ChangeDetectionStrategy,
  inject,
  computed,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonChip,
  RefresherCustomEvent,
  ModalController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import {
  OrderFilterModal,
  FilterContext,
} from '../../../../shared/components/order-filter/order-filter.modal';
import { addIcons } from 'ionicons';
import {
  filterOutline,
  checkmarkCircleOutline,
  timeOutline,
  alertCircleOutline,
} from 'ionicons/icons';
import { OrdersStore } from '../../../../store/orders/orders.store';
import { OrderStatus, Order, OrderLine } from '../../../../store/orders/orders.models';
import { AuthService } from '../../../../core/services/auth.service';

type CompletionFilter = 'dispatched' | 'completed' | 'all';

@Component({
  selector: 'app-completion-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
    IonRefresher,
    IonRefresherContent,
    IonSpinner,
    IonChip,
    TranslateModule,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ 'COMPLETION.TITLE' | translate }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="openFilter()">
            <ion-icon name="filter-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar
          [debounce]="300"
          [placeholder]="'ASSIGNMENT.SEARCH_PLACEHOLDER' | translate"
          (ionInput)="onSearch($event)"
        ></ion-searchbar>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [value]="currentFilter()" (ionChange)="onFilterChange($event)">
          <ion-segment-button value="all">
            <ion-label>{{ 'COMMON.ALL' | translate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="dispatched">
            <ion-label>{{ 'REPORTS.COMPLETION.CHIPS.WAITING' | translate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="completed">
            <ion-label>{{ 'REPORTS.COMPLETION.CHIPS.COMPLETED' | translate }}</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- Summary Chips -->
      <div class="summary-chips">
        <ion-chip color="warning">
          <ion-icon name="time-outline"></ion-icon>
          <ion-label
            >{{ 'REPORTS.COMPLETION.CHIPS.WAITING' | translate }} {{ pendingCount()
            }}{{ 'COMMON.COUNT_SUFFIX' | translate }}</ion-label
          >
        </ion-chip>
        <ion-chip color="primary">
          <ion-icon name="alert-circle-outline"></ion-icon>
          <ion-label
            >{{ 'REPORTS.COMPLETION.CHIPS.IN_PROGRESS' | translate }} {{ inProgressCount()
            }}{{ 'COMMON.COUNT_SUFFIX' | translate }}</ion-label
          >
        </ion-chip>
        <ion-chip color="success">
          <ion-icon name="checkmark-circle-outline"></ion-icon>
          <ion-label
            >{{ 'REPORTS.COMPLETION.CHIPS.COMPLETED' | translate }} {{ completedCount()
            }}{{ 'COMMON.COUNT_SUFFIX' | translate }}</ion-label
          >
        </ion-chip>
      </div>

      @if (isLoading()) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
          <p>{{ 'COMMON.LOADING' | translate }}</p>
        </div>
      } @else {
        <ion-list>
          @for (item of items(); track item.id) {
            <ion-item [routerLink]="['process', item.id]" detail>
              <ion-label>
                <h2>{{ item.orderNumber }}</h2>
                <h3>{{ item.customerName }}</h3>
                <p>{{ item.appointmentDate }} | {{ item.installerName }}</p>
                <div class="status-indicators">
                  @if (item.serialEntered) {
                    <ion-badge color="success">{{
                      'COMPLETION.STATUS.SERIAL_ENTERED' | translate
                    }}</ion-badge>
                  } @else {
                    <ion-badge color="warning">{{
                      'COMPLETION.STATUS.SERIAL_NOT_ENTERED' | translate
                    }}</ion-badge>
                  }
                  @if (item.wastePickedUp) {
                    <ion-badge color="success">{{
                      'COMPLETION.STATUS.WASTE_PICKUP' | translate
                    }}</ion-badge>
                  }
                </div>
              </ion-label>
              <ion-badge slot="end" [color]="getStatusColor(item.status)">
                {{ getStatusLabel(item.status) | translate }}
              </ion-badge>
            </ion-item>
          } @empty {
            <div class="empty-state">
              <ion-icon name="checkmark-circle-outline"></ion-icon>
              <p>{{ 'COMPLETION.NO_ITEMS' | translate }}</p>
            </div>
          }
        </ion-list>
      }
    </ion-content>
  `,
  styles: [
    `
      /* ========================================
       CSS Custom Properties
       ======================================== */
      :host {
        --completion-bg: #f8fafc;
        --completion-card-bg: #ffffff;
        --completion-card-shadow: 0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
        --completion-chip-bg: rgba(255, 255, 255, 0.85);
        --completion-chip-border: rgba(255, 255, 255, 0.6);
        --completion-text-primary: #1e293b;
        --completion-text-secondary: #64748b;
        --completion-text-muted: #94a3b8;
        --completion-border-accent-waiting: #f59e0b;
        --completion-border-accent-progress: #3b82f6;
        --completion-border-accent-done: #22c55e;
      }

      @media (prefers-color-scheme: dark) {
        :host {
          --completion-bg: #0f172a;
          --completion-card-bg: #1e293b;
          --completion-card-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), 0 4px 16px rgba(0, 0, 0, 0.2);
          --completion-chip-bg: rgba(30, 41, 59, 0.8);
          --completion-chip-border: rgba(71, 85, 105, 0.4);
          --completion-text-primary: #f1f5f9;
          --completion-text-secondary: #94a3b8;
          --completion-text-muted: #64748b;
          --completion-border-accent-waiting: #fbbf24;
          --completion-border-accent-progress: #60a5fa;
          --completion-border-accent-done: #4ade80;
        }
      }

      /* ========================================
       Summary Chips - Glassmorphism Style
       ======================================== */
      .summary-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        padding: 16px;
        background: linear-gradient(
          135deg,
          rgba(var(--ion-color-primary-rgb), 0.08) 0%,
          rgba(var(--ion-color-success-rgb), 0.04) 100%
        );
        position: relative;
        overflow: hidden;
      }

      .summary-chips::before {
        content: '';
        position: absolute;
        inset: 0;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
        opacity: 0.015;
        pointer-events: none;
      }

      .summary-chips ion-chip {
        --background: var(--completion-chip-bg);
        --color: var(--completion-text-primary);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid var(--completion-chip-border);
        border-radius: 20px;
        padding: 6px 14px;
        height: 38px;
        font-weight: 600;
        font-size: 13px;
        letter-spacing: 0.01em;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        animation: chipFadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) backwards;
      }

      .summary-chips ion-chip:nth-child(1) {
        animation-delay: 0.1s;
      }
      .summary-chips ion-chip:nth-child(2) {
        animation-delay: 0.15s;
      }
      .summary-chips ion-chip:nth-child(3) {
        animation-delay: 0.2s;
      }

      @keyframes chipFadeIn {
        from {
          opacity: 0;
          transform: translateY(8px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      .summary-chips ion-chip:active {
        transform: scale(0.97);
      }

      .summary-chips ion-chip[color='warning'] {
        --background: linear-gradient(
          135deg,
          rgba(245, 158, 11, 0.15) 0%,
          rgba(251, 191, 36, 0.1) 100%
        );
        border-color: rgba(245, 158, 11, 0.3);
      }

      .summary-chips ion-chip[color='warning'] ion-icon {
        color: #f59e0b;
      }

      .summary-chips ion-chip[color='primary'] {
        --background: linear-gradient(
          135deg,
          rgba(59, 130, 246, 0.15) 0%,
          rgba(96, 165, 250, 0.1) 100%
        );
        border-color: rgba(59, 130, 246, 0.3);
      }

      .summary-chips ion-chip[color='primary'] ion-icon {
        color: #3b82f6;
      }

      .summary-chips ion-chip[color='success'] {
        --background: linear-gradient(
          135deg,
          rgba(34, 197, 94, 0.15) 0%,
          rgba(74, 222, 128, 0.1) 100%
        );
        border-color: rgba(34, 197, 94, 0.3);
      }

      .summary-chips ion-chip[color='success'] ion-icon {
        color: #22c55e;
      }

      .summary-chips ion-chip ion-icon {
        font-size: 18px;
        margin-right: 6px;
      }

      .summary-chips ion-chip ion-label {
        font-weight: 600;
      }

      @media (prefers-color-scheme: dark) {
        .summary-chips {
          background: linear-gradient(
            135deg,
            rgba(var(--ion-color-primary-rgb), 0.12) 0%,
            rgba(var(--ion-color-success-rgb), 0.06) 100%
          );
        }

        .summary-chips ion-chip {
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
        }

        .summary-chips ion-chip[color='warning'] {
          --background: linear-gradient(
            135deg,
            rgba(251, 191, 36, 0.2) 0%,
            rgba(245, 158, 11, 0.12) 100%
          );
          border-color: rgba(251, 191, 36, 0.35);
        }

        .summary-chips ion-chip[color='warning'] ion-icon {
          color: #fbbf24;
        }

        .summary-chips ion-chip[color='primary'] {
          --background: linear-gradient(
            135deg,
            rgba(96, 165, 250, 0.2) 0%,
            rgba(59, 130, 246, 0.12) 100%
          );
          border-color: rgba(96, 165, 250, 0.35);
        }

        .summary-chips ion-chip[color='primary'] ion-icon {
          color: #60a5fa;
        }

        .summary-chips ion-chip[color='success'] {
          --background: linear-gradient(
            135deg,
            rgba(74, 222, 128, 0.2) 0%,
            rgba(34, 197, 94, 0.12) 100%
          );
          border-color: rgba(74, 222, 128, 0.35);
        }

        .summary-chips ion-chip[color='success'] ion-icon {
          color: #4ade80;
        }
      }

      /* ========================================
       List Container
       ======================================== */
      ion-list {
        background: var(--completion-bg);
        padding: 8px 12px 24px;
      }

      @media (prefers-color-scheme: dark) {
        ion-list {
          background: var(--completion-bg);
        }
      }

      /* ========================================
       Card-Style List Items
       ======================================== */
      ion-item {
        --background: var(--completion-card-bg);
        --padding-start: 0;
        --padding-end: 0;
        --inner-padding-start: 0;
        --inner-padding-end: 0;
        --min-height: auto;
        --border-radius: 14px;
        margin-bottom: 12px;
        border-radius: 14px;
        box-shadow: var(--completion-card-shadow);
        overflow: hidden;
        position: relative;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        animation: cardSlideIn 0.35s cubic-bezier(0.4, 0, 0.2, 1) backwards;
      }

      @keyframes cardSlideIn {
        from {
          opacity: 0;
          transform: translateY(16px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      ion-item:nth-child(1) {
        animation-delay: 0.05s;
      }
      ion-item:nth-child(2) {
        animation-delay: 0.1s;
      }
      ion-item:nth-child(3) {
        animation-delay: 0.15s;
      }
      ion-item:nth-child(4) {
        animation-delay: 0.2s;
      }
      ion-item:nth-child(5) {
        animation-delay: 0.25s;
      }

      ion-item:active {
        transform: scale(0.985);
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
      }

      /* Left border accent based on status */
      ion-item::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 4px;
        background: var(--completion-border-accent-waiting);
        border-radius: 4px 0 0 4px;
        transition: background 0.2s ease;
      }

      ion-item ion-label {
        padding: 14px 16px 14px 18px;
        margin: 0;
      }

      ion-item ion-label h2 {
        font-size: 11px;
        font-weight: 700;
        color: var(--ion-color-primary);
        letter-spacing: 0.5px;
        text-transform: uppercase;
        margin: 0 0 4px 0;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      ion-item ion-label h2::before {
        content: '';
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--ion-color-primary);
        opacity: 0.6;
      }

      ion-item ion-label h3 {
        font-size: 16px;
        font-weight: 600;
        color: var(--completion-text-primary);
        margin: 0 0 8px 0;
        line-height: 1.3;
      }

      ion-item ion-label p {
        font-size: 13px;
        color: var(--completion-text-secondary);
        margin: 0 0 10px 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      ion-item ion-label p::before {
        content: '';
        display: inline-block;
        width: 14px;
        height: 14px;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cpath fill='%2394a3b8' d='M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8zm0 448c-110.5 0-200-89.5-200-200S145.5 56 256 56s200 89.5 200 200-89.5 200-200 200zm61.8-104.4l-84.9-61.7c-3.1-2.3-4.9-5.9-4.9-9.7V116c0-6.6 5.4-12 12-12h32c6.6 0 12 5.4 12 12v141.7l66.8 48.6c5.4 3.9 6.5 11.4 2.6 16.8L334.6 349c-3.9 5.3-11.4 6.5-16.8 2.6z'/%3E%3C/svg%3E");
        background-size: contain;
        flex-shrink: 0;
      }

      /* End slot badge */
      ion-item ion-badge[slot='end'] {
        position: absolute;
        top: 14px;
        right: 40px;
        padding: 5px 10px;
        border-radius: 8px;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }

      /* ========================================
       Status Indicators - Pill Badges
       ======================================== */
      .status-indicators {
        display: flex;
        gap: 8px;
        margin-top: 0;
        flex-wrap: wrap;
      }

      .status-indicators ion-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 5px 10px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.02em;
        transition: all 0.2s ease;
      }

      /* Success state badges */
      .status-indicators ion-badge[color='success'] {
        --background: linear-gradient(
          135deg,
          rgba(34, 197, 94, 0.15) 0%,
          rgba(74, 222, 128, 0.1) 100%
        );
        --color: #16a34a;
        border: 1px solid rgba(34, 197, 94, 0.25);
      }

      .status-indicators ion-badge[color='success']::before {
        content: '';
        display: inline-block;
        width: 12px;
        height: 12px;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cpath fill='%2316a34a' d='M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z'/%3E%3C/svg%3E");
        background-size: contain;
        flex-shrink: 0;
      }

      /* Warning state badges */
      .status-indicators ion-badge[color='warning'] {
        --background: linear-gradient(
          135deg,
          rgba(245, 158, 11, 0.15) 0%,
          rgba(251, 191, 36, 0.1) 100%
        );
        --color: #d97706;
        border: 1px solid rgba(245, 158, 11, 0.25);
      }

      .status-indicators ion-badge[color='warning']::before {
        content: '';
        display: inline-block;
        width: 12px;
        height: 12px;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cpath fill='%23d97706' d='M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm0-384c13.3 0 24 10.7 24 24V264c0 13.3-10.7 24-24 24s-24-10.7-24-24V152c0-13.3 10.7-24 24-24zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z'/%3E%3C/svg%3E");
        background-size: contain;
        flex-shrink: 0;
      }

      @media (prefers-color-scheme: dark) {
        .status-indicators ion-badge[color='success'] {
          --background: linear-gradient(
            135deg,
            rgba(74, 222, 128, 0.2) 0%,
            rgba(34, 197, 94, 0.12) 100%
          );
          --color: #4ade80;
          border-color: rgba(74, 222, 128, 0.35);
        }

        .status-indicators ion-badge[color='success']::before {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cpath fill='%234ade80' d='M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z'/%3E%3C/svg%3E");
        }

        .status-indicators ion-badge[color='warning'] {
          --background: linear-gradient(
            135deg,
            rgba(251, 191, 36, 0.2) 0%,
            rgba(245, 158, 11, 0.12) 100%
          );
          --color: #fbbf24;
          border-color: rgba(251, 191, 36, 0.35);
        }

        .status-indicators ion-badge[color='warning']::before {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cpath fill='%23fbbf24' d='M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm0-384c13.3 0 24 10.7 24 24V264c0 13.3-10.7 24-24 24s-24-10.7-24-24V152c0-13.3 10.7-24 24-24zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z'/%3E%3C/svg%3E");
        }
      }

      /* ========================================
       Loading State
       ======================================== */
      .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 55vh;
        padding: 32px;
        animation: fadeIn 0.4s ease;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      .loading-container ion-spinner {
        width: 48px;
        height: 48px;
        margin-bottom: 20px;
        --color: var(--ion-color-primary);
      }

      .loading-container p {
        font-size: 14px;
        font-weight: 500;
        color: var(--completion-text-secondary);
        margin: 0;
        animation: pulse 1.5s ease-in-out infinite;
      }

      @keyframes pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.6;
        }
      }

      /* ========================================
       Empty State - Illustration Style
       ======================================== */
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 60vh;
        padding: 40px 24px;
        text-align: center;
        animation: emptyFadeIn 0.5s cubic-bezier(0.4, 0, 0.2, 1);
      }

      @keyframes emptyFadeIn {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .empty-state ion-icon {
        font-size: 80px;
        margin-bottom: 24px;
        color: var(--ion-color-success);
        opacity: 0.8;
        position: relative;
      }

      .empty-state ion-icon::after {
        content: '';
        position: absolute;
        width: 120px;
        height: 120px;
        background: linear-gradient(
          135deg,
          rgba(34, 197, 94, 0.12) 0%,
          rgba(74, 222, 128, 0.06) 100%
        );
        border-radius: 50%;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: -1;
      }

      .empty-state p {
        font-size: 16px;
        font-weight: 500;
        color: var(--completion-text-secondary);
        margin: 0;
        line-height: 1.5;
        max-width: 220px;
      }

      @media (prefers-color-scheme: dark) {
        .empty-state ion-icon {
          color: #4ade80;
        }

        .empty-state ion-icon::after {
          background: linear-gradient(
            135deg,
            rgba(74, 222, 128, 0.15) 0%,
            rgba(34, 197, 94, 0.08) 100%
          );
        }
      }

      /* ========================================
       Reduced Motion Support
       ======================================== */
      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
    `,
  ],
})
export class CompletionListPage implements OnInit {
  protected readonly ordersStore = inject(OrdersStore);
  private readonly authService = inject(AuthService);
  private readonly modalController = inject(ModalController);

  protected readonly currentFilter = signal<CompletionFilter>('all');
  protected readonly searchQuery = signal('');

  protected readonly isLoading = computed(() => this.ordersStore.isLoading());

  // 완료 처리 대상: 출문(DISPATCHED) 상태인 주문들
  protected readonly items = computed(() => {
    const orders = this.ordersStore.filteredOrders();
    const filter = this.currentFilter();
    const query = this.searchQuery().toLowerCase();

    let filtered = orders.filter((o) =>
      [OrderStatus.DISPATCHED, OrderStatus.COMPLETED, OrderStatus.PARTIAL].includes(o.status),
    );

    if (filter === 'dispatched') {
      filtered = filtered.filter((o) => o.status === OrderStatus.DISPATCHED);
    } else if (filter === 'completed') {
      filtered = filtered.filter((o) =>
        [OrderStatus.COMPLETED, OrderStatus.PARTIAL].includes(o.status),
      );
    }

    if (query) {
      filtered = filtered.filter(
        (o) =>
          o.orderNo.toLowerCase().includes(query) || o.customerName.toLowerCase().includes(query),
      );
    }

    return filtered.map((o: Order) => {
      const lines = o.lines || o.orderLines || [];
      return {
        id: o.id,
        orderNumber: o.orderNo,
        customerName: o.customerName,
        appointmentDate: o.appointmentDate || '-',
        status: o.status,
        installerName: o.installerName || o.installerId || '-',
        productCount: lines.length,
        serialEntered: lines.length > 0 && lines.every((l: OrderLine) => !!l.serialNumber),
        wastePickedUp: (o.completion?.waste?.length || 0) > 0,
      };
    });
  });

  protected readonly pendingCount = computed(
    () =>
      this.ordersStore.filteredOrders().filter((o) => o.status === OrderStatus.DISPATCHED).length,
  );
  protected readonly inProgressCount = computed(
    () => this.ordersStore.filteredOrders().filter((o) => o.status === OrderStatus.PARTIAL).length,
  );
  protected readonly completedCount = computed(
    () =>
      this.ordersStore.filteredOrders().filter((o) => o.status === OrderStatus.COMPLETED).length,
  );

  constructor() {
    addIcons({ filterOutline, checkmarkCircleOutline, timeOutline, alertCircleOutline });
  }

  ngOnInit(): void {
    this.loadData();
  }

  async loadData(): Promise<void> {
    const branchCode = this.authService.user()?.branchCode;
    await this.ordersStore.loadOrders(branchCode);
  }

  onSearch(event: CustomEvent): void {
    this.searchQuery.set(event.detail.value || '');
  }

  onFilterChange(event: CustomEvent): void {
    this.currentFilter.set(event.detail.value as CompletionFilter);
  }

  async onRefresh(event: RefresherCustomEvent): Promise<void> {
    await this.loadData();
    event.target.complete();
  }

  async openFilter(): Promise<void> {
    const modal = await this.modalController.create({
      component: OrderFilterModal,
      componentProps: {
        context: 'completion' as FilterContext,
        currentFilters: this.ordersStore.filters(),
        installers: [],
        branches: [],
      },
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === 'apply' && data) {
      this.ordersStore.setFilters(data);
      await this.loadData();
    }
  }

  getStatusColor(status: OrderStatus): string {
    const colors: Record<string, string> = {
      [OrderStatus.DISPATCHED]: 'warning',
      [OrderStatus.PARTIAL]: 'primary',
      [OrderStatus.COMPLETED]: 'success',
    };
    return colors[status] || 'medium';
  }

  getStatusLabel(status: OrderStatus): string {
    const labels: Record<string, string> = {
      [OrderStatus.DISPATCHED]: 'REPORTS.COMPLETION.FILTER.WAITING',
      [OrderStatus.PARTIAL]: 'REPORTS.COMPLETION.STATUS.IN_PROGRESS',
      [OrderStatus.COMPLETED]: 'REPORTS.COMPLETION.STATUS.COMPLETED',
    };
    return labels[status] || String(status);
  }
}
