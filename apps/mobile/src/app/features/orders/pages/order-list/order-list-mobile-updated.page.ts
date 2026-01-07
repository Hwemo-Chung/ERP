import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ScrollingModule } from '@angular/cdk/scrolling';
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
  IonBadge,
  IonSpinner,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  RefresherCustomEvent,
  InfiniteScrollCustomEvent,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { chevronForwardOutline, cloudOfflineOutline } from 'ionicons/icons';
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
    ScrollingModule,
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
    IonBadge,
    IonSpinner,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    TranslateModule,
  ],
  template: \`
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ 'ORDERS.LIST.TITLE' | translate }}</ion-title>
        <div slot="end" class="kpi-summary">
          <ion-badge>{{ 'COMMON.TOTAL' | translate }} {{ ordersStore.kpiMetrics().total }}</ion-badge>
          <ion-badge color="danger">{{ 'ORDERS.FILTER.UNASSIGNED' | translate }} {{ ordersStore.kpiMetrics().pending }}</ion-badge>
        </div>
        @if (networkService.isOffline()) {
          <ion-icon slot="end" name="cloud-offline-outline" color="warning"></ion-icon>
        }
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar
          [debounce]="300"
          [placeholder]="'ORDERS.LIST.SEARCH_PLACEHOLDER' | translate"
          (ionInput)="onSearch($event)"
        ></ion-searchbar>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [value]="currentFilter()" (ionChange)="onFilterChange($event)">
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

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (ordersStore.isLoading() && ordersStore.orders().length === 0) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      } @else if (ordersStore.filteredOrders().length === 0) {
        <div class="empty-state">
          <ion-icon name="list-outline"></ion-icon>
          <h3>{{ 'ORDERS.LIST.NO_ORDERS' | translate }}</h3>
          <p>{{ 'ORDERS.LIST.PULL_TO_REFRESH' | translate }}</p>
        </div>
      } @else {
        <cdk-virtual-scroll-viewport
          itemSize="88"
          class="order-list-viewport"
          minBufferPx="400"
          maxBufferPx="800">
          <ion-list>
            <ion-item
              *cdkVirtualFor="let order of ordersStore.filteredOrders(); trackBy: trackById"
              button
              (click)="viewOrder(order.id)">
              <ion-label>
                <h2>{{ order.orderNo }}</h2>
                <h3>{{ order.customerName }}</h3>
                <p>{{ order.customerAddress }}</p>
                <p class="appointment">
                  {{ order.appointmentDate | date:'MM/dd' }}
                  @if (order.appointmentSlot) {
                    {{ order.appointmentSlot }}
                  }
                </p>
              </ion-label>
              <ion-badge slot="end" [color]="getStatusColor(order.status)">
                {{ getStatusKey(order.status) | translate }}
              </ion-badge>
              <ion-icon slot="end" name="chevron-forward-outline"></ion-icon>
            </ion-item>
          </ion-list>
        </cdk-virtual-scroll-viewport>

        @if (ordersStore.pagination().hasMore) {
          <ion-infinite-scroll (ionInfinite)="loadMore($event)">
            <ion-infinite-scroll-content></ion-infinite-scroll-content>
          </ion-infinite-scroll>
        }
      }
    </ion-content>
  \`,
  styles: [\`
    .order-list-viewport {
      height: calc(100vh - 56px - 56px - 48px);
      width: 100%;
    }

    .loading-container {
      display: flex;
      justify-content: center;
      padding: 48px;
    }

    ion-item {
      --padding-top: 12px;
      --padding-bottom: 12px;

      h2 {
        font-weight: 600;
        margin-bottom: 4px;
      }

      h3 {
        font-size: 14px;
        margin-bottom: 2px;
      }

      p {
        font-size: 13px;
        color: var(--ion-color-medium);
        margin: 0;
      }

      .appointment {
        margin-top: 4px;
        font-weight: 500;
        color: var(--ion-color-primary);
      }
    }

    ion-badge {
      min-width: 80px;
      text-align: center;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 64px 24px;
      text-align: center;

      ion-icon {
        font-size: 56px;
        color: #cbd5e1;
        margin-bottom: 20px;
      }

      h3 {
        font-size: 17px;
        font-weight: 600;
        color: #374151;
        margin: 0 0 8px 0;
      }

      p {
        color: #94a3b8;
        font-size: 14px;
        margin: 0;
      }
    }
  \`],
})
export class OrderListPage implements OnInit {
  readonly ordersStore = inject(OrdersStore);
  readonly installersStore = inject(InstallersStore);
  readonly uiStore = inject(UIStore);
  protected readonly networkService = inject(NetworkService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  protected readonly currentFilter = signal<'all' | 'pending' | 'assigned'>('all');

  /**
   * TrackBy function for virtual scrolling optimization
   * Returns unique identifier to help Angular track DOM reuse
   * Complexity: O(1) - Single property access
   */
  trackById = (_index: number, order: any): string => order.id;

  constructor() {
    addIcons({ chevronForwardOutline, cloudOfflineOutline });
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

  private async loadOrders(): Promise<void> {
    try {
      const user = this.authService.user();
      const branchCode = user?.branchCode || 'ALL';
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
