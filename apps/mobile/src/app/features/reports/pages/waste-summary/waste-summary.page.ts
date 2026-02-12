// apps/web/src/app/features/reports/pages/waste-summary/waste-summary.page.ts
import {
  Component,
  signal,
  computed,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonSpinner,
  IonButton,
  IonIcon,
  IonDatetimeButton,
  IonModal,
  IonDatetime,
  IonRefresher,
  IonRefresherContent,
  ToastController,
  RefresherCustomEvent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { downloadOutline, calendarOutline, trashOutline } from 'ionicons/icons';
import { ReportsService, WasteSummary, WasteStat } from '../../../../core/services/reports.service';
import { AuthService } from '../../../../core/services/auth.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-waste-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
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
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
    IonSpinner,
    IonButton,
    IonIcon,
    IonDatetimeButton,
    IonModal,
    IonDatetime,
    IonRefresher,
    IonRefresherContent,
    TranslateModule,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"
          ><ion-back-button defaultHref="/tabs/reports"></ion-back-button
        ></ion-buttons>
        <ion-title>폐가전 집계</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="exportData()"
            ><ion-icon name="download-outline"></ion-icon
          ></ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <div class="date-range">
          <ion-datetime-button datetime="startDate"></ion-datetime-button>
          <span>~</span>
          <ion-datetime-button datetime="endDate"></ion-datetime-button>
        </div>
        <ion-modal [keepContentsMounted]="true">
          <ng-template>
            <ion-datetime
              id="startDate"
              presentation="date"
              [value]="dateFrom()"
              (ionChange)="onDateFromChange($event)"
            ></ion-datetime>
          </ng-template>
        </ion-modal>
        <ion-modal [keepContentsMounted]="true">
          <ng-template>
            <ion-datetime
              id="endDate"
              presentation="date"
              [value]="dateTo()"
              (ionChange)="onDateToChange($event)"
            ></ion-datetime>
          </ng-template>
        </ion-modal>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- Total Card -->
      <ion-card color="primary">
        <ion-card-content>
          <div class="total-count">
            <ion-icon name="trash-outline"></ion-icon>
            <span class="value">{{ totalCount() }}</span>
            <span class="unit">대</span>
          </div>
          <div class="total-label">총 회수량</div>
        </ion-card-content>
      </ion-card>

      @if (isLoading()) {
        <div class="center"><ion-spinner name="crescent"></ion-spinner></div>
      } @else {
        <!-- Category Stats -->
        <ion-card>
          <ion-card-header><ion-card-title>품목별 현황</ion-card-title></ion-card-header>
          <ion-card-content>
            <ion-list>
              @for (stat of wasteStats(); track stat.code) {
                <ion-item>
                  <ion-label>
                    <h3>{{ stat.code }}</h3>
                    <p>{{ stat.name }}</p>
                  </ion-label>
                  <ion-badge slot="end" [color]="getBadgeColor(stat.count)">
                    {{ stat.count }}대
                  </ion-badge>
                </ion-item>
              } @empty {
                <div class="empty">데이터가 없습니다</div>
              }
            </ion-list>
          </ion-card-content>
        </ion-card>

        <!-- Top 5 -->
        @if (topCategories().length > 0) {
          <ion-card>
            <ion-card-header><ion-card-title>TOP 5 품목</ion-card-title></ion-card-header>
            <ion-card-content>
              @for (stat of topCategories(); track stat.code; let i = $index) {
                <div class="rank-item">
                  <span class="rank">{{ i + 1 }}</span>
                  <span class="name">{{ stat.name }}</span>
                  <span class="count">{{ stat.count }}대</span>
                  <div class="bar" [style.width.%]="(stat.count / maxCount()) * 100"></div>
                </div>
              }
            </ion-card-content>
          </ion-card>
        }
      }
    </ion-content>
  `,
  styles: [
    `
      .date-range {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 8px;
      }
      .center {
        display: flex;
        justify-content: center;
        padding: 48px;
      }
      .total-count {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      .total-count ion-icon {
        font-size: 32px;
      }
      .total-count .value {
        font-size: 48px;
        font-weight: bold;
      }
      .total-count .unit {
        font-size: 18px;
      }
      .total-label {
        text-align: center;
        margin-top: 8px;
        opacity: 0.8;
      }
      .empty {
        text-align: center;
        padding: 24px;
        color: var(--ion-color-medium);
      }
      .rank-item {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
        position: relative;
      }
      .rank-item .rank {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: var(--ion-color-primary);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
      }
      .rank-item .name {
        flex: 1;
      }
      .rank-item .count {
        font-weight: 600;
      }
      .rank-item .bar {
        position: absolute;
        bottom: -4px;
        left: 36px;
        height: 3px;
        background: var(--ion-color-primary-tint);
        border-radius: 2px;
      }
      ion-card-title {
        font-size: 16px;
      }
    `,
  ],
})
export class WasteSummaryPage implements OnInit {
  private readonly reportsService = inject(ReportsService);
  private readonly authService = inject(AuthService);
  private readonly toastCtrl = inject(ToastController);
  private readonly translate = inject(TranslateService);

  protected readonly isLoading = signal(false);
  protected readonly dateFrom = signal(this.getDefaultDateFrom());
  protected readonly dateTo = signal(new Date().toISOString());
  protected readonly totalCount = signal(0);
  protected readonly wasteStats = signal<WasteStat[]>([]);

  protected readonly topCategories = computed(() =>
    [...this.wasteStats()].sort((a, b) => b.count - a.count).slice(0, 5),
  );

  protected readonly maxCount = computed(() =>
    Math.max(...this.wasteStats().map((s) => s.count), 1),
  );

  constructor() {
    addIcons({ downloadOutline, calendarOutline, trashOutline });
  }

  ngOnInit() {
    this.loadData();
  }

  private getDefaultDateFrom(): string {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString();
  }

  async loadData() {
    this.isLoading.set(true);
    const branchCode = this.authService.user()?.branchCode;

    try {
      this.reportsService
        .getWasteSummary({
          branchCode,
          dateFrom: this.dateFrom().split('T')[0],
          dateTo: this.dateTo().split('T')[0],
        })
        .subscribe({
          next: (data) => {
            this.totalCount.set(data.totalCount || 0);
            this.wasteStats.set(data.byCategory || []);
          },
          error: () => {
            this.totalCount.set(0);
            this.wasteStats.set([]);
          },
        });
    } finally {
      this.isLoading.set(false);
    }
  }

  onDateFromChange(event: CustomEvent) {
    this.dateFrom.set(event.detail.value);
    this.loadData();
  }

  onDateToChange(event: CustomEvent) {
    this.dateTo.set(event.detail.value);
    this.loadData();
  }

  async onRefresh(event: RefresherCustomEvent) {
    await this.loadData();
    event.target.complete();
  }

  getBadgeColor(count: number): string {
    if (count >= 50) return 'danger';
    if (count >= 20) return 'warning';
    return 'primary';
  }

  async exportData() {
    try {
      const headers = [
        this.translate.instant('WASTE.EXPORT.HEADERS.CODE'),
        this.translate.instant('WASTE.EXPORT.HEADERS.ITEM'),
        this.translate.instant('WASTE.EXPORT.HEADERS.QUANTITY'),
      ];
      const rows = this.wasteStats().map((s) => [s.code, s.name, String(s.count)]);
      const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');

      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `waste_summary_${this.dateFrom().split('T')[0]}_${this.dateTo().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      const toast = await this.toastCtrl.create({
        message: 'CSV 다운로드 완료',
        duration: 2000,
        color: 'success',
      });
      await toast.present();
    } catch {
      const toast = await this.toastCtrl.create({
        message: '다운로드 실패',
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    }
  }
}
