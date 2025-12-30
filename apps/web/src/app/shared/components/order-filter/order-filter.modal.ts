/**
 * Order Filter Modal
 * Reusable filter component for assignment and completion lists
 */

import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
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
        <ion-title>{{ 'FILTER.TITLE' | translate }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="reset()" color="medium">
            <ion-icon name="refresh-outline"></ion-icon>
            {{ 'FILTER.RESET' | translate }}
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Date Range Section -->
      <div class="filter-section">
        <h3>
          <ion-icon name="calendar-outline"></ion-icon>
          {{ 'FILTER.DATE_RANGE' | translate }}
        </h3>

        <ion-list>
          <ion-item>
            <ion-label>{{ 'FILTER.START_DATE' | translate }}</ion-label>
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
            <ion-label>{{ 'FILTER.END_DATE' | translate }}</ion-label>
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
        <h3>{{ 'FILTER.STATUS' | translate }}</h3>
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
            {{ 'FILTER.INSTALLER' | translate }}
          </h3>
          <ion-list>
            <ion-item>
              <ion-select
                [value]="selectedInstaller()"
                (ionChange)="onInstallerChange($event)"
                [placeholder]="'COMMON.ALL' | translate"
                interface="action-sheet"
              >
                <ion-select-option value="">{{ 'COMMON.ALL' | translate }}</ion-select-option>
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
            {{ 'FILTER.BRANCH' | translate }}
          </h3>
          <ion-list>
            <ion-item>
              <ion-select
                [value]="selectedBranch()"
                (ionChange)="onBranchChange($event)"
                [placeholder]="'COMMON.ALL' | translate"
                interface="action-sheet"
              >
                <ion-select-option value="">{{ 'COMMON.ALL' | translate }}</ion-select-option>
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
          <ion-note>
            {{ 'FILTER.ACTIVE_COUNT' | translate: { count: activeFilterCount() } }}
          </ion-note>
        </div>
      }
    </ion-content>

    <ion-footer>
      <ion-toolbar>
        <ion-button expand="block" (click)="apply()">
          <ion-icon name="checkmark-outline" slot="start"></ion-icon>
          {{ 'FILTER.APPLY' | translate }}
        </ion-button>
      </ion-toolbar>
    </ion-footer>
  `,
  styles: [`
    .filter-section {
      margin-bottom: 24px;

      h3 {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 600;
        color: var(--ion-color-medium);
        text-transform: uppercase;
        margin-bottom: 12px;
        padding-left: 4px;

        ion-icon {
          font-size: 18px;
        }
      }
    }

    .status-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .active-filters {
      text-align: center;
      margin-top: 16px;

      ion-note {
        color: var(--ion-color-primary);
      }
    }

    ion-footer ion-toolbar {
      padding: 8px 16px;
    }
  `],
})
export class OrderFilterModal implements OnInit {
  private readonly modalController = inject(ModalController);
  private readonly navParams = inject(NavParams);
  private readonly translate = inject(TranslateService);

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
      this.selectedStatuses.set(current.filter(s => s !== status));
    } else {
      this.selectedStatuses.set([...current, status]);
    }
  }

  getStatusLabel(status: OrderStatus): string {
    const key = ORDER_STATUS_LABELS[status];
    return key ? this.translate.instant(key) : status;
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
