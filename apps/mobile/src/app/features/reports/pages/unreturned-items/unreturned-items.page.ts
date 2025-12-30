/**
 * Unreturned Items Page (미환입 현황)
 * Shows cancelled orders where items have not been returned
 *
 * Manual Reference: Slide 19 (2017.10.26 v0.9)
 * - Filter by: branch, date range, return status (returned/unreturned)
 * - Display: order info, customer info, cancellation date, return status
 */
import { Component, signal, computed, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonList, IonItem,
  IonLabel, IonBadge, IonSpinner, IonButton, IonIcon, IonSegment, IonSegmentButton,
  IonDatetimeButton, IonModal, IonDatetime, IonRefresher, IonRefresherContent,
  IonSearchbar, IonChip, IonNote, IonItemSliding, IonItemOptions, IonItemOption,
  ToastController, AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  downloadOutline, calendarOutline, returnDownBackOutline,
  checkmarkCircleOutline, closeCircleOutline, searchOutline,
  alertCircleOutline, refreshOutline
} from 'ionicons/icons';
import { ReportsService, UnreturnedItem, UnreturnedSummary } from '../../../../core/services/reports.service';
import { AuthService } from '../../../../core/services/auth.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

type ReturnStatusFilter = 'all' | 'unreturned' | 'returned';

@Component({
  selector: 'app-unreturned-items',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonList, IonItem,
    IonLabel, IonBadge, IonSpinner, IonButton, IonIcon, IonSegment, IonSegmentButton,
    IonDatetimeButton, IonModal, IonDatetime, IonRefresher, IonRefresherContent,
    IonSearchbar, IonChip, IonNote, IonItemSliding, IonItemOptions, IonItemOption,
    TranslateModule,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/reports"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ 'REPORTS.UNRETURNED_ITEMS.TITLE' | translate }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="exportData()" [disabled]="isLoading()">
            <ion-icon name="download-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>

      <!-- Date Range Filter -->
      <ion-toolbar>
        <div class="date-range">
          <ion-datetime-button datetime="startDate"></ion-datetime-button>
          <span class="date-separator">~</span>
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

      <!-- Status Filter -->
      <ion-toolbar>
        <ion-segment [value]="statusFilter()" (ionChange)="onStatusFilterChange($event)">
          <ion-segment-button value="all">
            <ion-label>전체</ion-label>
          </ion-segment-button>
          <ion-segment-button value="unreturned">
            <ion-label>미환입</ion-label>
          </ion-segment-button>
          <ion-segment-button value="returned">
            <ion-label>환입완료</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>

      <!-- Search -->
      <ion-toolbar>
        <ion-searchbar
          placeholder="주문번호, 고객명 검색"
          [value]="searchTerm()"
          (ionInput)="onSearch($event)"
          debounce="300"
        ></ion-searchbar>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- Summary Cards -->
      <div class="summary-grid">
        <ion-card class="summary-card" color="danger">
          <ion-card-content>
            <ion-icon name="alert-circle-outline"></ion-icon>
            <div class="summary-value">{{ summary().unreturnedCount }}</div>
            <div class="summary-label">미환입</div>
          </ion-card-content>
        </ion-card>
        <ion-card class="summary-card" color="success">
          <ion-card-content>
            <ion-icon name="checkmark-circle-outline"></ion-icon>
            <div class="summary-value">{{ summary().returnedCount }}</div>
            <div class="summary-label">환입완료</div>
          </ion-card-content>
        </ion-card>
        <ion-card class="summary-card" color="primary">
          <ion-card-content>
            <ion-icon name="return-down-back-outline"></ion-icon>
            <div class="summary-value">{{ summary().totalCount }}</div>
            <div class="summary-label">전체</div>
          </ion-card-content>
        </ion-card>
      </div>

      @if (isLoading()) {
        <div class="center">
          <ion-spinner name="crescent"></ion-spinner>
          <p>데이터 로딩 중...</p>
        </div>
      } @else {
        <!-- Items List -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>
              취소건 환입 현황
              <ion-badge [color]="statusFilter() === 'unreturned' ? 'danger' : 'medium'">
                {{ filteredItems().length }}건
              </ion-badge>
            </ion-card-title>
          </ion-card-header>
          <ion-card-content class="list-content">
            <ion-list>
              @for (item of filteredItems(); track item.orderId) {
                <ion-item-sliding>
                  <ion-item [button]="true" (click)="showItemDetail(item)">
                    <div class="item-content" slot="start">
                      <ion-icon
                        [name]="item.isReturned ? 'checkmark-circle-outline' : 'close-circle-outline'"
                        [color]="item.isReturned ? 'success' : 'danger'"
                      ></ion-icon>
                    </div>
                    <ion-label>
                      <h2>{{ item.orderNo }}</h2>
                      <h3>{{ item.customerName }}</h3>
                      <p>
                        <ion-note>취소일: {{ item.cancelledAt | date:'yyyy-MM-dd' }}</ion-note>
                      </p>
                      <p>
                        <ion-chip [color]="item.isReturned ? 'success' : 'danger'" size="small">
                          {{ item.isReturned ? ('REPORTS.UNRETURNED_ITEMS.RETURNED' | translate) : ('REPORTS.UNRETURNED_ITEMS.NOT_RETURNED' | translate) }}
                        </ion-chip>
                        @if (item.productName) {
                          <ion-chip color="medium" size="small">{{ item.productName }}</ion-chip>
                        }
                      </p>
                    </ion-label>
                    <ion-note slot="end">
                      @if (item.returnedAt) {
                        {{ item.returnedAt | date:'MM/dd' }}
                      } @else {
                        <span class="overdue" [class.critical]="isOverdue(item)">
                          {{ getDaysOverdue(item) }}일 경과
                        </span>
                      }
                    </ion-note>
                  </ion-item>

                  @if (!item.isReturned) {
                    <ion-item-options side="end">
                      <ion-item-option color="success" (click)="markAsReturned(item)">
                        <ion-icon slot="icon-only" name="checkmark-circle-outline"></ion-icon>
                      </ion-item-option>
                    </ion-item-options>
                  }
                </ion-item-sliding>
              } @empty {
                <div class="empty">
                  <ion-icon name="return-down-back-outline"></ion-icon>
                  <p>조회된 데이터가 없습니다</p>
                </div>
              }
            </ion-list>
          </ion-card-content>
        </ion-card>

        <!-- Branch Summary -->
        @if (branchSummary().length > 0) {
          <ion-card>
            <ion-card-header>
              <ion-card-title>센터별 미환입 현황</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              @for (branch of branchSummary(); track branch.branchCode) {
                <div class="branch-item">
                  <span class="branch-name">{{ branch.branchName }}</span>
                  <div class="branch-stats">
                    <ion-badge color="danger">미환입 {{ branch.unreturnedCount }}</ion-badge>
                    <ion-badge color="success">환입 {{ branch.returnedCount }}</ion-badge>
                  </div>
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      [style.width.%]="getReturnRate(branch)"
                    ></div>
                  </div>
                </div>
              }
            </ion-card-content>
          </ion-card>
        }
      }
    </ion-content>
  `,
  styles: [`
    .date-range {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 8px;
    }
    .date-separator { color: var(--ion-color-medium); }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 16px;
    }
    .summary-card {
      margin: 0;
    }
    .summary-card ion-card-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px 8px;
    }
    .summary-card ion-icon { font-size: 24px; margin-bottom: 4px; }
    .summary-card .summary-value { font-size: 24px; font-weight: bold; }
    .summary-card .summary-label { font-size: 12px; opacity: 0.8; }

    .center {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;
      color: var(--ion-color-medium);
    }
    .center p { margin-top: 16px; }

    .list-content { padding: 0; }
    .item-content {
      display: flex;
      align-items: center;
      margin-right: 12px;
    }
    .item-content ion-icon { font-size: 24px; }

    ion-card-title {
      font-size: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px 24px;
      color: var(--ion-color-medium);
    }
    .empty ion-icon { font-size: 48px; margin-bottom: 16px; }

    .overdue { color: var(--ion-color-warning); font-weight: 500; }
    .overdue.critical { color: var(--ion-color-danger); }

    .branch-item {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding: 12px 0;
      border-bottom: 1px solid var(--ion-color-light);
    }
    .branch-item:last-child { border-bottom: none; }
    .branch-name { flex: 1; font-weight: 500; min-width: 100px; }
    .branch-stats { display: flex; gap: 4px; }
    .progress-bar {
      width: 100%;
      height: 4px;
      background: var(--ion-color-light);
      border-radius: 2px;
      margin-top: 4px;
    }
    .progress-fill {
      height: 100%;
      background: var(--ion-color-success);
      border-radius: 2px;
      transition: width 0.3s ease;
    }

    ion-chip { --padding-start: 6px; --padding-end: 6px; height: 22px; font-size: 11px; }
  `],
})
export class UnreturnedItemsPage implements OnInit {
  private readonly reportsService = inject(ReportsService);
  private readonly authService = inject(AuthService);
  private readonly toastCtrl = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);
  private readonly translate = inject(TranslateService);

  // State signals
  protected readonly isLoading = signal(false);
  protected readonly dateFrom = signal(this.getDefaultDateFrom());
  protected readonly dateTo = signal(new Date().toISOString());
  protected readonly statusFilter = signal<ReturnStatusFilter>('all');
  protected readonly searchTerm = signal('');
  protected readonly items = signal<UnreturnedItem[]>([]);
  protected readonly summary = signal<UnreturnedSummary>({
    totalCount: 0,
    unreturnedCount: 0,
    returnedCount: 0,
  });
  protected readonly branchSummary = signal<{
    branchCode: string;
    branchName: string;
    unreturnedCount: number;
    returnedCount: number;
  }[]>([]);

  // Computed signals
  protected readonly filteredItems = computed(() => {
    let result = this.items();
    const filter = this.statusFilter();
    const search = this.searchTerm().toLowerCase();

    if (filter === 'unreturned') {
      result = result.filter(item => !item.isReturned);
    } else if (filter === 'returned') {
      result = result.filter(item => item.isReturned);
    }

    if (search) {
      result = result.filter(item =>
        item.orderNo.toLowerCase().includes(search) ||
        item.customerName.toLowerCase().includes(search)
      );
    }

    return result;
  });

  constructor() {
    addIcons({
      downloadOutline, calendarOutline, returnDownBackOutline,
      checkmarkCircleOutline, closeCircleOutline, searchOutline,
      alertCircleOutline, refreshOutline
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

  async loadData() {
    this.isLoading.set(true);
    const branchCode = this.authService.user()?.branchCode;

    try {
      this.reportsService.getUnreturnedItems({
        branchCode,
        dateFrom: this.dateFrom().split('T')[0],
        dateTo: this.dateTo().split('T')[0],
      }).subscribe({
        next: (data) => {
          this.items.set(data.items || []);
          this.summary.set({
            totalCount: data.totalCount || 0,
            unreturnedCount: data.unreturnedCount || 0,
            returnedCount: data.returnedCount || 0,
          });
          this.branchSummary.set(data.byBranch || []);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Failed to load unreturned items:', err);
          this.items.set([]);
          this.summary.set({ totalCount: 0, unreturnedCount: 0, returnedCount: 0 });
          this.isLoading.set(false);
        },
      });
    } catch {
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

  onStatusFilterChange(event: CustomEvent) {
    this.statusFilter.set(event.detail.value as ReturnStatusFilter);
  }

  onSearch(event: CustomEvent) {
    this.searchTerm.set(event.detail.value || '');
  }

  async onRefresh(event: any) {
    await this.loadData();
    event.target.complete();
  }

  getDaysOverdue(item: UnreturnedItem): number {
    const cancelDate = new Date(item.cancelledAt);
    const today = new Date();
    const diffTime = today.getTime() - cancelDate.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  isOverdue(item: UnreturnedItem): boolean {
    return this.getDaysOverdue(item) > 7;
  }

  getReturnRate(branch: { unreturnedCount: number; returnedCount: number }): number {
    const total = branch.unreturnedCount + branch.returnedCount;
    if (total === 0) return 0;
    return (branch.returnedCount / total) * 100;
  }

  async showItemDetail(item: UnreturnedItem) {
    const okBtn = await this.translate.get('COMMON.BUTTONS.OK').toPromise();
    const cancelBtn = await this.translate.get('COMMON.BUTTONS.CANCEL').toPromise();
    const markReturnBtn = await this.translate.get('COMMON.BUTTONS.MARK_RETURN').toPromise();
    const returnedText = await this.translate.get('REPORTS.UNRETURNED_ITEMS.RETURNED').toPromise();
    const notReturnedText = await this.translate.get('REPORTS.UNRETURNED_ITEMS.NOT_RETURNED').toPromise();
    
    const alert = await this.alertCtrl.create({
      header: item.orderNo,
      subHeader: item.customerName,
      message: `
        <p><strong>품목:</strong> ${item.productName || '-'}</p>
        <p><strong>취소일:</strong> ${new Date(item.cancelledAt).toLocaleDateString('ko-KR')}</p>
        <p><strong>취소사유:</strong> ${item.cancelReason || '-'}</p>
        <p><strong>환입상태:</strong> ${item.isReturned ? returnedText : notReturnedText}</p>
        ${item.returnedAt ? `<p><strong>환입일:</strong> ${new Date(item.returnedAt).toLocaleDateString('ko-KR')}</p>` : ''}
      `,
      buttons: item.isReturned
        ? [okBtn]
        : [
            { text: cancelBtn, role: 'cancel' },
            { text: markReturnBtn, handler: () => this.markAsReturned(item) }
          ],
    });
    await alert.present();
  }

  async markAsReturned(item: UnreturnedItem) {
    const cancelBtn = await this.translate.get('COMMON.BUTTONS.CANCEL').toPromise();
    const okBtn = await this.translate.get('COMMON.BUTTONS.OK').toPromise();
    
    const alert = await this.alertCtrl.create({
      header: '환입 처리',
      message: `${item.orderNo} 건을 환입 처리하시겠습니까?`,
      buttons: [
        { text: cancelBtn, role: 'cancel' },
        {
          text: okBtn,
          handler: async () => {
            try {
              await this.reportsService.markItemAsReturned(item.orderId).toPromise();
              const toast = await this.toastCtrl.create({
                message: '환입 처리 완료',
                duration: 2000,
                color: 'success',
              });
              await toast.present();
              this.loadData();
            } catch {
              const toast = await this.toastCtrl.create({
                message: '환입 처리 실패',
                duration: 2000,
                color: 'danger',
              });
              await toast.present();
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async exportData() {
    try {
      const headers = this.translate.instant('REPORTS.UNRETURNED_ITEMS.EXPORT_HEADERS');
      const rows = this.filteredItems().map(item => [
        item.orderNo,
        item.customerName,
        item.productName || '',
        new Date(item.cancelledAt).toLocaleDateString('ko-KR'),
        item.cancelReason || '',
        item.isReturned ? this.translate.instant('REPORTS.UNRETURNED_ITEMS.RETURNED') : this.translate.instant('REPORTS.UNRETURNED_ITEMS.NOT_RETURNED'),
        item.returnedAt ? new Date(item.returnedAt).toLocaleDateString('ko-KR') : '',
      ]);
      const csv = [headers, ...rows].map(r => r.join(',')).join('\n');

      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `unreturned_items_${this.dateFrom().split('T')[0]}_${this.dateTo().split('T')[0]}.csv`;
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
