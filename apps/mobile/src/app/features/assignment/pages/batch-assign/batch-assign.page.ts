/**
 * Batch Assign Page
 * Allows batch assignment of multiple orders to a single installer
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
  IonSelect,
  IonSelectOption,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonDatetime,
  IonDatetimeButton,
  IonModal,
  AlertController,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  peopleOutline,
  calendarOutline,
  checkmarkCircleOutline,
} from 'ionicons/icons';

import { OrdersStore } from '../../../../store/orders/orders.store';
import { InstallersStore } from '../../../../store/installers/installers.store';
import { UIStore } from '../../../../store/ui/ui.store';
import { Order, OrderStatus } from '../../../../store/orders/orders.models';

interface UnassignedOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  appointmentDate: string;
  productCount: number;
  selected: boolean;
}

@Component({
  selector: 'app-batch-assign',
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
    IonSpinner,
    IonSearchbar,
    IonSelect,
    IonSelectOption,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/assignment"></ion-back-button>
        </ion-buttons>
        <ion-title>일괄 배정</ion-title>
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
      <!-- Installer Selection -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            <ion-icon name="people-outline"></ion-icon>
            설치기사 선택
          </ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-select
            placeholder="설치기사를 선택하세요"
            [(ngModel)]="selectedInstallerId"
            interface="action-sheet"
          >
            @for (installer of installers(); track installer.id) {
              <ion-select-option [value]="installer.id">
                {{ installer.name }} ({{ installer.assignedOrderCount ?? 0 }}건 배정)
              </ion-select-option>
            }
          </ion-select>
        </ion-card-content>
      </ion-card>

      <!-- Date Selection -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            <ion-icon name="calendar-outline"></ion-icon>
            배정 날짜
          </ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-datetime-button datetime="datetime"></ion-datetime-button>
          <ion-modal [keepContentsMounted]="true">
            <ng-template>
              <ion-datetime
                id="datetime"
                presentation="date"
                [(ngModel)]="selectedDate"
                [min]="minDate"
                [max]="maxDate"
              ></ion-datetime>
            </ng-template>
          </ion-modal>
        </ion-card-content>
      </ion-card>

      <!-- Order Selection -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>미배정 주문 선택</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div class="summary-row">
            <span>미배정 주문:</span>
            <strong>{{ orders().length }}건</strong>
          </div>
          <div class="summary-row">
            <span>선택된 주문:</span>
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
        </div>
      } @else {
        <ion-list>
          @for (order of orders(); track order.id) {
            <ion-item>
              <ion-checkbox
                slot="start"
                [(ngModel)]="order.selected"
                (ionChange)="onSelectionChange()"
              ></ion-checkbox>
              <ion-label>
                <h2>{{ order.orderNumber }}</h2>
                <h3>{{ order.customerName }}</h3>
                <p>{{ order.appointmentDate }} | {{ order.productCount }}개 제품</p>
              </ion-label>
            </ion-item>
          } @empty {
            <div class="empty-state">
              <p>미배정 주문이 없습니다.</p>
            </div>
          }
        </ion-list>
      }

      <!-- Assign Button -->
      @if (selectedCount() > 0 && selectedInstallerId) {
        <div class="confirm-button">
          <ion-button expand="block" (click)="batchAssign()">
            <ion-icon name="checkmark-circle-outline" slot="start"></ion-icon>
            {{ selectedCount() }}건 배정
          </ion-button>
        </div>
      }
    </ion-content>
  `,
  styles: [`
    ion-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }

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
      justify-content: center;
      padding: 24px;
    }

    .empty-state {
      text-align: center;
      padding: 24px;
      color: var(--ion-color-medium);
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
export class BatchAssignPage implements OnInit {
  private readonly router = inject(Router);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);

  readonly ordersStore = inject(OrdersStore);
  readonly installersStore = inject(InstallersStore);
  private readonly uiStore = inject(UIStore);

  protected readonly isLoading = signal(false);
  protected readonly orders = signal<UnassignedOrder[]>([]);
  protected readonly selectedCount = signal(0);
  private searchQuery = '';

  // Use installers from store
  protected readonly installers = this.installersStore.activeInstallers;

  selectedInstallerId: string | null = null;
  selectedDate: string = new Date().toISOString();
  minDate: string = new Date().toISOString();
  maxDate: string = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

  constructor() {
    addIcons({
      peopleOutline,
      calendarOutline,
      checkmarkCircleOutline,
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  /**
   * Load unassigned orders and installers
   */
  async loadData(): Promise<void> {
    this.isLoading.set(true);

    try {
      // Load orders and installers in parallel
      await Promise.all([
        this.ordersStore.loadOrders(),
        this.installersStore.loadInstallers(),
      ]);

      // Filter unassigned orders and map to UI model
      this.updateOrdersList();
    } catch (error) {
      this.uiStore.showToast('데이터 로드 실패', 'danger');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Update orders list from store with filters
   */
  private updateOrdersList(): void {
    const allOrders = this.ordersStore.orders();
    const unassigned = allOrders.filter(o => o.status === OrderStatus.UNASSIGNED);

    // Apply search filter
    let filtered = unassigned;
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = unassigned.filter(o =>
        o.erpOrderNumber.toLowerCase().includes(query) ||
        o.customerName.toLowerCase().includes(query)
      );
    }

    // Map to UI model
    const uiOrders: UnassignedOrder[] = filtered.map(o => ({
      id: o.id,
      orderNumber: o.erpOrderNumber,
      customerName: o.customerName,
      appointmentDate: o.appointmentDate || '',
      productCount: (o.lines || o.orderLines || []).length,
      selected: this.orders().find(existing => existing.id === o.id)?.selected || false,
    }));

    this.orders.set(uiOrders);
    this.updateSelectedCount();
  }

  /**
   * Search handler
   */
  onSearch(event: CustomEvent): void {
    this.searchQuery = event.detail.value || '';
    this.updateOrdersList();
  }

  /**
   * Check if all orders are selected
   */
  isAllSelected(): boolean {
    const allOrders = this.orders();
    return allOrders.length > 0 && allOrders.every(o => o.selected);
  }

  /**
   * Check if selection is indeterminate
   */
  isIndeterminate(): boolean {
    const allOrders = this.orders();
    const selectedOrders = allOrders.filter(o => o.selected);
    return selectedOrders.length > 0 && selectedOrders.length < allOrders.length;
  }

  /**
   * Toggle select all
   */
  toggleSelectAll(event: CustomEvent): void {
    const checked = event.detail.checked;
    this.orders.update(orders =>
      orders.map(order => ({ ...order, selected: checked }))
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
      this.orders().filter(o => o.selected).length
    );
  }

  /**
   * Batch assign selected orders to installer
   */
  async batchAssign(): Promise<void> {
    if (!this.selectedInstallerId) {
      this.uiStore.showToast('설치기사를 선택해주세요', 'warning');
      return;
    }

    const selectedOrders = this.orders().filter(o => o.selected);
    if (selectedOrders.length === 0) {
      this.uiStore.showToast('배정할 주문을 선택해주세요', 'warning');
      return;
    }

    const installerName = this.installers().find(i => i.id === this.selectedInstallerId)?.name || '';
    const appointmentDate = this.selectedDate.split('T')[0];

    const alert = await this.alertCtrl.create({
      header: '일괄 배정',
      message: `${selectedOrders.length}건을 ${installerName}에게 배정하시겠습니까?`,
      buttons: [
        { text: '취소', role: 'cancel' },
        {
          text: '배정',
          handler: async () => {
            await this.performBatchAssign(selectedOrders, appointmentDate);
          },
        },
      ],
    });
    await alert.present();
  }

  /**
   * Perform the actual batch assignment
   */
  private async performBatchAssign(
    selectedOrders: UnassignedOrder[],
    appointmentDate: string
  ): Promise<void> {
    this.isLoading.set(true);

    try {
      // Assign each order
      for (const order of selectedOrders) {
        await this.ordersStore.assignOrder(
          order.id,
          this.selectedInstallerId!,
          appointmentDate
        );
      }

      const toast = await this.toastCtrl.create({
        message: `${selectedOrders.length}건 배정 완료`,
        duration: 2000,
        color: 'success',
      });
      await toast.present();

      // Navigate back to assignment list
      this.router.navigate(['/tabs/assignment']);
    } catch (error) {
      this.uiStore.showToast('배정 실패', 'danger');
    } finally {
      this.isLoading.set(false);
    }
  }
}
