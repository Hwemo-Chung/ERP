// apps/mobile/src/app/features/assignment/pages/assignment-list/assignment-list.page.ts
import { Component, inject, signal, computed, ChangeDetectionStrategy, OnInit } from '@angular/core';
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
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonSpinner,
  IonFab,
  IonFabButton,
  IonChip,
  RefresherCustomEvent,
  InfiniteScrollCustomEvent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  filterOutline,
  addOutline,
  chevronForwardOutline,
  calendarOutline,
  personOutline,
  checkmarkCircleOutline,
} from 'ionicons/icons';
import { OrdersStore } from '../../../../store/orders/orders.store';
import { OrderStatus } from '../../../../store/orders/orders.models';
import { AuthService } from '@core/services/auth.service';
import { UIStore } from '../../../../store/ui/ui.store';

type AssignmentFilter = 'unassigned' | 'assigned' | 'confirmed' | 'all';

@Component({
  selector: 'app-assignment-list',
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
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonSpinner,
    IonFab,
    IonFabButton,
    IonChip,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>배정 관리</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="openFilter()">
            <ion-icon name="filter-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar
          [debounce]="300"
          placeholder="주문번호, 고객명 검색..."
          (ionInput)="onSearch($event)"
        ></ion-searchbar>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [value]="currentFilter()" (ionChange)="onStatusChange($event)">
          <ion-segment-button value="all">
            <ion-label>전체</ion-label>
          </ion-segment-button>
          <ion-segment-button value="unassigned">
            <ion-label>미배정</ion-label>
          </ion-segment-button>
          <ion-segment-button value="assigned">
            <ion-label>배정</ion-label>
          </ion-segment-button>
          <ion-segment-button value="confirmed">
            <ion-label>확정</ion-label>
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
        <ion-chip color="medium">
          <ion-label>총 {{ totalCount() }}건</ion-label>
        </ion-chip>
        <ion-chip color="danger">
          <ion-label>미배정 {{ unassignedCount() }}건</ion-label>
        </ion-chip>
        <ion-chip color="warning">
          <ion-label>배정 {{ assignedCount() }}건</ion-label>
        </ion-chip>
        <ion-chip color="success">
          <ion-label>확정 {{ confirmedCount() }}건</ion-label>
        </ion-chip>
      </div>

      @if (ordersStore.isLoading()) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
          <p>데이터 로딩 중...</p>
        </div>
      } @else {
        <ion-list>
          @for (order of assignmentOrders(); track order.id) {
            <ion-item [routerLink]="['detail', order.id]" detail>
              <ion-label>
                <h2>{{ order.erpOrderNumber }}</h2>
                <h3>{{ order.customerName }}</h3>
                <p>
                  <ion-icon name="calendar-outline"></ion-icon>
                  {{ formatDate(order.appointmentDate) }}
                  @if (order.appointmentSlot) {
                    {{ order.appointmentSlot }}
                  }
                </p>
                <p>
                  <ion-icon name="person-outline"></ion-icon>
                  {{ order.installerName || '미배정' }}
                </p>
                <p class="product-summary">{{ order.customerAddress }}</p>
              </ion-label>
              <ion-badge slot="end" [color]="getStatusColor(order.status)">
                {{ getStatusLabel(order.status) }}
              </ion-badge>
            </ion-item>
          } @empty {
            <div class="empty-state">
              <ion-icon name="checkmark-circle-outline"></ion-icon>
              <p>표시할 배정 항목이 없습니다.</p>
            </div>
          }
        </ion-list>

        <ion-infinite-scroll (ionInfinite)="onInfinite($event)">
          <ion-infinite-scroll-content
            loadingSpinner="crescent"
            loadingText="더 불러오는 중..."
          ></ion-infinite-scroll-content>
        </ion-infinite-scroll>
      }

      <!-- Batch Assign FAB -->
      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button routerLink="batch-assign">
          <ion-icon name="add-outline"></ion-icon>
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  `,
  styles: [`
    .summary-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      padding: 8px 16px;
      background: var(--ion-toolbar-background);
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 50vh;
      color: var(--ion-color-medium);
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 16px;
      color: var(--ion-color-medium);

      ion-icon {
        font-size: 64px;
        margin-bottom: 16px;
      }
    }

    ion-item {
      --padding-start: 16px;

      h2 {
        font-weight: 600;
      }

      h3 {
        color: var(--ion-color-dark);
      }

      p {
        display: flex;
        align-items: center;
        gap: 4px;
        color: var(--ion-color-medium);
        font-size: 13px;

        ion-icon {
          font-size: 14px;
        }
      }

      .product-summary {
        margin-top: 4px;
        font-size: 12px;
      }
    }
  `],
})
export class AssignmentListPage implements OnInit {
  readonly ordersStore = inject(OrdersStore);
  private readonly authService = inject(AuthService);
  private readonly uiStore = inject(UIStore);

  protected readonly currentFilter = signal<AssignmentFilter>('all');

  // Computed counts from orders store filtered by assignment-related statuses
  protected readonly assignmentOrders = computed(() => {
    const orders = this.ordersStore.orders();
    const filter = this.currentFilter();

    // Assignment tab shows: UNASSIGNED, ASSIGNED, CONFIRMED
    const assignmentStatuses = [OrderStatus.UNASSIGNED, OrderStatus.ASSIGNED, OrderStatus.CONFIRMED];
    let filtered = orders.filter(o => assignmentStatuses.includes(o.status));

    if (filter === 'unassigned') {
      filtered = filtered.filter(o => o.status === OrderStatus.UNASSIGNED);
    } else if (filter === 'assigned') {
      filtered = filtered.filter(o => o.status === OrderStatus.ASSIGNED);
    } else if (filter === 'confirmed') {
      filtered = filtered.filter(o => o.status === OrderStatus.CONFIRMED);
    }

    return filtered;
  });

  protected readonly totalCount = computed(() => {
    const orders = this.ordersStore.orders();
    return orders.filter(o =>
      [OrderStatus.UNASSIGNED, OrderStatus.ASSIGNED, OrderStatus.CONFIRMED].includes(o.status)
    ).length;
  });

  protected readonly unassignedCount = computed(() => {
    return this.ordersStore.orders().filter(o => o.status === OrderStatus.UNASSIGNED).length;
  });

  protected readonly assignedCount = computed(() => {
    return this.ordersStore.orders().filter(o => o.status === OrderStatus.ASSIGNED).length;
  });

  protected readonly confirmedCount = computed(() => {
    return this.ordersStore.orders().filter(o => o.status === OrderStatus.CONFIRMED).length;
  });

  constructor() {
    addIcons({
      filterOutline,
      addOutline,
      chevronForwardOutline,
      calendarOutline,
      personOutline,
      checkmarkCircleOutline,
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  async loadData(): Promise<void> {
    try {
      const user = this.authService.user();
      const branchCode = user?.branchCode || 'ALL';
      await this.ordersStore.loadOrders(branchCode, 1, 100);
    } catch (error) {
      console.error('[AssignmentList] Failed to load orders:', error);
      this.uiStore.showToast('배정 데이터 로드 실패', 'danger');
    }
  }

  onSearch(event: CustomEvent): void {
    const query = event.detail.value || '';
    this.ordersStore.setFilters({ customerName: query || undefined });
  }

  onStatusChange(event: CustomEvent): void {
    const filter = event.detail.value as AssignmentFilter;
    this.currentFilter.set(filter);
  }

  async onRefresh(event: RefresherCustomEvent): Promise<void> {
    await this.loadData();
    event.target.complete();
  }

  async onInfinite(event: InfiniteScrollCustomEvent): Promise<void> {
    await this.ordersStore.loadMoreOrders();
    event.target.complete();
  }

  openFilter(): void {
    // TODO: Open filter modal
    console.log('Open filter');
  }

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      [OrderStatus.UNASSIGNED]: 'danger',
      [OrderStatus.ASSIGNED]: 'warning',
      [OrderStatus.CONFIRMED]: 'success',
    };
    return colors[status] || 'medium';
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      [OrderStatus.UNASSIGNED]: '미배정',
      [OrderStatus.ASSIGNED]: '배정',
      [OrderStatus.CONFIRMED]: '확정',
    };
    return labels[status] || status;
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
}
