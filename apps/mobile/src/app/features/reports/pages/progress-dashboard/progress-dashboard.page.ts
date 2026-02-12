// apps/mobile/src/app/features/reports/pages/progress-dashboard/progress-dashboard.page.ts
import {
  Component,
  signal,
  computed,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonSpinner,
  IonGrid,
  IonRow,
  IonCol,
  IonBadge,
  IonList,
  IonItem,
  IonRefresher,
  IonRefresherContent,
  IonProgressBar,
  RefresherCustomEvent,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  ReportsService,
  KpiSummary,
  ProgressItem,
} from '../../../../core/services/reports.service';
import { AuthService } from '../../../../core/services/auth.service';
import { UserRole } from '../../../../shared/constants/roles';
import { LoggerService } from '../../../../core/services/logger.service';

type ViewType = 'installer' | 'branch' | 'status';

@Component({
  selector: 'app-progress-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonSpinner,
    IonGrid,
    IonRow,
    IonCol,
    IonBadge,
    IonList,
    IonItem,
    IonRefresher,
    IonRefresherContent,
    IonProgressBar,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"
          ><ion-back-button defaultHref="/tabs/reports"></ion-back-button
        ></ion-buttons>
        <ion-title>{{ 'REPORTS.PROGRESS.TITLE' | translate }}</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [value]="viewType()" (ionChange)="onViewTypeChange($any($event).detail.value)">
          <ion-segment-button value="installer"
            ><ion-label>{{
              'REPORTS.PROGRESS.VIEW_BY_INSTALLER' | translate
            }}</ion-label></ion-segment-button
          >
          <ion-segment-button value="branch"
            ><ion-label>{{
              'REPORTS.PROGRESS.VIEW_BY_BRANCH' | translate
            }}</ion-label></ion-segment-button
          >
          <ion-segment-button value="status"
            ><ion-label>{{
              'REPORTS.PROGRESS.VIEW_BY_STATUS' | translate
            }}</ion-label></ion-segment-button
          >
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
              <ion-card
                ><ion-card-content>
                  <div class="stat-value">{{ summary()?.total || 0 }}</div>
                  <div class="stat-label">총 주문</div>
                </ion-card-content></ion-card
              >
            </ion-col>
            <ion-col size="6">
              <ion-card color="success"
                ><ion-card-content>
                  <div class="stat-value">{{ summary()?.completed || 0 }}</div>
                  <div class="stat-label">완료</div>
                </ion-card-content></ion-card
              >
            </ion-col>
            <ion-col size="6">
              <ion-card color="warning"
                ><ion-card-content>
                  <div class="stat-value">{{ summary()?.inProgress || 0 }}</div>
                  <div class="stat-label">진행중</div>
                </ion-card-content></ion-card
              >
            </ion-col>
            <ion-col size="6">
              <ion-card color="danger"
                ><ion-card-content>
                  <div class="stat-value">{{ summary()?.pending || 0 }}</div>
                  <div class="stat-label">미배정</div>
                </ion-card-content></ion-card
              >
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
              <ion-progress-bar
                [value]="(summary()?.appointmentRate || 0) / 100"
                color="success"
              ></ion-progress-bar>
              <ion-badge color="success">{{ summary()?.appointmentRate || 0 }}%</ion-badge>
            </div>
            <div class="kpi-item">
              <span>폐가전 회수율</span>
              <ion-progress-bar
                [value]="(summary()?.wastePickupRate || 0) / 100"
                color="tertiary"
              ></ion-progress-bar>
              <ion-badge color="tertiary">{{ summary()?.wastePickupRate || 0 }}%</ion-badge>
            </div>
            <div class="kpi-item">
              <span>설치불량율</span>
              <ion-progress-bar
                [value]="(summary()?.defectRate || 0) / 100"
                color="danger"
              ></ion-progress-bar>
              <ion-badge color="danger">{{ summary()?.defectRate || 0 }}%</ion-badge>
            </div>
          </ion-card-content>
        </ion-card>

        <!-- Progress List -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ viewTypeLabel() | translate }} 현황</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list>
              @for (item of progressItems(); track item.id) {
                <ion-item>
                  <ion-label>
                    <h3>{{ getItemLabel(item, viewType()) }}</h3>
                    @if (viewType() !== 'status') {
                      <ion-progress-bar [value]="item.rate / 100"></ion-progress-bar>
                    }
                  </ion-label>
                  <div slot="end" class="progress-stats">
                    <span>{{ getItemStats(item, viewType()) }}</span>
                    @if (viewType() !== 'status') {
                      <ion-badge
                        [color]="
                          item.rate >= 80 ? 'success' : item.rate >= 50 ? 'warning' : 'danger'
                        "
                      >
                        {{ item.rate }}%
                      </ion-badge>
                    }
                  </div>
                </ion-item>
              } @empty {
                <div class="empty">{{ 'COMMON.NO_DATA' | translate }}</div>
              }
            </ion-list>
          </ion-card-content>
        </ion-card>
      }
    </ion-content>
  `,
  styles: [
    `
      .center {
        display: flex;
        justify-content: center;
        padding: 48px;
      }
      .stat-value {
        font-size: 28px;
        font-weight: bold;
        text-align: center;
      }
      .stat-label {
        text-align: center;
        color: var(--ion-color-medium);
        font-size: 13px;
      }
      .kpi-item {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
      }
      .kpi-item span {
        min-width: 100px;
        font-size: 13px;
      }
      .kpi-item ion-progress-bar {
        flex: 1;
      }
      .progress-stats {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 4px;
      }
      .progress-stats span {
        font-size: 12px;
        color: var(--ion-color-medium);
      }
      .empty {
        text-align: center;
        padding: 24px;
        color: var(--ion-color-medium);
      }
      ion-card-title {
        font-size: 16px;
      }
    `,
  ],
})
export class ProgressDashboardPage implements OnInit {
  private readonly reportsService = inject(ReportsService);
  private readonly authService = inject(AuthService);
  private readonly translate = inject(TranslateService);
  private readonly logger = inject(LoggerService);

  protected readonly viewType = signal<ViewType>('installer');
  protected readonly isLoading = signal(false);
  protected readonly summary = signal<KpiSummary | null>(null);
  protected readonly progressItems = signal<ProgressItem[]>([]);

  protected readonly viewTypeLabel = computed(() => {
    const labels: Record<ViewType, string> = {
      installer: 'REPORTS.PROGRESS.VIEW_BY_INSTALLER',
      branch: 'REPORTS.PROGRESS.VIEW_BY_BRANCH',
      status: 'REPORTS.PROGRESS.VIEW_BY_STATUS',
    };
    return labels[this.viewType()];
  });

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.isLoading.set(true);
    // HQ_ADMIN sees all data, others see only their branch
    const branchCode = this.authService.hasRole(UserRole.HQ_ADMIN)
      ? undefined
      : this.authService.user()?.branchCode;

    try {
      // Load summary
      this.reportsService.getSummary({ level: 'branch', branchCode }).subscribe({
        next: (data) => this.summary.set(data),
        error: () => this.summary.set(null),
      });

      // Load progress
      this.reportsService.getProgress({ groupBy: this.viewType(), branchCode }).subscribe({
        next: (data) => {
          this.logger.log('[ProgressDashboard] Received progress data:', {
            viewType: this.viewType(),
            itemCount: data.items?.length,
            firstItems: data.items?.slice(0, 3).map((i) => ({ name: i.name, total: i.total })),
          });
          this.progressItems.set(data.items || []);
        },
        error: (err) => {
          this.logger.error('[ProgressDashboard] Error loading progress:', err);
          this.progressItems.set([]);
        },
      });
    } finally {
      this.isLoading.set(false);
    }
  }

  onViewTypeChange(type: ViewType) {
    this.viewType.set(type);
    this.loadData();
  }

  async onRefresh(event: RefresherCustomEvent) {
    await this.loadData();
    event.target.complete();
  }

  /**
   * Get translated label for progress item
   * For status view, translate using ORDER_STATUS keys
   */
  getItemLabel(item: { name?: string; key?: string }, currentViewType: ViewType): string {
    if (currentViewType === 'status') {
      const statusKey = item.key || item.name || '';
      const translationKey = `ORDER_STATUS.${statusKey}`;
      const translated = this.translate.instant(translationKey);
      return translated !== translationKey ? translated : item.name || statusKey;
    }
    return item.name || '';
  }

  /**
   * Get stats display for progress item
   * For status view, show just total count
   */
  getItemStats(item: { total?: number; completed?: number }, currentViewType: ViewType): string {
    if (currentViewType === 'status') {
      return `${item.total || 0}${this.translate.instant('REPORTS.PROGRESS.ITEMS_SUFFIX')}`;
    }
    return `${item.completed || 0}/${item.total || 0}`;
  }
}
