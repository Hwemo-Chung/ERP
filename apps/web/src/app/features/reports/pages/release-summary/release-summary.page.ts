// apps/web/src/app/features/reports/pages/release-summary/release-summary.page.ts
// Release summary report - Aggregate release request data by FDC
import { Component, ChangeDetectionStrategy, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonBackButton,
  IonButtons,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonDatetime,
  IonButton,
  IonSpinner,
  IonIcon,
  IonSearchbar,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonModal,
  IonDatetimeButton,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { printOutline, downloadOutline, calendarOutline, filterOutline, chevronBackOutline, searchOutline } from 'ionicons/icons';

interface ReleaseSummaryItem {
  fdcCode: string;
  fdcName: string;
  modelCode: string;
  modelName: string;
  quantity: number;
}

interface FdcOption {
  code: string;
  name: string;
}

@Component({
  selector: 'app-release-summary',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonBackButton,
    IonButtons,
    IonLabel,
    IonSelect,
    IonSelectOption,
    IonDatetime,
    IonButton,
    IonSpinner,
    IonIcon,
    IonSearchbar,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonGrid,
    IonRow,
    IonCol,
    IonModal,
    IonDatetimeButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/reports" text=""></ion-back-button>
        </ion-buttons>
        <!-- 출고요청집계표 타이틀 -->
        <ion-title>{{ 'REPORTS.RELEASE_SUMMARY.TITLE' | translate }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="printReport()" [disabled]="isLoading()">
            <ion-icon slot="icon-only" name="print-outline"></ion-icon>
          </ion-button>
          <ion-button (click)="exportPdf()" [disabled]="isLoading()">
            <ion-icon slot="icon-only" name="download-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="release-summary-container">
        <!-- Filter Section - 필터 섹션 -->
        <div class="filter-section">
          <ion-card class="filter-card">
            <ion-card-content>
              <ion-grid>
                <ion-row>
                  <ion-col size="12" size-md="4">
                    <div class="filter-group">
                      <ion-label class="filter-label">
                        <ion-icon name="calendar-outline"></ion-icon>
                        {{ 'REPORTS.RELEASE_SUMMARY.START_DATE' | translate }}
                      </ion-label>
                      <ion-datetime-button datetime="startDate"></ion-datetime-button>
                      <ion-modal [keepContentsMounted]="true">
                        <ng-template>
                          <ion-datetime
                            id="startDate"
                            presentation="date"
                            [value]="startDate()"
                            (ionChange)="onStartDateChange($event)"
                            [max]="today"
                          ></ion-datetime>
                        </ng-template>
                      </ion-modal>
                    </div>
                  </ion-col>
                  <ion-col size="12" size-md="4">
                    <div class="filter-group">
                      <ion-label class="filter-label">
                        <ion-icon name="calendar-outline"></ion-icon>
                        {{ 'REPORTS.RELEASE_SUMMARY.END_DATE' | translate }}
                      </ion-label>
                      <ion-datetime-button datetime="endDate"></ion-datetime-button>
                      <ion-modal [keepContentsMounted]="true">
                        <ng-template>
                          <ion-datetime
                            id="endDate"
                            presentation="date"
                            [value]="endDate()"
                            (ionChange)="onEndDateChange($event)"
                            [max]="today"
                          ></ion-datetime>
                        </ng-template>
                      </ion-modal>
                    </div>
                  </ion-col>
                  <ion-col size="12" size-md="4">
                    <div class="filter-group">
                      <ion-label class="filter-label">
                        <ion-icon name="filter-outline"></ion-icon>
                        {{ 'REPORTS.RELEASE_SUMMARY.FDC_SELECT' | translate }}
                      </ion-label>
                      <ion-select
                        [value]="selectedFdc()"
                        (ionChange)="onFdcChange($event)"
                        [placeholder]="'REPORTS.RELEASE_SUMMARY.ALL' | translate"
                        interface="popover"
                        class="fdc-select"
                      >
                        <ion-select-option value="">{{ 'REPORTS.RELEASE_SUMMARY.ALL' | translate }}</ion-select-option>
                        @for (fdc of fdcOptions(); track fdc.code) {
                          <ion-select-option [value]="fdc.code">{{ fdc.name }}</ion-select-option>
                        }
                      </ion-select>
                    </div>
                  </ion-col>
                </ion-row>
                <ion-row>
                  <ion-col size="12">
                    <ion-searchbar
                      [value]="searchQuery()"
                      (ionInput)="onSearchChange($event)"
                      [placeholder]="'REPORTS.RELEASE_SUMMARY.SEARCH_PLACEHOLDER' | translate"
                      debounce="300"
                      class="search-bar"
                    ></ion-searchbar>
                  </ion-col>
                </ion-row>
              </ion-grid>
            </ion-card-content>
          </ion-card>
        </div>

        <!-- Summary Statistics Cards - 요약 통계 카드 -->
        <div class="stats-section">
          <ion-grid>
            <ion-row>
              <ion-col size="12" size-md="4">
                <div class="stat-card stat-card-primary">
                  <div class="stat-icon">📦</div>
                  <div class="stat-content">
                    <div class="stat-value">{{ totalOrders() }}</div>
                    <div class="stat-label">{{ 'REPORTS.RELEASE_SUMMARY.TOTAL_ORDERS' | translate }}</div>
                  </div>
                </div>
              </ion-col>
              <ion-col size="12" size-md="4">
                <div class="stat-card stat-card-success">
                  <div class="stat-icon">📊</div>
                  <div class="stat-content">
                    <div class="stat-value">{{ totalQuantity() | number }}</div>
                    <div class="stat-label">{{ 'REPORTS.RELEASE_SUMMARY.TOTAL_QUANTITY' | translate }}</div>
                  </div>
                </div>
              </ion-col>
              <ion-col size="12" size-md="4">
                <div class="stat-card stat-card-warning">
                  <div class="stat-icon">🏢</div>
                  <div class="stat-content">
                    <div class="stat-value">{{ fdcCount() }}</div>
                    <div class="stat-label">{{ 'REPORTS.RELEASE_SUMMARY.TOTAL_MODELS' | translate }}</div>
                  </div>
                </div>
              </ion-col>
            </ion-row>
          </ion-grid>
        </div>

        <!-- Data Table Section - 데이터 테이블 -->
        <div class="table-section">
          <ion-card class="table-card">
            <ion-card-header>
              <ion-card-title class="table-title">
                {{ 'REPORTS.RELEASE_SUMMARY.TITLE' | translate }}
                <span class="record-count">({{ filteredData().length }}건)</span>
              </ion-card-title>
            </ion-card-header>
            <ion-card-content>
              @if (isLoading()) {
                <div class="loading-container">
                  <ion-spinner name="crescent"></ion-spinner>
                  <p>{{ 'REPORTS.PROGRESS.LOADING' | translate }}</p>
                </div>
              } @else if (filteredData().length === 0) {
                <div class="empty-state">
                  <div class="empty-icon">📋</div>
                  <p>{{ 'REPORTS.PROGRESS.NO_DATA' | translate }}</p>
                </div>
              } @else {
                <div class="table-wrapper">
                  <table class="data-table" id="release-summary-table">
                    <thead>
                      <tr>
                        <th class="th-fdc">{{ 'REPORTS.RELEASE_SUMMARY.FDC_NAME' | translate }}</th>
                        <th class="th-model-code">{{ 'REPORTS.RELEASE_SUMMARY.MODEL_CODE' | translate }}</th>
                        <th class="th-model-name">{{ 'REPORTS.RELEASE_SUMMARY.MODEL_NAME' | translate }}</th>
                        <th class="th-quantity">{{ 'REPORTS.RELEASE_SUMMARY.QUANTITY' | translate }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (item of filteredData(); track item.fdcCode + item.modelCode) {
                        <tr>
                          <td class="td-fdc">{{ item.fdcName }}</td>
                          <td class="td-model-code">{{ item.modelCode }}</td>
                          <td class="td-model-name">{{ item.modelName }}</td>
                          <td class="td-quantity">{{ item.quantity | number }}</td>
                        </tr>
                      }
                    </tbody>
                    <tfoot>
                      <tr class="total-row">
                        <td colspan="3" class="total-label">{{ 'REPORTS.RELEASE_SUMMARY.TOTAL' | translate }}</td>
                        <td class="total-value">{{ totalQuantity() | number }}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              }
            </ion-card-content>
          </ion-card>
        </div>

        <!-- Print Content (Hidden) -->
        <div class="print-content" id="print-area">
          <div class="print-header">
            <h1>{{ 'REPORTS.RELEASE_SUMMARY.TITLE' | translate }}</h1>
            <p class="print-date">{{ 'REPORTS.RELEASE_SUMMARY.PERIOD' | translate }}: {{ startDate() }} ~ {{ endDate() }}</p>
            <p class="print-info">{{ 'REPORTS.RELEASE_SUMMARY.PRINT_DATE' | translate }}: {{ printDateTime }}</p>
          </div>
          <div class="print-summary">
            <span>{{ 'REPORTS.RELEASE_SUMMARY.TOTAL_ORDERS' | translate }}: {{ totalOrders() }}{{ 'COMMON.COUNT_SUFFIX' | translate }}</span>
            <span>{{ 'REPORTS.RELEASE_SUMMARY.TOTAL_QUANTITY' | translate }}: {{ totalQuantity() | number }}{{ 'REPORTS.RELEASE_SUMMARY.UNIT' | translate }}</span>
            <span>{{ 'REPORTS.RELEASE_SUMMARY.FDC_COUNT' | translate }}: {{ fdcCount() }}{{ 'REPORTS.RELEASE_SUMMARY.UNIT' | translate }}</span>
          </div>
          <table class="print-table">
            <thead>
              <tr>
                <th>{{ 'REPORTS.RELEASE_SUMMARY.FDC_NAME' | translate }}</th>
                <th>{{ 'REPORTS.RELEASE_SUMMARY.MODEL_CODE' | translate }}</th>
                <th>{{ 'REPORTS.RELEASE_SUMMARY.MODEL_NAME' | translate }}</th>
                <th>{{ 'REPORTS.RELEASE_SUMMARY.QUANTITY' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (item of filteredData(); track item.fdcCode + item.modelCode) {
                <tr>
                  <td>{{ item.fdcName }}</td>
                  <td>{{ item.modelCode }}</td>
                  <td>{{ item.modelName }}</td>
                  <td>{{ item.quantity | number }}</td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3"><strong>{{ 'REPORTS.RELEASE_SUMMARY.TOTAL' | translate }}</strong></td>
                <td><strong>{{ totalQuantity() | number }}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    :host {
      --primary-color: #3b82f6;
      --success-color: #10b981;
      --warning-color: #f59e0b;
      --border-radius: 12px;
      --card-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }

    .release-summary-container {
      max-width: 1400px;
      margin: 0 auto;
    }

    /* Filter Section */
    .filter-section {
      margin-bottom: 1rem;
    }

    .filter-card {
      border-radius: var(--border-radius);
      box-shadow: var(--card-shadow);
      margin: 0;
    }

    .filter-card ion-card-content {
      padding: 1rem;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .filter-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      font-weight: 600;
      color: #374151;
    }

    .filter-label ion-icon {
      color: var(--primary-color);
    }

    .fdc-select {
      --background: #f9fafb;
      --border-radius: 8px;
      --padding-start: 12px;
      --padding-end: 12px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
    }

    .search-bar {
      --background: #f9fafb;
      --border-radius: 8px;
      --box-shadow: none;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 0;
    }

    /* Statistics Cards */
    .stats-section {
      margin-bottom: 1rem;
    }

    .stat-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.25rem;
      border-radius: var(--border-radius);
      background: white;
      box-shadow: var(--card-shadow);
      transition: transform 0.2s ease;
    }

    .stat-card:hover {
      transform: translateY(-2px);
    }

    .stat-card-primary {
      border-left: 4px solid var(--primary-color);
    }

    .stat-card-success {
      border-left: 4px solid var(--success-color);
    }

    .stat-card-warning {
      border-left: 4px solid var(--warning-color);
    }

    .stat-icon {
      font-size: 2rem;
    }

    .stat-content {
      flex: 1;
    }

    .stat-value {
      font-size: 1.75rem;
      font-weight: 700;
      color: #1f2937;
      line-height: 1.2;
    }

    .stat-label {
      font-size: 0.875rem;
      color: #6b7280;
      margin-top: 0.25rem;
    }

    /* Table Section */
    .table-section {
      margin-bottom: 2rem;
    }

    .table-card {
      border-radius: var(--border-radius);
      box-shadow: var(--card-shadow);
      margin: 0;
      overflow: hidden;
    }

    .table-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #1f2937;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .record-count {
      font-size: 0.875rem;
      font-weight: 400;
      color: #6b7280;
    }

    .table-wrapper {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }

    .data-table thead {
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .data-table th {
      background: #f8fafc;
      padding: 0.875rem 1rem;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #e5e7eb;
      white-space: nowrap;
    }

    .data-table th.th-quantity {
      text-align: right;
    }

    .data-table td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #f3f4f6;
      color: #4b5563;
    }

    .data-table td.td-quantity {
      text-align: right;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
    }

    .data-table td.td-model-code {
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
      font-size: 0.8125rem;
      color: var(--primary-color);
    }

    .data-table tbody tr:hover {
      background: #f9fafb;
    }

    .data-table tfoot .total-row {
      background: #f0f9ff;
    }

    .data-table .total-label {
      text-align: right;
      font-weight: 600;
      color: #1f2937;
      padding-right: 1rem;
    }

    .data-table .total-value {
      text-align: right;
      font-weight: 700;
      color: var(--primary-color);
      font-size: 1rem;
      font-variant-numeric: tabular-nums;
    }

    /* Loading & Empty States */
    .loading-container,
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem;
      color: #6b7280;
    }

    .loading-container ion-spinner {
      width: 48px;
      height: 48px;
      color: var(--primary-color);
    }

    .loading-container p,
    .empty-state p {
      margin-top: 1rem;
      font-size: 0.875rem;
    }

    .empty-icon {
      font-size: 3rem;
      margin-bottom: 0.5rem;
    }

    /* Print Content (Hidden on screen) */
    .print-content {
      display: none;
    }

    /* Responsive Styles */
    @media (max-width: 768px) {
      .filter-group {
        margin-bottom: 0.75rem;
      }

      .stat-card {
        padding: 1rem;
      }

      .stat-value {
        font-size: 1.5rem;
      }

      .data-table th,
      .data-table td {
        padding: 0.625rem 0.75rem;
      }

      .th-model-name,
      .td-model-name {
        min-width: 150px;
      }
    }

    /* Print Styles */
    @media print {
      :host {
        display: block !important;
      }

      ion-header,
      .filter-section,
      .stats-section,
      .table-section {
        display: none !important;
      }

      .print-content {
        display: block !important;
        padding: 20px;
        font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif;
      }

      .print-header {
        text-align: center;
        margin-bottom: 24px;
        border-bottom: 2px solid #000;
        padding-bottom: 16px;
      }

      .print-header h1 {
        font-size: 24px;
        margin: 0 0 8px 0;
        font-weight: 700;
      }

      .print-date,
      .print-info {
        font-size: 12px;
        color: #666;
        margin: 4px 0;
      }

      .print-summary {
        display: flex;
        justify-content: space-around;
        margin-bottom: 20px;
        padding: 12px;
        background: #f5f5f5;
        border-radius: 4px;
      }

      .print-summary span {
        font-size: 14px;
        font-weight: 600;
      }

      .print-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
      }

      .print-table th,
      .print-table td {
        border: 1px solid #ddd;
        padding: 8px 12px;
        text-align: left;
      }

      .print-table th {
        background: #f0f0f0;
        font-weight: 600;
      }

      .print-table th:last-child,
      .print-table td:last-child {
        text-align: right;
      }

      .print-table tfoot td {
        background: #f9f9f9;
        font-weight: 600;
      }

      @page {
        size: A4;
        margin: 15mm;
      }
    }
  `]
})
export class ReleaseSummaryPage implements OnInit {
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  // Date range
  today = new Date().toISOString().split('T')[0];
  startDate = signal(this.getDefaultStartDate());
  endDate = signal(this.today);

  // Filters
  selectedFdc = signal('');
  searchQuery = signal('');

  // Loading state
  isLoading = signal(false);

  // Print date time
  printDateTime = new Date().toLocaleString('ko-KR');

  // FDC Options (Mock)
  fdcOptions = signal<FdcOption[]>([
    { code: 'FDC001', name: '서울 물류센터' },
    { code: 'FDC002', name: '부산 물류센터' },
    { code: 'FDC003', name: '대구 물류센터' },
    { code: 'FDC004', name: '인천 물류센터' },
    { code: 'FDC005', name: '광주 물류센터' },
  ]);

  // Raw Data (Mock)
  rawData = signal<ReleaseSummaryItem[]>([
    { fdcCode: 'FDC001', fdcName: '서울 물류센터', modelCode: 'SM-G998N', modelName: '갤럭시 S21 울트라', quantity: 150 },
    { fdcCode: 'FDC001', fdcName: '서울 물류센터', modelCode: 'SM-F926N', modelName: '갤럭시 Z폴드3', quantity: 85 },
    { fdcCode: 'FDC001', fdcName: '서울 물류센터', modelCode: 'SM-A526N', modelName: '갤럭시 A52s 5G', quantity: 220 },
    { fdcCode: 'FDC001', fdcName: '서울 물류센터', modelCode: 'SM-G991N', modelName: '갤럭시 S21', quantity: 180 },
    { fdcCode: 'FDC002', fdcName: '부산 물류센터', modelCode: 'SM-G998N', modelName: '갤럭시 S21 울트라', quantity: 95 },
    { fdcCode: 'FDC002', fdcName: '부산 물류센터', modelCode: 'SM-F711N', modelName: '갤럭시 Z플립3', quantity: 120 },
    { fdcCode: 'FDC002', fdcName: '부산 물류센터', modelCode: 'SM-A326N', modelName: '갤럭시 A32 5G', quantity: 175 },
    { fdcCode: 'FDC003', fdcName: '대구 물류센터', modelCode: 'SM-G998N', modelName: '갤럭시 S21 울트라', quantity: 65 },
    { fdcCode: 'FDC003', fdcName: '대구 물류센터', modelCode: 'SM-F926N', modelName: '갤럭시 Z폴드3', quantity: 45 },
    { fdcCode: 'FDC003', fdcName: '대구 물류센터', modelCode: 'SM-A526N', modelName: '갤럭시 A52s 5G', quantity: 130 },
    { fdcCode: 'FDC004', fdcName: '인천 물류센터', modelCode: 'SM-G991N', modelName: '갤럭시 S21', quantity: 110 },
    { fdcCode: 'FDC004', fdcName: '인천 물류센터', modelCode: 'SM-F711N', modelName: '갤럭시 Z플립3', quantity: 88 },
    { fdcCode: 'FDC004', fdcName: '인천 물류센터', modelCode: 'SM-A725N', modelName: '갤럭시 A72', quantity: 145 },
    { fdcCode: 'FDC005', fdcName: '광주 물류센터', modelCode: 'SM-G998N', modelName: '갤럭시 S21 울트라', quantity: 55 },
    { fdcCode: 'FDC005', fdcName: '광주 물류센터', modelCode: 'SM-A526N', modelName: '갤럭시 A52s 5G', quantity: 98 },
    { fdcCode: 'FDC005', fdcName: '광주 물류센터', modelCode: 'SM-M325F', modelName: '갤럭시 M32', quantity: 72 },
  ]);

  // Filtered Data (computed)
  filteredData = computed(() => {
    let data = this.rawData();

    // Filter by FDC
    const fdc = this.selectedFdc();
    if (fdc) {
      data = data.filter(item => item.fdcCode === fdc);
    }

    // Filter by search query
    const query = this.searchQuery().toLowerCase().trim();
    if (query) {
      data = data.filter(item =>
        item.modelCode.toLowerCase().includes(query) ||
        item.modelName.toLowerCase().includes(query)
      );
    }

    // Sort by FDC name, then model code
    return data.sort((a, b) => {
      if (a.fdcName !== b.fdcName) {
        return a.fdcName.localeCompare(b.fdcName, 'ko');
      }
      return a.modelCode.localeCompare(b.modelCode);
    });
  });

  // Statistics (computed)
  totalOrders = computed(() => this.filteredData().length);

  totalQuantity = computed(() =>
    this.filteredData().reduce((sum, item) => sum + item.quantity, 0)
  );

  fdcCount = computed(() => {
    const uniqueFdcs = new Set(this.filteredData().map(item => item.fdcCode));
    return uniqueFdcs.size;
  });

  constructor() {
    addIcons({
      printOutline,
      downloadOutline,
      calendarOutline,
      filterOutline,
      chevronBackOutline,
      searchOutline,
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  private getDefaultStartDate(): string {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  }

  private loadData(): void {
    this.isLoading.set(true);

    // Simulate API call
    setTimeout(() => {
      this.isLoading.set(false);
    }, 500);
  }

  onStartDateChange(event: CustomEvent): void {
    const value = event.detail.value;
    if (value) {
      this.startDate.set(value.split('T')[0]);
      this.loadData();
    }
  }

  onEndDateChange(event: CustomEvent): void {
    const value = event.detail.value;
    if (value) {
      this.endDate.set(value.split('T')[0]);
      this.loadData();
    }
  }

  onFdcChange(event: CustomEvent): void {
    this.selectedFdc.set(event.detail.value || '');
  }

  onSearchChange(event: CustomEvent): void {
    this.searchQuery.set(event.detail.value || '');
  }

  printReport(): void {
    this.printDateTime = new Date().toLocaleString('ko-KR');
    setTimeout(() => {
      window.print();
    }, 100);
  }

  exportPdf(): void {
    // In a real application, this would generate a PDF using jsPDF or similar library
    // For now, we'll use the print function as a PDF export alternative
    this.printDateTime = new Date().toLocaleString('ko-KR');

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const printContent = document.getElementById('print-area');
      if (printContent) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>${this.translate.instant('REPORTS.RELEASE_SUMMARY.TITLE')}</title>
            <meta charset="UTF-8">
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              body {
                font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif;
                padding: 20px;
                color: #333;
              }
              .print-header {
                text-align: center;
                margin-bottom: 24px;
                border-bottom: 2px solid #000;
                padding-bottom: 16px;
              }
              .print-header h1 {
                font-size: 24px;
                margin: 0 0 8px 0;
                font-weight: 700;
              }
              .print-date, .print-info {
                font-size: 12px;
                color: #666;
                margin: 4px 0;
              }
              .print-summary {
                display: flex;
                justify-content: space-around;
                margin-bottom: 20px;
                padding: 12px;
                background: #f5f5f5;
                border-radius: 4px;
              }
              .print-summary span {
                font-size: 14px;
                font-weight: 600;
              }
              .print-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 11px;
              }
              .print-table th, .print-table td {
                border: 1px solid #ddd;
                padding: 8px 12px;
                text-align: left;
              }
              .print-table th {
                background: #f0f0f0;
                font-weight: 600;
              }
              .print-table th:last-child,
              .print-table td:last-child {
                text-align: right;
              }
              .print-table tfoot td {
                background: #f9f9f9;
                font-weight: 600;
              }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
          </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      }
    }
  }
}
