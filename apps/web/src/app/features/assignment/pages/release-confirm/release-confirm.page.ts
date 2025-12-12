// apps/web/src/app/features/assignment/pages/release-confirm/release-confirm.page.ts
import { Component, signal, computed, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
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
import {
  checkmarkCircleOutline,
  cubeOutline,
  printOutline,
} from 'ionicons/icons';
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
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/assignment"></ion-back-button>
        </ion-buttons>
        <ion-title>출고 확정</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="printSummary()">
            <ion-icon name="print-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar
          [debounce]="300"
          placeholder="주문번호, 고객명 검색..."
          (ionInput)="onSearch($event)"
        ></ion-searchbar>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Summary Card -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>출고 확정 대상</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div class="summary-row">
            <span>전체 항목:</span>
            <strong>{{ items().length }}건</strong>
          </div>
          <div class="summary-row">
            <span>선택된 항목:</span>
            <strong>{{ selectedCount() }}건</strong>
          </div>
        </ion-card-content>
      </ion-card>

      <!-- Select All -->
      <ion-item>
        <ion-checkbox
          slot="start"
          [checked]="isAllSelected()"
          [indeterminate]="isIndeterminate()"
          (ionChange)="toggleSelectAll($event)"
        ></ion-checkbox>
        <ion-label>전체 선택</ion-label>
      </ion-item>

      @if (isLoading()) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
          <p>데이터 로딩 중...</p>
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
                <h2>{{ order.erpOrderNumber }}</h2>
                <h3>{{ order.customerName }}</h3>
                <p>
                  <ion-icon name="cube-outline"></ion-icon>
                  {{ order.lines?.length || 0 }}개 제품 | {{ order.installerName || '미배정' }}
                </p>
                <ion-note>{{ order.appointmentDate || '-' }}</ion-note>
              </ion-label>
            </ion-item>
          } @empty {
            <div class="empty-state">
              <ion-icon name="checkmark-circle-outline"></ion-icon>
              <p>출고 확정 대상이 없습니다.</p>
            </div>
          }
        </ion-list>
      }

      <!-- Confirm Button -->
      @if (selectedCount() > 0) {
        <div class="confirm-button">
          <ion-button expand="block" (click)="confirmRelease()">
            <ion-icon name="checkmark-circle-outline" slot="start"></ion-icon>
            {{ selectedCount() }}건 출고 확정
          </ion-button>
        </div>
      }
    </ion-content>
  `,
  styles: [`
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
    }
  `],
})
export class ReleaseConfirmPage implements OnInit {
  private readonly ordersStore = inject(OrdersStore);
  private readonly reportsStore = inject(ReportsStore);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);

  protected readonly isLoading = signal(false);
  protected readonly searchQuery = signal('');
  protected readonly selectedIds = signal<Set<string>>(new Set());

  // Get confirmed orders that are ready for release
  protected readonly confirmedOrders = computed(() => {
    return this.ordersStore.orders().filter(o => o.status === OrderStatus.CONFIRMED);
  });

  // Filter by search query
  protected readonly items = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const orders = this.confirmedOrders();
    
    if (!query) return orders;
    
    return orders.filter(o =>
      o.erpOrderNumber?.toLowerCase().includes(query) ||
      o.customerName?.toLowerCase().includes(query) ||
      o.installerName?.toLowerCase().includes(query)
    );
  });

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
    return allItems.length > 0 && allItems.every(item => this.selectedIds().has(item.id));
  }

  isIndeterminate(): boolean {
    const allItems = this.items();
    const selectedCount = allItems.filter(item => this.selectedIds().has(item.id)).length;
    return selectedCount > 0 && selectedCount < allItems.length;
  }

  isSelected(orderId: string): boolean {
    return this.selectedIds().has(orderId);
  }

  toggleSelectAll(event: CustomEvent): void {
    const checked = event.detail.checked;
    if (checked) {
      this.selectedIds.set(new Set(this.items().map(item => item.id)));
    } else {
      this.selectedIds.set(new Set());
    }
  }

  toggleSelection(orderId: string): void {
    this.selectedIds.update(set => {
      const newSet = new Set(set);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  }

  async printSummary(): Promise<void> {
    try {
      // Export release summary as PDF
      const blob = await this.reportsStore.exportData({
        type: 'release',
        format: 'pdf',
        status: [OrderStatus.CONFIRMED],
      });
      
      this.reportsStore.downloadFile(blob, `출고요청집계표_${new Date().toISOString().split('T')[0]}.pdf`);
      
      const toast = await this.toastCtrl.create({
        message: '출고요청집계표가 다운로드되었습니다.',
        duration: 2000,
        color: 'success',
      });
      await toast.present();
    } catch (error) {
      const toast = await this.toastCtrl.create({
        message: '인쇄 파일 생성에 실패했습니다.',
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    }
  }

  async confirmRelease(): Promise<void> {
    const selectedOrderIds = Array.from(this.selectedIds());
    
    const alert = await this.alertCtrl.create({
      header: '출고 확정',
      message: `${selectedOrderIds.length}건을 출고 확정하시겠습니까?`,
      buttons: [
        { text: '취소', role: 'cancel' },
        {
          text: '확정',
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

              const message = failCount > 0 
                ? `${successCount}건 성공, ${failCount}건 실패`
                : `${successCount}건 출고 확정 완료`;

              const toast = await this.toastCtrl.create({
                message,
                duration: 2000,
                color: failCount > 0 ? 'warning' : 'success',
              });
              await toast.present();
            } catch (error) {
              const toast = await this.toastCtrl.create({
                message: '출고 확정 처리 중 오류가 발생했습니다.',
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
