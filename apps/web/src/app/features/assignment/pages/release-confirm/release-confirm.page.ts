// apps/web/src/app/features/assignment/pages/release-confirm/release-confirm.page.ts
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
  IonButton,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonCheckbox,
  IonBadge,
  IonSpinner,
  IonSearchbar,
  IonNote,
  IonChip,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  AlertController,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkCircleOutline, cubeOutline, printOutline } from 'ionicons/icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { OrdersStore } from '../../../../store/orders/orders.store';
import { OrderStatus } from '../../../../store/orders/orders.models';
import { ReportsStore } from '../../../../store/reports/reports.store';

@Component({
  selector: 'app-release-confirm',
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
    IonButton,
    IonIcon,
    IonList,
    IonItem,
    IonLabel,
    IonCheckbox,
    IonBadge,
    IonSpinner,
    IonSearchbar,
    IonNote,
    IonChip,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    TranslateModule,
  ],
  template: `
    <!-- 출고 확정 페이지 헤더 -->
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/assignment"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ 'ASSIGNMENT.RELEASE.TITLE' | translate }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="printSummary()">
            <ion-icon name="print-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar
          [debounce]="300"
          [placeholder]="'ASSIGNMENT.SEARCH_PLACEHOLDER' | translate"
          (ionInput)="onSearch($event)"
        ></ion-searchbar>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- 출고 확정 대상 요약 카드 -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ 'ASSIGNMENT.RELEASE.TARGET_TITLE' | translate }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div class="summary-row">
            <span>{{ 'ASSIGNMENT.RELEASE.TOTAL_ITEMS' | translate }}:</span>
            <strong>{{ items().length }}{{ 'ASSIGNMENT.RELEASE.ITEMS_SUFFIX' | translate }}</strong>
          </div>
          <div class="summary-row">
            <span>{{ 'ASSIGNMENT.RELEASE.SELECTED_ITEMS' | translate }}:</span>
            <strong
              >{{ selectedCount() }}{{ 'ASSIGNMENT.RELEASE.ITEMS_SUFFIX' | translate }}</strong
            >
          </div>
        </ion-card-content>
      </ion-card>

      <!-- 전체 선택 체크박스 -->
      <ion-item>
        <ion-checkbox
          slot="start"
          [checked]="isAllSelected()"
          [indeterminate]="isIndeterminate()"
          (ionChange)="toggleSelectAll($event)"
        ></ion-checkbox>
        <ion-label>{{ 'ASSIGNMENT.RELEASE.SELECT_ALL' | translate }}</ion-label>
      </ion-item>

      @if (isLoading()) {
        <!-- 로딩 상태 -->
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
          <p>{{ 'ASSIGNMENT.RELEASE.LOADING' | translate }}</p>
        </div>
      } @else {
        <ion-list>
          @for (order of items(); track order.id) {
            <ion-item>
              <ion-checkbox
                slot="start"
                [checked]="isSelected(order.id)"
                (ionChange)="toggleSelection(order.id)"
              ></ion-checkbox>
              <ion-label>
                <h2>{{ order.orderNo }}</h2>
                <h3>{{ order.customerName }}</h3>
                <p>
                  <ion-icon name="cube-outline"></ion-icon>
                  {{
                    'ASSIGNMENT.RELEASE.PRODUCTS_COUNT'
                      | translate: { count: order.lines?.length || 0 }
                  }}
                  | {{ order.installerName || ('ASSIGNMENT.DETAIL.NOT_ASSIGNED' | translate) }}
                </p>
                <ion-note>{{ order.appointmentDate || '-' }}</ion-note>
              </ion-label>
            </ion-item>
          } @empty {
            <!-- 빈 상태 -->
            <div class="empty-state">
              <ion-icon name="checkmark-circle-outline"></ion-icon>
              <p>{{ 'ASSIGNMENT.RELEASE.NO_TARGET' | translate }}</p>
            </div>
          }
        </ion-list>
      }

      <!-- 출고 확정 버튼 -->
      @if (selectedCount() > 0) {
        <div class="confirm-button">
          <ion-button (click)="confirmRelease()">
            <ion-icon name="checkmark-circle-outline" slot="start"></ion-icon>
            {{ 'ASSIGNMENT.RELEASE.CONFIRM_BTN' | translate: { count: selectedCount() } }}
          </ion-button>
        </div>
      }
    </ion-content>
  `,
  styles: [
    `
      .summary-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid var(--ion-color-light);

        &:last-child {
          border-bottom: none;
        }
      }

      .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 40vh;
        color: var(--ion-color-medium);
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 16px;
        color: var(--ion-color-medium);

        ion-icon {
          font-size: 64px;
          margin-bottom: 16px;
        }
      }

      ion-item {
        h2 {
          font-weight: 600;
        }

        p {
          display: flex;
          align-items: center;
          gap: 4px;
          color: var(--ion-color-medium);

          ion-icon {
            font-size: 14px;
          }
        }
      }

      .confirm-button {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 16px;
        background: var(--ion-background-color);
        box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
        display: flex;
        flex-wrap: wrap;
        gap: 12px;

        ion-button {
          flex: 1 1 auto;
          min-width: 160px;
          max-width: 280px;
        }

        @media (max-width: 767px) {
          flex-direction: column;

          ion-button {
            max-width: 100%;
          }
        }
      }
    `,
  ],
})
export class ReleaseConfirmPage implements OnInit {
  /** @description 주문 스토어 */
  private readonly ordersStore = inject(OrdersStore);
  /** @description 리포트 스토어 */
  private readonly reportsStore = inject(ReportsStore);
  /** @description 알림창 컨트롤러 */
  private readonly alertCtrl = inject(AlertController);
  /** @description 토스트 컨트롤러 */
  private readonly toastCtrl = inject(ToastController);
  /** @description 다국어 번역 서비스 */
  private readonly translateService = inject(TranslateService);

  /** @description 로딩 상태 */
  protected readonly isLoading = signal(false);
  /** @description 검색어 */
  protected readonly searchQuery = signal('');
  /** @description 선택된 주문 ID 집합 */
  protected readonly selectedIds = signal<Set<string>>(new Set());

  /**
   * @description 확정 상태(CONFIRMED)인 주문 목록 (출고 대기)
   */
  protected readonly confirmedOrders = computed(() => {
    return this.ordersStore.orders().filter((o) => o.status === OrderStatus.CONFIRMED);
  });

  /**
   * @description 검색어로 필터링된 주문 목록
   */
  protected readonly items = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const orders = this.confirmedOrders();

    if (!query) return orders;

    return orders.filter(
      (o) =>
        o.orderNo?.toLowerCase().includes(query) ||
        o.customerName?.toLowerCase().includes(query) ||
        o.installerName?.toLowerCase().includes(query),
    );
  });

  /** @description 선택된 항목 수 */
  protected readonly selectedCount = computed(() => this.selectedIds().size);

  constructor() {
    addIcons({
      checkmarkCircleOutline,
      cubeOutline,
      printOutline,
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  async loadData(): Promise<void> {
    this.isLoading.set(true);
    try {
      // Load orders with CONFIRMED status
      await this.ordersStore.loadOrders(undefined, 1, 100);
    } finally {
      this.isLoading.set(false);
    }
  }

  onSearch(event: CustomEvent): void {
    const query = event.detail.value || '';
    this.searchQuery.set(query);
  }

  isAllSelected(): boolean {
    const allItems = this.items();
    return allItems.length > 0 && allItems.every((item) => this.selectedIds().has(item.id));
  }

  isIndeterminate(): boolean {
    const allItems = this.items();
    const selectedCount = allItems.filter((item) => this.selectedIds().has(item.id)).length;
    return selectedCount > 0 && selectedCount < allItems.length;
  }

  isSelected(orderId: string): boolean {
    return this.selectedIds().has(orderId);
  }

  toggleSelectAll(event: CustomEvent): void {
    const checked = event.detail.checked;
    if (checked) {
      this.selectedIds.set(new Set(this.items().map((item) => item.id)));
    } else {
      this.selectedIds.set(new Set());
    }
  }

  toggleSelection(orderId: string): void {
    this.selectedIds.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  }

  /**
   * @description 출고요청집계표 인쇄 (PDF 다운로드)
   */
  async printSummary(): Promise<void> {
    try {
      // Export release summary as PDF
      const blob = await this.reportsStore.exportData({
        type: 'release',
        format: 'pdf',
        status: [OrderStatus.CONFIRMED],
      });

      this.reportsStore.downloadFile(
        blob,
        `${this.translateService.instant('ASSIGNMENT.RELEASE.PRINT_SUMMARY')}_${new Date().toISOString().split('T')[0]}.pdf`,
      );

      const toast = await this.toastCtrl.create({
        message: this.translateService.instant('ASSIGNMENT.RELEASE.PRINT_SUCCESS'),
        duration: 2000,
        color: 'success',
      });
      await toast.present();
    } catch (error) {
      const toast = await this.toastCtrl.create({
        message: this.translateService.instant('ASSIGNMENT.RELEASE.PRINT_FAILED'),
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    }
  }

  /**
   * @description 선택된 주문들 출고 확정
   */
  async confirmRelease(): Promise<void> {
    const selectedOrderIds = Array.from(this.selectedIds());

    const alert = await this.alertCtrl.create({
      header: this.translateService.instant('ASSIGNMENT.RELEASE.CONFIRM_HEADER'),
      message: this.translateService.instant('ASSIGNMENT.RELEASE.CONFIRM_MESSAGE', {
        count: selectedOrderIds.length,
      }),
      buttons: [
        { text: this.translateService.instant('COMMON.CANCEL'), role: 'cancel' },
        {
          text: this.translateService.instant('COMMON.CONFIRM'),
          handler: async () => {
            try {
              // Update each order status to RELEASED
              let successCount = 0;
              let failCount = 0;

              for (const orderId of selectedOrderIds) {
                try {
                  await this.ordersStore.updateOrderStatus(orderId, OrderStatus.RELEASED);
                  successCount++;
                } catch {
                  failCount++;
                }
              }

              // Clear selections
              this.selectedIds.set(new Set());

              const message =
                failCount > 0
                  ? this.translateService.instant('ASSIGNMENT.RELEASE.PARTIAL_SUCCESS', {
                      successCount,
                      failCount,
                    })
                  : this.translateService.instant('ASSIGNMENT.RELEASE.SUCCESS_MESSAGE', {
                      successCount,
                    });

              const toast = await this.toastCtrl.create({
                message,
                duration: 2000,
                color: failCount > 0 ? 'warning' : 'success',
              });
              await toast.present();
            } catch (error) {
              const toast = await this.toastCtrl.create({
                message: this.translateService.instant('ASSIGNMENT.RELEASE.ERROR'),
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
}
