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
  ModalController,
} from '@ionic/angular/standalone';
import { OrderFilterModal, FilterContext } from '../../../../shared/components/order-filter/order-filter.modal';
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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
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
    TranslateModule,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ 'COMPLETION.TITLE' | translate }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="openFilter()">
            <ion-icon name="filter-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar
          [debounce]="300"
          [placeholder]="'ASSIGNMENT.SEARCH_PLACEHOLDER' | translate"
          (ionInput)="onSearch($event)"
        ></ion-searchbar>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [value]="currentFilter()" (ionChange)="onFilterChange($event)" [scrollable]="true">
          <ion-segment-button value="all">
            <ion-label>{{ 'COMMON.ALL' | translate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="dispatched">
            <ion-label>{{ 'COMPLETION.FILTER.PENDING' | translate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="completed">
            <ion-label>{{ 'ORDERS.FILTER.COMPLETED' | translate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="issued">
            <ion-label>{{ 'COMPLETION.FILTER.CERTIFICATE_ISSUED' | translate }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="not-issued">
            <ion-label>{{ 'COMPLETION.FILTER.CERTIFICATE_NOT_ISSUED' | translate }}</ion-label>
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
          <div class="stat-label">{{ 'COMPLETION.FILTER.PENDING' | translate }}</div>
        </div>
        <div class="stat-card primary">
          <div class="stat-value">{{ inProgressCount() }}</div>
          <div class="stat-label">{{ 'ORDERS.FILTER.IN_PROGRESS' | translate }}</div>
        </div>
        <div class="stat-card success">
          <div class="stat-value">{{ completedCount() }}</div>
          <div class="stat-label">{{ 'ORDERS.FILTER.COMPLETED' | translate }}</div>
        </div>
        <div class="stat-card tertiary">
          <div class="stat-value">{{ certificateIssuedCount() }}</div>
          <div class="stat-label">{{ 'COMPLETION.FILTER.CERTIFICATE_ISSUED' | translate }}</div>
        </div>
      </div>

      @if (isLoading()) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
          <p>{{ 'ORDERS.LIST.LOADING' | translate }}</p>
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
                    <span class="tag success">{{ 'COMPLETION.STATUS.SERIAL_ENTERED' | translate }}</span>
                  } @else {
                    <span class="tag warning">{{ 'COMPLETION.STATUS.SERIAL_NOT_ENTERED' | translate }}</span>
                  }
                  @if (item.wastePickedUp) {
                    <span class="tag success">{{ 'COMPLETION.STATUS.WASTE_PICKUP' | translate }}</span>
                  }
                  @if (item.certificateIssued) {
                    <span class="tag info">
                      <ion-icon name="document-text-outline"></ion-icon>
                      {{ 'COMPLETION.FILTER.CERTIFICATE_ISSUED' | translate }}
                    </span>
                  }
                </div>
              </div>
              <ion-icon slot="end" name="chevron-forward-outline" class="chevron-icon"></ion-icon>
            </ion-item>
          } @empty {
            <div class="empty-state">
              <ion-icon name="checkmark-circle-outline"></ion-icon>
              <h3>{{ 'COMPLETION.NO_ITEMS' | translate }}</h3>
              <p>{{ 'COMPLETION.ALL_COMPLETED' | translate }}</p>
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
  /** 주문 데이터 상태 관리 스토어 */
  protected readonly ordersStore = inject(OrdersStore);
  /** 인증 서비스 */
  private readonly authService = inject(AuthService);
  /** 모달 컨트롤러 */
  private readonly modalController = inject(ModalController);
  /** 다국어 번역 서비스 */
  private readonly translateService = inject(TranslateService);

  /** 현재 선택된 필터 */
  protected readonly currentFilter = signal<CompletionFilter>('all');
  /** 검색어 */
  protected readonly searchQuery = signal('');
  /** 로딩 상태 */
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
        o.orderNo.toLowerCase().includes(query) ||
        o.customerName.toLowerCase().includes(query)
      );
    }

    return filtered.map(o => ({
      id: o.id,
      orderNumber: o.orderNo,
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
    const user = this.authService.user();
    // HQ_ADMIN can see all branches, others see only their branch
    const branchCode = user?.roles?.includes('HQ_ADMIN') ? 'ALL' : user?.branchCode;
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

  async openFilter(): Promise<void> {
    const modal = await this.modalController.create({
      component: OrderFilterModal,
      componentProps: {
        context: 'completion' as FilterContext,
        currentFilters: this.ordersStore.filters(),
        installers: [],
        branches: [],
      },
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === 'apply' && data) {
      this.ordersStore.setFilters(data);
      await this.loadData();
    }
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

  /**
   * 상태 코드를 i18n 기반 라벨로 변환
   * @param status - 주문 상태 코드
   * @returns 번역된 상태 라벨
   */
  getStatusLabel(status: OrderStatus): string {
    const statusI18nKeys: Record<string, string> = {
      [OrderStatus.DISPATCHED]: 'COMPLETION.FILTER.PENDING',
      [OrderStatus.COMPLETED]: 'ORDERS.STATUS.COMPLETED',
      [OrderStatus.PARTIAL]: 'ORDERS.STATUS.PARTIAL',
      [OrderStatus.COLLECTED]: 'ORDERS.STATUS.COLLECTED',
    };
    const key = statusI18nKeys[status];
    return key ? this.translateService.instant(key) : String(status);
  }
}
