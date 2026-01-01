// apps/web/src/app/features/reports/pages/progress-dashboard/progress-dashboard.page.ts
// PRD FR-08, FR-11 - KPI Dashboard with branch/installer progress
import { Component, signal, computed, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonSegment, IonSegmentButton,
  IonLabel, IonSpinner, IonGrid, IonRow, IonCol, IonBadge, IonList, IonItem,
  IonRefresher, IonRefresherContent, IonProgressBar, IonIcon, IonButton,
  IonDatetime, IonModal, IonDatetimeButton,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { 
  calendarOutline, filterOutline, refreshOutline, trendingUpOutline,
  personOutline, businessOutline, statsChartOutline, checkmarkCircleOutline,
  warningOutline, closeCircleOutline, timeOutline,
} from 'ionicons/icons';
import { ReportsStore } from '../../../../store/reports/reports.store';
import { AuthService } from '../../../../core/services/auth.service';
import { USER_ROLES } from '../../../../shared/constants/app.constants';

type ViewType = 'installer' | 'branch' | 'status';

@Component({
  selector: 'app-progress-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, TranslateModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonSegment, IonSegmentButton,
    IonLabel, IonSpinner, IonGrid, IonRow, IonCol, IonBadge, IonList, IonItem,
    IonRefresher, IonRefresherContent, IonProgressBar, IonIcon, IonButton,
    IonDatetime, IonModal, IonDatetimeButton,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/reports"></ion-back-button>
        </ion-buttons>
        <!-- 진행현황 대시보드 타이틀 -->
        <ion-title>{{ 'REPORTS.PROGRESS.TITLE' | translate }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="loadData()">
            <ion-icon slot="icon-only" name="refresh-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar class="filter-bar">
        <div class="filter-row">
          <!-- 날짜 범위 선택 버튼 -->
          <ion-button fill="clear" size="small" id="open-date-modal">
            <ion-icon slot="start" name="calendar-outline"></ion-icon>
            {{ dateRangeLabel() }}
          </ion-button>
          <!-- 뷰 타입 세그먼트 (설치기사별/지점별/상태별) -->
          <ion-segment [value]="viewType()" (ionChange)="onViewTypeChange($any($event).detail.value)" class="view-segment">
            <ion-segment-button value="installer"><ion-icon name="person-outline"></ion-icon></ion-segment-button>
            <ion-segment-button value="branch"><ion-icon name="business-outline"></ion-icon></ion-segment-button>
            <ion-segment-button value="status"><ion-icon name="stats-chart-outline"></ion-icon></ion-segment-button>
          </ion-segment>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (reportsStore.isLoading()) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
          <p>{{ 'REPORTS.PROGRESS.LOADING' | translate }}</p>
        </div>
      } @else {
        <!-- Summary Cards - 요약 카드들 -->
        <div class="summary-grid">
          <div class="summary-card total">
            <div class="card-icon"><ion-icon name="stats-chart-outline"></ion-icon></div>
            <div class="card-content">
              <span class="value">{{ reportsStore.summary()?.total || 0 }}</span>
              <span class="label">{{ 'REPORTS.PROGRESS.TOTAL_ORDERS' | translate }}</span>
            </div>
          </div>
          <div class="summary-card completed">
            <div class="card-icon"><ion-icon name="checkmark-circle-outline"></ion-icon></div>
            <div class="card-content">
              <span class="value">{{ reportsStore.summary()?.completed || 0 }}</span>
              <span class="label">{{ 'REPORTS.PROGRESS.COMPLETED' | translate }}</span>
            </div>
          </div>
          <div class="summary-card pending">
            <div class="card-icon"><ion-icon name="time-outline"></ion-icon></div>
            <div class="card-content">
              <span class="value">{{ reportsStore.summary()?.pending || 0 }}</span>
              <span class="label">{{ 'REPORTS.PROGRESS.IN_PROGRESS' | translate }}</span>
            </div>
          </div>
          <div class="summary-card cancelled">
            <div class="card-icon"><ion-icon name="close-circle-outline"></ion-icon></div>
            <div class="card-content">
              <span class="value">{{ reportsStore.summary()?.cancelled || 0 }}</span>
              <span class="label">{{ 'REPORTS.PROGRESS.CANCELLED' | translate }}</span>
            </div>
          </div>
        </div>

        <!-- KPI Metrics - KPI 지표 섹션 -->
        <div class="section">
          <h3 class="section-title">
            <ion-icon name="trending-up-outline"></ion-icon>
            {{ 'REPORTS.PROGRESS.KPI_TITLE' | translate }}
          </h3>
          <div class="kpi-card">
            <div class="kpi-item">
              <div class="kpi-header">
                <span class="kpi-label">{{ 'REPORTS.PROGRESS.COMPLETION_RATE' | translate }}</span>
                <span class="kpi-value">{{ reportsStore.totalCompletionRate() }}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" [style.width.%]="reportsStore.totalCompletionRate()"></div>
              </div>
            </div>
            <div class="kpi-item">
              <div class="kpi-header">
                <span class="kpi-label">{{ 'REPORTS.PROGRESS.WASTE_PICKUP' | translate }}</span>
                <span class="kpi-value">{{ reportsStore.wasteTotals().totalItems }}{{ 'REPORTS.PROGRESS.ITEMS_SUFFIX' | translate }}</span>
              </div>
              <div class="progress-bar waste">
                <div class="progress-fill" [style.width.%]="wasteProgress()"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Progress List - 진행 현황 리스트 -->
        <div class="section">
          <h3 class="section-title">
            <ion-icon [name]="viewTypeIcon()"></ion-icon>
            {{ viewTypeLabel() | translate }}
          </h3>
          @if (reportsStore.progressItems().length > 0) {
            <div class="progress-list">
              @for (item of reportsStore.progressItems(); track item.key) {
                <div class="progress-item">
                  <div class="item-header">
                    <span class="item-name">{{ getItemLabel(item, viewType()) }}</span>
                    <span class="item-stats">{{ getItemStats(item, viewType()) }}</span>
                  </div>
                  @if (viewType() !== 'status') {
                    <div class="progress-bar">
                      <div class="progress-fill"
                           [class.success]="item.completionRate >= 80"
                           [class.warning]="item.completionRate >= 50 && item.completionRate < 80"
                           [class.danger]="item.completionRate < 50"
                           [style.width.%]="item.completionRate"></div>
                    </div>
                    <div class="item-footer">
                      <span class="rate-badge"
                            [class.success]="item.completionRate >= 80"
                            [class.warning]="item.completionRate >= 50 && item.completionRate < 80"
                            [class.danger]="item.completionRate < 50">
                        {{ item.completionRate | number:'1.0-0' }}%
                      </span>
                    </div>
                  }
                </div>
              }
            </div>
          } @else {
            <div class="empty-state">
              <ion-icon name="stats-chart-outline"></ion-icon>
              <p>{{ 'REPORTS.PROGRESS.NO_DATA' | translate }}</p>
            </div>
          }
        </div>
      }

      <!-- Date Range Modal - 기간 선택 모달 -->
      <ion-modal trigger="open-date-modal" [initialBreakpoint]="0.5" [breakpoints]="[0, 0.5]">
        <ng-template>
          <ion-header>
            <ion-toolbar>
              <ion-title>{{ 'REPORTS.PROGRESS.DATE_SELECT' | translate }}</ion-title>
              <ion-buttons slot="end">
                <ion-button (click)="applyDateFilter()">{{ 'REPORTS.PROGRESS.APPLY' | translate }}</ion-button>
              </ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content class="ion-padding">
            <div class="date-inputs">
              <div class="date-field">
                <label>{{ 'REPORTS.PROGRESS.START_DATE' | translate }}</label>
                <ion-datetime-button datetime="datetime-from"></ion-datetime-button>
                <ion-modal [keepContentsMounted]="true">
                  <ng-template>
                    <ion-datetime id="datetime-from" [(ngModel)]="dateFrom" presentation="date" [showDefaultButtons]="true"></ion-datetime>
                  </ng-template>
                </ion-modal>
              </div>
              <div class="date-field">
                <label>{{ 'REPORTS.PROGRESS.END_DATE' | translate }}</label>
                <ion-datetime-button datetime="datetime-to"></ion-datetime-button>
                <ion-modal [keepContentsMounted]="true">
                  <ng-template>
                    <ion-datetime id="datetime-to" [(ngModel)]="dateTo" presentation="date" [showDefaultButtons]="true"></ion-datetime>
                  </ng-template>
                </ion-modal>
              </div>
            </div>
            <!-- 빠른 필터 버튼들 -->
            <div class="quick-filters">
              <ion-button fill="outline" size="small" (click)="setQuickDate('today')">{{ 'REPORTS.PROGRESS.TODAY' | translate }}</ion-button>
              <ion-button fill="outline" size="small" (click)="setQuickDate('week')">{{ 'REPORTS.PROGRESS.THIS_WEEK' | translate }}</ion-button>
              <ion-button fill="outline" size="small" (click)="setQuickDate('month')">{{ 'REPORTS.PROGRESS.THIS_MONTH' | translate }}</ion-button>
            </div>
          </ion-content>
        </ng-template>
      </ion-modal>
    </ion-content>
  `,
  styles: [`
    .filter-bar { --background: var(--ion-color-light); }
    .filter-row { display: flex; align-items: center; justify-content: space-between; padding: 0 8px; }
    .view-segment { width: auto; min-width: 120px; }
    .view-segment ion-segment-button { --padding-start: 8px; --padding-end: 8px; min-width: 40px; }
    .loading-container { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 64px 24px; }
    .loading-container p { margin-top: 16px; color: var(--ion-color-medium); }
    .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; padding: 16px; }
    .summary-card { background: white; border-radius: 16px; padding: 16px; display: flex; align-items: center; gap: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .card-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
    .card-icon ion-icon { font-size: 24px; color: white; }
    .summary-card.total .card-icon { background: linear-gradient(135deg, #3b82f6, #2563eb); }
    .summary-card.completed .card-icon { background: linear-gradient(135deg, #10b981, #059669); }
    .summary-card.pending .card-icon { background: linear-gradient(135deg, #f59e0b, #d97706); }
    .summary-card.cancelled .card-icon { background: linear-gradient(135deg, #ef4444, #dc2626); }
    .card-content { display: flex; flex-direction: column; }
    .card-content .value { font-size: 24px; font-weight: 700; color: #0f172a; }
    .card-content .label { font-size: 12px; color: #64748b; }
    .section { padding: 0 16px 16px; }
    .section-title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; color: #0f172a; margin: 16px 0 12px; }
    .section-title ion-icon { font-size: 20px; color: #3b82f6; }
    .kpi-card { background: white; border-radius: 16px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .kpi-item { margin-bottom: 16px; }
    .kpi-item:last-child { margin-bottom: 0; }
    .kpi-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .kpi-label { font-size: 14px; color: #64748b; }
    .kpi-value { font-size: 14px; font-weight: 600; color: #0f172a; }
    .progress-bar { height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb); border-radius: 4px; transition: width 0.3s; }
    .progress-fill.success { background: linear-gradient(90deg, #10b981, #059669); }
    .progress-fill.warning { background: linear-gradient(90deg, #f59e0b, #d97706); }
    .progress-fill.danger { background: linear-gradient(90deg, #ef4444, #dc2626); }
    .progress-bar.waste .progress-fill { background: linear-gradient(90deg, #8b5cf6, #7c3aed); }
    .progress-list { display: flex; flex-direction: column; gap: 12px; }
    .progress-item { background: white; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .item-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .item-name { font-size: 14px; font-weight: 600; color: #0f172a; }
    .item-stats { font-size: 13px; color: #64748b; }
    .item-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
    .rate-badge { font-size: 12px; font-weight: 600; padding: 4px 8px; border-radius: 6px; }
    .rate-badge.success { background: #dcfce7; color: #166534; }
    .rate-badge.warning { background: #fef3c7; color: #92400e; }
    .rate-badge.danger { background: #fee2e2; color: #991b1b; }
    .empty-state { display: flex; flex-direction: column; align-items: center; padding: 48px; color: #94a3b8; }
    .empty-state ion-icon { font-size: 48px; margin-bottom: 12px; }
    .date-inputs { display: flex; gap: 16px; margin-bottom: 16px; }
    .date-field { flex: 1; }
    .date-field label { display: block; font-size: 13px; color: #64748b; margin-bottom: 8px; }
    .quick-filters { display: flex; gap: 8px; flex-wrap: wrap; }
  `],
})
export class ProgressDashboardPage implements OnInit {
  protected readonly reportsStore = inject(ReportsStore);
  private readonly authService = inject(AuthService);
  private readonly translate = inject(TranslateService);

  // Local UI state
  protected readonly viewType = signal<ViewType>('branch');
  dateFrom = new Date().toISOString();
  dateTo = new Date().toISOString();

  constructor() {
    addIcons({
      calendarOutline, filterOutline, refreshOutline, trendingUpOutline,
      personOutline, businessOutline, statsChartOutline, checkmarkCircleOutline,
      warningOutline, closeCircleOutline, timeOutline,
    });
  }

  // Computed properties - 날짜 범위 라벨 (computed signal)
  protected readonly dateRangeLabel = computed(() => {
    const from = new Date(this.dateFrom);
    const to = new Date(this.dateTo);
    const formatDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
    return `${formatDate(from)} - ${formatDate(to)}`;
  });

  // 뷰 타입 라벨 (i18n key - translated in template)
  protected readonly viewTypeLabel = computed(() => {
    const labels: Record<ViewType, string> = {
      installer: 'REPORTS.PROGRESS.VIEW_BY_INSTALLER',
      branch: 'REPORTS.PROGRESS.VIEW_BY_BRANCH',
      status: 'REPORTS.PROGRESS.VIEW_BY_STATUS',
    };
    return labels[this.viewType()];
  });

  protected readonly viewTypeIcon = computed(() => {
    const icons: Record<ViewType, string> = {
      installer: 'person-outline',
      branch: 'business-outline',
      status: 'stats-chart-outline',
    };
    return icons[this.viewType()];
  });

  protected readonly wasteProgress = computed(() => {
    const totals = this.reportsStore.wasteTotals();
    return totals.totalItems > 0 ? Math.min((totals.totalItems / 100) * 100, 100) : 0;
  });

  ngOnInit() {
    // Set default date range to current month
    const now = new Date();
    this.dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    this.dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
    
    this.loadData();
  }

  loadData() {
    // HQ_ADMIN sees all data, others see only their branch
    const branchCode = this.authService.hasRole(USER_ROLES.HQ_ADMIN)
      ? undefined
      : this.authService.user()?.branchCode;

    const filters = {
      dateFrom: this.dateFrom.split('T')[0],
      dateTo: this.dateTo.split('T')[0],
      branchCode,
      groupBy: this.viewType() as 'branch' | 'installer' | 'status',
    };

    this.reportsStore.setFilters(filters);
    this.reportsStore.loadSummary();
    this.reportsStore.loadProgress(filters);
  }

  onViewTypeChange(type: ViewType) {
    this.viewType.set(type);
    // Load progress with the new groupBy parameter
    const branchCode = this.authService.hasRole(USER_ROLES.HQ_ADMIN)
      ? undefined
      : this.authService.user()?.branchCode;

    this.reportsStore.loadProgress({
      dateFrom: this.dateFrom.split('T')[0],
      dateTo: this.dateTo.split('T')[0],
      branchCode,
      groupBy: type as 'branch' | 'installer' | 'status',
    });
  }

  async onRefresh(event: any) {
    this.loadData();
    setTimeout(() => event.target.complete(), 500);
  }

  applyDateFilter() {
    this.loadData();
  }

  setQuickDate(period: 'today' | 'week' | 'month') {
    const now = new Date();
    switch (period) {
      case 'today':
        this.dateFrom = now.toISOString();
        this.dateTo = now.toISOString();
        break;
      case 'week':
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        this.dateFrom = startOfWeek.toISOString();
        this.dateTo = now.toISOString();
        break;
      case 'month':
        this.dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        this.dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
        break;
    }
  }

  /**
   * Get translated label for progress item
   * For status view, translate using ORDER_STATUS keys
   * Note: viewType passed explicitly for OnPush change detection
   */
  getItemLabel(item: { key: string; label: string }, currentViewType: ViewType): string {
    if (currentViewType === 'status') {
      // Translate status key using ORDER_STATUS translations
      const translationKey = `ORDER_STATUS.${item.key}`;
      const translated = this.translate.instant(translationKey);
      // If no translation found, return original label
      return translated !== translationKey ? translated : item.label;
    }
    return item.label;
  }

  /**
   * Get stats display for progress item
   * For status view, show just total count (completion rate doesn't apply)
   * For other views, show completed/total
   * Note: viewType passed explicitly for OnPush change detection
   */
  getItemStats(item: { total: number; completed: number }, currentViewType: ViewType): string {
    if (currentViewType === 'status') {
      // For status view, show total count with suffix (completion rate doesn't apply)
      return `${item.total}${this.translate.instant('REPORTS.PROGRESS.ITEMS_SUFFIX')}`;
    }
    return `${item.completed}/${item.total}`;
  }
}
