import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonChip,
  RefresherCustomEvent,
  InfiniteScrollCustomEvent,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  chevronForwardOutline,
  cloudOfflineOutline,
  cubeOutline,
  calendarOutline,
  locationOutline,
  personOutline,
  layersOutline,
  alertCircleOutline,
  checkmarkCircleOutline,
  searchOutline,
  refreshOutline,
} from 'ionicons/icons';
import { NetworkService } from '@core/services/network.service';
import { AuthService } from '@core/services/auth.service';
import { OrdersStore } from '../../../../store/orders/orders.store';
import { InstallersStore } from '../../../../store/installers/installers.store';
import { UIStore } from '../../../../store/ui/ui.store';
import {
  OrderStatus,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
} from '../../../../store/orders/orders.models';

@Component({
  selector: 'app-order-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
    IonRefresher,
    IonRefresherContent,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonSpinner,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonChip,
    TranslateModule,
  ],
  template: `
    <ion-header class="order-list-header">
      <ion-toolbar color="primary">
        <ion-title>{{ 'ORDERS.LIST.TITLE' | translate }}</ion-title>
        @if (networkService.isOffline()) {
          <ion-chip slot="end" color="warning" class="offline-chip">
            <ion-icon name="cloud-offline-outline"></ion-icon>
            <ion-label>Offline</ion-label>
          </ion-chip>
        }
      </ion-toolbar>

      <!-- KPI Summary Bar -->
      <ion-toolbar class="kpi-toolbar">
        <div class="kpi-chips">
          <ion-chip class="kpi-chip kpi-total">
            <ion-icon name="layers-outline"></ion-icon>
            <ion-label>{{ ordersStore.kpiMetrics().total }}</ion-label>
          </ion-chip>
          <ion-chip class="kpi-chip kpi-pending" color="danger">
            <ion-icon name="alert-circle-outline"></ion-icon>
            <ion-label>{{ ordersStore.kpiMetrics().pending }}</ion-label>
          </ion-chip>
          <ion-chip class="kpi-chip kpi-completed" color="success">
            <ion-icon name="checkmark-circle-outline"></ion-icon>
            <ion-label>{{ ordersStore.kpiMetrics().completed || 0 }}</ion-label>
          </ion-chip>
        </div>
      </ion-toolbar>

      <!-- Search Bar -->
      <ion-toolbar class="search-toolbar">
        <ion-searchbar
          mode="ios"
          [debounce]="300"
          [placeholder]="'ORDERS.LIST.SEARCH_PLACEHOLDER' | translate"
          (ionInput)="onSearch($event)"
          class="custom-searchbar"
        ></ion-searchbar>
      </ion-toolbar>

      <!-- Filter Segment -->
      <ion-toolbar class="segment-toolbar">
        <ion-segment [value]="currentFilter()" (ionChange)="onFilterChange($event)" mode="ios">
          <ion-segment-button value="all">
            <ion-label>{{ 'ORDERS.FILTER.ALL' | translate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="pending">
            <ion-label>{{ 'ORDERS.FILTER.UNASSIGNED' | translate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="assigned">
            <ion-label>{{ 'ORDERS.FILTER.ASSIGNED' | translate }}</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content class="order-list-content">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content
          pullingIcon="refresh-outline"
          refreshingSpinner="crescent"
        ></ion-refresher-content>
      </ion-refresher>

      <!-- Loading State -->
      @if (ordersStore.isLoading() && ordersStore.orders().length === 0) {
        <div class="loading-state">
          <div class="loading-spinner-wrapper">
            <ion-spinner name="crescent" color="primary"></ion-spinner>
          </div>
          <p class="loading-text">{{ 'COMMON.LOADING' | translate }}</p>
        </div>
      } @else if (ordersStore.filteredOrders().length === 0) {
        <!-- Empty State -->
        <div class="empty-state">
          <div class="empty-icon-wrapper">
            <ion-icon name="cube-outline"></ion-icon>
          </div>
          <h3 class="empty-title">{{ 'ORDERS.LIST.NO_ORDERS' | translate }}</h3>
          <p class="empty-description">{{ 'ORDERS.LIST.PULL_TO_REFRESH' | translate }}</p>
          <ion-chip color="light" class="empty-hint">
            <ion-icon name="refresh-outline"></ion-icon>
            <ion-label>{{ 'COMMON.SWIPE_DOWN_REFRESH' | translate }}</ion-label>
          </ion-chip>
        </div>
      } @else {
        <!-- Order List -->
        <ion-list class="order-list" lines="none">
          @for (order of ordersStore.filteredOrders(); track order.id) {
            <ion-item button (click)="viewOrder(order.id)" class="order-card" detail="false">
              <div class="order-card-content">
                <!-- Status Badge - Top Right -->
                <div class="status-badge-wrapper">
                  <span class="status-badge" [attr.data-status]="order.status">
                    {{ getStatusKey(order.status) | translate }}
                  </span>
                </div>

                <!-- Order Header -->
                <div class="order-header">
                  <span class="order-number">{{ order.orderNo }}</span>
                  <ion-icon name="chevron-forward-outline" class="nav-icon"></ion-icon>
                </div>

                <!-- Customer Info -->
                <h2 class="customer-name">{{ order.customerName }}</h2>

                <!-- Order Details -->
                <div class="order-details">
                  <div class="detail-row">
                    <ion-icon name="calendar-outline"></ion-icon>
                    <span class="detail-text">
                      {{ order.appointmentDate | date: 'yyyy.MM.dd' }}
                      @if (order.appointmentSlot) {
                        <span class="time-slot">{{ order.appointmentSlot }}</span>
                      }
                    </span>
                  </div>
                  @if (order.customerAddress) {
                    <div class="detail-row">
                      <ion-icon name="location-outline"></ion-icon>
                      <span class="detail-text address-text">{{ order.customerAddress }}</span>
                    </div>
                  }
                  @if (order.installerName) {
                    <div class="detail-row">
                      <ion-icon name="person-outline"></ion-icon>
                      <span class="detail-text">{{ order.installerName }}</span>
                    </div>
                  }
                </div>
              </div>
            </ion-item>
          }
        </ion-list>

        <!-- Infinite Scroll -->
        @if (ordersStore.pagination().hasMore) {
          <ion-infinite-scroll (ionInfinite)="loadMore($event)">
            <ion-infinite-scroll-content loadingSpinner="crescent"></ion-infinite-scroll-content>
          </ion-infinite-scroll>
        }
      }
    </ion-content>
  `,
  styles: [
    `
      /* ========================================
         Header Styles
         ======================================== */
      .order-list-header ion-toolbar {
        --border-width: 0;
      }

      .offline-chip {
        --background: var(--ion-color-warning);
        --color: var(--ion-color-warning-contrast);
        height: 28px;
        font-size: 12px;
        font-weight: 600;
        margin-inline-end: 8px;
      }

      /* KPI Toolbar */
      .kpi-toolbar {
        --background: var(--ion-color-primary);
        --padding-top: 0;
        --padding-bottom: 12px;
      }

      .kpi-chips {
        display: flex;
        justify-content: center;
        gap: 8px;
        padding: 0 16px;
      }

      .kpi-chip {
        --background: rgba(255, 255, 255, 0.2);
        --color: #fff;
        height: 32px;
        font-size: 13px;
        font-weight: 600;
        border-radius: 16px;
      }

      .kpi-chip ion-icon {
        font-size: 16px;
        margin-inline-end: 4px;
      }

      .kpi-chip.kpi-pending {
        --background: rgba(235, 68, 90, 0.9);
      }

      .kpi-chip.kpi-completed {
        --background: rgba(45, 211, 111, 0.9);
      }

      /* Search Toolbar */
      .search-toolbar {
        --background: var(--ion-background-color);
        --padding-start: 12px;
        --padding-end: 12px;
        --padding-top: 8px;
        --padding-bottom: 4px;
      }

      .custom-searchbar {
        --background: var(--ion-color-light);
        --border-radius: 12px;
        --box-shadow: none;
        --placeholder-opacity: 0.6;
        --icon-color: var(--ion-color-medium);
        padding: 0 !important;
        height: 44px;
      }

      /* Segment Toolbar */
      .segment-toolbar {
        --background: var(--ion-background-color);
        --padding-start: 12px;
        --padding-end: 12px;
        --padding-top: 4px;
        --padding-bottom: 12px;
      }

      ion-segment {
        --background: var(--ion-color-light);
        border-radius: 10px;
        min-height: 36px;
      }

      ion-segment-button {
        --indicator-color: var(--ion-color-primary);
        --color: var(--ion-color-medium);
        --color-checked: #fff;
        --indicator-height: 100%;
        --border-radius: 8px;
        min-height: 36px;
        font-size: 13px;
        font-weight: 500;
        text-transform: none;
        letter-spacing: 0;
      }

      /* ========================================
         Content Styles
         ======================================== */
      .order-list-content {
        --background: #f4f5f8;
      }

      @media (prefers-color-scheme: dark) {
        .order-list-content {
          --background: #121212;
        }
      }

      /* Loading State */
      .loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 50vh;
        padding: 32px;
      }

      .loading-spinner-wrapper {
        width: 64px;
        height: 64px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--ion-color-primary-tint);
        border-radius: 50%;
        margin-bottom: 16px;
      }

      .loading-spinner-wrapper ion-spinner {
        width: 32px;
        height: 32px;
      }

      .loading-text {
        color: var(--ion-color-medium);
        font-size: 14px;
        margin: 0;
      }

      /* Empty State */
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 60vh;
        padding: 32px;
        text-align: center;
      }

      .empty-icon-wrapper {
        width: 96px;
        height: 96px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
        border-radius: 24px;
        margin-bottom: 24px;
      }

      .empty-icon-wrapper ion-icon {
        font-size: 48px;
        color: #6366f1;
      }

      @media (prefers-color-scheme: dark) {
        .empty-icon-wrapper {
          background: linear-gradient(135deg, #312e81 0%, #4338ca 100%);
        }
        .empty-icon-wrapper ion-icon {
          color: #a5b4fc;
        }
      }

      .empty-title {
        font-size: 18px;
        font-weight: 600;
        color: var(--ion-text-color);
        margin: 0 0 8px 0;
      }

      .empty-description {
        font-size: 14px;
        color: var(--ion-color-medium);
        margin: 0 0 20px 0;
        max-width: 240px;
        line-height: 1.5;
      }

      .empty-hint {
        --background: var(--ion-color-light);
        --color: var(--ion-color-medium);
        font-size: 12px;
        height: 32px;
      }

      .empty-hint ion-icon {
        font-size: 14px;
        margin-inline-end: 4px;
      }

      /* ========================================
         Order List & Card Styles
         ======================================== */
      .order-list {
        padding: 8px 12px 16px 12px;
        background: transparent;
      }

      .order-card {
        --background: var(--ion-card-background, #fff);
        --padding-start: 0;
        --padding-end: 0;
        --padding-top: 0;
        --padding-bottom: 0;
        --inner-padding-start: 0;
        --inner-padding-end: 0;
        --min-height: auto;
        --border-radius: 12px;
        margin-bottom: 10px;
        border-radius: 12px;
        box-shadow:
          0 1px 3px rgba(0, 0, 0, 0.08),
          0 1px 2px rgba(0, 0, 0, 0.06);
        overflow: hidden;
        transition:
          transform 0.15s ease,
          box-shadow 0.15s ease;
      }

      .order-card:active {
        transform: scale(0.98);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      }

      @media (prefers-color-scheme: dark) {
        .order-card {
          --background: #1e1e1e;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }
      }

      .order-card-content {
        padding: 14px 16px 16px 16px;
        width: 100%;
        position: relative;
      }

      /* Status Badge */
      .status-badge-wrapper {
        position: absolute;
        top: 12px;
        right: 12px;
      }

      .status-badge {
        display: inline-flex;
        align-items: center;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }

      /* Status Colors - Semantic colors for each status */
      .status-badge[data-status='UNASSIGNED'] {
        background: linear-gradient(135deg, #fecaca 0%, #fca5a5 100%);
        color: #991b1b;
      }
      .status-badge[data-status='ASSIGNED'] {
        background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
        color: #92400e;
      }
      .status-badge[data-status='CONFIRMED'] {
        background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
        color: #065f46;
      }
      .status-badge[data-status='RELEASED'] {
        background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
        color: #1e40af;
      }
      .status-badge[data-status='DISPATCHED'] {
        background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
        color: #3730a3;
      }
      .status-badge[data-status='COMPLETED'] {
        background: linear-gradient(135deg, #d1fae5 0%, #6ee7b7 100%);
        color: #047857;
      }
      .status-badge[data-status='PARTIAL'] {
        background: linear-gradient(135deg, #cffafe 0%, #a5f3fc 100%);
        color: #0e7490;
      }
      .status-badge[data-status='POSTPONED'] {
        background: linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%);
        color: #9a3412;
      }
      .status-badge[data-status='ABSENT'] {
        background: linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%);
        color: #374151;
      }
      .status-badge[data-status='CANCELLED'],
      .status-badge[data-status='REQUEST_CANCEL'] {
        background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
        color: #6b7280;
      }
      .status-badge[data-status='COLLECTED'] {
        background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
        color: #166534;
      }

      /* Dark mode status badges */
      @media (prefers-color-scheme: dark) {
        .status-badge[data-status='UNASSIGNED'] {
          background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%);
          color: #fecaca;
        }
        .status-badge[data-status='ASSIGNED'] {
          background: linear-gradient(135deg, #78350f 0%, #92400e 100%);
          color: #fef3c7;
        }
        .status-badge[data-status='CONFIRMED'] {
          background: linear-gradient(135deg, #064e3b 0%, #065f46 100%);
          color: #d1fae5;
        }
        .status-badge[data-status='RELEASED'] {
          background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
          color: #dbeafe;
        }
        .status-badge[data-status='DISPATCHED'] {
          background: linear-gradient(135deg, #312e81 0%, #3730a3 100%);
          color: #e0e7ff;
        }
        .status-badge[data-status='COMPLETED'] {
          background: linear-gradient(135deg, #047857 0%, #059669 100%);
          color: #d1fae5;
        }
        .status-badge[data-status='PARTIAL'] {
          background: linear-gradient(135deg, #155e75 0%, #0e7490 100%);
          color: #cffafe;
        }
        .status-badge[data-status='POSTPONED'] {
          background: linear-gradient(135deg, #7c2d12 0%, #9a3412 100%);
          color: #ffedd5;
        }
        .status-badge[data-status='ABSENT'] {
          background: linear-gradient(135deg, #374151 0%, #4b5563 100%);
          color: #e5e7eb;
        }
        .status-badge[data-status='CANCELLED'],
        .status-badge[data-status='REQUEST_CANCEL'] {
          background: linear-gradient(135deg, #4b5563 0%, #6b7280 100%);
          color: #e5e7eb;
        }
        .status-badge[data-status='COLLECTED'] {
          background: linear-gradient(135deg, #14532d 0%, #166534 100%);
          color: #dcfce7;
        }
      }

      /* Order Header */
      .order-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;
        padding-right: 80px;
      }

      .order-number {
        font-size: 12px;
        font-weight: 600;
        color: var(--ion-color-primary);
        letter-spacing: 0.3px;
      }

      .nav-icon {
        position: absolute;
        right: 12px;
        bottom: 16px;
        font-size: 18px;
        color: var(--ion-color-medium-tint);
      }

      /* Customer Name */
      .customer-name {
        font-size: 16px;
        font-weight: 600;
        color: var(--ion-text-color);
        margin: 0 0 10px 0;
        line-height: 1.3;
      }

      /* Order Details */
      .order-details {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .detail-row {
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }

      .detail-row ion-icon {
        font-size: 14px;
        color: var(--ion-color-medium);
        flex-shrink: 0;
        margin-top: 1px;
      }

      .detail-text {
        font-size: 13px;
        color: var(--ion-color-medium-shade);
        line-height: 1.4;
      }

      .time-slot {
        display: inline-block;
        margin-left: 6px;
        padding: 1px 6px;
        background: var(--ion-color-primary-tint);
        color: var(--ion-color-primary);
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
      }

      @media (prefers-color-scheme: dark) {
        .time-slot {
          background: rgba(var(--ion-color-primary-rgb), 0.2);
        }
      }

      .address-text {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `,
  ],
})
export class OrderListPage implements OnInit {
  readonly ordersStore = inject(OrdersStore);
  readonly installersStore = inject(InstallersStore);
  readonly uiStore = inject(UIStore);
  protected readonly networkService = inject(NetworkService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly currentFilter = signal<'all' | 'pending' | 'assigned'>('all');

  constructor() {
    addIcons({
      chevronForwardOutline,
      cloudOfflineOutline,
      cubeOutline,
      calendarOutline,
      locationOutline,
      personOutline,
      layersOutline,
      alertCircleOutline,
      checkmarkCircleOutline,
      searchOutline,
      refreshOutline,
    });
  }

  ngOnInit(): void {
    this.loadOrders();
  }

  protected async onRefresh(event: RefresherCustomEvent): Promise<void> {
    await this.loadOrders();
    event.target.complete();
  }

  protected onSearch(event: CustomEvent): void {
    const query = event.detail.value || '';
    this.ordersStore.setFilters({ customerName: query || undefined });
  }

  protected onFilterChange(event: CustomEvent): void {
    const filter = event.detail.value as 'all' | 'pending' | 'assigned';
    this.currentFilter.set(filter);

    if (filter === 'all') {
      this.ordersStore.clearFilters();
    } else if (filter === 'pending') {
      this.ordersStore.setFilters({ status: [OrderStatus.UNASSIGNED] });
    } else if (filter === 'assigned') {
      this.ordersStore.setFilters({ status: [OrderStatus.ASSIGNED, OrderStatus.CONFIRMED] });
    }
  }

  protected async loadMore(event: InfiniteScrollCustomEvent): Promise<void> {
    await this.ordersStore.loadMoreOrders();
    event.target.complete();
  }

  protected viewOrder(id: string): void {
    this.ordersStore.selectOrder(id);
    this.router.navigate(['/tabs/orders', id]);
  }

  protected getStatusColor(status: string): string {
    return ORDER_STATUS_COLORS[status as OrderStatus] || 'medium';
  }

  protected getStatusKey(status: string): string {
    return ORDER_STATUS_LABELS[status as OrderStatus] || status;
  }

  private readonly translate = inject(TranslateService);

  private async loadOrders(): Promise<void> {
    try {
      const user = this.authService.user();
      const branchCode = user?.branchCode || 'ALL';
      // Load stats for accurate KPI counts, then load paginated orders
      await Promise.all([
        this.ordersStore.loadStats(branchCode),
        this.ordersStore.loadOrders(branchCode, 1, 20),
        this.installersStore.loadInstallers(branchCode),
      ]);
    } catch (error) {
      console.error('[OrderList] Failed to load orders:', error);
      this.uiStore.showToast(this.translate.instant('ORDERS.ERROR.LOAD_FAILED'), 'danger');
    }
  }
}
