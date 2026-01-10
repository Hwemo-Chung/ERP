import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonGrid,
  IonRow,
  IonCol,
  IonRefresher,
  IonRefresherContent,
  IonIcon,
  IonSkeletonText,
  RefresherCustomEvent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cubeOutline,
  checkmarkCircleOutline,
  timeOutline,
  closeCircleOutline,
  trendingUpOutline,
  trendingDownOutline,
  statsChartOutline,
  pulseOutline,
} from 'ionicons/icons';
import { environment } from '@env/environment';
import { firstValueFrom } from 'rxjs';

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
    IonGrid,
    IonRow,
    IonCol,
    IonRefresher,
    IonRefresherContent,
    IonIcon,
    IonSkeletonText,
    TranslateModule,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>{{ 'DASHBOARD.TITLE' | translate }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="dashboard-container">
        @if (isLoading()) {
          <!-- Enhanced Loading Skeleton -->
          <div class="loading-skeleton">
            <div class="skeleton-header">
              <ion-skeleton-text
                [animated]="true"
                style="width: 60%; height: 28px;"
              ></ion-skeleton-text>
              <ion-skeleton-text
                [animated]="true"
                style="width: 40%; height: 16px; margin-top: 8px;"
              ></ion-skeleton-text>
            </div>
            <ion-grid class="stats-grid">
              <ion-row>
                @for (i of [1, 2]; track i) {
                  <ion-col size="6">
                    <div class="skeleton-card">
                      <ion-skeleton-text
                        [animated]="true"
                        style="width: 40px; height: 40px; border-radius: 12px;"
                      ></ion-skeleton-text>
                      <ion-skeleton-text
                        [animated]="true"
                        style="width: 60%; height: 32px; margin-top: 16px;"
                      ></ion-skeleton-text>
                      <ion-skeleton-text
                        [animated]="true"
                        style="width: 80%; height: 14px; margin-top: 8px;"
                      ></ion-skeleton-text>
                    </div>
                  </ion-col>
                }
              </ion-row>
              <ion-row>
                @for (i of [3, 4]; track i) {
                  <ion-col size="6">
                    <div class="skeleton-card">
                      <ion-skeleton-text
                        [animated]="true"
                        style="width: 40px; height: 40px; border-radius: 12px;"
                      ></ion-skeleton-text>
                      <ion-skeleton-text
                        [animated]="true"
                        style="width: 60%; height: 32px; margin-top: 16px;"
                      ></ion-skeleton-text>
                      <ion-skeleton-text
                        [animated]="true"
                        style="width: 80%; height: 14px; margin-top: 8px;"
                      ></ion-skeleton-text>
                    </div>
                  </ion-col>
                }
              </ion-row>
            </ion-grid>
            <div class="skeleton-card skeleton-kpi">
              <ion-skeleton-text
                [animated]="true"
                style="width: 50%; height: 20px;"
              ></ion-skeleton-text>
              <ion-skeleton-text
                [animated]="true"
                style="width: 100%; height: 48px; margin-top: 16px;"
              ></ion-skeleton-text>
              <ion-skeleton-text
                [animated]="true"
                style="width: 100%; height: 48px; margin-top: 12px;"
              ></ion-skeleton-text>
            </div>
          </div>
        } @else if (data()) {
          <!-- Dashboard Header -->
          <div class="dashboard-header" style="animation: fadeInUp 0.4s ease-out;">
            <h1 class="dashboard-title">{{ 'DASHBOARD.TITLE' | translate }}</h1>
            <p class="dashboard-subtitle">{{ 'DASHBOARD.SUBTITLE' | translate }}</p>
          </div>

          <!-- Summary Cards with Staggered Animation -->
          <ion-grid class="stats-grid">
            <ion-row>
              <ion-col size="6">
                <div
                  class="stat-card stat-total"
                  style="animation: fadeInUp 0.4s ease-out 0.1s both;"
                >
                  <div class="stat-icon-wrapper">
                    <ion-icon name="cube-outline"></ion-icon>
                  </div>
                  <div class="stat-content">
                    <div class="stat-value">{{ data()!.summary.total | number }}</div>
                    <div class="stat-label">{{ 'DASHBOARD.STATS.TOTAL_ORDERS' | translate }}</div>
                  </div>
                  <div class="stat-decoration"></div>
                </div>
              </ion-col>
              <ion-col size="6">
                <div
                  class="stat-card stat-success"
                  style="animation: fadeInUp 0.4s ease-out 0.15s both;"
                >
                  <div class="stat-icon-wrapper">
                    <ion-icon name="checkmark-circle-outline"></ion-icon>
                  </div>
                  <div class="stat-content">
                    <div class="stat-value">{{ data()!.summary.completed | number }}</div>
                    <div class="stat-label">{{ 'DASHBOARD.STATS.COMPLETED' | translate }}</div>
                  </div>
                  <div class="stat-trend trend-up">
                    <ion-icon name="trending-up-outline"></ion-icon>
                    <span>{{ data()!.summary.completionRate }}%</span>
                  </div>
                  <div class="stat-decoration"></div>
                </div>
              </ion-col>
            </ion-row>
            <ion-row>
              <ion-col size="6">
                <div
                  class="stat-card stat-warning"
                  style="animation: fadeInUp 0.4s ease-out 0.2s both;"
                >
                  <div class="stat-icon-wrapper">
                    <ion-icon name="time-outline"></ion-icon>
                  </div>
                  <div class="stat-content">
                    <div class="stat-value">{{ data()!.summary.pending | number }}</div>
                    <div class="stat-label">{{ 'DASHBOARD.STATS.PENDING' | translate }}</div>
                  </div>
                  @if (pendingPercentage() > 0) {
                    <div class="stat-progress">
                      <div class="progress-bar" [style.width.%]="pendingPercentage()"></div>
                    </div>
                  }
                  <div class="stat-decoration"></div>
                </div>
              </ion-col>
              <ion-col size="6">
                <div
                  class="stat-card stat-danger"
                  style="animation: fadeInUp 0.4s ease-out 0.25s both;"
                >
                  <div class="stat-icon-wrapper">
                    <ion-icon name="close-circle-outline"></ion-icon>
                  </div>
                  <div class="stat-content">
                    <div class="stat-value">{{ data()!.summary.cancelled | number }}</div>
                    <div class="stat-label">{{ 'DASHBOARD.STATS.CANCELLED' | translate }}</div>
                  </div>
                  @if (parseFloat(data()!.summary.cancellationRate) > 0) {
                    <div class="stat-trend trend-down">
                      <ion-icon name="trending-down-outline"></ion-icon>
                      <span>{{ data()!.summary.cancellationRate }}%</span>
                    </div>
                  }
                  <div class="stat-decoration"></div>
                </div>
              </ion-col>
            </ion-row>
          </ion-grid>

          <!-- KPI Card with Visual Gauges -->
          <div class="kpi-card" style="animation: fadeInUp 0.4s ease-out 0.3s both;">
            <div class="kpi-header">
              <div class="kpi-title-wrapper">
                <ion-icon name="stats-chart-outline"></ion-icon>
                <h2>{{ 'DASHBOARD.KPI.TITLE' | translate }}</h2>
              </div>
            </div>
            <div class="kpi-body">
              <!-- Completion Rate Gauge -->
              <div class="kpi-metric kpi-completion">
                <div class="kpi-metric-header">
                  <span class="kpi-metric-label">{{
                    'DASHBOARD.KPI.COMPLETION_RATE' | translate
                  }}</span>
                  <span class="kpi-metric-value success"
                    >{{ data()!.summary.completionRate }}%</span
                  >
                </div>
                <div class="kpi-gauge">
                  <div class="gauge-track">
                    <div
                      class="gauge-fill gauge-success"
                      [style.width.%]="data()!.summary.completionRate"
                    ></div>
                  </div>
                  <div class="gauge-markers">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>

              <!-- Cancellation Rate Gauge -->
              <div class="kpi-metric kpi-cancellation">
                <div class="kpi-metric-header">
                  <span class="kpi-metric-label">{{
                    'DASHBOARD.KPI.CANCELLATION_RATE' | translate
                  }}</span>
                  <span class="kpi-metric-value danger"
                    >{{ data()!.summary.cancellationRate }}%</span
                  >
                </div>
                <div class="kpi-gauge">
                  <div class="gauge-track">
                    <div
                      class="gauge-fill gauge-danger"
                      [style.width.%]="data()!.summary.cancellationRate"
                    ></div>
                  </div>
                  <div class="gauge-markers">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Status Breakdown with Enhanced Visual Design -->
          <div class="breakdown-card" style="animation: fadeInUp 0.4s ease-out 0.35s both;">
            <div class="breakdown-header">
              <div class="breakdown-title-wrapper">
                <ion-icon name="pulse-outline"></ion-icon>
                <h2>{{ 'DASHBOARD.STATUS_BREAKDOWN.TITLE' | translate }}</h2>
              </div>
              <span class="breakdown-count">{{ statusEntries().length }}</span>
            </div>
            <div class="breakdown-body">
              @for (status of statusEntries(); track status[0]; let i = $index) {
                <div class="status-item" [style.animation-delay.ms]="350 + i * 50">
                  <div class="status-info">
                    <span class="status-dot" [attr.data-status]="status[0].toLowerCase()"></span>
                    <span class="status-name">{{ 'ORDER_STATUS.' + status[0] | translate }}</span>
                  </div>
                  <div class="status-metrics">
                    <div class="status-bar-wrapper">
                      <div
                        class="status-bar"
                        [attr.data-status]="status[0].toLowerCase()"
                        [style.width.%]="getStatusPercentage(status[1])"
                      ></div>
                    </div>
                    <span class="status-count">{{ status[1] | number }}</span>
                  </div>
                </div>
              }
              @if (statusEntries().length === 0) {
                <div class="empty-breakdown">
                  <ion-icon name="cube-outline"></ion-icon>
                  <p>{{ 'DASHBOARD.NO_STATUS_DATA' | translate }}</p>
                </div>
              }
            </div>
          </div>
        } @else {
          <!-- Empty State -->
          <div class="empty-state" style="animation: fadeInUp 0.4s ease-out;">
            <div class="empty-icon">
              <ion-icon name="stats-chart-outline"></ion-icon>
            </div>
            <h3>{{ 'DASHBOARD.EMPTY.TITLE' | translate }}</h3>
            <p>{{ 'DASHBOARD.EMPTY.MESSAGE' | translate }}</p>
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: [
    `
      /* ========================================
       CSS Variables for Dashboard Theme
       ======================================== */
      :host {
        --dashboard-bg: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
        --card-bg: #ffffff;
        --card-shadow: 0 4px 24px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04);
        --card-shadow-hover: 0 8px 32px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.06);
        --card-border: 1px solid rgba(226, 232, 240, 0.8);
        --card-radius: 20px;

        --stat-total-gradient: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        --stat-total-light: rgba(59, 130, 246, 0.08);
        --stat-success-gradient: linear-gradient(135deg, #10b981 0%, #059669 100%);
        --stat-success-light: rgba(16, 185, 129, 0.08);
        --stat-warning-gradient: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        --stat-warning-light: rgba(245, 158, 11, 0.08);
        --stat-danger-gradient: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        --stat-danger-light: rgba(239, 68, 68, 0.08);

        --text-primary: #0f172a;
        --text-secondary: #64748b;
        --text-muted: #94a3b8;

        --gauge-track: #e2e8f0;
        --gauge-success: linear-gradient(90deg, #10b981 0%, #34d399 100%);
        --gauge-danger: linear-gradient(90deg, #ef4444 0%, #f87171 100%);
      }

      @media (prefers-color-scheme: dark) {
        :host {
          --dashboard-bg: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
          --card-bg: #1e293b;
          --card-shadow: 0 4px 24px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2);
          --card-shadow-hover: 0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.3);
          --card-border: 1px solid rgba(51, 65, 85, 0.8);

          --stat-total-light: rgba(59, 130, 246, 0.15);
          --stat-success-light: rgba(16, 185, 129, 0.15);
          --stat-warning-light: rgba(245, 158, 11, 0.15);
          --stat-danger-light: rgba(239, 68, 68, 0.15);

          --text-primary: #f8fafc;
          --text-secondary: #cbd5e1;
          --text-muted: #64748b;

          --gauge-track: #334155;
        }
      }

      /* ========================================
       Animations
       ======================================== */
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.6;
        }
      }

      @keyframes shimmer {
        0% {
          background-position: -200% 0;
        }
        100% {
          background-position: 200% 0;
        }
      }

      @keyframes gaugeGrow {
        from {
          width: 0;
        }
      }

      /* ========================================
       Main Layout
       ======================================== */
      ion-header {
        ion-toolbar {
          --background: transparent;
          --border-width: 0;
          --padding-top: 12px;
          --padding-bottom: 8px;

          ion-title {
            font-size: 20px;
            font-weight: 700;
            letter-spacing: -0.02em;
            color: var(--text-primary);
          }
        }
      }

      ion-content {
        --background: var(--dashboard-bg);
      }

      .dashboard-container {
        padding: 0 16px 32px;
        max-width: 600px;
        margin: 0 auto;
      }

      /* ========================================
       Dashboard Header
       ======================================== */
      .dashboard-header {
        padding: 8px 4px 20px;

        .dashboard-title {
          font-size: 28px;
          font-weight: 800;
          color: var(--text-primary);
          margin: 0 0 4px 0;
          letter-spacing: -0.03em;
          line-height: 1.2;
        }

        .dashboard-subtitle {
          font-size: 14px;
          color: var(--text-secondary);
          margin: 0;
          font-weight: 500;
        }
      }

      /* ========================================
       Stats Grid
       ======================================== */
      .stats-grid {
        --ion-grid-padding: 0;
        --ion-grid-column-padding: 6px;
        margin-bottom: 16px;

        ion-row {
          margin-bottom: 0;
        }
      }

      /* ========================================
       Stat Cards - Premium Design
       ======================================== */
      .stat-card {
        position: relative;
        background: var(--card-bg);
        border-radius: var(--card-radius);
        padding: 20px 16px;
        box-shadow: var(--card-shadow);
        border: var(--card-border);
        overflow: hidden;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        min-height: 140px;
        display: flex;
        flex-direction: column;

        &:active {
          transform: scale(0.98);
          box-shadow: var(--card-shadow-hover);
        }

        .stat-icon-wrapper {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;

          ion-icon {
            font-size: 22px;
            color: white;
          }
        }

        .stat-content {
          flex: 1;
          position: relative;
          z-index: 1;
        }

        .stat-value {
          font-size: 32px;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1;
          margin-bottom: 6px;
          letter-spacing: -0.02em;
          font-variant-numeric: tabular-nums;
        }

        .stat-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .stat-trend {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          margin-top: 10px;

          ion-icon {
            font-size: 14px;
          }

          &.trend-up {
            background: rgba(16, 185, 129, 0.12);
            color: #059669;
          }

          &.trend-down {
            background: rgba(239, 68, 68, 0.12);
            color: #dc2626;
          }
        }

        .stat-progress {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: rgba(245, 158, 11, 0.15);

          .progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%);
            border-radius: 0 2px 2px 0;
            animation: gaugeGrow 0.8s ease-out;
          }
        }

        .stat-decoration {
          position: absolute;
          top: -30px;
          right: -30px;
          width: 100px;
          height: 100px;
          border-radius: 50%;
          opacity: 0.1;
          z-index: 0;
        }

        /* Color Variants */
        &.stat-total {
          .stat-icon-wrapper {
            background: var(--stat-total-gradient);
          }
          .stat-decoration {
            background: var(--stat-total-gradient);
          }
        }

        &.stat-success {
          .stat-icon-wrapper {
            background: var(--stat-success-gradient);
          }
          .stat-decoration {
            background: var(--stat-success-gradient);
          }
        }

        &.stat-warning {
          .stat-icon-wrapper {
            background: var(--stat-warning-gradient);
          }
          .stat-decoration {
            background: var(--stat-warning-gradient);
          }
        }

        &.stat-danger {
          .stat-icon-wrapper {
            background: var(--stat-danger-gradient);
          }
          .stat-decoration {
            background: var(--stat-danger-gradient);
          }
        }
      }

      /* ========================================
       KPI Card
       ======================================== */
      .kpi-card {
        background: var(--card-bg);
        border-radius: var(--card-radius);
        box-shadow: var(--card-shadow);
        border: var(--card-border);
        padding: 24px;
        margin-bottom: 16px;

        .kpi-header {
          margin-bottom: 24px;

          .kpi-title-wrapper {
            display: flex;
            align-items: center;
            gap: 12px;

            ion-icon {
              font-size: 24px;
              color: var(--ion-color-primary);
              background: rgba(59, 130, 246, 0.1);
              padding: 10px;
              border-radius: 12px;
            }

            h2 {
              font-size: 18px;
              font-weight: 700;
              color: var(--text-primary);
              margin: 0;
              letter-spacing: -0.01em;
            }
          }
        }

        .kpi-body {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .kpi-metric {
          .kpi-metric-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;

            .kpi-metric-label {
              font-size: 14px;
              font-weight: 600;
              color: var(--text-secondary);
            }

            .kpi-metric-value {
              font-size: 24px;
              font-weight: 800;
              letter-spacing: -0.02em;
              font-variant-numeric: tabular-nums;

              &.success {
                color: #059669;
              }
              &.danger {
                color: #dc2626;
              }
            }
          }

          .kpi-gauge {
            .gauge-track {
              height: 10px;
              background: var(--gauge-track);
              border-radius: 10px;
              overflow: hidden;
              margin-bottom: 8px;

              .gauge-fill {
                height: 100%;
                border-radius: 10px;
                animation: gaugeGrow 1s ease-out;

                &.gauge-success {
                  background: var(--gauge-success);
                }

                &.gauge-danger {
                  background: var(--gauge-danger);
                }
              }
            }

            .gauge-markers {
              display: flex;
              justify-content: space-between;

              span {
                font-size: 10px;
                font-weight: 500;
                color: var(--text-muted);
              }
            }
          }
        }
      }

      /* ========================================
       Status Breakdown Card
       ======================================== */
      .breakdown-card {
        background: var(--card-bg);
        border-radius: var(--card-radius);
        box-shadow: var(--card-shadow);
        border: var(--card-border);
        padding: 24px;

        .breakdown-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;

          .breakdown-title-wrapper {
            display: flex;
            align-items: center;
            gap: 12px;

            ion-icon {
              font-size: 24px;
              color: var(--ion-color-tertiary);
              background: rgba(82, 96, 255, 0.1);
              padding: 10px;
              border-radius: 12px;
            }

            h2 {
              font-size: 18px;
              font-weight: 700;
              color: var(--text-primary);
              margin: 0;
              letter-spacing: -0.01em;
            }
          }

          .breakdown-count {
            font-size: 13px;
            font-weight: 600;
            color: var(--text-muted);
            background: var(--gauge-track);
            padding: 4px 12px;
            border-radius: 20px;
          }
        }

        .breakdown-body {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .status-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 14px;
          background: rgba(241, 245, 249, 0.5);
          border-radius: 12px;
          transition: all 0.2s ease;
          animation: fadeInUp 0.4s ease-out both;

          @media (prefers-color-scheme: dark) {
            background: rgba(51, 65, 85, 0.3);
          }

          &:active {
            background: rgba(241, 245, 249, 0.8);
            transform: scale(0.99);
          }

          .status-info {
            display: flex;
            align-items: center;
            gap: 12px;

            .status-dot {
              width: 10px;
              height: 10px;
              border-radius: 50%;
              flex-shrink: 0;

              &[data-status='unassigned'] {
                background: var(--status-unassigned);
              }
              &[data-status='assigned'] {
                background: var(--status-assigned);
              }
              &[data-status='confirmed'] {
                background: var(--status-confirmed);
              }
              &[data-status='released'] {
                background: var(--status-released);
              }
              &[data-status='dispatched'] {
                background: var(--status-dispatched);
              }
              &[data-status='completed'] {
                background: var(--status-completed);
              }
              &[data-status='postponed'] {
                background: var(--status-postponed);
              }
              &[data-status='absent'] {
                background: var(--status-absent);
              }
              &[data-status='request_cancel'],
              &[data-status='request-cancel'] {
                background: var(--status-request-cancel);
              }
              &[data-status='cancelled'] {
                background: var(--status-cancelled);
              }
              &[data-status='collected'] {
                background: var(--status-collected);
              }
              &[data-status='reverted'] {
                background: var(--status-reverted);
              }
            }

            .status-name {
              font-size: 14px;
              font-weight: 600;
              color: var(--text-primary);
            }
          }

          .status-metrics {
            display: flex;
            align-items: center;
            gap: 12px;

            .status-bar-wrapper {
              width: 60px;
              height: 6px;
              background: var(--gauge-track);
              border-radius: 6px;
              overflow: hidden;

              .status-bar {
                height: 100%;
                border-radius: 6px;
                transition: width 0.6s ease-out;

                &[data-status='unassigned'] {
                  background: var(--status-unassigned);
                }
                &[data-status='assigned'] {
                  background: var(--status-assigned);
                }
                &[data-status='confirmed'] {
                  background: var(--status-confirmed);
                }
                &[data-status='released'] {
                  background: var(--status-released);
                }
                &[data-status='dispatched'] {
                  background: var(--status-dispatched);
                }
                &[data-status='completed'] {
                  background: var(--status-completed);
                }
                &[data-status='postponed'] {
                  background: var(--status-postponed);
                }
                &[data-status='absent'] {
                  background: var(--status-absent);
                }
                &[data-status='request_cancel'],
                &[data-status='request-cancel'] {
                  background: var(--status-request-cancel);
                }
                &[data-status='cancelled'] {
                  background: var(--status-cancelled);
                }
                &[data-status='collected'] {
                  background: var(--status-collected);
                }
                &[data-status='reverted'] {
                  background: var(--status-reverted);
                }
              }
            }

            .status-count {
              font-size: 15px;
              font-weight: 700;
              color: var(--text-primary);
              min-width: 40px;
              text-align: right;
              font-variant-numeric: tabular-nums;
            }
          }
        }

        .empty-breakdown {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px 20px;
          text-align: center;

          ion-icon {
            font-size: 48px;
            color: var(--text-muted);
            margin-bottom: 12px;
          }

          p {
            font-size: 14px;
            color: var(--text-secondary);
            margin: 0;
          }
        }
      }

      /* ========================================
       Loading Skeleton
       ======================================== */
      .loading-skeleton {
        .skeleton-header {
          padding: 8px 4px 20px;
        }

        .skeleton-card {
          background: var(--card-bg);
          border-radius: var(--card-radius);
          padding: 20px 16px;
          box-shadow: var(--card-shadow);
          border: var(--card-border);
          min-height: 140px;

          ion-skeleton-text {
            --border-radius: 8px;
          }
        }

        .skeleton-kpi {
          margin-top: 16px;
          min-height: auto;
          padding: 24px;
        }
      }

      /* ========================================
       Empty State
       ======================================== */
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 80px 32px;
        text-align: center;

        .empty-icon {
          width: 88px;
          height: 88px;
          border-radius: 50%;
          background: linear-gradient(
            135deg,
            rgba(59, 130, 246, 0.1) 0%,
            rgba(82, 96, 255, 0.1) 100%
          );
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;

          ion-icon {
            font-size: 40px;
            color: var(--ion-color-primary);
          }
        }

        h3 {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 8px 0;
        }

        p {
          font-size: 15px;
          color: var(--text-secondary);
          margin: 0;
          max-width: 280px;
          line-height: 1.5;
        }
      }
    `,
  ],
})
export class DashboardPage implements OnInit {
  private readonly http = inject(HttpClient);

  protected readonly data = signal<DashboardSummary | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly statusEntries = signal<[string, number][]>([]);

  protected readonly pendingPercentage = computed(() => {
    const currentData = this.data();
    if (!currentData || currentData.summary.total === 0) return 0;
    return Math.round((currentData.summary.pending / currentData.summary.total) * 100);
  });

  private readonly maxStatusCount = computed(() => {
    const entries = this.statusEntries();
    if (entries.length === 0) return 1;
    return Math.max(...entries.map(([, count]) => count), 1);
  });

  constructor() {
    addIcons({
      cubeOutline,
      checkmarkCircleOutline,
      timeOutline,
      closeCircleOutline,
      trendingUpOutline,
      trendingDownOutline,
      statsChartOutline,
      pulseOutline,
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  protected async onRefresh(event: RefresherCustomEvent): Promise<void> {
    await this.loadData();
    event.target.complete();
  }

  protected getStatusPercentage(count: number): number {
    const max = this.maxStatusCount();
    return Math.round((count / max) * 100);
  }

  protected parseFloat(value: string): number {
    return parseFloat(value) || 0;
  }

  private async loadData(): Promise<void> {
    this.isLoading.set(true);

    try {
      // No date filter - show all data for comprehensive dashboard view
      const result = await firstValueFrom(
        this.http.get<DashboardSummary>(`${environment.apiUrl}/reports/summary`, {
          params: { level: 'branch' },
        }),
      );

      this.data.set(result);
      this.statusEntries.set(Object.entries(result.statusBreakdown));
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      this.isLoading.set(false);
    }
  }
}
