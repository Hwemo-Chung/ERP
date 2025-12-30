// apps/mobile/src/app/features/completion/pages/completion-list/completion-list.page.ts
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
  IonChip,
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
} from 'ionicons/icons';
import { OrdersStore } from '../../../../store/orders/orders.store';
import { OrderStatus, Order, OrderLine } from '../../../../store/orders/orders.models';
import { AuthService } from '../../../../core/services/auth.service';

type CompletionFilter = 'dispatched' | 'completed' | 'all';

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
    IonChip,
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
        <ion-segment [value]="currentFilter()" (ionChange)="onFilterChange($event)">
          <ion-segment-button value="all">
            <ion-label>전체</ion-label>
          </ion-segment-button>
          <ion-segment-button value="dispatched">
            <ion-label>대기</ion-label>
          </ion-segment-button>
          <ion-segment-button value="completed">
            <ion-label>완료</ion-label>
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
        <ion-chip color="warning">
          <ion-icon name="time-outline"></ion-icon>
          <ion-label>대기 {{ pendingCount() }}건</ion-label>
        </ion-chip>
        <ion-chip color="primary">
          <ion-icon name="alert-circle-outline"></ion-icon>
          <ion-label>진행중 {{ inProgressCount() }}건</ion-label>
        </ion-chip>
        <ion-chip color="success">
          <ion-icon name="checkmark-circle-outline"></ion-icon>
          <ion-label>완료 {{ completedCount() }}건</ion-label>
        </ion-chip>
      </div>

      @if (isLoading()) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
          <p>데이터 로딩 중...</p>
        </div>
      } @else {
        <ion-list>
          @for (item of items(); track item.id) {
            <ion-item [routerLink]="['process', item.id]" detail>
              <ion-label>
                <h2>{{ item.orderNumber }}</h2>
                <h3>{{ item.customerName }}</h3>
                <p>{{ item.appointmentDate }} | {{ item.installerName }}</p>
                <div class="status-indicators">
                  @if (item.serialEntered) {
                    <ion-badge color="success">시리얼 입력완료</ion-badge>
                  } @else {
                    <ion-badge color="warning">시리얼 미입력</ion-badge>
                  }
                  @if (item.wastePickedUp) {
                    <ion-badge color="success">폐가전 회수</ion-badge>
                  }
                </div>
              </ion-label>
              <ion-badge slot="end" [color]="getStatusColor(item.status)">
                {{ getStatusLabel(item.status) }}
              </ion-badge>
            </ion-item>
          } @empty {
            <div class="empty-state">
              <ion-icon name="checkmark-circle-outline"></ion-icon>
              <p>처리할 항목이 없습니다.</p>
            </div>
          }
        </ion-list>
      }
    </ion-content>
  `,
  styles: [`
    .summary-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 12px 16px;
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

    .status-indicators {
      display: flex;
      gap: 4px;
      margin-top: 8px;
      flex-wrap: wrap;

      ion-badge {
        font-size: 10px;
      }
    }
  `],
})
export class CompletionListPage implements OnInit {
  protected readonly ordersStore = inject(OrdersStore);
  private readonly authService = inject(AuthService);
  private readonly modalController = inject(ModalController);

  protected readonly currentFilter = signal<CompletionFilter>('all');
  protected readonly searchQuery = signal('');

  protected readonly isLoading = computed(() => this.ordersStore.isLoading());

  // 완료 처리 대상: 출문(DISPATCHED) 상태인 주문들
  protected readonly items = computed(() => {
    const orders = this.ordersStore.filteredOrders();
    const filter = this.currentFilter();
    const query = this.searchQuery().toLowerCase();

    let filtered = orders.filter(o =>
      [OrderStatus.DISPATCHED, OrderStatus.COMPLETED, OrderStatus.PARTIAL].includes(o.status)
    );

    if (filter === 'dispatched') {
      filtered = filtered.filter(o => o.status === OrderStatus.DISPATCHED);
    } else if (filter === 'completed') {
      filtered = filtered.filter(o => [OrderStatus.COMPLETED, OrderStatus.PARTIAL].includes(o.status));
    }

    if (query) {
      filtered = filtered.filter(o =>
        o.erpOrderNumber.toLowerCase().includes(query) ||
        o.customerName.toLowerCase().includes(query)
      );
    }

    return filtered.map((o: Order) => {
      const lines = o.lines || o.orderLines || [];
      return {
        id: o.id,
        orderNumber: o.erpOrderNumber,
        customerName: o.customerName,
        appointmentDate: o.appointmentDate || '-',
        status: o.status,
        installerName: o.installerName || o.installerId || '-',
        productCount: lines.length,
        serialEntered: lines.length > 0 && lines.every((l: OrderLine) => !!l.serialNumber),
        wastePickedUp: (o.completion?.waste?.length || 0) > 0,
      };
    });
  });

  protected readonly pendingCount = computed(() =>
    this.ordersStore.filteredOrders().filter(o => o.status === OrderStatus.DISPATCHED).length
  );
  protected readonly inProgressCount = computed(() =>
    this.ordersStore.filteredOrders().filter(o => o.status === OrderStatus.PARTIAL).length
  );
  protected readonly completedCount = computed(() =>
    this.ordersStore.filteredOrders().filter(o => o.status === OrderStatus.COMPLETED).length
  );

  constructor() {
    addIcons({ filterOutline, checkmarkCircleOutline, timeOutline, alertCircleOutline });
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
      [OrderStatus.PARTIAL]: 'primary',
      [OrderStatus.COMPLETED]: 'success',
    };
    return colors[status] || 'medium';
  }

  getStatusLabel(status: OrderStatus): string {
    const labels: Record<string, string> = {
      [OrderStatus.DISPATCHED]: '대기',
      [OrderStatus.PARTIAL]: '진행중',
      [OrderStatus.COMPLETED]: '완료',
    };
    return labels[status] || String(status);
  }
}
