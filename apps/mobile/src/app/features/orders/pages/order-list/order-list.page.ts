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
  IonButton,
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
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonList,
    IonItem,
    IonLabel,
    IonButton,
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
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>주문 목록</ion-title>
        <div slot="end" class="kpi-summary">
          <ion-badge>총 {{ ordersStore.kpiMetrics().total }}</ion-badge>
          <ion-badge color="danger">미배정 {{ ordersStore.kpiMetrics().pending }}</ion-badge>
        </div>
        @if (networkService.isOffline()) {
          <ion-icon slot="end" name="cloud-offline-outline" color="warning"></ion-icon>
        }
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar
          [debounce]="300"
          placeholder="주문 검색..."
          (ionInput)="onSearch($event)"
        ></ion-searchbar>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [value]="currentFilter()" (ionChange)="onFilterChange($event)">
          <ion-segment-button value="all">
            <ion-label>전체</ion-label>
          </ion-segment-button>
          <ion-segment-button value="pending">
            <ion-label>미배정</ion-label>
          </ion-segment-button>
          <ion-segment-button value="assigned">
            <ion-label>배정완료</ion-label>
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
          <h3>주문이 없습니다</h3>
          <p>아래로 당겨 새로고침</p>
        </div>
      } @else {
        <ion-list>
          @for (order of ordersStore.filteredOrders(); track order.id) {
            <ion-item button (click)="viewOrder(order.id)">
              <ion-label>
                <h2>{{ order.erpOrderNumber }}</h2>
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
                {{ getStatusLabel(order.status) }}
              </ion-badge>
              <ion-icon slot="end" name="chevron-forward-outline"></ion-icon>
            </ion-item>
          }
        </ion-list>

        @if (ordersStore.pagination().hasMore) {
          <ion-infinite-scroll (ionInfinite)="loadMore($event)">
            <ion-infinite-scroll-content></ion-infinite-scroll-content>
          </ion-infinite-scroll>
        }
      }
    </ion-content>
  `,
  styles: [`
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
  `],
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

  protected getStatusLabel(status: string): string {
    return ORDER_STATUS_LABELS[status as OrderStatus] || status;
  }

  private async loadOrders(): Promise<void> {
    try {
      const user = this.authService.user();
      const branchCode = user?.branchCode || 'ALL';
      await this.ordersStore.loadOrders(branchCode, 1, 20);
      await this.installersStore.loadInstallers(branchCode);
    } catch (error) {
      console.error('[OrderList] Failed to load orders:', error);
      this.uiStore.showToast('주문 로드 실패', 'danger');
    }
  }
}
