// apps/web/src/app/features/completion/pages/completion-list/completion-list.page.ts
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
  IonSpinner,
  RefresherCustomEvent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  filterOutline,
  checkmarkCircleOutline,
  timeOutline,
  alertCircleOutline,
  chevronForwardOutline,
  calendarOutline,
  personOutline,
  documentTextOutline,
} from 'ionicons/icons';
import { OrdersStore } from '../../../../store/orders/orders.store';
import { OrderStatus } from '../../../../store/orders/orders.models';
import { AuthService } from '../../../../core/services/auth.service';

type CompletionFilter = 'dispatched' | 'completed' | 'all' | 'issued' | 'not-issued';

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
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>완료 처리</ion-title>
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
        <ion-segment [value]="currentFilter()" (ionChange)="onFilterChange($event)" [scrollable]="true">
          <ion-segment-button value="all">
            <ion-label>전체</ion-label>
          </ion-segment-button>
          <ion-segment-button value="dispatched">
            <ion-label>대기</ion-label>
          </ion-segment-button>
          <ion-segment-button value="completed">
            <ion-label>완료</ion-label>
          </ion-segment-button>
          <ion-segment-button value="issued">
            <ion-label>확인서 발행</ion-label>
          </ion-segment-button>
          <ion-segment-button value="not-issued">
            <ion-label>확인서 미발행</ion-label>
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
        <div class="stat-card warning">
          <div class="stat-value">{{ pendingCount() }}</div>
          <div class="stat-label">대기</div>
        </div>
        <div class="stat-card primary">
          <div class="stat-value">{{ inProgressCount() }}</div>
          <div class="stat-label">진행중</div>
        </div>
        <div class="stat-card success">
          <div class="stat-value">{{ completedCount() }}</div>
          <div class="stat-label">완료</div>
        </div>
        <div class="stat-card tertiary">
          <div class="stat-value">{{ certificateIssuedCount() }}</div>
          <div class="stat-label">확인서 발행</div>
        </div>
      </div>

      @if (isLoading()) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
          <p>데이터 로딩 중...</p>
        </div>
      } @else {
        <ion-list>
          @for (item of items(); track item.id) {
            <ion-item [routerLink]="['process', item.id]" class="completion-item">
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
                  <span class="meta-item">
                    <ion-icon name="person-outline"></ion-icon>
                    {{ item.installerName }}
                  </span>
                </div>
                <div class="status-tags">
                  @if (item.serialEntered) {
                    <span class="tag success">시리얼 입력완료</span>
                  } @else {
                    <span class="tag warning">시리얼 미입력</span>
                  }
                  @if (item.wastePickedUp) {
                    <span class="tag success">폐가전 회수</span>
                  }
                  @if (item.certificateIssued) {
                    <span class="tag info">
                      <ion-icon name="document-text-outline"></ion-icon>
                      확인서 발행
                    </span>
                  }
                </div>
              </div>
              <ion-icon slot="end" name="chevron-forward-outline" class="chevron-icon"></ion-icon>
            </ion-item>
          } @empty {
            <div class="empty-state">
              <ion-icon name="checkmark-circle-outline"></ion-icon>
              <h3>처리할 항목이 없습니다</h3>
              <p>모든 작업이 완료되었습니다</p>
            </div>
          }
        </ion-list>
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
    }

    .stat-card .stat-value {
      font-size: 22px;
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

    .stat-card.warning {
      border-left: 3px solid #f59e0b;
    }
    .stat-card.warning .stat-value { color: #f59e0b; }

    .stat-card.primary {
      border-left: 3px solid #3b82f6;
    }
    .stat-card.primary .stat-value { color: #3b82f6; }

    .stat-card.success {
      border-left: 3px solid #10b981;
    }
    .stat-card.success .stat-value { color: #10b981; }

    .stat-card.tertiary {
      border-left: 3px solid #8b5cf6;
    }
    .stat-card.tertiary .stat-value { color: #8b5cf6; }

    .completion-item {
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
      margin-bottom: 8px;
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

    .status-tags {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .tag {
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 4px;
      font-weight: 500;
    }

    .tag.success {
      background: #dcfce7;
      color: #15803d;
    }

    .tag.warning {
      background: #fef3c7;
      color: #b45309;
    }

    .tag.info {
      background: #e0e7ff;
      color: #4338ca;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .tag.info ion-icon {
      font-size: 12px;
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
export class CompletionListPage implements OnInit {
  protected readonly ordersStore = inject(OrdersStore);
  private readonly authService = inject(AuthService);

  protected readonly currentFilter = signal<CompletionFilter>('all');
  protected readonly searchQuery = signal('');
  protected readonly isLoading = computed(() => this.ordersStore.isLoading());

  protected readonly pendingCount = computed(() => {
    return this.ordersStore.orders().filter(o => o.status === OrderStatus.DISPATCHED).length;
  });

  protected readonly inProgressCount = computed(() => {
    return this.ordersStore.orders().filter(o => 
      o.status === OrderStatus.DISPATCHED && o.lines?.some(l => l.serialNumber)
    ).length;
  });

  protected readonly completedCount = computed(() => {
    return this.ordersStore.orders().filter(o => 
      [OrderStatus.COMPLETED, OrderStatus.PARTIAL, OrderStatus.COLLECTED].includes(o.status)
    ).length;
  });

  // FR-15: Certificate issuance tracking
  protected readonly certificateIssuedCount = computed(() => {
    return this.ordersStore.orders().filter(o => 
      o.completion?.certificateIssuedAt
    ).length;
  });

  protected readonly items = computed(() => {
    const orders = this.ordersStore.orders();
    const filter = this.currentFilter();
    const query = this.searchQuery().toLowerCase();

    let filtered = orders.filter(o => 
      [OrderStatus.DISPATCHED, OrderStatus.COMPLETED, OrderStatus.PARTIAL, OrderStatus.COLLECTED].includes(o.status)
    );

    if (filter === 'dispatched') {
      filtered = filtered.filter(o => o.status === OrderStatus.DISPATCHED);
    } else if (filter === 'completed') {
      filtered = filtered.filter(o => 
        [OrderStatus.COMPLETED, OrderStatus.PARTIAL, OrderStatus.COLLECTED].includes(o.status)
      );
    } else if (filter === 'issued') {
      // FR-15: Filter by certificate issued
      filtered = filtered.filter(o => o.completion?.certificateIssuedAt);
    } else if (filter === 'not-issued') {
      // FR-15: Filter by certificate not issued
      filtered = filtered.filter(o => !o.completion?.certificateIssuedAt);
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
      installerName: o.installerName || '-',
      serialEntered: o.lines?.some(l => l.serialNumber) || false,
      wastePickedUp: o.completion?.waste && o.completion.waste.length > 0,
      certificateIssued: !!o.completion?.certificateIssuedAt, // FR-15
    }));
  });

  constructor() {
    addIcons({
      filterOutline,
      checkmarkCircleOutline,
      timeOutline,
      alertCircleOutline,
      chevronForwardOutline,
      calendarOutline,
      personOutline,
      documentTextOutline,
    });
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

  openFilter(): void {
    console.log('Open filter modal');
  }

  getStatusColor(status: OrderStatus): string {
    const colors: Record<string, string> = {
      [OrderStatus.DISPATCHED]: 'warning',
      [OrderStatus.COMPLETED]: 'success',
      [OrderStatus.PARTIAL]: 'success',
      [OrderStatus.COLLECTED]: 'success',
    };
    return colors[status] || 'medium';
  }

  getStatusLabel(status: OrderStatus): string {
    const labels: Record<string, string> = {
      [OrderStatus.DISPATCHED]: '대기',
      [OrderStatus.COMPLETED]: '인수',
      [OrderStatus.PARTIAL]: '부분인수',
      [OrderStatus.COLLECTED]: '회수',
    };
    return labels[status] || String(status);
  }
}
