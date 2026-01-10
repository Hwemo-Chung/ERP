// apps/mobile/src/app/features/assignment/pages/assignment-list/assignment-list.page.ts
import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  OnInit,
} from '@angular/core';
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
  ModalController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import {
  OrderFilterModal,
  FilterContext,
} from '../../../../shared/components/order-filter/order-filter.modal';
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
    TranslateModule,
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
                <h2>{{ order.orderNo }}</h2>
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
                  {{ order.installerName || ('ASSIGNMENT.DETAIL.NOT_ASSIGNED' | translate) }}
                </p>
                <p class="product-summary">{{ order.customerAddress }}</p>
              </ion-label>
              <ion-badge slot="end" [color]="getStatusColor(order.status)">
                {{ getStatusLabel(order.status) | translate }}
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
  styles: [
    `
      /* ============================================
     * SUMMARY CHIPS - Glassmorphism Dashboard
     * ============================================ */
      .summary-chips {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: var(--space-2);
        padding: var(--space-4);
        background: linear-gradient(
          135deg,
          rgba(var(--ion-color-primary-rgb), 0.08) 0%,
          rgba(var(--ion-color-tertiary-rgb), 0.04) 100%
        );
        border-bottom: 1px solid var(--border-subtle);
        position: relative;
        overflow: hidden;

        /* Subtle noise texture overlay */
        &::before {
          content: '';
          position: absolute;
          inset: 0;
          background: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          opacity: 0.03;
          pointer-events: none;
        }

        ion-chip {
          --background: rgba(var(--ion-background-color-rgb), 0.7);
          --color: var(--text-primary);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(var(--ion-color-medium-rgb), 0.15);
          border-radius: var(--radius-lg);
          margin: 0;
          padding: var(--space-3) var(--space-2);
          height: auto;
          min-height: 56px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--space-1);
          box-shadow: var(--shadow-sm);
          transition: all var(--transition-normal) var(--ease-out);

          &:active {
            transform: scale(0.97);
          }

          ion-label {
            font-size: var(--font-size-sm);
            font-weight: var(--font-weight-semibold);
            letter-spacing: var(--letter-spacing-tight);
            white-space: nowrap;
          }

          /* Total chip - primary accent */
          &[color='medium'] {
            --background: linear-gradient(
              135deg,
              rgba(var(--ion-color-medium-rgb), 0.15) 0%,
              rgba(var(--ion-color-medium-rgb), 0.08) 100%
            );
            border-color: rgba(var(--ion-color-medium-rgb), 0.25);

            ion-label {
              background: linear-gradient(135deg, var(--text-primary), var(--text-secondary));
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
            }
          }

          /* Danger chip - unassigned */
          &[color='danger'] {
            --background: linear-gradient(
              135deg,
              rgba(var(--ion-color-danger-rgb), 0.12) 0%,
              rgba(var(--ion-color-danger-rgb), 0.06) 100%
            );
            border-color: rgba(var(--ion-color-danger-rgb), 0.3);
            box-shadow: 0 2px 8px rgba(var(--ion-color-danger-rgb), 0.15);

            ion-label {
              color: var(--ion-color-danger);
            }
          }

          /* Warning chip - assigned */
          &[color='warning'] {
            --background: linear-gradient(
              135deg,
              rgba(var(--ion-color-warning-rgb), 0.12) 0%,
              rgba(var(--ion-color-warning-rgb), 0.06) 100%
            );
            border-color: rgba(var(--ion-color-warning-rgb), 0.3);
            box-shadow: 0 2px 8px rgba(var(--ion-color-warning-rgb), 0.15);

            ion-label {
              color: var(--ion-color-warning-shade);
            }
          }

          /* Success chip - confirmed */
          &[color='success'] {
            --background: linear-gradient(
              135deg,
              rgba(var(--ion-color-success-rgb), 0.12) 0%,
              rgba(var(--ion-color-success-rgb), 0.06) 100%
            );
            border-color: rgba(var(--ion-color-success-rgb), 0.3);
            box-shadow: 0 2px 8px rgba(var(--ion-color-success-rgb), 0.15);

            ion-label {
              color: var(--ion-color-success);
            }
          }
        }
      }

      /* ============================================
     * LOADING STATE - Refined spinner
     * ============================================ */
      .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 50vh;
        color: var(--text-tertiary);
        gap: var(--space-4);

        ion-spinner {
          --color: var(--ion-color-primary);
          width: 48px;
          height: 48px;
        }

        p {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          letter-spacing: var(--letter-spacing-wide);
          text-transform: uppercase;
          animation: pulse 2s ease-in-out infinite;
        }
      }

      @keyframes pulse {
        0%,
        100% {
          opacity: 0.6;
        }
        50% {
          opacity: 1;
        }
      }

      /* ============================================
     * EMPTY STATE - Elegant illustration
     * ============================================ */
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--space-16) var(--space-6);
        color: var(--text-tertiary);
        text-align: center;

        ion-icon {
          font-size: 80px;
          margin-bottom: var(--space-6);
          opacity: 0.4;
          background: linear-gradient(
            135deg,
            var(--ion-color-success) 0%,
            var(--ion-color-tertiary) 100%
          );
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        p {
          font-size: var(--font-size-base);
          font-weight: var(--font-weight-medium);
          color: var(--text-secondary);
          max-width: 240px;
          line-height: var(--line-height-relaxed);
        }
      }

      /* ============================================
     * ORDER LIST - Premium Card Design
     * ============================================ */
      ion-list {
        background: transparent;
        padding: var(--space-3) var(--space-4) var(--space-20);

        ion-item {
          --background: var(--background-elevated);
          --padding-start: var(--space-4);
          --padding-end: var(--space-4);
          --padding-top: var(--space-4);
          --padding-bottom: var(--space-4);
          --inner-padding-end: 0;
          --border-radius: var(--radius-lg);
          --border-width: 0;

          margin-bottom: var(--space-3);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
          border: 1px solid var(--border-subtle);
          overflow: hidden;
          position: relative;

          /* Staggered entrance animation */
          animation: slideInUp 0.4s var(--ease-out) backwards;

          &:nth-child(1) {
            animation-delay: 0.05s;
          }
          &:nth-child(2) {
            animation-delay: 0.1s;
          }
          &:nth-child(3) {
            animation-delay: 0.15s;
          }
          &:nth-child(4) {
            animation-delay: 0.2s;
          }
          &:nth-child(5) {
            animation-delay: 0.25s;
          }
          &:nth-child(6) {
            animation-delay: 0.3s;
          }
          &:nth-child(7) {
            animation-delay: 0.35s;
          }
          &:nth-child(8) {
            animation-delay: 0.4s;
          }

          /* Hover/Active state */
          &:active {
            --background: var(--state-hover);
            transform: scale(0.985);
            transition: transform var(--transition-fast) var(--ease-out);
          }

          /* Left accent bar */
          &::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 4px;
            background: linear-gradient(
              180deg,
              var(--ion-color-primary) 0%,
              var(--ion-color-tertiary) 100%
            );
            opacity: 0.7;
            border-radius: var(--radius-lg) 0 0 var(--radius-lg);
          }

          ion-label {
            margin: 0;
            padding-left: var(--space-2);

            /* Order Number - Primary identifier */
            h2 {
              font-size: var(--font-size-lg);
              font-weight: var(--font-weight-bold);
              color: var(--text-primary);
              letter-spacing: var(--letter-spacing-tight);
              margin-bottom: var(--space-1);
              font-family: var(--font-family-mono);
            }

            /* Customer Name - Secondary prominence */
            h3 {
              font-size: var(--font-size-base);
              font-weight: var(--font-weight-semibold);
              color: var(--text-primary);
              margin-bottom: var(--space-3);
              line-height: var(--line-height-snug);
            }

            /* Info rows with icons */
            p {
              display: flex;
              align-items: center;
              gap: var(--space-2);
              color: var(--text-secondary);
              font-size: var(--font-size-sm);
              margin-bottom: var(--space-1-5);
              line-height: var(--line-height-normal);

              ion-icon {
                font-size: 16px;
                color: var(--text-tertiary);
                flex-shrink: 0;
              }

              &:last-of-type {
                margin-bottom: 0;
              }
            }

            /* Address - Tertiary info */
            .product-summary {
              margin-top: var(--space-2);
              padding-top: var(--space-2);
              border-top: 1px dashed var(--border-subtle);
              font-size: var(--font-size-xs);
              color: var(--text-tertiary);
              line-height: var(--line-height-relaxed);
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
            }
          }

          /* Status Badge - Premium styling */
          ion-badge {
            position: absolute;
            top: var(--space-3);
            right: var(--space-3);
            font-size: var(--font-size-2xs);
            font-weight: var(--font-weight-bold);
            letter-spacing: var(--letter-spacing-wider);
            text-transform: uppercase;
            padding: var(--space-1-5) var(--space-2-5);
            border-radius: var(--radius-full);
            box-shadow: var(--shadow-xs);

            /* Gradient backgrounds for each status */
            &[color='danger'] {
              --background: linear-gradient(
                135deg,
                var(--ion-color-danger) 0%,
                var(--ion-color-danger-shade) 100%
              );
              --color: var(--ion-color-danger-contrast);
            }

            &[color='warning'] {
              --background: linear-gradient(
                135deg,
                var(--ion-color-warning) 0%,
                var(--ion-color-warning-shade) 100%
              );
              --color: var(--ion-color-warning-contrast);
            }

            &[color='success'] {
              --background: linear-gradient(
                135deg,
                var(--ion-color-success) 0%,
                var(--ion-color-success-shade) 100%
              );
              --color: var(--ion-color-success-contrast);
            }
          }

          /* Detail arrow enhancement */
          ion-icon[slot='end'] {
            color: var(--text-placeholder);
            font-size: 20px;
            margin-left: var(--space-2);
          }
        }
      }

      @keyframes slideInUp {
        from {
          opacity: 0;
          transform: translateY(16px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      /* ============================================
     * FAB BUTTON - Premium floating action
     * ============================================ */
      ion-fab {
        --background: transparent;

        ion-fab-button {
          --background: linear-gradient(
            135deg,
            var(--ion-color-primary) 0%,
            var(--ion-color-tertiary) 100%
          );
          --background-activated: linear-gradient(
            135deg,
            var(--ion-color-primary-shade) 0%,
            var(--ion-color-tertiary-shade) 100%
          );
          --box-shadow:
            0 8px 24px rgba(var(--ion-color-primary-rgb), 0.35), 0 4px 8px rgba(0, 0, 0, 0.1);
          --border-radius: var(--radius-xl);
          width: 60px;
          height: 60px;
          transition: all var(--transition-normal) var(--ease-out);

          /* Pulse animation on idle */
          animation: fabPulse 3s ease-in-out infinite;

          &:active {
            transform: scale(0.92);
            animation: none;
          }

          ion-icon {
            font-size: 28px;
            color: white;
          }

          /* Glow ring effect */
          &::before {
            content: '';
            position: absolute;
            inset: -3px;
            border-radius: var(--radius-xl);
            background: linear-gradient(
              135deg,
              var(--ion-color-primary-tint) 0%,
              var(--ion-color-tertiary-tint) 100%
            );
            opacity: 0;
            z-index: -1;
            transition: opacity var(--transition-normal) var(--ease-out);
          }

          &:hover::before {
            opacity: 0.5;
          }
        }
      }

      @keyframes fabPulse {
        0%,
        100% {
          box-shadow:
            0 8px 24px rgba(var(--ion-color-primary-rgb), 0.35),
            0 4px 8px rgba(0, 0, 0, 0.1);
        }
        50% {
          box-shadow:
            0 12px 32px rgba(var(--ion-color-primary-rgb), 0.5),
            0 6px 12px rgba(0, 0, 0, 0.15);
        }
      }

      /* ============================================
     * DARK MODE ENHANCEMENTS
     * ============================================ */
      @media (prefers-color-scheme: dark) {
        .summary-chips {
          background: linear-gradient(
            135deg,
            rgba(var(--ion-color-primary-rgb), 0.12) 0%,
            rgba(var(--ion-color-tertiary-rgb), 0.08) 100%
          );

          &::before {
            opacity: 0.05;
          }

          ion-chip {
            --background: rgba(var(--ion-background-color-rgb), 0.5);
            border-color: rgba(255, 255, 255, 0.1);

            &[color='medium'] {
              --background: linear-gradient(
                135deg,
                rgba(var(--ion-color-medium-rgb), 0.2) 0%,
                rgba(var(--ion-color-medium-rgb), 0.1) 100%
              );
            }

            &[color='danger'] {
              --background: linear-gradient(
                135deg,
                rgba(var(--ion-color-danger-rgb), 0.2) 0%,
                rgba(var(--ion-color-danger-rgb), 0.1) 100%
              );
              box-shadow: 0 2px 12px rgba(var(--ion-color-danger-rgb), 0.25);
            }

            &[color='warning'] {
              --background: linear-gradient(
                135deg,
                rgba(var(--ion-color-warning-rgb), 0.2) 0%,
                rgba(var(--ion-color-warning-rgb), 0.1) 100%
              );
              box-shadow: 0 2px 12px rgba(var(--ion-color-warning-rgb), 0.25);
            }

            &[color='success'] {
              --background: linear-gradient(
                135deg,
                rgba(var(--ion-color-success-rgb), 0.2) 0%,
                rgba(var(--ion-color-success-rgb), 0.1) 100%
              );
              box-shadow: 0 2px 12px rgba(var(--ion-color-success-rgb), 0.25);
            }
          }
        }

        ion-list ion-item {
          --background: var(--background-elevated);
          border-color: var(--border-subtle);
          box-shadow: var(--shadow-md);

          &::before {
            opacity: 0.9;
          }
        }

        ion-fab ion-fab-button {
          --box-shadow:
            0 8px 28px rgba(var(--ion-color-primary-rgb), 0.45), 0 4px 12px rgba(0, 0, 0, 0.3);
        }
      }

      /* ============================================
     * RESPONSIVE ADJUSTMENTS
     * ============================================ */
      @media (max-width: 359px) {
        .summary-chips {
          grid-template-columns: repeat(2, 1fr);
          gap: var(--space-2);

          ion-chip {
            min-height: 48px;
            padding: var(--space-2);

            ion-label {
              font-size: var(--font-size-xs);
            }
          }
        }
      }

      @media (min-width: 768px) {
        .summary-chips {
          max-width: 600px;
          margin: 0 auto;
          border-radius: 0 0 var(--radius-lg) var(--radius-lg);
        }

        ion-list {
          max-width: 700px;
          margin: 0 auto;
        }
      }

      /* ============================================
     * REDUCED MOTION SUPPORT
     * ============================================ */
      @media (prefers-reduced-motion: reduce) {
        ion-list ion-item {
          animation: none;
        }

        ion-fab ion-fab-button {
          animation: none;
        }

        .loading-container p {
          animation: none;
        }
      }
    `,
  ],
})
export class AssignmentListPage implements OnInit {
  readonly ordersStore = inject(OrdersStore);
  private readonly authService = inject(AuthService);
  private readonly uiStore = inject(UIStore);
  private readonly modalController = inject(ModalController);

  protected readonly currentFilter = signal<AssignmentFilter>('all');

  // Computed counts from orders store filtered by assignment-related statuses
  protected readonly assignmentOrders = computed(() => {
    const orders = this.ordersStore.orders();
    const filter = this.currentFilter();

    // Assignment tab shows: UNASSIGNED, ASSIGNED, CONFIRMED
    const assignmentStatuses = [
      OrderStatus.UNASSIGNED,
      OrderStatus.ASSIGNED,
      OrderStatus.CONFIRMED,
    ];
    let filtered = orders.filter((o) => assignmentStatuses.includes(o.status));

    if (filter === 'unassigned') {
      filtered = filtered.filter((o) => o.status === OrderStatus.UNASSIGNED);
    } else if (filter === 'assigned') {
      filtered = filtered.filter((o) => o.status === OrderStatus.ASSIGNED);
    } else if (filter === 'confirmed') {
      filtered = filtered.filter((o) => o.status === OrderStatus.CONFIRMED);
    }

    return filtered;
  });

  // Use server stats for accurate counts (not affected by lazy loading)
  protected readonly totalCount = computed(() => {
    const stats = this.ordersStore.kpiMetrics();
    // Assignment tab total = unassigned + assigned + confirmed
    return stats.unassigned + stats.assigned + stats.confirmed;
  });

  protected readonly unassignedCount = computed(() => {
    return this.ordersStore.kpiMetrics().unassigned;
  });

  protected readonly assignedCount = computed(() => {
    return this.ordersStore.kpiMetrics().assigned;
  });

  protected readonly confirmedCount = computed(() => {
    return this.ordersStore.kpiMetrics().confirmed;
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
      // Load stats first for accurate KPI counts, then load paginated orders
      await Promise.all([
        this.ordersStore.loadStats(branchCode),
        this.ordersStore.loadOrders(branchCode, 1, 100),
      ]);
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

  async openFilter(): Promise<void> {
    const modal = await this.modalController.create({
      component: OrderFilterModal,
      componentProps: {
        context: 'assignment' as FilterContext,
        currentFilters: this.ordersStore.filters(),
        installers: [], // Can be populated from metadata store if available
        branches: [], // Can be populated from metadata store for HQ_ADMIN
      },
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === 'apply' && data) {
      this.ordersStore.setFilters(data);
      await this.loadData();
    }
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
      [OrderStatus.UNASSIGNED]: 'ORDER_STATUS.UNASSIGNED',
      [OrderStatus.ASSIGNED]: 'ORDER_STATUS.ASSIGNED',
      [OrderStatus.CONFIRMED]: 'ORDER_STATUS.CONFIRMED',
    };
    return labels[status] || `ORDER_STATUS.${status}`;
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
}
