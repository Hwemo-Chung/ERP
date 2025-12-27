// apps/web/src/app/features/assignment/pages/assignment-list/assignment-list.page.ts
import { Component, signal, ChangeDetectionStrategy, inject, computed, OnInit } from '@angular/core';
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
  cubeOutline,
} from 'ionicons/icons';
import { OrdersStore } from '../../../../store/orders/orders.store';
import { OrderStatus } from '../../../../store/orders/orders.models';
import { AuthService } from '../../../../core/services/auth.service';

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
        <ion-segment [value]="currentStatus()" (ionChange)="onStatusChange($event)">
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

      <!-- Stats Summary -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ totalCount() }}</div>
          <div class="stat-label">전체</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-value">{{ unassignedCount() }}</div>
          <div class="stat-label">미배정</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-value">{{ assignedCount() }}</div>
          <div class="stat-label">배정</div>
        </div>
        <div class="stat-card success">
          <div class="stat-value">{{ confirmedCount() }}</div>
          <div class="stat-label">확정</div>
        </div>
      </div>

      @if (isLoading()) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
          <p>데이터 로딩 중...</p>
        </div>
      } @else {
        <ion-list>
          @for (item of assignments(); track item.id) {
            <ion-item [routerLink]="['detail', item.id]" class="assignment-item">
              <div class="item-content">
                <div class="item-header">
                  <span class="order-number">{{ item.orderNumber }}</span>
                  <ion-badge [color]="getStatusColor(item.status)">
                    {{ getStatusLabel(item.status) }}
                  </ion-badge>
                </div>
                <h2 class="customer-name">{{ item.customerName }}</h2>
                <div class="item-meta">
                  <span class="meta-item">
                    <ion-icon name="calendar-outline"></ion-icon>
                    {{ item.appointmentDate }}
                  </span>
                  <span class="meta-item" [class.unassigned]="!item.installerName">
                    <ion-icon name="person-outline"></ion-icon>
                    {{ item.installerName || '미배정' }}
                  </span>
                </div>
                @if (item.productSummary && item.productSummary !== '-') {
                  <div class="product-info">
                    <ion-icon name="cube-outline"></ion-icon>
                    <span>{{ item.productSummary }}</span>
                  </div>
                }
              </div>
              <ion-icon slot="end" name="chevron-forward-outline" class="chevron-icon"></ion-icon>
            </ion-item>
          } @empty {
            <div class="empty-state">
              <ion-icon name="checkmark-circle-outline"></ion-icon>
              <h3>표시할 항목이 없습니다</h3>
              <p>필터를 변경하거나 새로고침하세요</p>
            </div>
          }
        </ion-list>

        <ion-infinite-scroll (ionInfinite)="onInfinite($event)">
          <ion-infinite-scroll-content loadingSpinner="crescent"></ion-infinite-scroll-content>
        </ion-infinite-scroll>
      }

      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button routerLink="batch-assign" color="primary">
          <ion-icon name="add-outline"></ion-icon>
        </ion-fab-button>
      </ion-fab>
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
    }

    .stat-card .stat-value {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1;
      margin-bottom: 4px;
    }

    .stat-card .stat-label {
      font-size: 11px;
      color: #64748b;
      font-weight: 500;
    }

    .stat-card.danger {
      border-left: 3px solid #ef4444;
    }
    .stat-card.danger .stat-value { color: #ef4444; }

    .stat-card.warning {
      border-left: 3px solid #f59e0b;
    }
    .stat-card.warning .stat-value { color: #f59e0b; }

    .stat-card.success {
      border-left: 3px solid #10b981;
    }
    .stat-card.success .stat-value { color: #10b981; }

    .assignment-item {
      --padding-start: 16px;
      --padding-end: 12px;
      --inner-padding-end: 0;
      --padding-top: 12px;
      --padding-bottom: 12px;
      --border-color: #f1f5f9;
    }

    .item-content {
      flex: 1;
      min-width: 0;
    }

    .item-header {
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
    }

    .item-meta {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      color: #64748b;
    }

    .meta-item ion-icon {
      font-size: 14px;
      color: #94a3b8;
    }

    .meta-item.unassigned {
      color: #ef4444;
    }
    .meta-item.unassigned ion-icon { color: #ef4444; }

    .product-info {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 6px;
      font-size: 12px;
      color: #94a3b8;
    }

    .product-info ion-icon { font-size: 13px; }
    .product-info span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
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
    }

    .loading-container p {
      color: #64748b;
      font-size: 14px;
      margin: 0;
    }

    ion-fab-button {
      --box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 64px 24px;
      text-align: center;
    }

    .empty-state ion-icon {
      font-size: 56px;
      color: #cbd5e1;
      margin-bottom: 20px;
    }

    .empty-state h3 {
      font-size: 17px;
      font-weight: 600;
      color: #374151;
      margin: 0 0 8px 0;
    }

    .empty-state p {
      color: #94a3b8;
      font-size: 14px;
      margin: 0;
    }
  `],
})
export class AssignmentListPage implements OnInit {
  protected readonly ordersStore = inject(OrdersStore);
  private readonly authService = inject(AuthService);

  protected readonly currentStatus = signal<string>('all');
  protected readonly searchQuery = signal('');

  protected readonly isLoading = computed(() => this.ordersStore.isLoading());
  protected readonly kpi = computed(() => this.ordersStore.kpiMetrics());
  protected readonly totalCount = computed(() => this.kpi().total);
  protected readonly unassignedCount = computed(() => this.kpi().pending);
  protected readonly assignedCount = computed(() => this.kpi().assigned);
  protected readonly confirmedCount = computed(() => this.kpi().confirmed);

  protected readonly assignments = computed(() => {
    const orders = this.ordersStore.filteredOrders();
    const status = this.currentStatus();
    const query = this.searchQuery().toLowerCase();

    let filtered = orders.filter(o => 
      [OrderStatus.UNASSIGNED, OrderStatus.ASSIGNED, OrderStatus.CONFIRMED, OrderStatus.RELEASED].includes(o.status)
    );

    if (status === 'unassigned') {
      filtered = filtered.filter(o => o.status === OrderStatus.UNASSIGNED);
    } else if (status === 'assigned') {
      filtered = filtered.filter(o => o.status === OrderStatus.ASSIGNED);
    } else if (status === 'confirmed') {
      filtered = filtered.filter(o => o.status === OrderStatus.CONFIRMED);
    }

    if (query) {
      filtered = filtered.filter(o =>
        o.erpOrderNumber.toLowerCase().includes(query) ||
        o.customerName.toLowerCase().includes(query)
      );
    }

    return filtered.map(o => ({
      id: o.id,
      orderNumber: o.erpOrderNumber,
      customerName: o.customerName,
      appointmentDate: o.appointmentDate || '-',
      status: o.status,
      installerName: o.installerName,
      productSummary: o.lines?.map(l => l.productName).filter(Boolean).join(', ') || '-',
    }));
  });

  constructor() {
    addIcons({
      filterOutline,
      addOutline,
      chevronForwardOutline,
      calendarOutline,
      personOutline,
      checkmarkCircleOutline,
      cubeOutline,
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  async loadData(): Promise<void> {
    const user = this.authService.user();
    // HQ_ADMIN can see all branches, others see only their branch
    const branchCode = user?.roles?.includes('HQ_ADMIN') ? 'ALL' : user?.branchCode;
    await this.ordersStore.loadOrders(branchCode);
  }

  onSearch(event: CustomEvent): void {
    this.searchQuery.set(event.detail.value || '');
  }

  onStatusChange(event: CustomEvent): void {
    this.currentStatus.set(event.detail.value);
  }

  async onRefresh(event: RefresherCustomEvent): Promise<void> {
    await this.loadData();
    event.target.complete();
  }

  async onInfinite(event: InfiniteScrollCustomEvent): Promise<void> {
    const pagination = this.ordersStore.pagination();
    if (pagination.hasMore) {
      await this.ordersStore.loadMoreOrders();
    }
    event.target.complete();
  }

  openFilter(): void {
    console.log('Open filter modal');
  }

  getStatusColor(status: OrderStatus | string): string {
    const colors: Record<string, string> = {
      [OrderStatus.UNASSIGNED]: 'danger',
      [OrderStatus.ASSIGNED]: 'warning',
      [OrderStatus.CONFIRMED]: 'success',
      [OrderStatus.RELEASED]: 'primary',
    };
    return colors[status] || 'medium';
  }

  getStatusLabel(status: OrderStatus | string): string {
    const labels: Record<string, string> = {
      [OrderStatus.UNASSIGNED]: '미배정',
      [OrderStatus.ASSIGNED]: '배정',
      [OrderStatus.CONFIRMED]: '확정',
      [OrderStatus.RELEASED]: '출고확정',
    };
    return labels[status] || String(status);
  }
}
