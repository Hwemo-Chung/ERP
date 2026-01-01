import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
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
  RefresherCustomEvent,
} from '@ionic/angular/standalone';
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
    TranslateModule,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ 'DASHBOARD.TITLE' | translate }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (isLoading()) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      } @else if (data()) {
        <!-- Summary Cards -->
        <ion-grid>
          <ion-row>
            <ion-col size="6">
              <ion-card class="stat-card">
                <ion-card-content>
                  <div class="stat-value">{{ data()!.summary.total }}</div>
                  <div class="stat-label">{{ 'DASHBOARD.STATS.TOTAL_ORDERS' | translate }}</div>
                </ion-card-content>
              </ion-card>
            </ion-col>
            <ion-col size="6">
              <ion-card class="stat-card success">
                <ion-card-content>
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
                  <div class="stat-value">{{ data()!.summary.pending }}</div>
                  <div class="stat-label">{{ 'DASHBOARD.STATS.PENDING' | translate }}</div>
                </ion-card-content>
              </ion-card>
            </ion-col>
            <ion-col size="6">
              <ion-card class="stat-card danger">
                <ion-card-content>
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
                  {{ 'ORDER_STATUS.' + status[0] | translate }}
                </span>
                <span class="status-count">{{ status[1] }}</span>
              </div>
            }
          </ion-card-content>
        </ion-card>
      }
    </ion-content>
  `,
  styles: [`
    .loading-container {
      display: flex;
      justify-content: center;
      padding: 48px;
    }

    .stat-card {
      text-align: center;

      &.success { --background: var(--ion-color-success-tint); }
      &.warning { --background: var(--ion-color-warning-tint); }
      &.danger { --background: var(--ion-color-danger-tint); }

      .stat-value {
        font-size: 32px;
        font-weight: 700;
        color: var(--ion-color-dark);
      }

      .stat-label {
        font-size: 12px;
        color: var(--ion-color-medium);
        text-transform: uppercase;
      }
    }

    .kpi-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
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
      padding: 8px 0;

      .status-label {
        font-size: 13px;
        padding: 2px 8px;
        border-radius: 4px;
        background: var(--ion-color-light);
      }

      .status-count {
        font-weight: 600;
      }
    }
  `],
})
export class DashboardPage implements OnInit {
  private readonly http = inject(HttpClient);

  protected readonly data = signal<DashboardSummary | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly statusEntries = signal<[string, number][]>([]);

  ngOnInit(): void {
    this.loadData();
  }

  protected async onRefresh(event: RefresherCustomEvent): Promise<void> {
    await this.loadData();
    event.target.complete();
  }

  private async loadData(): Promise<void> {
    this.isLoading.set(true);

    try {
      // No date filter - show all data for comprehensive dashboard view
      const result = await firstValueFrom(
        this.http.get<DashboardSummary>(
          `${environment.apiUrl}/reports/summary`,
          { params: { level: 'branch' } }
        )
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
