/**
 * Order Filter Modal
 * Reusable filter component for assignment and completion lists
 */

import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonFooter,
  IonButton,
  IonButtons,
  IonLabel,
  IonItem,
  IonList,
  IonIcon,
  IonDatetime,
  IonDatetimeButton,
  IonSelect,
  IonSelectOption,
  IonNote,
  IonChip,
  ModalController,
  NavParams,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  closeOutline,
  checkmarkOutline,
  calendarOutline,
  personOutline,
  refreshOutline,
  businessOutline,
} from 'ionicons/icons';
import { TranslateModule } from '@ngx-translate/core';
import {
  OrderStatus,
  ORDER_STATUS_LABELS,
  OrderFilterOptions,
} from '../../../store/orders/orders.models';

/**
 * Filter context determines which statuses are shown
 */
export type FilterContext = 'assignment' | 'completion' | 'all';

/**
 * Installer option for select
 */
export interface InstallerOption {
  id: string;
  name: string;
}

/**
 * Branch option for select
 */
export interface BranchOption {
  code: string;
  name: string;
}

@Component({
  selector: 'app-order-filter-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonFooter,
    IonButton,
    IonButtons,
    IonLabel,
    IonItem,
    IonList,
    IonIcon,
    IonDatetime,
    IonDatetimeButton,
    IonSelect,
    IonSelectOption,
    IonNote,
    IonChip,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="dismiss()">
            <ion-icon name="close-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>필터</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="reset()" color="medium">
            <ion-icon name="refresh-outline"></ion-icon>
            초기화
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Date Range Section -->
      <div class="filter-section">
        <h3>
          <ion-icon name="calendar-outline"></ion-icon>
          날짜 범위
        </h3>

        <ion-list>
          <ion-item>
            <ion-label>시작일</ion-label>
            <ion-datetime-button datetime="startDate"></ion-datetime-button>
          </ion-item>
          <ion-datetime
            id="startDate"
            presentation="date"
            [value]="startDate()"
            (ionChange)="onStartDateChange($event)"
            [max]="maxDate"
          ></ion-datetime>

          <ion-item>
            <ion-label>종료일</ion-label>
            <ion-datetime-button datetime="endDate"></ion-datetime-button>
          </ion-item>
          <ion-datetime
            id="endDate"
            presentation="date"
            [value]="endDate()"
            (ionChange)="onEndDateChange($event)"
            [max]="maxDate"
          ></ion-datetime>
        </ion-list>
      </div>

      <!-- Status Section -->
      <div class="filter-section">
        <h3>상태</h3>
        <div class="status-chips">
          @for (status of availableStatuses(); track status) {
            <ion-chip
              [color]="isStatusSelected(status) ? 'primary' : 'medium'"
              [outline]="!isStatusSelected(status)"
              (click)="toggleStatus(status)"
            >
              <ion-label>{{ getStatusLabel(status) }}</ion-label>
            </ion-chip>
          }
        </div>
      </div>

      <!-- Installer Section (if available) -->
      @if (installers().length > 0) {
        <div class="filter-section">
          <h3>
            <ion-icon name="person-outline"></ion-icon>
            설치기사
          </h3>
          <ion-list>
            <ion-item>
              <ion-select
                [value]="selectedInstaller()"
                (ionChange)="onInstallerChange($event)"
                [placeholder]="'PLACEHOLDERS.ALL' | translate"
                interface="action-sheet"
              >
                <ion-select-option value="">{{ 'PLACEHOLDERS.ALL' | translate }}</ion-select-option>
                @for (installer of installers(); track installer.id) {
                  <ion-select-option [value]="installer.id">
                    {{ installer.name }}
                  </ion-select-option>
                }
              </ion-select>
            </ion-item>
          </ion-list>
        </div>
      }

      <!-- Branch Section (for admins) -->
      @if (branches().length > 0) {
        <div class="filter-section">
          <h3>
            <ion-icon name="business-outline"></ion-icon>
            지점
          </h3>
          <ion-list>
            <ion-item>
              <ion-select
                [value]="selectedBranch()"
                (ionChange)="onBranchChange($event)"
                [placeholder]="'PLACEHOLDERS.ALL' | translate"
                interface="action-sheet"
              >
                <ion-select-option value="">{{ 'PLACEHOLDERS.ALL' | translate }}</ion-select-option>
                @for (branch of branches(); track branch.code) {
                  <ion-select-option [value]="branch.code">
                    {{ branch.name }}
                  </ion-select-option>
                }
              </ion-select>
            </ion-item>
          </ion-list>
        </div>
      }

      <!-- Active Filters Summary -->
      @if (activeFilterCount() > 0) {
        <div class="active-filters">
          <ion-note> {{ activeFilterCount() }}개의 필터가 적용됨 </ion-note>
        </div>
      }
    </ion-content>

    <ion-footer>
      <ion-toolbar>
        <ion-button expand="block" (click)="apply()">
          <ion-icon name="checkmark-outline" slot="start"></ion-icon>
          적용하기
        </ion-button>
      </ion-toolbar>
    </ion-footer>
  `,
  styles: [
    `
      /* ============================================
     * MODAL HEADER - Elevated with subtle depth
     * ============================================ */
      ion-header {
        ion-toolbar {
          --background: var(--background-elevated, #ffffff);
          --border-width: 0;
          box-shadow: var(--shadow-sm);

          ion-title {
            font-size: var(--font-size-lg, 1.25rem);
            font-weight: var(--font-weight-semibold, 600);
            letter-spacing: var(--letter-spacing-tight, -0.015em);
          }

          ion-button {
            --color: var(--text-secondary, #64748b);
            font-size: var(--font-size-sm, 0.875rem);
            font-weight: var(--font-weight-medium, 500);

            ion-icon {
              font-size: 22px;
            }

            &:hover {
              --color: var(--ion-color-primary);
            }
          }
        }
      }

      /* ============================================
     * CONTENT AREA - Soft background texture
     * ============================================ */
      ion-content {
        --background: var(--background-secondary, #f8fafc);

        &::part(background) {
          background: linear-gradient(
            180deg,
            var(--background-secondary, #f8fafc) 0%,
            var(--background-tertiary, #f1f5f9) 100%
          );
        }
      }

      /* ============================================
     * FILTER SECTION CARDS
     * Floating cards with subtle elevation
     * ============================================ */
      .filter-section {
        margin-bottom: var(--space-4, 1rem);
        background: var(--background-elevated, #ffffff);
        border-radius: var(--radius-xl, 1rem);
        padding: var(--space-4, 1rem);
        box-shadow: var(--shadow-sm);
        border: 1px solid var(--border-subtle, #e2e8f0);

        /* Stagger animation on load */
        animation: slideUp 0.4s var(--ease-out) backwards;

        &:nth-child(1) {
          animation-delay: 0.05s;
        }
        &:nth-child(2) {
          animation-delay: 0.1s;
        }
        &:nth-child(3) {
          animation-delay: 0.15s;
        }
        &:nth-child(4) {
          animation-delay: 0.2s;
        }

        h3 {
          display: flex;
          align-items: center;
          gap: var(--space-2, 0.5rem);
          font-size: var(--font-size-xs, 0.75rem);
          font-weight: var(--font-weight-semibold, 600);
          color: var(--text-tertiary, #64748b);
          text-transform: uppercase;
          letter-spacing: var(--letter-spacing-wider, 0.03em);
          margin: 0 0 var(--space-3, 0.75rem) 0;
          padding-bottom: var(--space-2, 0.5rem);
          border-bottom: 1px solid var(--border-subtle, #e2e8f0);

          ion-icon {
            font-size: 16px;
            color: var(--ion-color-primary);
            opacity: 0.8;
          }
        }

        ion-list {
          background: transparent;
          padding: 0;
          margin: 0;

          ion-item {
            --background: var(--background-secondary, #f8fafc);
            --border-radius: var(--radius-md, 0.5rem);
            --padding-start: var(--space-3, 0.75rem);
            --padding-end: var(--space-3, 0.75rem);
            --inner-padding-end: 0;
            --min-height: 52px;
            margin-bottom: var(--space-2, 0.5rem);
            border: 1px solid var(--border-subtle, #e2e8f0);
            border-radius: var(--radius-md, 0.5rem);
            transition: all var(--transition-fast, 100ms) var(--ease-out);

            &:last-child {
              margin-bottom: 0;
            }

            &:hover,
            &:focus-within {
              --background: var(--background-tertiary, #f1f5f9);
              border-color: var(--ion-color-primary-tint);
            }

            ion-label {
              font-size: var(--font-size-sm, 0.875rem);
              font-weight: var(--font-weight-medium, 500);
              color: var(--text-secondary, #475569);
            }
          }
        }
      }

      /* ============================================
     * DATE PICKER BUTTONS
     * Modern, pill-shaped date selectors
     * ============================================ */
      ion-datetime-button {
        &::part(native) {
          background: linear-gradient(
            135deg,
            var(--ion-color-primary-tint) 0%,
            var(--ion-color-primary) 100%
          );
          color: var(--ion-color-primary-contrast, #ffffff);
          border-radius: var(--radius-full, 9999px);
          padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
          font-size: var(--font-size-sm, 0.875rem);
          font-weight: var(--font-weight-medium, 500);
          min-width: 120px;
          box-shadow: var(--shadow-primary);
          transition: all var(--transition-normal, 200ms) var(--ease-out);
        }

        &:hover::part(native) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px 0 rgba(37, 99, 235, 0.35);
        }

        &:active::part(native) {
          transform: translateY(0);
        }
      }

      /* Hidden datetime modal styling */
      ion-datetime {
        --background: var(--background-elevated, #ffffff);
        --background-rgb: 255, 255, 255;
        border-radius: var(--radius-lg, 0.75rem);
      }

      /* ============================================
     * STATUS CHIPS
     * Large touch targets with satisfying feedback
     * ============================================ */
      .status-chips {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2, 0.5rem);

        ion-chip {
          --background: var(--background-secondary, #f1f5f9);
          --color: var(--text-secondary, #64748b);
          --padding-start: var(--space-4, 1rem);
          --padding-end: var(--space-4, 1rem);
          height: 40px;
          min-width: 80px;
          border-radius: var(--radius-full, 9999px);
          border: 2px solid var(--border-subtle, #e2e8f0);
          font-size: var(--font-size-sm, 0.875rem);
          font-weight: var(--font-weight-medium, 500);
          transition: all var(--transition-normal, 200ms) var(--ease-out);
          cursor: pointer;

          ion-label {
            margin: 0;
          }

          /* Unselected hover state */
          &:hover:not([color='primary']) {
            --background: var(--background-tertiary, #e2e8f0);
            border-color: var(--border-default, #cbd5e1);
            transform: translateY(-1px);
          }

          /* Selected state with glow effect */
          &[color='primary'] {
            --background: linear-gradient(
              135deg,
              var(--ion-color-primary) 0%,
              var(--ion-color-primary-shade) 100%
            );
            --color: var(--ion-color-primary-contrast, #ffffff);
            border-color: var(--ion-color-primary);
            box-shadow: var(--shadow-primary);
            transform: scale(1.02);

            &:hover {
              box-shadow: 0 6px 20px 0 rgba(37, 99, 235, 0.4);
              transform: scale(1.04) translateY(-1px);
            }
          }

          /* Press animation */
          &:active {
            transform: scale(0.98) !important;
            transition: transform 0.1s ease;
          }
        }
      }

      /* ============================================
     * SELECT DROPDOWNS
     * Clean, modern select appearance
     * ============================================ */
      ion-select {
        --placeholder-color: var(--text-placeholder, #94a3b8);
        --placeholder-opacity: 1;
        font-size: var(--font-size-sm, 0.875rem);
        font-weight: var(--font-weight-medium, 500);
        color: var(--text-primary, #1e293b);
        min-height: 44px;
        width: 100%;

        &::part(container) {
          padding: 0;
        }

        &::part(icon) {
          color: var(--ion-color-primary);
          opacity: 0.7;
        }

        &::part(text) {
          padding-inline-end: var(--space-2, 0.5rem);
        }
      }

      /* ============================================
     * ACTIVE FILTERS BADGE
     * Eye-catching count indicator
     * ============================================ */
      .active-filters {
        margin-top: var(--space-4, 1rem);
        padding: var(--space-4, 1rem);
        background: linear-gradient(
          135deg,
          rgba(37, 99, 235, 0.08) 0%,
          rgba(99, 102, 241, 0.12) 100%
        );
        border-radius: var(--radius-xl, 1rem);
        border: 1px dashed var(--ion-color-primary-tint);
        text-align: center;
        animation: pulse-subtle 2s ease-in-out infinite;

        ion-note {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2, 0.5rem);
          color: var(--ion-color-primary);
          font-size: var(--font-size-sm, 0.875rem);
          font-weight: var(--font-weight-semibold, 600);

          &::before {
            content: '';
            display: inline-block;
            width: 8px;
            height: 8px;
            background: var(--ion-color-primary);
            border-radius: var(--radius-full, 9999px);
            animation: blink 1.5s ease-in-out infinite;
          }
        }
      }

      /* ============================================
     * FOOTER - Prominent apply button
     * ============================================ */
      ion-footer {
        box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.08);

        ion-toolbar {
          --background: var(--background-elevated, #ffffff);
          --border-width: 0;
          padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
          padding-bottom: calc(var(--space-3, 0.75rem) + var(--ion-safe-area-bottom, 0));

          ion-button {
            --background: linear-gradient(
              135deg,
              var(--ion-color-primary) 0%,
              var(--ion-color-primary-shade) 100%
            );
            --background-hover: var(--ion-color-primary-shade);
            --background-activated: var(--ion-color-primary-shade);
            --border-radius: var(--radius-xl, 1rem);
            --box-shadow: var(--shadow-primary);
            --padding-top: var(--space-4, 1rem);
            --padding-bottom: var(--space-4, 1rem);
            height: 56px;
            font-size: var(--font-size-base, 1rem);
            font-weight: var(--font-weight-semibold, 600);
            letter-spacing: var(--letter-spacing-wide, 0.015em);
            text-transform: none;
            transition: all var(--transition-normal, 200ms) var(--ease-out);

            ion-icon {
              font-size: 20px;
              margin-right: var(--space-2, 0.5rem);
            }

            &:hover {
              --box-shadow: 0 8px 30px 0 rgba(37, 99, 235, 0.4);
              transform: translateY(-2px);
            }

            &:active {
              transform: translateY(0) scale(0.98);
            }
          }
        }
      }

      /* ============================================
     * ANIMATIONS
     * ============================================ */
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(12px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes pulse-subtle {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.85;
        }
      }

      @keyframes blink {
        0%,
        100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.5;
          transform: scale(0.8);
        }
      }

      /* ============================================
     * DARK MODE SUPPORT
     * ============================================ */
      @media (prefers-color-scheme: dark) {
        ion-header ion-toolbar {
          box-shadow: 0 1px 0 var(--border-subtle, #334155);
        }

        .filter-section {
          background: var(--background-elevated, #1e293b);
          border-color: var(--border-subtle, #334155);
          box-shadow: var(--shadow-md);

          h3 {
            border-bottom-color: var(--border-subtle, #334155);
          }

          ion-list ion-item {
            --background: var(--background-tertiary, #334155);
            border-color: var(--border-subtle, #475569);
          }
        }

        .status-chips ion-chip {
          --background: var(--background-tertiary, #334155);
          border-color: var(--border-subtle, #475569);

          &:hover:not([color='primary']) {
            --background: var(--gray-600, #475569);
          }

          &[color='primary'] {
            --background: linear-gradient(
              135deg,
              var(--ion-color-primary) 0%,
              var(--ion-color-primary-shade) 100%
            );
            border-color: var(--ion-color-primary);
          }
        }

        ion-datetime-button::part(native) {
          background: linear-gradient(
            135deg,
            var(--ion-color-primary) 0%,
            var(--ion-color-primary-shade) 100%
          );
        }

        .active-filters {
          background: linear-gradient(
            135deg,
            rgba(59, 130, 246, 0.15) 0%,
            rgba(129, 140, 248, 0.2) 100%
          );
          border-color: var(--ion-color-primary-shade);
        }

        ion-footer {
          box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);

          ion-toolbar {
            background: var(--background-elevated, #1e293b);
          }
        }
      }

      /* ============================================
     * MANUAL DARK MODE CLASS
     * ============================================ */
      :host-context(.dark),
      :host-context(.ion-palette-dark) {
        ion-header ion-toolbar {
          box-shadow: 0 1px 0 var(--border-subtle, #334155);
        }

        .filter-section {
          background: var(--background-elevated, #1e293b);
          border-color: var(--border-subtle, #334155);

          h3 {
            border-bottom-color: var(--border-subtle, #334155);
          }
        }

        .status-chips ion-chip {
          --background: var(--background-tertiary, #334155);
          border-color: var(--border-subtle, #475569);
        }

        .active-filters {
          background: linear-gradient(
            135deg,
            rgba(59, 130, 246, 0.15) 0%,
            rgba(129, 140, 248, 0.2) 100%
          );
        }
      }

      /* ============================================
     * REDUCED MOTION SUPPORT
     * ============================================ */
      @media (prefers-reduced-motion: reduce) {
        .filter-section {
          animation: none;
        }

        .status-chips ion-chip,
        ion-datetime-button::part(native),
        ion-footer ion-toolbar ion-button {
          transition: none;
        }

        .active-filters {
          animation: none;
        }

        .active-filters ion-note::before {
          animation: none;
        }
      }
    `,
  ],
})
export class OrderFilterModal implements OnInit {
  private readonly modalController = inject(ModalController);
  private readonly navParams = inject(NavParams);

  // Input data from parent
  protected readonly context = signal<FilterContext>('all');
  protected readonly currentFilters = signal<OrderFilterOptions>({});
  protected readonly installers = signal<InstallerOption[]>([]);
  protected readonly branches = signal<BranchOption[]>([]);

  // Filter state
  protected readonly startDate = signal<string>('');
  protected readonly endDate = signal<string>('');
  protected readonly selectedStatuses = signal<OrderStatus[]>([]);
  protected readonly selectedInstaller = signal<string>('');
  protected readonly selectedBranch = signal<string>('');

  protected readonly maxDate = new Date().toISOString();

  // Computed: available statuses based on context
  protected readonly availableStatuses = computed(() => {
    const ctx = this.context();

    if (ctx === 'assignment') {
      return [OrderStatus.UNASSIGNED, OrderStatus.ASSIGNED, OrderStatus.CONFIRMED];
    }

    if (ctx === 'completion') {
      return [
        OrderStatus.RELEASED,
        OrderStatus.DISPATCHED,
        OrderStatus.COMPLETED,
        OrderStatus.PARTIAL,
        OrderStatus.POSTPONED,
        OrderStatus.ABSENT,
      ];
    }

    return Object.values(OrderStatus);
  });

  // Computed: count of active filters
  protected readonly activeFilterCount = computed(() => {
    let count = 0;
    if (this.startDate()) count++;
    if (this.endDate()) count++;
    if (this.selectedStatuses().length > 0) count++;
    if (this.selectedInstaller()) count++;
    if (this.selectedBranch()) count++;
    return count;
  });

  constructor() {
    addIcons({
      closeOutline,
      checkmarkOutline,
      calendarOutline,
      personOutline,
      refreshOutline,
      businessOutline,
    });
  }

  ngOnInit(): void {
    // Load params from parent
    const ctx = this.navParams.get('context') || 'all';
    const filters = this.navParams.get('currentFilters') || {};
    const installerList = this.navParams.get('installers') || [];
    const branchList = this.navParams.get('branches') || [];

    this.context.set(ctx);
    this.currentFilters.set(filters);
    this.installers.set(installerList);
    this.branches.set(branchList);

    // Initialize filter state from current filters
    if (filters.startDate) this.startDate.set(filters.startDate);
    if (filters.endDate) this.endDate.set(filters.endDate);
    if (filters.status) this.selectedStatuses.set(filters.status);
    if (filters.installerId) this.selectedInstaller.set(filters.installerId);
    if (filters.branchCode) this.selectedBranch.set(filters.branchCode);
  }

  isStatusSelected(status: OrderStatus): boolean {
    return this.selectedStatuses().includes(status);
  }

  toggleStatus(status: OrderStatus): void {
    const current = this.selectedStatuses();
    if (current.includes(status)) {
      this.selectedStatuses.set(current.filter((s) => s !== status));
    } else {
      this.selectedStatuses.set([...current, status]);
    }
  }

  getStatusLabel(status: OrderStatus): string {
    return ORDER_STATUS_LABELS[status] || status;
  }

  onStartDateChange(event: CustomEvent): void {
    this.startDate.set(event.detail.value || '');
  }

  onEndDateChange(event: CustomEvent): void {
    this.endDate.set(event.detail.value || '');
  }

  onInstallerChange(event: CustomEvent): void {
    this.selectedInstaller.set(event.detail.value || '');
  }

  onBranchChange(event: CustomEvent): void {
    this.selectedBranch.set(event.detail.value || '');
  }

  reset(): void {
    this.startDate.set('');
    this.endDate.set('');
    this.selectedStatuses.set([]);
    this.selectedInstaller.set('');
    this.selectedBranch.set('');
  }

  dismiss(): void {
    this.modalController.dismiss(null, 'cancel');
  }

  apply(): void {
    const filters: OrderFilterOptions = {};

    if (this.startDate()) {
      filters.startDate = this.startDate().split('T')[0];
    }
    if (this.endDate()) {
      filters.endDate = this.endDate().split('T')[0];
    }
    if (this.selectedStatuses().length > 0) {
      filters.status = this.selectedStatuses();
    }
    if (this.selectedInstaller()) {
      filters.installerId = this.selectedInstaller();
    }
    if (this.selectedBranch()) {
      filters.branchCode = this.selectedBranch();
    }

    this.modalController.dismiss(filters, 'apply');
  }
}
