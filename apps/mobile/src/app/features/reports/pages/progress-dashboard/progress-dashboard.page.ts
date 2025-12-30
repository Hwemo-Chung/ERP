// apps/web/src/app/features/reports/pages/progress-dashboard/progress-dashboard.page.ts
import { Component, signal, computed, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonSegment, IonSegmentButton,
  IonLabel, IonSpinner, IonGrid, IonRow, IonCol, IonBadge, IonList, IonItem,
  IonRefresher, IonRefresherContent, IonProgressBar,
} from '@ionic/angular/standalone';
import { ReportsService, KpiSummary, ProgressItem } from '../../../../core/services/reports.service';
import { AuthService } from '../../../../core/services/auth.service';

type ViewType = 'installer' | 'branch' | 'status';

@Component({
  selector: 'app-progress-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonSegment, IonSegmentButton,
    IonLabel, IonSpinner, IonGrid, IonRow, IonCol, IonBadge, IonList, IonItem,
    IonRefresher, IonRefresherContent, IonProgressBar,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/reports"></ion-back-button></ion-buttons>
        <ion-title>진행현황</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [value]="viewType()" (ionChange)="onViewTypeChange($any($event).detail.value)">
          <ion-segment-button value="installer"><ion-label>기사별</ion-label></ion-segment-button>
          <ion-segment-button value="branch"><ion-label>지점별</ion-label></ion-segment-button>
          <ion-segment-button value="status"><ion-label>상태별</ion-label></ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (isLoading()) {
        <div class="center"><ion-spinner name="crescent"></ion-spinner></div>
      } @else {
        <!-- Summary Cards -->
        <ion-grid>
          <ion-row>
            <ion-col size="6">
              <ion-card><ion-card-content>
                <div class="stat-value">{{ summary()?.total || 0 }}</div>
                <div class="stat-label">총 주문</div>
              </ion-card-content></ion-card>
            </ion-col>
            <ion-col size="6">
              <ion-card color="success"><ion-card-content>
                <div class="stat-value">{{ summary()?.completed || 0 }}</div>
                <div class="stat-label">완료</div>
              </ion-card-content></ion-card>
            </ion-col>
            <ion-col size="6">
              <ion-card color="warning"><ion-card-content>
                <div class="stat-value">{{ summary()?.inProgress || 0 }}</div>
                <div class="stat-label">진행중</div>
              </ion-card-content></ion-card>
            </ion-col>
            <ion-col size="6">
              <ion-card color="danger"><ion-card-content>
                <div class="stat-value">{{ summary()?.pending || 0 }}</div>
                <div class="stat-label">미배정</div>
              </ion-card-content></ion-card>
            </ion-col>
          </ion-row>
        </ion-grid>

        <!-- KPI Metrics -->
        <ion-card>
          <ion-card-header><ion-card-title>KPI 현황</ion-card-title></ion-card-header>
          <ion-card-content>
            <div class="kpi-item">
              <span>완료율</span>
              <ion-progress-bar [value]="(summary()?.completionRate || 0) / 100"></ion-progress-bar>
              <ion-badge>{{ summary()?.completionRate || 0 }}%</ion-badge>
            </div>
            <div class="kpi-item">
              <span>약속방문준수율</span>
              <ion-progress-bar [value]="(summary()?.appointmentRate || 0) / 100" color="success"></ion-progress-bar>
              <ion-badge color="success">{{ summary()?.appointmentRate || 0 }}%</ion-badge>
            </div>
            <div class="kpi-item">
              <span>폐가전 회수율</span>
              <ion-progress-bar [value]="(summary()?.wastePickupRate || 0) / 100" color="tertiary"></ion-progress-bar>
              <ion-badge color="tertiary">{{ summary()?.wastePickupRate || 0 }}%</ion-badge>
            </div>
            <div class="kpi-item">
              <span>설치불량율</span>
              <ion-progress-bar [value]="(summary()?.defectRate || 0) / 100" color="danger"></ion-progress-bar>
              <ion-badge color="danger">{{ summary()?.defectRate || 0 }}%</ion-badge>
            </div>
          </ion-card-content>
        </ion-card>

        <!-- Progress List -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ viewTypeLabel() }} 현황</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list>
              @for (item of progressItems(); track item.id) {
                <ion-item>
                  <ion-label>
                    <h3>{{ item.name }}</h3>
                    <ion-progress-bar [value]="item.rate / 100"></ion-progress-bar>
                  </ion-label>
                  <div slot="end" class="progress-stats">
                    <span>{{ item.completed }}/{{ item.total }}</span>
                    <ion-badge [color]="item.rate >= 80 ? 'success' : item.rate >= 50 ? 'warning' : 'danger'">
                      {{ item.rate }}%
                    </ion-badge>
                  </div>
                </ion-item>
              } @empty {
                <div class="empty">데이터가 없습니다</div>
              }
            </ion-list>
          </ion-card-content>
        </ion-card>
      }
    </ion-content>
  `,
  styles: [`
    .center { display: flex; justify-content: center; padding: 48px; }
    .stat-value { font-size: 28px; font-weight: bold; text-align: center; }
    .stat-label { text-align: center; color: var(--ion-color-medium); font-size: 13px; }
    .kpi-item { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .kpi-item span { min-width: 100px; font-size: 13px; }
    .kpi-item ion-progress-bar { flex: 1; }
    .progress-stats { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
    .progress-stats span { font-size: 12px; color: var(--ion-color-medium); }
    .empty { text-align: center; padding: 24px; color: var(--ion-color-medium); }
    ion-card-title { font-size: 16px; }
  `],
})
export class ProgressDashboardPage implements OnInit {
  private readonly reportsService = inject(ReportsService);
  private readonly authService = inject(AuthService);

  protected readonly viewType = signal<ViewType>('installer');
  protected readonly isLoading = signal(false);
  protected readonly summary = signal<KpiSummary | null>(null);
  protected readonly progressItems = signal<ProgressItem[]>([]);

  protected readonly viewTypeLabel = computed(() => {
    const labels: Record<ViewType, string> = {
      installer: 'REPORTS.PROGRESS_DASHBOARD.GROUPBY.INSTALLER',
      branch: 'REPORTS.PROGRESS_DASHBOARD.GROUPBY.BRANCH',
      status: 'REPORTS.PROGRESS_DASHBOARD.GROUPBY.STATUS',
    };
    return labels[this.viewType()];
  });

  ngOnInit() { this.loadData(); }

  async loadData() {
    this.isLoading.set(true);
    const branchCode = this.authService.user()?.branchCode;

    try {
      // Load summary
      this.reportsService.getSummary({ level: 'branch', branchCode }).subscribe({
        next: (data) => this.summary.set(data),
        error: () => this.summary.set(null),
      });

      // Load progress
      this.reportsService.getProgress({ groupBy: this.viewType(), branchCode }).subscribe({
        next: (data) => this.progressItems.set(data.items || []),
        error: () => this.progressItems.set([]),
      });
    } finally {
      this.isLoading.set(false);
    }
  }

  onViewTypeChange(type: ViewType) {
    this.viewType.set(type);
    this.loadData();
  }

  async onRefresh(event: any) {
    await this.loadData();
    event.target.complete();
  }
}
