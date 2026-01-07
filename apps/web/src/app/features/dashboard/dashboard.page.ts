/**
 * @fileoverview 대시보드 페이지 컴포넌트
 * @description 주문 현황 요약, KPI 지표, 상태별 분석을 제공하는 메인 대시보드입니다.
 * 
 * 주요 기능:
 * - 실시간 주문 통계 표시
 * - 상태별 주문 현황 분석
 * - KPI 성과 지표 (완료율, 취소율)
 * - 반응형 레이아웃 (웹/모바일)
 * - 다국어(i18n) 지원
 */
import { Component, inject, OnInit, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonIcon,
  IonButton,
  RefresherCustomEvent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  statsChartOutline, 
  checkmarkCircleOutline, 
  timeOutline, 
  closeCircleOutline,
  trendingUpOutline,
  trendingDownOutline,
  calendarOutline,
  peopleOutline,
  carOutline,
  cubeOutline,
  arrowForwardOutline,
  refreshOutline
} from 'ionicons/icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { environment } from '@env/environment';
import { firstValueFrom } from 'rxjs';
import { BREAKPOINTS } from '@shared/constants';

/**
 * 대시보드 요약 데이터 인터페이스
 */
interface DashboardSummary {
  summary: {
    total: number;
    completed: number;
    pending: number;
    cancelled: number;
    completionRate: string;
    cancellationRate: string;
  };
  statusBreakdown: Record<string, number>;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonGrid,
    IonRow,
    IonCol,
    IonRefresher,
    IonRefresherContent,
    IonSpinner,
    IonIcon,
    IonButton,
    TranslateModule,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ 'DASHBOARD.TITLE' | translate }}</ion-title>
        <ion-button slot="end" fill="clear" (click)="loadData()">
          <ion-icon name="refresh-outline"></ion-icon>
        </ion-button>
      </ion-toolbar>
    </ion-header>

    <ion-content [class.web-view]="isWebView()">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (isLoading()) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
          <p>{{ 'DASHBOARD.LOADING_DATA' | translate }}</p>
        </div>
      } @else if (data()) {
        <!-- 웹 버전: 1080px 이상 -->
        @if (isWebView()) {
          <div class="web-dashboard">
            <!-- 상단 통계 카드 -->
            <div class="web-stats-grid">
              <div class="web-stat-card">
                <div class="stat-icon primary">
                  <ion-icon name="cube-outline"></ion-icon>
                </div>
                <div class="stat-value">{{ data()!.summary.total }}</div>
                <div class="stat-label">{{ 'DASHBOARD.STATS.TOTAL_ORDERS' | translate }}</div>
              </div>
              <div class="web-stat-card">
                <div class="stat-icon success">
                  <ion-icon name="checkmark-circle-outline"></ion-icon>
                </div>
                <div class="stat-value">{{ data()!.summary.completed }}</div>
                <div class="stat-label">{{ 'DASHBOARD.STATS.COMPLETED' | translate }}</div>
                <div class="stat-trend up">
                  <ion-icon name="trending-up-outline"></ion-icon>
                  {{ data()!.summary.completionRate }}%
                </div>
              </div>
              <div class="web-stat-card">
                <div class="stat-icon warning">
                  <ion-icon name="time-outline"></ion-icon>
                </div>
                <div class="stat-value">{{ data()!.summary.pending }}</div>
                <div class="stat-label">{{ 'DASHBOARD.STATS.PENDING' | translate }}</div>
              </div>
              <div class="web-stat-card">
                <div class="stat-icon danger">
                  <ion-icon name="close-circle-outline"></ion-icon>
                </div>
                <div class="stat-value">{{ data()!.summary.cancelled }}</div>
                <div class="stat-label">{{ 'DASHBOARD.STATS.CANCELLED' | translate }}</div>
                <div class="stat-trend down">
                  <ion-icon name="trending-down-outline"></ion-icon>
                  {{ data()!.summary.cancellationRate }}%
                </div>
              </div>
            </div>

            <!-- 메인 콘텐츠 그리드 -->
            <div class="web-content-grid">
              <!-- 상태별 현황 테이블 -->
              <div class="web-card wide">
                <div class="card-header">
                  <div class="card-title">{{ 'DASHBOARD.STATUS_BREAKDOWN.TITLE' | translate }}</div>
                  <ion-button fill="clear" size="small">
                    {{ 'DASHBOARD.STATUS_BREAKDOWN.VIEW_DETAILS' | translate }} <ion-icon name="arrow-forward-outline"></ion-icon>
                  </ion-button>
                </div>
                <div class="card-body">
                  <div class="status-table">
                    <div class="status-table-header">
                      <div class="col-status">{{ 'DASHBOARD.STATUS_BREAKDOWN.HEADER.STATUS' | translate }}</div>
                      <div class="col-count">{{ 'DASHBOARD.STATUS_BREAKDOWN.HEADER.COUNT' | translate }}</div>
                      <div class="col-percent">{{ 'DASHBOARD.STATUS_BREAKDOWN.HEADER.PERCENT' | translate }}</div>
                      <div class="col-bar">{{ 'DASHBOARD.STATUS_BREAKDOWN.HEADER.DISTRIBUTION' | translate }}</div>
                    </div>
                    @for (status of statusEntries(); track status[0]) {
                      <div class="status-table-row">
                        <div class="col-status">
                          <span [class]="'status-badge status-' + status[0].toLowerCase()">
                            {{ getStatusLabel(status[0]) }}
                          </span>
                        </div>
                        <div class="col-count">{{ status[1] }}{{ 'COMMON.ITEMS_COUNT' | translate:{ count: '' } }}</div>
                        <div class="col-percent">{{ getPercentage(status[1]) }}%</div>
                        <div class="col-bar">
                          <div class="progress-bar">
                            <div 
                              class="progress-fill"
                              [class]="'status-' + status[0].toLowerCase()"
                              [style.width.%]="getPercentage(status[1])">
                            </div>
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              </div>

              <!-- KPI 성과 카드 -->
              <div class="web-card">
                <div class="card-header">
                  <div class="card-title">{{ 'DASHBOARD.KPI.TITLE' | translate }}</div>
                </div>
                <div class="card-body">
                  <div class="kpi-list">
                    <div class="kpi-item">
                      <div class="kpi-header">
                        <span class="kpi-label">{{ 'DASHBOARD.KPI.COMPLETION_RATE' | translate }}</span>
                        <span class="kpi-value success">{{ data()!.summary.completionRate }}%</span>
                      </div>
                      <div class="kpi-progress">
                        <div class="progress-bar large">
                          <div 
                            class="progress-fill success" 
                            [style.width.%]="data()!.summary.completionRate">
                          </div>
                        </div>
                      </div>
                      <div class="kpi-target">{{ 'DASHBOARD.KPI.TARGET' | translate:{ value: 95 } }}</div>
                    </div>
                    <div class="kpi-item">
                      <div class="kpi-header">
                        <span class="kpi-label">{{ 'DASHBOARD.KPI.CANCELLATION_RATE' | translate }}</span>
                        <span class="kpi-value danger">{{ data()!.summary.cancellationRate }}%</span>
                      </div>
                      <div class="kpi-progress">
                        <div class="progress-bar large">
                          <div 
                            class="progress-fill danger" 
                            [style.width.%]="data()!.summary.cancellationRate">
                          </div>
                        </div>
                      </div>
                      <div class="kpi-target">{{ 'DASHBOARD.KPI.TARGET_LESS_THAN' | translate:{ value: 5 } }}</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 오늘의 요약 -->
              <div class="web-card">
                <div class="card-header">
                  <div class="card-title">
                    <ion-icon name="calendar-outline"></ion-icon>
                    {{ 'DASHBOARD.TODAY_SUMMARY.TITLE' | translate }}
                  </div>
                </div>
                <div class="card-body">
                  <div class="today-summary">
                    <div class="summary-item">
                      <ion-icon name="cube-outline" color="primary"></ion-icon>
                      <div class="summary-content">
                        <div class="summary-label">{{ 'DASHBOARD.TODAY_SUMMARY.NEW_ORDERS' | translate }}</div>
                        <div class="summary-value">{{ data()!.summary.total }}{{ 'COMMON.ITEMS_SUFFIX' | translate }}</div>
                      </div>
                    </div>
                    <div class="summary-item">
                      <ion-icon name="people-outline" color="secondary"></ion-icon>
                      <div class="summary-content">
                        <div class="summary-label">{{ 'DASHBOARD.TODAY_SUMMARY.PENDING_ASSIGNMENT' | translate }}</div>
                        <div class="summary-value">{{ data()!.summary.pending }}{{ 'COMMON.ITEMS_SUFFIX' | translate }}</div>
                      </div>
                    </div>
                    <div class="summary-item">
                      <ion-icon name="car-outline" color="tertiary"></ion-icon>
                      <div class="summary-content">
                        <div class="summary-label">{{ 'DASHBOARD.TODAY_SUMMARY.IN_DELIVERY' | translate }}</div>
                        <div class="summary-value">{{ getDispatchedCount() }}{{ 'COMMON.ITEMS_SUFFIX' | translate }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        } @else {
          <!-- 모바일 버전: 1080px 미만 -->
          <div class="mobile-dashboard">
            <!-- Summary Cards -->
            <ion-grid>
              <ion-row>
                <ion-col size="6">
                  <ion-card class="stat-card">
                    <ion-card-content>
                      <div class="stat-icon-mobile primary">
                        <ion-icon name="cube-outline"></ion-icon>
                      </div>
                      <div class="stat-value">{{ data()!.summary.total }}</div>
                      <div class="stat-label">{{ 'COMMON.ALL' | translate }}</div>
                    </ion-card-content>
                  </ion-card>
                </ion-col>
                <ion-col size="6">
                  <ion-card class="stat-card success">
                    <ion-card-content>
                      <div class="stat-icon-mobile success">
                        <ion-icon name="checkmark-circle-outline"></ion-icon>
                      </div>
                      <div class="stat-value">{{ data()!.summary.completed }}</div>
                      <div class="stat-label">{{ 'DASHBOARD.STATS.COMPLETED' | translate }}</div>
                    </ion-card-content>
                  </ion-card>
                </ion-col>
              </ion-row>
              <ion-row>
                <ion-col size="6">
                  <ion-card class="stat-card warning">
                    <ion-card-content>
                      <div class="stat-icon-mobile warning">
                        <ion-icon name="time-outline"></ion-icon>
                      </div>
                      <div class="stat-value">{{ data()!.summary.pending }}</div>
                      <div class="stat-label">{{ 'DASHBOARD.STATS.PENDING' | translate }}</div>
                    </ion-card-content>
                  </ion-card>
                </ion-col>
                <ion-col size="6">
                  <ion-card class="stat-card danger">
                    <ion-card-content>
                      <div class="stat-icon-mobile danger">
                        <ion-icon name="close-circle-outline"></ion-icon>
                      </div>
                      <div class="stat-value">{{ data()!.summary.cancelled }}</div>
                      <div class="stat-label">{{ 'DASHBOARD.STATS.CANCELLED' | translate }}</div>
                    </ion-card-content>
                  </ion-card>
                </ion-col>
              </ion-row>
            </ion-grid>

            <!-- KPI Card -->
            <ion-card>
              <ion-card-header>
                <ion-card-title>{{ 'DASHBOARD.KPI.TITLE' | translate }}</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <div class="kpi-row">
                  <span>{{ 'DASHBOARD.KPI.COMPLETION_RATE' | translate }}</span>
                  <span class="kpi-value success">{{ data()!.summary.completionRate }}%</span>
                </div>
                <div class="kpi-row">
                  <span>{{ 'DASHBOARD.KPI.CANCELLATION_RATE' | translate }}</span>
                  <span class="kpi-value danger">{{ data()!.summary.cancellationRate }}%</span>
                </div>
              </ion-card-content>
            </ion-card>

            <!-- Status Breakdown -->
            <ion-card>
              <ion-card-header>
                <ion-card-title>{{ 'DASHBOARD.STATUS_BREAKDOWN.TITLE' | translate }}</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                @for (status of statusEntries(); track status[0]) {
                  <div class="status-row">
                    <span [class]="'status-label status-' + status[0].toLowerCase()">
                      {{ getStatusLabel(status[0]) }}
                    </span>
                    <span class="status-count">{{ status[1] }}{{ 'COMMON.ITEMS_SUFFIX' | translate }}</span>
                  </div>
                }
              </ion-card-content>
            </ion-card>
          </div>
        }
      }
    </ion-content>
  `,
  styles: [`
    /* ============================================
       공통 스타일
       ============================================ */
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

    /* ============================================
       모바일 버전 (1080px 미만)
       ============================================ */
    .mobile-dashboard {
      padding: 8px;
    }

    .stat-card {
      text-align: center;
      margin: 4px;

      &.success { --background: rgba(16, 185, 129, 0.1); }
      &.warning { --background: rgba(245, 158, 11, 0.1); }
      &.danger { --background: rgba(239, 68, 68, 0.1); }

      ion-card-content {
        padding: 16px 8px;
      }

      .stat-icon-mobile {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 8px;

        ion-icon {
          font-size: 20px;
          color: #ffffff;
        }

        &.primary { background: linear-gradient(135deg, #3b82f6, #2563eb); }
        &.success { background: linear-gradient(135deg, #10b981, #059669); }
        &.warning { background: linear-gradient(135deg, #f59e0b, #d97706); }
        &.danger { background: linear-gradient(135deg, #ef4444, #dc2626); }
      }

      .stat-value {
        font-size: 28px;
        font-weight: 700;
        color: var(--ion-color-dark);
      }

      .stat-label {
        font-size: 12px;
        color: var(--ion-color-medium);
        text-transform: uppercase;
        font-weight: 500;
      }
    }

    .kpi-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 0;
      border-bottom: 1px solid var(--ion-color-light);

      &:last-child {
        border-bottom: none;
      }

      .kpi-value {
        font-weight: 600;
        font-size: 18px;

        &.success { color: var(--ion-color-success); }
        &.danger { color: var(--ion-color-danger); }
      }
    }

    .status-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;

      .status-label {
        font-size: 13px;
        padding: 4px 10px;
        border-radius: 6px;
        background: var(--ion-color-light);
        font-weight: 500;
      }

      .status-count {
        font-weight: 600;
        color: #374151;
      }
    }

    /* ============================================
       웹 버전 (1080px 이상)
       ============================================ */
    .web-view {
      --background: #f8fafc;
    }

    .web-dashboard {
      padding: 24px;
      max-width: 1600px;
      margin: 0 auto;

      @media (min-width: 1920px) {
        padding: 32px 48px;
        max-width: 1800px;
      }
    }

    .web-stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-bottom: 24px;

      @media (min-width: 1600px) {
        gap: 24px;
      }
    }

    .web-stat-card {
      background: #ffffff;
      border-radius: 16px;
      padding: 24px;
      border: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: transform 0.2s, box-shadow 0.2s;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
      }

      .stat-icon {
        width: 52px;
        height: 52px;
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;

        ion-icon {
          font-size: 26px;
          color: #ffffff;
        }

        &.primary { background: linear-gradient(135deg, #3b82f6, #2563eb); }
        &.success { background: linear-gradient(135deg, #10b981, #059669); }
        &.warning { background: linear-gradient(135deg, #f59e0b, #d97706); }
        &.danger { background: linear-gradient(135deg, #ef4444, #dc2626); }
      }

      .stat-value {
        font-size: 36px;
        font-weight: 700;
        color: #0f172a;
        line-height: 1;
      }

      .stat-label {
        font-size: 14px;
        color: #64748b;
        font-weight: 500;
      }

      .stat-trend {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 13px;
        font-weight: 600;

        ion-icon {
          font-size: 16px;
        }

        &.up {
          color: #10b981;
        }

        &.down {
          color: #ef4444;
        }
      }
    }

    .web-content-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 20px;

      @media (min-width: 1600px) {
        gap: 24px;
      }
    }

    .web-card {
      background: #ffffff;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      overflow: hidden;

      &.wide {
        grid-column: span 1;
      }

      .card-header {
        padding: 20px 24px;
        border-bottom: 1px solid #f1f5f9;
        display: flex;
        align-items: center;
        justify-content: space-between;

        .card-title {
          font-size: 16px;
          font-weight: 600;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 8px;

          ion-icon {
            font-size: 20px;
            color: #64748b;
          }
        }
      }

      .card-body {
        padding: 24px;
      }
    }

    /* 상태 테이블 */
    .status-table {
      .status-table-header {
        display: grid;
        grid-template-columns: 140px 80px 80px 1fr;
        gap: 16px;
        padding: 12px 0;
        border-bottom: 2px solid #f1f5f9;
        font-size: 12px;
        font-weight: 600;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .status-table-row {
        display: grid;
        grid-template-columns: 140px 80px 80px 1fr;
        gap: 16px;
        padding: 14px 0;
        border-bottom: 1px solid #f1f5f9;
        align-items: center;

        &:last-child {
          border-bottom: none;
        }

        .col-count {
          font-weight: 600;
          color: #374151;
        }

        .col-percent {
          font-weight: 500;
          color: #64748b;
        }
      }
    }

    .progress-bar {
      height: 8px;
      background: #f1f5f9;
      border-radius: 4px;
      overflow: hidden;

      &.large {
        height: 12px;
        border-radius: 6px;
      }

      .progress-fill {
        height: 100%;
        border-radius: 4px;
        transition: width 0.5s ease;

        &.success { background: linear-gradient(90deg, #10b981, #059669); }
        &.danger { background: linear-gradient(90deg, #ef4444, #dc2626); }
        
        &.status-unassigned { background: #9e9e9e; }
        &.status-assigned { background: #2196f3; }
        &.status-confirmed { background: #03a9f4; }
        &.status-released { background: #00bcd4; }
        &.status-dispatched { background: #009688; }
        &.status-completed { background: #4caf50; }
        &.status-postponed { background: #ff9800; }
        &.status-absent { background: #ff5722; }
        &.status-request_cancel { background: #f44336; }
        &.status-cancelled { background: #795548; }
        &.status-collected { background: #8bc34a; }
        &.status-reverted { background: #607d8b; }
      }
    }

    /* KPI 리스트 */
    .kpi-list {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .kpi-item {
      .kpi-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;

        .kpi-label {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
        }

        .kpi-value {
          font-size: 24px;
          font-weight: 700;

          &.success { color: #10b981; }
          &.danger { color: #ef4444; }
        }
      }

      .kpi-progress {
        margin-bottom: 8px;
      }

      .kpi-target {
        font-size: 12px;
        color: #94a3b8;
        text-align: right;
      }
    }

    /* 오늘의 요약 */
    .today-summary {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .summary-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: #f8fafc;
      border-radius: 12px;

      ion-icon {
        font-size: 28px;
      }

      .summary-content {
        .summary-label {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 2px;
        }

        .summary-value {
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
        }
      }
    }

    /* 상태 배지 스타일 */
    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;

      &.status-unassigned { background: rgba(158, 158, 158, 0.15); color: #757575; }
      &.status-assigned { background: rgba(33, 150, 243, 0.15); color: #1976d2; }
      &.status-confirmed { background: rgba(3, 169, 244, 0.15); color: #0288d1; }
      &.status-released { background: rgba(0, 188, 212, 0.15); color: #0097a7; }
      &.status-dispatched { background: rgba(0, 150, 136, 0.15); color: #00796b; }
      &.status-completed { background: rgba(76, 175, 80, 0.15); color: #388e3c; }
      &.status-postponed { background: rgba(255, 152, 0, 0.15); color: #f57c00; }
      &.status-absent { background: rgba(255, 87, 34, 0.15); color: #e64a19; }
      &.status-request_cancel { background: rgba(244, 67, 54, 0.15); color: #d32f2f; }
      &.status-cancelled { background: rgba(121, 85, 72, 0.15); color: #5d4037; }
      &.status-collected { background: rgba(139, 195, 74, 0.15); color: #689f38; }
      &.status-reverted { background: rgba(96, 125, 139, 0.15); color: #455a64; }
    }
  `],
})
export class DashboardPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly translateService = inject(TranslateService);

  protected readonly data = signal<DashboardSummary | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly statusEntries = signal<[string, number][]>([]);
  protected readonly isWebView = signal(window.innerWidth >= BREAKPOINTS.WEB_VIEW);

  /**
   * 상태 코드와 i18n 키 매핑
   * @description 주문 상태 코드를 번역 키로 변환하기 위한 매핑 테이블
   */
  private readonly STATUS_I18N_KEYS: Record<string, string> = {
    'UNASSIGNED': 'ORDERS.STATUS.UNASSIGNED',
    'ASSIGNED': 'ORDERS.STATUS.ASSIGNED',
    'CONFIRMED': 'ORDERS.STATUS.CONFIRMED',
    'RELEASED': 'ORDERS.STATUS.RELEASED',
    'DISPATCHED': 'ORDERS.STATUS.DISPATCHED',
    'COMPLETED': 'ORDERS.STATUS.COMPLETED',
    'POSTPONED': 'ORDERS.STATUS.POSTPONED',
    'ABSENT': 'ORDERS.STATUS.ABSENT',
    'REQUEST_CANCEL': 'ORDERS.STATUS.REQUEST_CANCEL',
    'CANCELLED': 'ORDERS.STATUS.CANCELLED',
    'COLLECTED': 'ORDERS.STATUS.COLLECTED',
    'REVERTED': 'ORDERS.STATUS.REVERTED',
  };

  constructor() {
    addIcons({ 
      statsChartOutline, 
      checkmarkCircleOutline, 
      timeOutline, 
      closeCircleOutline,
      trendingUpOutline,
      trendingDownOutline,
      calendarOutline,
      peopleOutline,
      carOutline,
      cubeOutline,
      arrowForwardOutline,
      refreshOutline
    });
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    this.isWebView.set(window.innerWidth >= BREAKPOINTS.WEB_VIEW);
  }

  ngOnInit(): void {
    this.loadData();
  }

  protected async onRefresh(event: RefresherCustomEvent): Promise<void> {
    await this.loadData();
    event.target.complete();
  }

  /**
   * 대시보드 데이터 로드
   * @description API에서 오늘의 주문 요약 데이터를 가져옵니다.
   */
  protected async loadData(): Promise<void> {
    this.isLoading.set(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      const result = await firstValueFrom(
        this.http.get<DashboardSummary>(
          `${environment.apiUrl}/reports/summary`,
          { params: { level: 'branch', dateFrom: today, dateTo: today } }
        )
      );

      this.data.set(result);
      this.statusEntries.set(Object.entries(result.statusBreakdown));
    } catch (error) {
      console.error('[DashboardPage] 대시보드 데이터 로드 실패:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * 상태 코드를 번역된 라벨로 변환
   * @param status - 상태 코드
   * @returns 번역된 상태 라벨
   */
  protected getStatusLabel(status: string): string {
    const key = this.STATUS_I18N_KEYS[status];
    return key ? this.translateService.instant(key) : status;
  }

  /**
   * 전체 대비 비율 계산
   * @param count - 개별 건수
   * @returns 백분율 (정수)
   */
  protected getPercentage(count: number): number {
    const total = this.data()?.summary.total || 1;
    return Math.round((count / total) * 100);
  }

  /**
   * 배송중 주문 건수 조회
   * @returns 배송중 상태 주문 수
   */
  protected getDispatchedCount(): number {
    const entries = this.statusEntries();
    const dispatched = entries.find(e => e[0] === 'DISPATCHED');
    return dispatched ? dispatched[1] : 0;
  }
}
