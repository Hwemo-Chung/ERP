// apps/web/src/app/features/assignment/pages/batch-assign/batch-assign.page.ts
import { Component, signal, inject, ChangeDetectionStrategy, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { firstValueFrom } from 'rxjs';
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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BulkOperationService } from '@app/shared/services/bulk-operation.service';
import { BulkOperationResult } from '@app/shared/components/bulk-operation-result/bulk-operation-result.component';
import { OrdersStore } from '../../../../store/orders/orders.store';
import { OrderStatus, Order } from '../../../../store/orders/orders.models';

interface UnassignedOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  appointmentDate: string;
  productCount: number;
  selected: boolean;
}

interface Installer {
  id: string;
  name: string;
  assignedCount: number;
  capacity: number;
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
    IonBadge,
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
    TranslateModule,
  ],
  template: `
    <!-- 일괄 배정 페이지 헤더 -->
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/assignment"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ 'ASSIGNMENT.BATCH_ASSIGN.TITLE' | translate }}</ion-title>
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
      <!-- 설치기사 선택 카드 -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            <ion-icon name="people-outline"></ion-icon>
            {{ 'ASSIGNMENT.BATCH_ASSIGN.INSTALLER_SELECT_TITLE' | translate }}
          </ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-select
            [placeholder]="'ASSIGNMENT.BATCH_ASSIGN.INSTALLER_PLACEHOLDER' | translate"
            [(ngModel)]="selectedInstallerId"
            interface="action-sheet"
          >
            @for (installer of installers(); track installer.id) {
              <ion-select-option [value]="installer.id">
                {{ installer.name }} ({{ installer.assignedCount }}/{{ installer.capacity }})
              </ion-select-option>
            }
          </ion-select>
        </ion-card-content>
      </ion-card>

      <!-- 배정 날짜 선택 카드 -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            <ion-icon name="calendar-outline"></ion-icon>
            {{ 'ASSIGNMENT.BATCH_ASSIGN.DATE_TITLE' | translate }}
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

      <!-- 미배정 주문 선택 카드 -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ 'ASSIGNMENT.BATCH_ASSIGN.UNASSIGNED_SELECT_TITLE' | translate }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div class="summary-row">
            <span>{{ 'ASSIGNMENT.BATCH_ASSIGN.UNASSIGNED_COUNT' | translate }}:</span>
            <strong>{{ orders().length }}{{ 'ASSIGNMENT.BATCH_ASSIGN.ITEMS_SUFFIX' | translate }}</strong>
          </div>
          <div class="summary-row">
            <span>{{ 'ASSIGNMENT.BATCH_ASSIGN.SELECTED_COUNT' | translate }}:</span>
            <strong>{{ selectedCount() }}{{ 'ASSIGNMENT.BATCH_ASSIGN.ITEMS_SUFFIX' | translate }}</strong>
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
        <ion-label>{{ 'ASSIGNMENT.BATCH_ASSIGN.SELECT_ALL' | translate }}</ion-label>
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
                <p>{{ order.appointmentDate }} | {{ order.productCount }}{{ 'ASSIGNMENT.BATCH_ASSIGN.PRODUCTS_SUFFIX' | translate }}</p>
              </ion-label>
            </ion-item>
          } @empty {
            <!-- 미배정 주문 없음 상태 -->
            <div class="empty-state">
              <p>{{ 'ASSIGNMENT.BATCH_ASSIGN.NO_UNASSIGNED' | translate }}</p>
            </div>
          }
        </ion-list>
      }

      <!-- 배정 버튼 -->
      @if (selectedCount() > 0 && selectedInstallerId) {
        <div class="confirm-button">
          <ion-button expand="block" (click)="batchAssign()">
            <ion-icon name="checkmark-circle-outline" slot="start"></ion-icon>
            {{ 'ASSIGNMENT.BATCH_ASSIGN.ASSIGN_BTN' | translate:{ count: selectedCount() } }}
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
  /** @description HTTP 클라이언트 */
  private readonly http = inject(HttpClient);
  /** @description 일괄 작업 서비스 */
  private readonly bulkOperationService = inject(BulkOperationService);
  /** @description 주문 상태 관리 스토어 */
  protected readonly ordersStore = inject(OrdersStore);
  /** @description 다국어 번역 서비스 */
  private readonly translateService = inject(TranslateService);
  
  protected readonly isLoading = computed(() => this.ordersStore.isLoading());
  protected readonly orders = signal<UnassignedOrder[]>([]);
  protected readonly installers = signal<Installer[]>([]);
  protected readonly selectedCount = signal(0);
  private searchQuery = '';

  // Computed: Filter unassigned orders from store
  protected readonly unassignedOrders = computed(() => {
    return this.ordersStore.orders().filter(
      (o: Order) => o.status === OrderStatus.UNASSIGNED
    );
  });

  selectedInstallerId: string | null = null;
  selectedDate: string = new Date().toISOString();
  minDate: string = new Date().toISOString();
  maxDate: string = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

  constructor(
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {
    addIcons({
      peopleOutline,
      calendarOutline,
      checkmarkCircleOutline,
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  async loadData(): Promise<void> {
    // Load orders from store (will fetch unassigned orders)
    this.ordersStore.loadOrders();

    // Map unassigned orders to UI model
    const unassigned = this.unassignedOrders().map((order: Order) => ({
      id: order.id,
      orderNumber: order.orderNo || order.id,
      customerName: order.customerName,
      appointmentDate: order.appointmentDate || '-',
      productCount: order.lines?.length || order.orderLines?.length || 0,
      selected: false,
    }));
    this.orders.set(unassigned);

    // Load installers from API
    try {
      const response = await firstValueFrom(
        this.http.get<{ id: string; name: string; capacityPerDay: number; isActive: boolean }[]>(
          `${environment.apiUrl}/metadata/installers?active=true`
        )
      );

      // Map API response to Installer interface
      // Calculate assigned count from OrdersStore
      const storeOrders = this.ordersStore.orders();
      const installerList: Installer[] = response.map(inst => ({
        id: inst.id,
        name: inst.name,
        assignedCount: storeOrders.filter(
          o => o.installerId === inst.id && o.status === OrderStatus.ASSIGNED
        ).length,
        capacity: inst.capacityPerDay || 10,
      }));

      this.installers.set(installerList);
    } catch (error) {
      console.error('Failed to load installers:', error);
      // Set empty list on error to avoid using dummy data
      this.installers.set([]);
    }
  }

  onSearch(event: CustomEvent): void {
    const query = event.detail.value || '';
    console.log('Search:', query);
  }

  isAllSelected(): boolean {
    const allOrders = this.orders();
    return allOrders.length > 0 && allOrders.every(o => o.selected);
  }

  isIndeterminate(): boolean {
    const allOrders = this.orders();
    const selectedOrders = allOrders.filter(o => o.selected);
    return selectedOrders.length > 0 && selectedOrders.length < allOrders.length;
  }

  toggleSelectAll(event: CustomEvent): void {
    const checked = event.detail.checked;
    this.orders.update(orders =>
      orders.map(order => ({ ...order, selected: checked }))
    );
    this.updateSelectedCount();
  }

  onSelectionChange(): void {
    this.updateSelectedCount();
  }

  updateSelectedCount(): void {
    this.selectedCount.set(
      this.orders().filter(o => o.selected).length
    );
  }

  /**
   * @description 선택된 주문들을 설치기사에게 일괄 배정
   * @returns Promise<void>
   */
  async batchAssign(): Promise<void> {
    const selectedOrders = this.orders().filter(o => o.selected);
    const installer = this.installers().find(i => i.id === this.selectedInstallerId);
    
    if (!installer || selectedOrders.length === 0) {
      return;
    }

    const alert = await this.alertCtrl.create({
      header: this.translateService.instant('ASSIGNMENT.BATCH_ASSIGN.TITLE'),
      message: this.translateService.instant('ASSIGNMENT.BATCH_ASSIGN.CONFIRM_MESSAGE', {
        count: this.selectedCount(),
        installer: installer.name
      }),
      buttons: [
        { text: this.translateService.instant('COMMON.CANCEL'), role: 'cancel' },
        {
          text: this.translateService.instant('ORDERS.ACTIONS.ASSIGN'),
          handler: () => {
            this.executeBatchAssign(selectedOrders, installer);
          },
        },
      ],
    });
    await alert.present();
  }

  /**
   * @description 일괄 배정 실행 및 결과 처리
   * @param orders 배정할 주문 목록
   * @param installer 대상 설치기사
   */
  private async executeBatchAssign(
    orders: UnassignedOrder[],
    installer: Installer
  ): Promise<void> {
    // BulkOperationService로 실행
    const result = await this.bulkOperationService.execute({
      items: orders,
      operationName: this.translateService.instant('ASSIGNMENT.BATCH_ASSIGN.OPERATION_NAME'),
      operation: (order) => this.assignOrderToInstaller(order.id, installer.id),
      getItemId: (order) => order.id,
      getItemLabel: (order) => `${order.orderNumber} - ${order.customerName}`,
      continueOnError: true,
    });

    // 결과 다이얼로그 표시
    const action = await this.bulkOperationService.showResultDialog(result);
    
    // 재시도 요청 시
    if (action === 'retry' && result.failedCount > 0) {
      const failedIds = new Set(
        result.items.filter(item => !item.success).map(item => item.id)
      );
      const failedOrders = orders.filter(o => failedIds.has(o.id));
      await this.executeBatchAssign(failedOrders, installer);
    }

    // 성공한 주문들은 목록에서 제거
    if (result.successCount > 0) {
      const successIds = new Set(
        result.items.filter(item => item.success).map(item => item.id)
      );
      this.orders.update(currentOrders => 
        currentOrders.filter(o => !successIds.has(o.id))
      );
      this.updateSelectedCount();
    }
  }

  private async assignOrderToInstaller(
    orderId: string,
    installerId: string
  ): Promise<{ orderId: string; installerId: string }> {
    // Update order status to ASSIGNED with installerId via ordersStore
    await this.ordersStore.updateOrderStatus(orderId, OrderStatus.ASSIGNED, installerId);
    return { orderId, installerId };
  }
}
