/**
 * Release Confirm Page
 * Confirms release of assigned orders for delivery
 */
import { Component, signal, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
  IonSpinner,
  IonSearchbar,
  IonNote,
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
import { InstallersStore } from '../../../../store/installers/installers.store';
import { UIStore } from '../../../../store/ui/ui.store';
import { Order, OrderStatus } from '../../../../store/orders/orders.models';
import { TranslateModule } from '@ngx-translate/core';

interface ReleaseItem {
  id: string;
  orderNumber: string;
  customerName: string;
  installerName: string;
  productCount: number;
  appointmentDate: string;
  selected: boolean;
}

@Component({
  selector: 'app-release-confirm',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
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
    IonSpinner,
    IonSearchbar,
    IonNote,
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
          @for (item of items(); track item.id) {
            <ion-item>
              <ion-checkbox
                slot="start"
                [(ngModel)]="item.selected"
                (ionChange)="onSelectionChange()"
              ></ion-checkbox>
              <ion-label>
                <h2>{{ item.orderNumber }}</h2>
                <h3>{{ item.customerName }}</h3>
                <p>
                  <ion-icon name="cube-outline"></ion-icon>
                  {{ item.productCount }}개 제품 | {{ item.installerName }}
                </p>
                <ion-note>{{ item.appointmentDate }}</ion-note>
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
  private readonly router = inject(Router);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);

  readonly ordersStore = inject(OrdersStore);
  readonly installersStore = inject(InstallersStore);
  private readonly uiStore = inject(UIStore);

  protected readonly isLoading = signal(false);
  protected readonly items = signal<ReleaseItem[]>([]);
  protected readonly selectedCount = signal(0);
  private searchQuery = '';

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

  /**
   * Load confirmed orders ready for release
   */
  async loadData(): Promise<void> {
    this.isLoading.set(true);

    try {
      // Load orders and installers in parallel
      await Promise.all([
        this.ordersStore.loadOrders(),
        this.installersStore.loadInstallers(),
      ]);

      // Filter confirmed orders and map to UI model
      this.updateItemsList();
    } catch (error) {
      this.uiStore.showToast('데이터 로드 실패', 'danger');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Update items list from store with filters
   */
  private updateItemsList(): void {
    const allOrders = this.ordersStore.orders();
    const installers = this.installersStore.installers();

    // Filter orders that are CONFIRMED (ready for release)
    const confirmedOrders = allOrders.filter(o => o.status === OrderStatus.CONFIRMED);

    // Apply search filter
    let filtered = confirmedOrders;
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = confirmedOrders.filter(o =>
        o.orderNo.toLowerCase().includes(query) ||
        o.customerName.toLowerCase().includes(query) ||
        (o.installerName && o.installerName.toLowerCase().includes(query))
      );
    }

    // Map to UI model
    const uiItems: ReleaseItem[] = filtered.map(o => {
      // Find installer name if not available on order
      const installerName = o.installerName ||
        installers.find(i => i.id === o.installerId)?.name || '';

      return {
        id: o.id,
        orderNumber: o.orderNo,
        customerName: o.customerName,
        installerName,
        productCount: (o.lines || o.orderLines || []).length,
        appointmentDate: o.appointmentDate || '',
        selected: this.items().find(existing => existing.id === o.id)?.selected || false,
      };
    });

    this.items.set(uiItems);
    this.updateSelectedCount();
  }

  /**
   * Search handler
   */
  onSearch(event: CustomEvent): void {
    this.searchQuery = event.detail.value || '';
    this.updateItemsList();
  }

  /**
   * Check if all items are selected
   */
  isAllSelected(): boolean {
    const allItems = this.items();
    return allItems.length > 0 && allItems.every(item => item.selected);
  }

  /**
   * Check if selection is indeterminate
   */
  isIndeterminate(): boolean {
    const allItems = this.items();
    const selectedItems = allItems.filter(item => item.selected);
    return selectedItems.length > 0 && selectedItems.length < allItems.length;
  }

  /**
   * Toggle select all
   */
  toggleSelectAll(event: CustomEvent): void {
    const checked = event.detail.checked;
    this.items.update(items =>
      items.map(item => ({ ...item, selected: checked }))
    );
    this.updateSelectedCount();
  }

  /**
   * Handle selection change
   */
  onSelectionChange(): void {
    this.updateSelectedCount();
  }

  /**
   * Update selected count
   */
  updateSelectedCount(): void {
    this.selectedCount.set(
      this.items().filter(item => item.selected).length
    );
  }

  /**
   * Print release summary report using blob URL for security
   */
  printSummary(): void {
    const selectedItems = this.items().filter(item => item.selected);
    if (selectedItems.length === 0) {
      this.uiStore.showToast('인쇄할 항목을 선택해주세요', 'warning');
      return;
    }

    // Generate print content and create blob URL
    const printContent = this.generatePrintContent(selectedItems);
    const blob = new Blob([printContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
        URL.revokeObjectURL(url);
      };
    }
  }

  /**
   * Generate printable HTML content for release summary
   */
  private generatePrintContent(items: ReleaseItem[]): string {
    const today = new Date().toLocaleDateString('ko-KR');
    const rows = items.map(item =>
      `<tr>
        <td>${this.escapeHtml(item.orderNumber)}</td>
        <td>${this.escapeHtml(item.customerName)}</td>
        <td>${this.escapeHtml(item.installerName)}</td>
        <td>${item.productCount}개</td>
        <td>${this.escapeHtml(item.appointmentDate)}</td>
      </tr>`
    ).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <title>출고요청집계표</title>
  <style>
    body { font-family: 'Malgun Gothic', sans-serif; padding: 20px; }
    h1 { text-align: center; margin-bottom: 20px; }
    .info { margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #333; padding: 8px; text-align: left; }
    th { background-color: #f0f0f0; }
    .footer { margin-top: 20px; text-align: right; }
  </style>
</head>
<body>
  <h1>출고요청집계표</h1>
  <div class="info">
    <p>출력일: ${today}</p>
    <p>총 ${items.length}건</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>주문번호</th>
        <th>고객명</th>
        <th>설치기사</th>
        <th>제품수</th>
        <th>방문예정일</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <div class="footer">
    <p>Logistics ERP System</p>
  </div>
</body>
</html>`;
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Confirm release for selected orders
   */
  async confirmRelease(): Promise<void> {
    const selectedItems = this.items().filter(item => item.selected);
    if (selectedItems.length === 0) {
      this.uiStore.showToast('출고 확정할 주문을 선택해주세요', 'warning');
      return;
    }

    const alert = await this.alertCtrl.create({
      header: '출고 확정',
      message: `${selectedItems.length}건을 출고 확정하시겠습니까?`,
      buttons: [
        { text: '취소', role: 'cancel' },
        {
          text: '확정',
          handler: async () => {
            await this.performReleaseConfirm(selectedItems);
          },
        },
      ],
    });
    await alert.present();
  }

  /**
   * Perform the actual release confirmation
   */
  private async performReleaseConfirm(selectedItems: ReleaseItem[]): Promise<void> {
    this.isLoading.set(true);

    try {
      // Update each order status to RELEASED
      for (const item of selectedItems) {
        await this.ordersStore.updateOrderStatus(item.id, OrderStatus.RELEASED);
      }

      const toast = await this.toastCtrl.create({
        message: `${selectedItems.length}건 출고 확정 완료`,
        duration: 2000,
        color: 'success',
      });
      await toast.present();

      // Refresh the list
      this.updateItemsList();

      // If all items are released, navigate back
      if (this.items().length === 0) {
        this.router.navigate(['/tabs/assignment']);
      }
    } catch (error) {
      this.uiStore.showToast('출고 확정 실패', 'danger');
    } finally {
      this.isLoading.set(false);
    }
  }
}
