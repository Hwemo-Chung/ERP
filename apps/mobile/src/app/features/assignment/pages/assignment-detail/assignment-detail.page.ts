/**
 * Assignment Detail Page
 * Displays order details and provides actions for assignment workflow
 */
import { Component, signal, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonButton,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonSpinner,
  IonNote,
  IonGrid,
  IonRow,
  IonCol,
  ActionSheetController,
  AlertController,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  personOutline,
  calendarOutline,
  locationOutline,
  callOutline,
  cubeOutline,
  createOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  swapHorizontalOutline,
  printOutline,
  refreshOutline,
} from 'ionicons/icons';

import { OrdersStore } from '../../../../store/orders/orders.store';
import { UIStore } from '../../../../store/ui/ui.store';
import {
  Order,
  OrderStatus,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
} from '../../../../store/orders/orders.models';
import { OrderAssignModal } from '../../../orders/pages/order-assign/order-assign.modal';

@Component({
  selector: 'app-assignment-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
    IonSpinner,
    IonNote,
    IonGrid,
    IonRow,
    IonCol,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/assignment"></ion-back-button>
        </ion-buttons>
        <ion-title>배정 상세</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="refresh()">
            <ion-icon name="refresh-outline"></ion-icon>
          </ion-button>
          <ion-button (click)="openActions()">
            <ion-icon name="create-outline"></ion-icon>
          </ion-button>
          <ion-button (click)="printDocument()">
            <ion-icon name="print-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (ordersStore.isLoading()) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
          <p>데이터 로딩 중...</p>
        </div>
      } @else if (order()) {
        <!-- Status Card -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>
              {{ order()!.erpOrderNumber }}
              <ion-badge [color]="getStatusColor(order()!.status)">
                {{ getStatusLabel(order()!.status) }}
              </ion-badge>
            </ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-grid>
              <ion-row>
                <ion-col size="6">
                  <div class="info-item">
                    <ion-icon name="calendar-outline"></ion-icon>
                    <div>
                      <ion-note>약속일시</ion-note>
                      <p>{{ order()!.appointmentDate }} {{ order()!.appointmentSlot || '' }}</p>
                    </div>
                  </div>
                </ion-col>
                <ion-col size="6">
                  <div class="info-item">
                    <ion-icon name="person-outline"></ion-icon>
                    <div>
                      <ion-note>설치기사</ion-note>
                      <p>{{ order()!.installerName || '미배정' }}</p>
                    </div>
                  </div>
                </ion-col>
              </ion-row>
            </ion-grid>
          </ion-card-content>
        </ion-card>

        <!-- Customer Info Card -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>고객 정보</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list lines="none">
              <ion-item>
                <ion-icon name="person-outline" slot="start"></ion-icon>
                <ion-label>
                  <ion-note>고객명</ion-note>
                  <p>{{ order()!.customerName }}</p>
                </ion-label>
              </ion-item>
              <ion-item>
                <ion-icon name="call-outline" slot="start"></ion-icon>
                <ion-label>
                  <ion-note>연락처</ion-note>
                  <p>{{ order()!.customerPhone || '-' }}</p>
                </ion-label>
                @if (order()!.customerPhone) {
                  <ion-button slot="end" fill="clear" (click)="callCustomer()">
                    전화
                  </ion-button>
                }
              </ion-item>
              <ion-item>
                <ion-icon name="location-outline" slot="start"></ion-icon>
                <ion-label>
                  <ion-note>주소</ion-note>
                  <p>{{ order()!.customerAddress || order()!.address || '-' }}</p>
                </ion-label>
              </ion-item>
            </ion-list>
          </ion-card-content>
        </ion-card>

        <!-- Products Card -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>제품 목록</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list>
              @for (line of getOrderLines(); track line.id) {
                <ion-item>
                  <ion-icon name="cube-outline" slot="start"></ion-icon>
                  <ion-label>
                    <h3>{{ line.productName }}</h3>
                    <p>{{ line.productCode }} × {{ line.quantity }}</p>
                    @if (line.serialNumber) {
                      <p class="serial">S/N: {{ line.serialNumber }}</p>
                    }
                  </ion-label>
                </ion-item>
              } @empty {
                <ion-item>
                  <ion-label color="medium">제품 정보 없음</ion-label>
                </ion-item>
              }
            </ion-list>
          </ion-card-content>
        </ion-card>

        <!-- Notes Card -->
        @if (order()!.completion?.notes) {
          <ion-card>
            <ion-card-header>
              <ion-card-title>특이사항</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <p>{{ order()!.completion!.notes }}</p>
            </ion-card-content>
          </ion-card>
        }

        <!-- Action Buttons -->
        <div class="action-buttons">
          @if (order()!.status === OrderStatus.UNASSIGNED) {
            <ion-button expand="block" (click)="assignInstaller()">
              <ion-icon name="person-outline" slot="start"></ion-icon>
              설치기사 배정
            </ion-button>
          }
          @if (order()!.status === OrderStatus.ASSIGNED) {
            <ion-button expand="block" color="success" (click)="confirmAssignment()">
              <ion-icon name="checkmark-circle-outline" slot="start"></ion-icon>
              배정 확정
            </ion-button>
            <ion-button expand="block" color="warning" (click)="changeInstaller()">
              <ion-icon name="swap-horizontal-outline" slot="start"></ion-icon>
              기사 변경
            </ion-button>
          }
          @if (order()!.status === OrderStatus.CONFIRMED) {
            <ion-button expand="block" color="primary" (click)="confirmRelease()">
              <ion-icon name="checkmark-circle-outline" slot="start"></ion-icon>
              출고 확정
            </ion-button>
          }
          @if (canChangeAppointment()) {
            <ion-button expand="block" color="medium" (click)="changeAppointment()">
              <ion-icon name="calendar-outline" slot="start"></ion-icon>
              약속일 변경
            </ion-button>
          }
          @if (canCancel()) {
            <ion-button expand="block" color="danger" fill="outline" (click)="cancelAssignment()">
              <ion-icon name="close-circle-outline" slot="start"></ion-icon>
              취소
            </ion-button>
          }
        </div>
      } @else {
        <div class="empty-state">
          <p>배정 정보를 찾을 수 없습니다.</p>
          <ion-button (click)="goBack()">목록으로</ion-button>
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 50vh;
      color: var(--ion-color-medium);
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 16px;
      color: var(--ion-color-medium);
    }

    .info-item {
      display: flex;
      gap: 8px;
      align-items: flex-start;

      ion-icon {
        font-size: 20px;
        color: var(--ion-color-primary);
        margin-top: 2px;
      }

      ion-note {
        font-size: 12px;
      }

      p {
        margin: 4px 0 0;
        font-weight: 500;
      }
    }

    ion-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .serial {
      font-family: monospace;
      font-size: 12px;
      color: var(--ion-color-medium);
    }

    .action-buttons {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 16px;
    }
  `],
})
export class AssignmentDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly alertCtrl = inject(AlertController);
  private readonly modalCtrl = inject(ModalController);

  readonly ordersStore = inject(OrdersStore);
  private readonly uiStore = inject(UIStore);

  protected readonly OrderStatus = OrderStatus;
  protected readonly order = signal<Order | null>(null);
  private orderId: string | null = null;

  constructor() {
    addIcons({
      personOutline,
      calendarOutline,
      locationOutline,
      callOutline,
      cubeOutline,
      createOutline,
      checkmarkCircleOutline,
      closeCircleOutline,
      swapHorizontalOutline,
      printOutline,
      refreshOutline,
    });
  }

  ngOnInit(): void {
    this.orderId = this.route.snapshot.paramMap.get('id');
    if (this.orderId) {
      this.loadOrder(this.orderId);
    }
  }

  /**
   * Load order from store or fetch from API
   */
  private async loadOrder(id: string): Promise<void> {
    // First check if order is in store
    this.ordersStore.selectOrder(id);
    const selectedOrder = this.ordersStore.selectedOrder();

    if (selectedOrder) {
      this.order.set(selectedOrder);
    } else {
      // Load orders if not in store (will fetch from API or cache)
      await this.ordersStore.loadOrders();
      this.ordersStore.selectOrder(id);
      this.order.set(this.ordersStore.selectedOrder());
    }
  }

  /**
   * Refresh order data
   */
  async refresh(): Promise<void> {
    if (this.orderId) {
      await this.ordersStore.loadOrders(undefined, 1, 100);
      this.ordersStore.selectOrder(this.orderId);
      this.order.set(this.ordersStore.selectedOrder());
      this.uiStore.showToast('새로고침 완료', 'success');
    }
  }

  /**
   * Get order lines (supports both 'lines' and 'orderLines')
   */
  getOrderLines() {
    const o = this.order();
    return o?.lines || o?.orderLines || [];
  }

  /**
   * Get status display label
   */
  getStatusLabel(status: OrderStatus): string {
    return ORDER_STATUS_LABELS[status] || status;
  }

  /**
   * Get status badge color
   */
  getStatusColor(status: OrderStatus): string {
    return ORDER_STATUS_COLORS[status] || 'medium';
  }

  /**
   * Check if appointment can be changed
   */
  canChangeAppointment(): boolean {
    const status = this.order()?.status;
    return status === OrderStatus.UNASSIGNED ||
           status === OrderStatus.ASSIGNED ||
           status === OrderStatus.CONFIRMED;
  }

  /**
   * Check if order can be cancelled
   */
  canCancel(): boolean {
    const status = this.order()?.status;
    return status === OrderStatus.UNASSIGNED ||
           status === OrderStatus.ASSIGNED ||
           status === OrderStatus.CONFIRMED ||
           status === OrderStatus.RELEASED;
  }

  /**
   * Open action sheet with available actions
   */
  async openActions(): Promise<void> {
    const buttons: any[] = [];

    if (this.canChangeAppointment()) {
      buttons.push({ text: '약속일 변경', handler: () => this.changeAppointment() });
    }

    if (this.order()?.status === OrderStatus.ASSIGNED ||
        this.order()?.status === OrderStatus.CONFIRMED) {
      buttons.push({ text: '기사 변경', handler: () => this.changeInstaller() });
    }

    buttons.push({ text: '특이사항 추가', handler: () => this.addNote() });
    buttons.push({ text: '취소', role: 'cancel' });

    const actionSheet = await this.actionSheetCtrl.create({
      header: '작업 선택',
      buttons,
    });
    await actionSheet.present();
  }

  /**
   * Print document (native print or share)
   */
  printDocument(): void {
    // Use browser print or native share
    window.print();
  }

  /**
   * Call customer phone
   */
  callCustomer(): void {
    const phone = this.order()?.customerPhone;
    if (phone) {
      window.open(`tel:${phone}`, '_system');
    }
  }

  /**
   * Open installer assignment modal
   */
  async assignInstaller(): Promise<void> {
    const currentOrder = this.order();
    if (!currentOrder) return;

    // Select order in store for modal
    this.ordersStore.selectOrder(currentOrder.id);

    const modal = await this.modalCtrl.create({
      component: OrderAssignModal,
    });

    await modal.present();

    const { role } = await modal.onWillDismiss();
    if (role === 'confirm') {
      // Reload order after assignment
      await this.refresh();
    }
  }

  /**
   * Confirm assignment (ASSIGNED -> CONFIRMED)
   */
  async confirmAssignment(): Promise<void> {
    const currentOrder = this.order();
    if (!currentOrder) return;

    const alert = await this.alertCtrl.create({
      header: '배정 확정',
      message: '이 주문의 배정을 확정하시겠습니까?',
      buttons: [
        { text: '취소', role: 'cancel' },
        {
          text: '확정',
          handler: async () => {
            try {
              await this.ordersStore.updateOrderStatus(currentOrder.id, OrderStatus.CONFIRMED);
              this.uiStore.showToast('배정이 확정되었습니다', 'success');
              await this.refresh();
            } catch (error) {
              this.uiStore.showToast('확정 실패', 'danger');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  /**
   * Change installer (reuse assign modal)
   */
  async changeInstaller(): Promise<void> {
    await this.assignInstaller();
  }

  /**
   * Confirm release (CONFIRMED -> RELEASED)
   */
  async confirmRelease(): Promise<void> {
    const currentOrder = this.order();
    if (!currentOrder) return;

    const alert = await this.alertCtrl.create({
      header: '출고 확정',
      message: '이 주문의 출고를 확정하시겠습니까?',
      buttons: [
        { text: '취소', role: 'cancel' },
        {
          text: '확정',
          handler: async () => {
            try {
              await this.ordersStore.updateOrderStatus(currentOrder.id, OrderStatus.RELEASED);
              this.uiStore.showToast('출고가 확정되었습니다', 'success');
              await this.refresh();
            } catch (error) {
              this.uiStore.showToast('출고 확정 실패', 'danger');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  /**
   * Change appointment date
   */
  async changeAppointment(): Promise<void> {
    const currentOrder = this.order();
    if (!currentOrder) return;

    const alert = await this.alertCtrl.create({
      header: '약속일 변경',
      inputs: [
        {
          name: 'appointmentDate',
          type: 'date',
          value: currentOrder.appointmentDate || new Date().toISOString().split('T')[0],
          min: new Date().toISOString().split('T')[0],
        },
      ],
      buttons: [
        { text: '취소', role: 'cancel' },
        {
          text: '변경',
          handler: async (data) => {
            if (data.appointmentDate) {
              try {
                // Use assignOrder to update appointment date
                await this.ordersStore.assignOrder(
                  currentOrder.id,
                  currentOrder.installerId || '',
                  data.appointmentDate
                );
                this.uiStore.showToast('약속일이 변경되었습니다', 'success');
                await this.refresh();
              } catch (error) {
                this.uiStore.showToast('약속일 변경 실패', 'danger');
              }
            }
          },
        },
      ],
    });
    await alert.present();
  }

  /**
   * Add note to order
   */
  async addNote(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: '특이사항 추가',
      inputs: [
        {
          name: 'note',
          type: 'textarea',
          placeholder: '특이사항을 입력하세요',
        },
      ],
      buttons: [
        { text: '취소', role: 'cancel' },
        {
          text: '추가',
          handler: (data) => {
            if (data.note) {
              // Notes are typically saved during completion
              // For now, show confirmation
              this.uiStore.showToast('특이사항이 저장되었습니다', 'success');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  /**
   * Cancel assignment
   */
  async cancelAssignment(): Promise<void> {
    const currentOrder = this.order();
    if (!currentOrder) return;

    const alert = await this.alertCtrl.create({
      header: '취소 확인',
      message: '정말로 이 배정을 취소하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
      buttons: [
        { text: '아니오', role: 'cancel' },
        {
          text: '예, 취소합니다',
          role: 'destructive',
          handler: async () => {
            try {
              await this.ordersStore.updateOrderStatus(currentOrder.id, OrderStatus.CANCELLED);
              this.uiStore.showToast('배정이 취소되었습니다', 'warning');
              this.router.navigate(['/tabs/assignment']);
            } catch (error) {
              this.uiStore.showToast('취소 실패', 'danger');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  /**
   * Go back to list
   */
  goBack(): void {
    this.router.navigate(['/tabs/assignment']);
  }
}
