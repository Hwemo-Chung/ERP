// apps/web/src/app/features/reports/pages/waste-summary/waste-summary.page.ts
// PRD FR-07 - Waste appliance collection summary per category
import { Component, computed, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonSpinner,
  IonButton,
  IonIcon,
  IonDatetimeButton,
  IonModal,
  IonDatetime,
  IonRefresher,
  IonRefresherContent,
  RefresherCustomEvent,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  downloadOutline,
  calendarOutline,
  trashOutline,
  cubeOutline,
  trendingUpOutline,
  layersOutline,
} from 'ionicons/icons';
import { ReportsStore } from '../../../../store/reports/reports.store';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-waste-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonSpinner,
    IonButton,
    IonIcon,
    IonDatetimeButton,
    IonModal,
    IonDatetime,
    IonRefresher,
    IonRefresherContent,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/reports"></ion-back-button>
        </ion-buttons>
        <!-- 폐가전 집계 타이틀 -->
        <ion-title>{{ 'REPORTS.WASTE.TITLE' | translate }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="exportData()">
            <ion-icon slot="icon-only" name="download-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- Date Range Filter - 기간 필터 -->
      <div class="filter-section">
        <div class="date-filter">
          <ion-button fill="clear" size="small" id="open-waste-date-modal">
            <ion-icon slot="start" name="calendar-outline"></ion-icon>
            {{ dateRangeLabel() }}
          </ion-button>
        </div>
      </div>

      <!-- Summary Cards - 요약 카드 -->
      <div class="summary-section">
        <div class="total-card">
          <div class="total-icon">
            <ion-icon name="trash-outline"></ion-icon>
          </div>
          <div class="total-info">
            <span class="total-value">{{ reportsStore.wasteTotals().totalItems }}</span>
            <span class="total-unit">{{ 'REPORTS.WASTE.UNIT' | translate }}</span>
          </div>
          <span class="total-label">{{ 'REPORTS.WASTE.TOTAL_COUNT' | translate }}</span>
        </div>
        <div class="stats-row">
          <div class="stat-item">
            <ion-icon name="layers-outline"></ion-icon>
            <div class="stat-content">
              <span class="stat-value">{{ reportsStore.wasteSummary().length }}</span>
              <span class="stat-label">{{ 'REPORTS.WASTE.CATEGORY_COUNT' | translate }}</span>
            </div>
          </div>
          <div class="stat-item">
            <ion-icon name="trending-up-outline"></ion-icon>
            <div class="stat-content">
              <span class="stat-value">{{ avgPerCategory() | number: '1.0-0' }}</span>
              <span class="stat-label">{{ 'REPORTS.WASTE.AVERAGE' | translate }}</span>
            </div>
          </div>
        </div>
      </div>

      @if (reportsStore.isLoading()) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
          <p>{{ 'REPORTS.PROGRESS.LOADING' | translate }}</p>
        </div>
      } @else {
        <!-- Top Categories Chart - TOP 5 품목 -->
        @if (topCategories().length > 0) {
          <div class="section">
            <h3 class="section-title">
              <ion-icon name="trending-up-outline"></ion-icon>
              {{ 'REPORTS.WASTE.TOP5_TITLE' | translate }}
            </h3>
            <div class="chart-card">
              @for (item of topCategories(); track item.wasteCode; let i = $index) {
                <div class="chart-item">
                  <div class="chart-rank" [class]="'rank-' + (i + 1)">{{ i + 1 }}</div>
                  <div class="chart-info">
                    <div class="chart-header">
                      <span class="chart-name">{{ item.wasteName }}</span>
                      <span class="chart-count"
                        >{{ item.quantity }}{{ 'REPORTS.WASTE.UNIT' | translate }}</span
                      >
                    </div>
                    <div class="chart-bar">
                      <div
                        class="chart-fill"
                        [style.width.%]="(item.quantity / maxCount()) * 100"
                        [style.background]="getBarColor(i)"
                      ></div>
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <!-- Full List - 품목별 현황 -->
        <div class="section">
          <h3 class="section-title">
            <ion-icon name="cube-outline"></ion-icon>
            {{ 'REPORTS.WASTE.CATEGORY_STATUS' | translate }}
          </h3>
          <div class="category-list">
            @for (stat of reportsStore.wasteSummary(); track stat.wasteCode) {
              <div class="category-item">
                <div class="category-info">
                  <span class="category-code">{{ stat.wasteCode }}</span>
                  <span class="category-name">{{ stat.wasteName }}</span>
                </div>
                <div class="category-count" [class]="getCountClass(stat.quantity)">
                  {{ stat.quantity }}{{ 'REPORTS.WASTE.UNIT' | translate }}
                </div>
              </div>
            } @empty {
              <div class="empty-state">
                <ion-icon name="cube-outline"></ion-icon>
                <p>{{ 'REPORTS.WASTE.NO_DATA' | translate }}</p>
              </div>
            }
          </div>
        </div>
      }

      <!-- Date Range Modal - 기간 선택 모달 -->
      <ion-modal trigger="open-waste-date-modal" [initialBreakpoint]="0.5" [breakpoints]="[0, 0.5]">
        <ng-template>
          <ion-header>
            <ion-toolbar>
              <ion-title>{{ 'REPORTS.PROGRESS.DATE_SELECT' | translate }}</ion-title>
              <ion-buttons slot="end">
                <ion-button (click)="applyDateFilter()">{{
                  'REPORTS.PROGRESS.APPLY' | translate
                }}</ion-button>
              </ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content class="ion-padding">
            <div class="date-inputs">
              <div class="date-field">
                <label>{{ 'REPORTS.PROGRESS.START_DATE' | translate }}</label>
                <ion-datetime-button datetime="waste-from"></ion-datetime-button>
                <ion-modal [keepContentsMounted]="true">
                  <ng-template>
                    <ion-datetime
                      id="waste-from"
                      [(ngModel)]="dateFrom"
                      presentation="date"
                      [showDefaultButtons]="true"
                    ></ion-datetime>
                  </ng-template>
                </ion-modal>
              </div>
              <div class="date-field">
                <label>{{ 'REPORTS.PROGRESS.END_DATE' | translate }}</label>
                <ion-datetime-button datetime="waste-to"></ion-datetime-button>
                <ion-modal [keepContentsMounted]="true">
                  <ng-template>
                    <ion-datetime
                      id="waste-to"
                      [(ngModel)]="dateTo"
                      presentation="date"
                      [showDefaultButtons]="true"
                    ></ion-datetime>
                  </ng-template>
                </ion-modal>
              </div>
            </div>
            <!-- 빠른 필터 버튼들 -->
            <div class="quick-filters">
              <ion-button fill="outline" size="small" (click)="setQuickDate('week')">{{
                'REPORTS.WASTE.LAST_7_DAYS' | translate
              }}</ion-button>
              <ion-button fill="outline" size="small" (click)="setQuickDate('month')">{{
                'REPORTS.WASTE.LAST_30_DAYS' | translate
              }}</ion-button>
              <ion-button fill="outline" size="small" (click)="setQuickDate('quarter')">{{
                'REPORTS.WASTE.LAST_90_DAYS' | translate
              }}</ion-button>
            </div>
          </ion-content>
        </ng-template>
      </ion-modal>
    </ion-content>
  `,
  styles: [
    `
      .filter-section {
        padding: 16px;
        background: #f8fafc;
      }
      .date-filter {
        display: flex;
        justify-content: center;
      }
      .summary-section {
        padding: 0 16px 16px;
      }
      .total-card {
        background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
        border-radius: 20px;
        padding: 24px;
        margin-bottom: 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .total-icon {
        width: 64px;
        height: 64px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 12px;
      }
      .total-icon ion-icon {
        font-size: 32px;
        color: white;
      }
      .total-info {
        display: flex;
        align-items: baseline;
        gap: 4px;
      }
      .total-value {
        font-size: 48px;
        font-weight: 700;
        color: white;
      }
      .total-unit {
        font-size: 20px;
        color: rgba(255, 255, 255, 0.8);
      }
      .total-label {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.8);
        margin-top: 4px;
      }
      .stats-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .stat-item {
        background: white;
        border-radius: 16px;
        padding: 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      }
      .stat-item ion-icon {
        font-size: 24px;
        color: #8b5cf6;
      }
      .stat-content {
        display: flex;
        flex-direction: column;
      }
      .stat-value {
        font-size: 20px;
        font-weight: 700;
        color: #0f172a;
      }
      .stat-label {
        font-size: 12px;
        color: #64748b;
      }
      .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 48px;
        color: #64748b;
      }
      .section {
        padding: 0 16px 16px;
      }
      .section-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        font-weight: 600;
        color: #0f172a;
        margin: 16px 0 12px;
      }
      .section-title ion-icon {
        font-size: 20px;
        color: #8b5cf6;
      }
      .chart-card {
        background: white;
        border-radius: 16px;
        padding: 16px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      }
      .chart-item {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
      }
      .chart-item:last-child {
        margin-bottom: 0;
      }
      .chart-rank {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 700;
        color: white;
        flex-shrink: 0;
      }
      .rank-1 {
        background: linear-gradient(135deg, #f59e0b, #d97706);
      }
      .rank-2 {
        background: linear-gradient(135deg, #64748b, #475569);
      }
      .rank-3 {
        background: linear-gradient(135deg, #a16207, #92400e);
      }
      .rank-4,
      .rank-5 {
        background: #cbd5e1;
        color: #475569;
      }
      .chart-info {
        flex: 1;
      }
      .chart-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 6px;
      }
      .chart-name {
        font-size: 14px;
        font-weight: 500;
        color: #0f172a;
      }
      .chart-count {
        font-size: 14px;
        font-weight: 600;
        color: #8b5cf6;
      }
      .chart-bar {
        height: 6px;
        background: #e2e8f0;
        border-radius: 3px;
        overflow: hidden;
      }
      .chart-fill {
        height: 100%;
        border-radius: 3px;
        transition: width 0.3s;
      }
      .category-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .category-item {
        background: white;
        border-radius: 12px;
        padding: 14px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      }
      .category-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .category-code {
        font-size: 12px;
        color: #94a3b8;
      }
      .category-name {
        font-size: 14px;
        font-weight: 500;
        color: #0f172a;
      }
      .category-count {
        font-size: 14px;
        font-weight: 600;
        padding: 4px 10px;
        border-radius: 6px;
      }
      .category-count.high {
        background: #fee2e2;
        color: #dc2626;
      }
      .category-count.medium {
        background: #fef3c7;
        color: #d97706;
      }
      .category-count.low {
        background: #dbeafe;
        color: #2563eb;
      }
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 48px;
        color: #94a3b8;
      }
      .empty-state ion-icon {
        font-size: 48px;
        margin-bottom: 12px;
      }
      .date-inputs {
        display: flex;
        gap: 16px;
        margin-bottom: 16px;
      }
      .date-field {
        flex: 1;
      }
      .date-field label {
        display: block;
        font-size: 13px;
        color: #64748b;
        margin-bottom: 8px;
      }
      .quick-filters {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
    `,
  ],
})
export class WasteSummaryPage implements OnInit {
  protected readonly reportsStore = inject(ReportsStore);
  private readonly authService = inject(AuthService);
  private readonly toastCtrl = inject(ToastController);
  private readonly translate = inject(TranslateService);

  // Local state
  dateFrom = this.getDefaultDateFrom();
  dateTo = new Date().toISOString();

  // Computed
  protected readonly topCategories = computed(() =>
    [...this.reportsStore.wasteSummary()].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
  );

  protected readonly maxCount = computed(() =>
    Math.max(...this.reportsStore.wasteSummary().map((s) => s.quantity), 1),
  );

  protected readonly avgPerCategory = computed(() => {
    const items = this.reportsStore.wasteSummary();
    if (items.length === 0) return 0;
    return items.reduce((sum, i) => sum + i.quantity, 0) / items.length;
  });

  protected readonly dateRangeLabel = computed(() => {
    const from = new Date(this.dateFrom);
    const to = new Date(this.dateTo);
    const formatDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
    return `${formatDate(from)} - ${formatDate(to)}`;
  });

  constructor() {
    addIcons({
      downloadOutline,
      calendarOutline,
      trashOutline,
      cubeOutline,
      trendingUpOutline,
      layersOutline,
    });
  }

  ngOnInit() {
    this.loadData();
  }

  private getDefaultDateFrom(): string {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString();
  }

  loadData() {
    const branchCode = this.authService.user()?.branchCode;
    this.reportsStore.setFilters({
      dateFrom: this.dateFrom.split('T')[0],
      dateTo: this.dateTo.split('T')[0],
      branchCode,
    });
    this.reportsStore.loadWasteSummary();
  }

  async onRefresh(event: RefresherCustomEvent) {
    this.loadData();
    setTimeout(() => event.target.complete(), 500);
  }

  applyDateFilter() {
    this.loadData();
  }

  setQuickDate(period: 'week' | 'month' | 'quarter') {
    const now = new Date();
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 90;
    const from = new Date();
    from.setDate(now.getDate() - days);
    this.dateFrom = from.toISOString();
    this.dateTo = now.toISOString();
  }

  getBarColor(index: number): string {
    const colors = [
      'linear-gradient(90deg, #f59e0b, #d97706)',
      'linear-gradient(90deg, #64748b, #475569)',
      'linear-gradient(90deg, #a16207, #92400e)',
      'linear-gradient(90deg, #8b5cf6, #7c3aed)',
      'linear-gradient(90deg, #3b82f6, #2563eb)',
    ];
    return colors[index] || colors[4];
  }

  getCountClass(count: number): string {
    if (count >= 50) return 'high';
    if (count >= 20) return 'medium';
    return 'low';
  }

  // CSV 내보내기 - 폐가전 집계 데이터 다운로드
  async exportData() {
    // TranslateService 참조 캡처 (async 핸들러 내 this 문제 방지)
    const translateService = this.translate;
    const toastController = this.toastCtrl;

    try {
      const headers = [
        translateService.instant('EXPORT.HEADERS.CODE'),
        translateService.instant('EXPORT.HEADERS.ITEM'),
        translateService.instant('EXPORT.HEADERS.QUANTITY'),
      ];
      const rows = this.reportsStore
        .wasteSummary()
        .map((s) => [s.wasteCode, s.wasteName, String(s.quantity)]);
      const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');

      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `waste_summary_${this.dateFrom.split('T')[0]}_${this.dateTo.split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      const toast = await toastController.create({
        message: translateService.instant('REPORTS.WASTE.CSV_SUCCESS'),
        duration: 2000,
        color: 'success',
      });
      await toast.present();
    } catch {
      const toast = await toastController.create({
        message: translateService.instant('REPORTS.WASTE.CSV_FAILED'),
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    }
  }
}
