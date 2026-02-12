import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonButton,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonSpinner,
  ActionSheetController,
  AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  callOutline,
  navigateOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  timeOutline,
  personOutline,
} from 'ionicons/icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { OrdersService, Order } from '../../services/orders.service';
import { LoggerService } from '../../../../core/services/logger.service';
import {
  OrderStatus,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
} from '../../../../store/orders/orders.models';

/**
 * Valid state transitions per status
 * Based on ARCHITECTURE.md Order State Machine
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.UNASSIGNED]: [OrderStatus.ASSIGNED],
  [OrderStatus.ASSIGNED]: [OrderStatus.CONFIRMED, OrderStatus.UNASSIGNED],
  [OrderStatus.CONFIRMED]: [OrderStatus.RELEASED, OrderStatus.ASSIGNED],
  [OrderStatus.RELEASED]: [OrderStatus.DISPATCHED, OrderStatus.CONFIRMED],
  [OrderStatus.DISPATCHED]: [
    OrderStatus.COMPLETED,
    OrderStatus.PARTIAL,
    OrderStatus.POSTPONED,
    OrderStatus.ABSENT,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.POSTPONED]: [OrderStatus.DISPATCHED, OrderStatus.ABSENT, OrderStatus.CANCELLED],
  [OrderStatus.ABSENT]: [OrderStatus.DISPATCHED, OrderStatus.POSTPONED, OrderStatus.CANCELLED],
  [OrderStatus.COMPLETED]: [OrderStatus.COLLECTED],
  [OrderStatus.PARTIAL]: [OrderStatus.COMPLETED, OrderStatus.COLLECTED],
  [OrderStatus.COLLECTED]: [], // Terminal
  [OrderStatus.CANCELLED]: [], // Terminal
  [OrderStatus.REQUEST_CANCEL]: [], // Terminal
};

/**
 * Action labels for status transition buttons
 */
const TRANSITION_ACTION_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.UNASSIGNED]: '미배정으로',
  [OrderStatus.ASSIGNED]: '배정으로 되돌리기',
  [OrderStatus.CONFIRMED]: '배정 확정',
  [OrderStatus.RELEASED]: '출고 확정',
  [OrderStatus.DISPATCHED]: '출문 처리',
  [OrderStatus.POSTPONED]: '연기',
  [OrderStatus.ABSENT]: '부재 처리',
  [OrderStatus.COMPLETED]: '인수 완료',
  [OrderStatus.PARTIAL]: '부분 인수',
  [OrderStatus.COLLECTED]: '회수 완료',
  [OrderStatus.CANCELLED]: '취소',
  [OrderStatus.REQUEST_CANCEL]: '취소 요청',
};

/**
 * Button colors for status transitions
 */
const TRANSITION_BUTTON_COLORS: Record<OrderStatus, string> = {
  [OrderStatus.UNASSIGNED]: 'medium',
  [OrderStatus.ASSIGNED]: 'medium',
  [OrderStatus.CONFIRMED]: 'primary',
  [OrderStatus.RELEASED]: 'tertiary',
  [OrderStatus.DISPATCHED]: 'secondary',
  [OrderStatus.POSTPONED]: 'warning',
  [OrderStatus.ABSENT]: 'warning',
  [OrderStatus.COMPLETED]: 'success',
  [OrderStatus.PARTIAL]: 'success',
  [OrderStatus.COLLECTED]: 'success',
  [OrderStatus.CANCELLED]: 'danger',
  [OrderStatus.REQUEST_CANCEL]: 'danger',
};

/**
 * Icons for status transitions
 */
const TRANSITION_ICONS: Record<OrderStatus, string> = {
  [OrderStatus.UNASSIGNED]: 'arrow-undo-outline',
  [OrderStatus.ASSIGNED]: 'person-outline',
  [OrderStatus.CONFIRMED]: 'checkmark-circle-outline',
  [OrderStatus.RELEASED]: 'cube-outline',
  [OrderStatus.DISPATCHED]: 'navigate-outline',
  [OrderStatus.POSTPONED]: 'time-outline',
  [OrderStatus.ABSENT]: 'close-circle-outline',
  [OrderStatus.COMPLETED]: 'checkmark-circle-outline',
  [OrderStatus.PARTIAL]: 'checkmark-outline',
  [OrderStatus.COLLECTED]: 'checkmark-done-outline',
  [OrderStatus.CANCELLED]: 'close-outline',
  [OrderStatus.REQUEST_CANCEL]: 'alert-circle-outline',
};

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
    IonSpinner,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/orders"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ 'ORDERS.DETAIL.TITLE' | translate }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (isLoading()) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      } @else if (order()) {
        <!-- Status Badge -->
        <div class="status-section">
          <ion-badge [class]="'status-badge status-' + order()!.status.toLowerCase()">
            {{ order()!.status }}
          </ion-badge>
        </div>

        <!-- Order Info Card -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ order()!.orderNo }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list lines="none">
              <ion-item>
                <ion-icon slot="start" name="time-outline"></ion-icon>
                <ion-label>
                  <p>{{ 'ORDERS.DETAIL.APPOINTMENT_INFO' | translate }}</p>
                  <h3>
                    {{ order()!.appointmentDate | date: 'yyyy-MM-dd' }}
                    {{ order()!.appointmentSlot }}
                  </h3>
                </ion-label>
              </ion-item>
              @if (order()!.installer?.name || order()!.installerName) {
                <ion-item>
                  <ion-icon slot="start" name="person-outline"></ion-icon>
                  <ion-label>
                    <p>{{ 'ORDERS.DETAIL.INSTALLER' | translate }}</p>
                    <h3>{{ order()!.installer?.name || order()!.installerName }}</h3>
                  </ion-label>
                </ion-item>
              }
            </ion-list>
          </ion-card-content>
        </ion-card>

        <!-- Customer Info Card -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ 'ORDERS.DETAIL.CUSTOMER_INFO' | translate }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list lines="none">
              <ion-item>
                <ion-label>
                  <h2>{{ order()!.customerName }}</h2>
                  <p>{{ order()!.customerAddress }}</p>
                </ion-label>
              </ion-item>
            </ion-list>
            <div class="action-buttons">
              <ion-button fill="outline" size="small" (click)="callCustomer()">
                <ion-icon slot="start" name="call-outline"></ion-icon>
                {{ 'ORDERS.DETAIL.CALL' | translate }}
              </ion-button>
              <ion-button fill="outline" size="small" (click)="navigateToAddress()">
                <ion-icon slot="start" name="navigate-outline"></ion-icon>
                {{ 'ORDERS.DETAIL.NAVIGATE' | translate }}
              </ion-button>
            </div>
          </ion-card-content>
        </ion-card>

        <!-- Order Lines Card -->
        @if ((order()!.lines || order()!.orderLines)?.length) {
          <ion-card>
            <ion-card-header>
              <ion-card-title
                >{{ 'ORDERS.DETAIL.PRODUCTS' | translate }} ({{
                  (order()!.lines || order()!.orderLines)!.length
                }})</ion-card-title
              >
            </ion-card-header>
            <ion-card-content>
              <ion-list>
                @for (line of (order()!.lines || order()!.orderLines)!; track line.id) {
                  <ion-item>
                    <ion-label>
                      <h3>{{ line.itemName || line.productName }}</h3>
                      <p>{{ line.itemCode || line.productCode }} × {{ line.quantity }}</p>
                      @if (line.serialNumber) {
                        <p><strong>S/N:</strong> {{ line.serialNumber }}</p>
                      }
                    </ion-label>
                  </ion-item>
                }
              </ion-list>
            </ion-card-content>
          </ion-card>
        }

        <!-- Status Actions -->
        @if (allowedTransitions().length > 0) {
          <div class="status-actions">
            @for (status of allowedTransitions(); track status) {
              <ion-button
                [color]="getStatusButtonColor(status)"
                expand="block"
                (click)="confirmStatusChange(status)"
              >
                <ion-icon slot="start" [name]="getStatusIcon(status)"></ion-icon>
                {{ getStatusLabel(status) }}
              </ion-button>
            }
          </div>
        }
      } @else {
        <div class="empty-state">
          <h3>{{ 'ORDERS.DETAIL.ORDER_NOT_FOUND' | translate }}</h3>
        </div>
      }
    </ion-content>
  `,
  styles: [
    `
      /* ============================================
     * KEYFRAME ANIMATIONS
     * Subtle, purposeful motion design
     * ============================================ */

      @keyframes shimmer {
        0% {
          background-position: -200% 0;
        }
        100% {
          background-position: 200% 0;
        }
      }

      @keyframes pulse-ring {
        0% {
          transform: scale(0.95);
          opacity: 0.7;
        }
        50% {
          transform: scale(1);
          opacity: 1;
        }
        100% {
          transform: scale(0.95);
          opacity: 0.7;
        }
      }

      @keyframes fade-slide-up {
        from {
          opacity: 0;
          transform: translateY(12px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      /* ============================================
     * LOADING STATE
     * Elegant spinner with context
     * ============================================ */

      .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 60vh;
        gap: var(--space-4);

        ion-spinner {
          --color: var(--ion-color-primary);
          width: 48px;
          height: 48px;
          animation: pulse-ring 2s var(--ease-in-out) infinite;
        }

        &::after {
          content: '';
          display: block;
          width: 120px;
          height: 4px;
          border-radius: var(--radius-full);
          background: linear-gradient(
            90deg,
            var(--border-subtle) 0%,
            var(--ion-color-primary-tint) 50%,
            var(--border-subtle) 100%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s linear infinite;
        }
      }

      /* ============================================
     * EMPTY STATE
     * Clear, helpful feedback
     * ============================================ */

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 50vh;
        padding: var(--space-8);
        text-align: center;
        animation: fade-slide-up 0.4s var(--ease-out) forwards;

        &::before {
          content: '';
          display: block;
          width: 80px;
          height: 80px;
          margin-bottom: var(--space-6);
          border-radius: var(--radius-2xl);
          background: linear-gradient(135deg, var(--gray-100) 0%, var(--gray-200) 100%);
          opacity: 0.8;
        }

        h3 {
          margin: 0;
          font-family: var(--font-family-heading);
          font-size: var(--font-size-lg);
          font-weight: var(--font-weight-semibold);
          color: var(--text-secondary);
          letter-spacing: var(--letter-spacing-tight);
        }
      }

      /* ============================================
     * STATUS BADGE SECTION
     * Hero status indicator with gradient design
     * ============================================ */

      .status-section {
        display: flex;
        justify-content: center;
        margin-bottom: var(--space-5);
        padding-top: var(--space-2);
        animation: fade-slide-up 0.3s var(--ease-out) forwards;

        .status-badge {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2-5) var(--space-6);
          border-radius: var(--radius-full);
          font-family: var(--font-family-heading);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-bold);
          letter-spacing: var(--letter-spacing-wider);
          text-transform: uppercase;
          box-shadow: var(--shadow-sm);
          transition:
            transform var(--transition-normal) var(--ease-out),
            box-shadow var(--transition-normal) var(--ease-out);

          /* Subtle inner glow */
          &::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: inherit;
            background: linear-gradient(180deg, rgba(255, 255, 255, 0.15) 0%, transparent 50%);
            pointer-events: none;
          }

          /* Status-specific gradient backgrounds */
          &.status-unassigned {
            background: linear-gradient(
              135deg,
              var(--status-unassigned-bg) 0%,
              var(--gray-200) 100%
            );
            color: var(--status-unassigned-text);
            border: 1px solid var(--gray-300);
          }

          &.status-assigned {
            background: linear-gradient(135deg, var(--status-assigned-bg) 0%, #bfdbfe 100%);
            color: var(--status-assigned-text);
            border: 1px solid rgba(37, 99, 235, 0.2);
          }

          &.status-confirmed {
            background: linear-gradient(135deg, var(--status-confirmed-bg) 0%, #bae6fd 100%);
            color: var(--status-confirmed-text);
            border: 1px solid rgba(2, 132, 199, 0.2);
          }

          &.status-released {
            background: linear-gradient(135deg, var(--status-released-bg) 0%, #a5f3fc 100%);
            color: var(--status-released-text);
            border: 1px solid rgba(8, 145, 178, 0.2);
          }

          &.status-dispatched {
            background: linear-gradient(135deg, var(--status-dispatched-bg) 0%, #99f6e4 100%);
            color: var(--status-dispatched-text);
            border: 1px solid rgba(13, 148, 136, 0.2);
          }

          &.status-completed {
            background: linear-gradient(135deg, var(--status-completed-bg) 0%, #bbf7d0 100%);
            color: var(--status-completed-text);
            border: 1px solid rgba(22, 163, 74, 0.2);
          }

          &.status-collected {
            background: linear-gradient(135deg, var(--status-collected-bg) 0%, #d9f99d 100%);
            color: var(--status-collected-text);
            border: 1px solid rgba(101, 163, 13, 0.2);
          }

          &.status-partial {
            background: linear-gradient(135deg, #dcfce7 0%, #fef9c3 100%);
            color: #166534;
            border: 1px solid rgba(22, 163, 74, 0.2);
          }

          &.status-postponed {
            background: linear-gradient(135deg, var(--status-postponed-bg) 0%, #fef08a 100%);
            color: var(--status-postponed-text);
            border: 1px solid rgba(217, 119, 6, 0.2);
          }

          &.status-absent {
            background: linear-gradient(135deg, var(--status-absent-bg) 0%, #fed7aa 100%);
            color: var(--status-absent-text);
            border: 1px solid rgba(234, 88, 12, 0.2);
          }

          &.status-request_cancel,
          &.status-request-cancel {
            background: linear-gradient(135deg, var(--status-request-cancel-bg) 0%, #fecaca 100%);
            color: var(--status-request-cancel-text);
            border: 1px solid rgba(220, 38, 38, 0.2);
          }

          &.status-cancelled {
            background: linear-gradient(135deg, var(--status-cancelled-bg) 0%, #e7e5e4 100%);
            color: var(--status-cancelled-text);
            border: 1px solid var(--gray-300);
          }
        }
      }

      /* ============================================
     * PREMIUM CARD DESIGN
     * Elevated cards with refined borders
     * ============================================ */

      ion-card {
        --background: var(--background-elevated);
        margin: 0 0 var(--space-4) 0;
        border-radius: var(--radius-lg);
        border: 1px solid var(--border-subtle);
        box-shadow: var(--shadow-md);
        overflow: hidden;
        animation: fade-slide-up 0.4s var(--ease-out) both;

        /* Staggered entrance */
        &:nth-child(2) {
          animation-delay: 0.05s;
        }
        &:nth-child(3) {
          animation-delay: 0.1s;
        }
        &:nth-child(4) {
          animation-delay: 0.15s;
        }
        &:nth-child(5) {
          animation-delay: 0.2s;
        }

        /* Hover state for interactive feel */
        transition:
          transform var(--transition-normal) var(--ease-out),
          box-shadow var(--transition-normal) var(--ease-out);

        &:active {
          transform: scale(0.995);
          box-shadow: var(--shadow-sm);
        }

        ion-card-header {
          padding: var(--space-4) var(--space-4) var(--space-2);
          background: linear-gradient(180deg, var(--background-secondary) 0%, transparent 100%);
          border-bottom: 1px solid var(--border-subtle);

          ion-card-title {
            font-family: var(--font-family-heading);
            font-size: var(--font-size-md);
            font-weight: var(--font-weight-semibold);
            color: var(--text-primary);
            letter-spacing: var(--letter-spacing-tight);
            line-height: var(--line-height-snug);
          }
        }

        ion-card-content {
          padding: var(--space-3) var(--space-4) var(--space-4);
        }
      }

      /* ============================================
     * LIST ITEMS STYLING
     * Clean information hierarchy
     * ============================================ */

      ion-list {
        background: transparent;
        padding: 0;

        ion-item {
          --background: transparent;
          --padding-start: 0;
          --padding-end: 0;
          --inner-padding-end: 0;
          --min-height: auto;
          --border-color: transparent;
          margin-bottom: var(--space-3);

          &:last-child {
            margin-bottom: 0;
          }

          ion-icon[slot='start'] {
            margin-right: var(--space-3);
            font-size: 20px;
            color: var(--ion-color-primary);
            opacity: 0.9;
          }

          ion-label {
            margin: 0;

            p {
              margin: 0 0 var(--space-1) 0;
              font-size: var(--font-size-xs);
              font-weight: var(--font-weight-medium);
              color: var(--text-tertiary);
              text-transform: uppercase;
              letter-spacing: var(--letter-spacing-wide);
            }

            h2 {
              margin: 0;
              font-size: var(--font-size-base);
              font-weight: var(--font-weight-semibold);
              color: var(--text-primary);
              line-height: var(--line-height-snug);
            }

            h3 {
              margin: 0;
              font-size: var(--font-size-base);
              font-weight: var(--font-weight-medium);
              color: var(--text-primary);
              line-height: var(--line-height-normal);
            }
          }
        }
      }

      /* ============================================
     * ACTION BUTTONS (Call / Navigate)
     * Prominent, accessible action triggers
     * ============================================ */

      .action-buttons {
        display: flex;
        gap: var(--space-3);
        margin-top: var(--space-4);
        padding-top: var(--space-4);
        border-top: 1px solid var(--border-subtle);

        ion-button {
          --border-radius: var(--radius-md);
          --padding-start: var(--space-4);
          --padding-end: var(--space-4);
          --box-shadow: none;
          flex: 1;
          height: 44px;
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          letter-spacing: var(--letter-spacing-wide);
          transition:
            transform var(--transition-fast) var(--ease-out),
            background var(--transition-fast) var(--ease-out);

          &[fill='outline'] {
            --border-width: 1.5px;
            --background-hover: var(--state-hover);
            --background-activated: var(--state-pressed);
          }

          ion-icon {
            margin-right: var(--space-2);
            font-size: 18px;
          }

          &:active {
            transform: scale(0.97);
          }

          /* Call button - primary action feel */
          &:first-child {
            --color: var(--ion-color-success);
            --border-color: var(--ion-color-success);

            &:hover {
              --background: rgba(22, 163, 74, 0.08);
            }
          }

          /* Navigate button - secondary action */
          &:last-child {
            --color: var(--ion-color-primary);
            --border-color: var(--ion-color-primary);

            &:hover {
              --background: rgba(37, 99, 235, 0.08);
            }
          }
        }
      }

      /* ============================================
     * PRODUCT LIST (Order Lines)
     * Clear product hierarchy with visual grouping
     * ============================================ */

      ion-card:has(ion-card-title:contains('Products')),
      ion-card:last-of-type:not(:has(.action-buttons)) {
        ion-list {
          ion-item {
            --background: var(--background-secondary);
            --padding-start: var(--space-3);
            --padding-end: var(--space-3);
            padding: var(--space-3);
            margin-bottom: var(--space-2);
            border-radius: var(--radius-md);
            border: 1px solid var(--border-subtle);
            transition: background var(--transition-fast) var(--ease-out);

            &:last-child {
              margin-bottom: 0;
            }

            &:active {
              --background: var(--background-tertiary);
            }

            ion-label {
              h3 {
                font-weight: var(--font-weight-semibold);
                color: var(--text-primary);
                margin-bottom: var(--space-1);
              }

              p {
                margin: 0;
                text-transform: none;
                letter-spacing: normal;
                font-size: var(--font-size-sm);
                font-weight: var(--font-weight-regular);
                color: var(--text-secondary);
                line-height: var(--line-height-relaxed);

                strong {
                  color: var(--text-primary);
                  font-weight: var(--font-weight-medium);
                }
              }
            }
          }
        }
      }

      /* ============================================
     * STATUS ACTION BUTTONS
     * Sticky footer with prominent actions
     * ============================================ */

      .status-actions {
        position: sticky;
        bottom: 0;
        left: 0;
        right: 0;
        margin: var(--space-6) calc(-1 * var(--space-4)) 0;
        padding: var(--space-4);
        background: linear-gradient(
          180deg,
          transparent 0%,
          var(--background-primary) 20%,
          var(--background-primary) 100%
        );
        animation: fade-slide-up 0.5s var(--ease-out) 0.3s both;

        /* Frosted glass effect */
        &::before {
          content: '';
          position: absolute;
          inset: 0;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          z-index: -1;
        }

        ion-button {
          --border-radius: var(--radius-lg);
          --box-shadow: var(--shadow-sm);
          margin-bottom: var(--space-3);
          height: 52px;
          font-size: var(--font-size-base);
          font-weight: var(--font-weight-semibold);
          letter-spacing: var(--letter-spacing-wide);
          transition:
            transform var(--transition-fast) var(--ease-out),
            box-shadow var(--transition-fast) var(--ease-out);

          &:last-child {
            margin-bottom: 0;
          }

          ion-icon {
            margin-right: var(--space-2);
            font-size: 20px;
          }

          &:active {
            transform: scale(0.98);
            --box-shadow: var(--shadow-xs);
          }

          /* Primary actions - enhanced prominence */
          &[color='primary'],
          &[color='success'] {
            --box-shadow: var(--shadow-md);

            &[color='primary'] {
              --background: linear-gradient(
                135deg,
                var(--ion-color-primary) 0%,
                var(--ion-color-primary-shade) 100%
              );
            }

            &[color='success'] {
              --background: linear-gradient(
                135deg,
                var(--ion-color-success) 0%,
                var(--ion-color-success-shade) 100%
              );
            }
          }

          /* Warning actions */
          &[color='warning'] {
            --background: linear-gradient(
              135deg,
              var(--ion-color-warning) 0%,
              var(--ion-color-warning-shade) 100%
            );
          }

          /* Danger actions */
          &[color='danger'] {
            --background: linear-gradient(
              135deg,
              var(--ion-color-danger) 0%,
              var(--ion-color-danger-shade) 100%
            );
          }

          /* Secondary/Tertiary actions */
          &[color='secondary'] {
            --background: linear-gradient(
              135deg,
              var(--ion-color-secondary) 0%,
              var(--ion-color-secondary-shade) 100%
            );
          }

          &[color='tertiary'] {
            --background: linear-gradient(
              135deg,
              var(--ion-color-tertiary) 0%,
              var(--ion-color-tertiary-shade) 100%
            );
          }

          /* Medium (neutral) actions */
          &[color='medium'] {
            --background: linear-gradient(135deg, var(--gray-500) 0%, var(--gray-600) 100%);
          }
        }
      }

      /* ============================================
     * DARK MODE ADJUSTMENTS
     * Refined dark theme support
     * ============================================ */

      @media (prefers-color-scheme: dark) {
        .status-section .status-badge {
          box-shadow:
            var(--shadow-md),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);

          &::before {
            background: linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 50%);
          }

          /* Dark mode gradient adjustments */
          &.status-assigned {
            background: linear-gradient(135deg, var(--status-assigned-bg) 0%, #1e3a5f 100%);
          }

          &.status-confirmed {
            background: linear-gradient(135deg, var(--status-confirmed-bg) 0%, #0c4a6e 100%);
          }

          &.status-released {
            background: linear-gradient(135deg, var(--status-released-bg) 0%, #164e63 100%);
          }

          &.status-dispatched {
            background: linear-gradient(135deg, var(--status-dispatched-bg) 0%, #134e4a 100%);
          }

          &.status-completed {
            background: linear-gradient(135deg, var(--status-completed-bg) 0%, #14532d 100%);
          }

          &.status-collected {
            background: linear-gradient(135deg, var(--status-collected-bg) 0%, #365314 100%);
          }

          &.status-partial {
            background: linear-gradient(135deg, #14532d 0%, #3f6212 100%);
            color: #bbf7d0;
          }

          &.status-postponed {
            background: linear-gradient(135deg, var(--status-postponed-bg) 0%, #78350f 100%);
          }

          &.status-absent {
            background: linear-gradient(135deg, var(--status-absent-bg) 0%, #7c2d12 100%);
          }

          &.status-request_cancel,
          &.status-request-cancel {
            background: linear-gradient(135deg, var(--status-request-cancel-bg) 0%, #7f1d1d 100%);
          }

          &.status-cancelled {
            background: linear-gradient(135deg, var(--status-cancelled-bg) 0%, #292524 100%);
          }

          &.status-unassigned {
            background: linear-gradient(135deg, var(--status-unassigned-bg) 0%, #1e293b 100%);
          }
        }

        ion-card {
          --background: var(--background-elevated);
          border-color: var(--border-subtle);
          box-shadow:
            var(--shadow-lg),
            inset 0 1px 0 rgba(255, 255, 255, 0.02);

          ion-card-header {
            background: linear-gradient(180deg, rgba(255, 255, 255, 0.02) 0%, transparent 100%);
          }
        }

        .action-buttons ion-button {
          &:first-child:hover {
            --background: rgba(34, 197, 94, 0.12);
          }

          &:last-child:hover {
            --background: rgba(59, 130, 246, 0.12);
          }
        }

        .empty-state::before {
          background: linear-gradient(135deg, var(--gray-200) 0%, var(--gray-300) 100%);
        }

        .status-actions {
          background: linear-gradient(
            180deg,
            transparent 0%,
            var(--background-primary) 30%,
            var(--background-primary) 100%
          );

          ion-button {
            --box-shadow: var(--shadow-md);

            &[color='primary'],
            &[color='success'] {
              --box-shadow: var(--shadow-lg);
            }
          }
        }
      }

      /* ============================================
     * REDUCED MOTION SUPPORT
     * Accessibility-first animations
     * ============================================ */

      @media (prefers-reduced-motion: reduce) {
        .loading-container ion-spinner,
        .loading-container::after,
        ion-card,
        .status-section,
        .status-actions,
        .empty-state {
          animation: none;
        }

        ion-card,
        ion-button,
        .action-buttons ion-button {
          transition: none;
        }
      }
    `,
  ],
})
export class OrderDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ordersService = inject(OrdersService);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly alertCtrl = inject(AlertController);
  private readonly translate = inject(TranslateService);
  private readonly logger = inject(LoggerService);
  protected readonly order = signal<Order | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly allowedTransitions = signal<string[]>([]);

  constructor() {
    addIcons({
      callOutline,
      navigateOutline,
      checkmarkCircleOutline,
      closeCircleOutline,
      timeOutline,
      personOutline,
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadOrder(id);
    }
  }

  private async loadOrder(id: string): Promise<void> {
    this.isLoading.set(true);
    try {
      const order = await this.ordersService.getOrder(id);
      this.order.set(order);

      if (order) {
        const transitions = ALLOWED_TRANSITIONS[order.status as OrderStatus] || [];
        this.allowedTransitions.set(transitions as string[]);
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  protected callCustomer(): void {
    const phone = this.order()?.customerPhone;
    if (phone) {
      window.open(`tel:${phone}`, '_system');
    }
  }

  protected navigateToAddress(): void {
    const address = this.order()?.customerAddress;
    if (address) {
      const encoded = encodeURIComponent(address);
      window.open(`https://maps.google.com?q=${encoded}`, '_system');
    }
  }

  protected async confirmStatusChange(newStatus: string): Promise<void> {
    // Handle ABSENT status with special flow for reason and notes
    if (newStatus === OrderStatus.ABSENT) {
      await this.handleAbsenceStatus();
      return;
    }

    const alert = await this.alertCtrl.create({
      header: this.translate.instant('ORDERS.DETAIL.CONFIRM_STATUS_CHANGE'),
      message: this.translate.instant('ORDERS.DETAIL.CHANGE_STATUS_TO', {
        status: this.getStatusLabel(newStatus),
      }),
      buttons: [
        { text: this.translate.instant('COMMON.CANCEL'), role: 'cancel' },
        {
          text: this.translate.instant('COMMON.CONFIRM'),
          handler: () => this.updateStatus(newStatus),
        },
      ],
    });

    await alert.present();
  }

  /**
   * Handle ABSENT status with reason selection and notes
   * Implements FR-04 absence tracking
   */
  private async handleAbsenceStatus(): Promise<void> {
    const currentOrder = this.order();
    if (!currentOrder) return;

    // Show absence retry warning if applicable
    const retryCount = currentOrder.absenceRetryCount || 0;
    const maxRetries = currentOrder.maxAbsenceRetries || 3;
    const retryWarning =
      retryCount > 0
        ? `\n\n${this.translate.instant('ORDERS.ABSENCE.RETRY_COUNT')}: ${retryCount}/${maxRetries}`
        : '';

    const alert = await this.alertCtrl.create({
      header: this.translate.instant('ORDERS.ABSENCE.TITLE'),
      message: `${this.translate.instant('ORDERS.ABSENCE.REASON.TITLE')}${retryWarning}`,
      inputs: [
        {
          name: 'reason',
          type: 'radio',
          label: this.translate.instant('ORDERS.ABSENCE.REASON.NOT_HOME'),
          value: 'NO_RESPONSE',
          checked: true,
        },
        {
          name: 'reason',
          type: 'radio',
          label: this.translate.instant('ORDERS.ABSENCE.REASON.WRONG_ADDRESS'),
          value: 'WRONG_ADDRESS',
        },
        {
          name: 'reason',
          type: 'radio',
          label: this.translate.instant('ORDERS.ABSENCE.REASON.REFUSED'),
          value: 'CUSTOMER_REFUSED',
        },
        {
          name: 'reason',
          type: 'radio',
          label: this.translate.instant('ORDERS.ABSENCE.REASON.OTHER'),
          value: 'OTHER',
        },
      ],
      buttons: [
        { text: this.translate.instant('COMMON.CANCEL'), role: 'cancel' },
        {
          text: this.translate.instant('COMMON.NEXT'),
          handler: async (reasonCode) => {
            await this.promptAbsenceNotes(reasonCode);
          },
        },
      ],
    });

    await alert.present();
  }

  /**
   * Prompt for absence notes after reason selection
   */
  private async promptAbsenceNotes(reasonCode: string): Promise<void> {
    const notesAlert = await this.alertCtrl.create({
      header: this.translate.instant('ORDERS.ABSENCE.MEMO.LABEL'),
      message: this.translate.instant('ORDERS.ABSENCE.MEMO.PLACEHOLDER'),
      inputs: [
        {
          name: 'notes',
          type: 'textarea',
          placeholder: this.translate.instant('ORDERS.ABSENCE.MEMO.PLACEHOLDER'),
        },
      ],
      buttons: [
        {
          text: this.translate.instant('COMMON.BUTTON.CANCEL'),
          handler: () => this.updateStatus(OrderStatus.ABSENT, { reasonCode }),
        },
        {
          text: this.translate.instant('COMMON.CONFIRM'),
          handler: (data) => {
            this.updateStatus(OrderStatus.ABSENT, {
              reasonCode,
              notes: data.notes,
            });
          },
        },
      ],
    });

    await notesAlert.present();
  }

  private async updateStatus(
    newStatus: string,
    options?: { reasonCode?: string; notes?: string; appointmentDate?: string },
  ): Promise<void> {
    const currentOrder = this.order();
    if (!currentOrder) return;

    try {
      const updatePayload: {
        status: string;
        version: number;
        reasonCode?: string;
        notes?: string;
        appointmentDate?: string;
      } = {
        status: newStatus,
        version: currentOrder.version,
      };

      // Add status-specific fields (reasonCode used for absence reason, etc.)
      if (options?.reasonCode) {
        updatePayload.reasonCode = options.reasonCode;
      }
      if (options?.notes) {
        updatePayload.notes = options.notes;
      }
      if (options?.appointmentDate) {
        updatePayload.appointmentDate = options.appointmentDate;
      }

      const updated = await this.ordersService.updateStatus(currentOrder.id, updatePayload);

      this.order.set(updated);
      const transitions = ALLOWED_TRANSITIONS[updated.status as OrderStatus] || [];
      this.allowedTransitions.set(transitions as string[]);
    } catch (error) {
      this.logger.error('Failed to update status:', error);
    }
  }

  protected getStatusLabel(status: string): string {
    return TRANSITION_ACTION_LABELS[status as OrderStatus] || status;
  }

  protected getStatusButtonColor(status: string): string {
    return TRANSITION_BUTTON_COLORS[status as OrderStatus] || 'primary';
  }

  protected getStatusIcon(status: string): string {
    return TRANSITION_ICONS[status as OrderStatus] || 'checkmark-circle-outline';
  }
}
