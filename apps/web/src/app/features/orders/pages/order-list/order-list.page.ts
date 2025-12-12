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
import { chevronForwardOutline, cloudOfflineOutline, listOutline, calendarOutline, locationOutline } from 'ionicons/icons';
import { NetworkService } from '@core/services/network.service';
import { OrdersStore } from '../../../../store/orders/orders.store';
import { InstallersStore } from '../../../../store/installers/installers.store';
import { UIStore } from '../../../../store/ui/ui.store';
import { OrderStatus } from '../../../../store/orders/orders.models';

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
        @if (networkService.isOffline()) {
          <ion-icon slot="end" name="cloud-offline-outline" color="warning" style="margin-right: 16px;"></ion-icon>
        }
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar
          [debounce]="300"
          placeholder="주문번호, 고객명, 주소 검색..."
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

      <!-- Stats Summary -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ ordersStore.kpiMetrics().total }}</div>
          <div class="stat-label">전체</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-value">{{ ordersStore.kpiMetrics().pending }}</div>
          <div class="stat-label">미배정</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-value">{{ ordersStore.kpiMetrics().dispatched }}</div>
          <div class="stat-label">진행중</div>
        </div>
        <div class="stat-card success">
          <div class="stat-value">{{ ordersStore.kpiMetrics().completed }}</div>
          <div class="stat-label">완료</div>
        </div>
      </div>

      @if (ordersStore.isLoading() && ordersStore.orders().length === 0) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
          <p>데이터 로딩 중...</p>
        </div>
      } @else if (ordersStore.filteredOrders().length === 0) {
        <div class="empty-state">
          <ion-icon name="list-outline"></ion-icon>
          <h3>주문이 없습니다</h3>
          <p>아래로 당겨 새로고침하세요</p>
        </div>
      } @else {
        <ion-list>
          @for (order of ordersStore.filteredOrders(); track order.id) {
            <ion-item button (click)="viewOrder(order.id)" class="order-item">
              <div class="order-content">
                <div class="order-header">
                  <span class="order-number">{{ order.erpOrderNumber }}</span>
                  <ion-badge [color]="getStatusColor(order.status)">
                    {{ getStatusLabel(order.status) }}
                  </ion-badge>
                </div>
                <h2 class="customer-name">{{ order.customerName }}</h2>
                <div class="order-meta">
                  <span class="meta-item">
                    <ion-icon name="location-outline"></ion-icon>
                    {{ order.customerAddress }}
                  </span>
                </div>
                <div class="order-meta">
                  <span class="meta-item appointment">
                    <ion-icon name="calendar-outline"></ion-icon>
                    {{ order.appointmentDate | date:'MM/dd (EEE)' }}
                    @if (order.appointmentSlot) {
                      · {{ order.appointmentSlot }}
                    }
                  </span>
                </div>
              </div>
              <ion-icon slot="end" name="chevron-forward-outline" class="chevron-icon"></ion-icon>
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
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      padding: 12px 16px;
      background: #f8fafc;
    }

    .stat-card {
      background: #ffffff;
      border-radius: 12px;
      padding: 12px 8px;
      text-align: center;
      border: 1px solid #e2e8f0;
      transition: transform 0.2s, box-shadow 0.2s;

      &:active {
        transform: scale(0.98);
      }

      .stat-value {
        font-size: 20px;
        font-weight: 700;
        color: #0f172a;
        line-height: 1;
        margin-bottom: 4px;
      }

      .stat-label {
        font-size: 11px;
        color: #64748b;
        font-weight: 500;
      }

      &.danger {
        border-left: 3px solid #ef4444;
        .stat-value { color: #ef4444; }
      }

      &.warning {
        border-left: 3px solid #f59e0b;
        .stat-value { color: #f59e0b; }
      }

      &.success {
        border-left: 3px solid #10b981;
        .stat-value { color: #10b981; }
      }
    }

    .order-item {
      --padding-start: 16px;
      --padding-end: 12px;
      --inner-padding-end: 0;
      --padding-top: 12px;
      --padding-bottom: 12px;
      --border-color: #f1f5f9;
    }

    .order-content {
      flex: 1;
      min-width: 0;
    }

    .order-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .order-number {
      font-size: 12px;
      font-weight: 600;
      color: #3b82f6;
      letter-spacing: 0.3px;
    }

    ion-badge {
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 6px;
    }

    .customer-name {
      font-size: 15px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 6px 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .order-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 4px;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      color: #64748b;

      ion-icon {
        font-size: 14px;
        color: #94a3b8;
      }

      &.appointment {
        color: #3b82f6;
        font-weight: 500;

        ion-icon {
          color: #3b82f6;
        }
      }
    }

    .chevron-icon {
      color: #cbd5e1;
      font-size: 18px;
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 64px 24px;
      gap: 16px;

      p {
        color: #64748b;
        font-size: 14px;
        margin: 0;
      }
    }
  `],
})
export class OrderListPage implements OnInit {
  readonly ordersStore = inject(OrdersStore);
  readonly installersStore = inject(InstallersStore);
  readonly uiStore = inject(UIStore);
  protected readonly networkService = inject(NetworkService);
  private readonly router = inject(Router);

  protected readonly currentFilter = signal<'all' | 'pending' | 'assigned'>('all');

  constructor() {
    addIcons({ chevronForwardOutline, cloudOfflineOutline, listOutline, calendarOutline, locationOutline });
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
    const colorMap: Record<string, string> = {
      [OrderStatus.UNASSIGNED]: 'danger',
      [OrderStatus.ASSIGNED]: 'warning',
      [OrderStatus.CONFIRMED]: 'warning',
      [OrderStatus.RELEASED]: 'primary',
      [OrderStatus.DISPATCHED]: 'primary',
      [OrderStatus.POSTPONED]: 'secondary',
      [OrderStatus.ABSENT]: 'tertiary',
      [OrderStatus.COMPLETED]: 'success',
      [OrderStatus.PARTIAL]: 'success',
      [OrderStatus.COLLECTED]: 'success',
      [OrderStatus.CANCELLED]: 'medium',
      [OrderStatus.REQUEST_CANCEL]: 'danger',
    };
    return colorMap[status] || 'medium';
  }

  protected getStatusLabel(status: string): string {
    const labelMap: Record<string, string> = {
      [OrderStatus.UNASSIGNED]: '미배정',
      [OrderStatus.ASSIGNED]: '배정',
      [OrderStatus.CONFIRMED]: '배정확정',
      [OrderStatus.RELEASED]: '출고확정',
      [OrderStatus.DISPATCHED]: '출문',
      [OrderStatus.POSTPONED]: '연기',
      [OrderStatus.ABSENT]: '부재',
      [OrderStatus.COMPLETED]: '인수',
      [OrderStatus.PARTIAL]: '부분인수',
      [OrderStatus.COLLECTED]: '회수',
      [OrderStatus.CANCELLED]: '취소',
      [OrderStatus.REQUEST_CANCEL]: '의뢰취소',
    };
    return labelMap[status] || status;
  }

  private async loadOrders(): Promise<void> {
    try {
      const user = inject(OrdersStore) as any;
      const branchCode = (user as any).branchCode || 'ALL';
      await this.ordersStore.loadOrders(branchCode, 1, 20);
      await this.installersStore.loadInstallers(branchCode);
    } catch (error) {
      this.uiStore.showToast('주문 로드 실패', 'danger');
    }
  }
}
