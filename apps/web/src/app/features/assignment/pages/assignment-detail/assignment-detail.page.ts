// apps/web/src/app/features/assignment/pages/assignment-detail/assignment-detail.page.ts
import { Component, signal, computed, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
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
  IonChip,
  IonGrid,
  IonRow,
  IonCol,
  ActionSheetController,
  AlertController,
  ModalController,
  ToastController,
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
} from 'ionicons/icons';
import { OrdersStore } from '../../../../store/orders/orders.store';
import { Order, OrderStatus, ORDER_STATUS_LABELS } from '../../../../store/orders/orders.models';
import { ReportsStore } from '../../../../store/reports/reports.store';

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
    IonChip,
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
      @if (isLoading()) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
          <p>데이터 로딩 중...</p>
        </div>
      } @else if (assignment()) {
        <!-- Status Card -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>
              {{ assignment()!.erpOrderNumber }}
              <ion-badge [color]="getStatusColor(assignment()!.status)">
                {{ getStatusLabel(assignment()!.status) }}
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
                      <p>{{ assignment()!.appointmentDate || '-' }}</p>
                    </div>
                  </div>
                </ion-col>
                <ion-col size="6">
                  <div class="info-item">
                    <ion-icon name="person-outline"></ion-icon>
                    <div>
                      <ion-note>설치기사</ion-note>
                      <p>{{ assignment()!.installerName || '미배정' }}</p>
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
                  <p>{{ assignment()!.customerName }}</p>
                </ion-label>
              </ion-item>
              <ion-item>
                <ion-icon name="call-outline" slot="start"></ion-icon>
                <ion-label>
                  <ion-note>연락처</ion-note>
                  <p>{{ assignment()!.customerPhone }}</p>
                </ion-label>
                <ion-button slot="end" fill="clear" (click)="callCustomer()">
                  전화
                </ion-button>
              </ion-item>
              <ion-item>
                <ion-icon name="location-outline" slot="start"></ion-icon>
                <ion-label>
                  <ion-note>주소</ion-note>
                  <p>{{ assignment()!.customerAddress }}</p>
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
              @for (line of assignment()!.lines || assignment()!.orderLines || []; track line.id) {
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
              }
            </ion-list>
          </ion-card-content>
        </ion-card>

        <!-- Notes Card -->
        @if (assignment()!.completion?.notes) {
          <ion-card>
            <ion-card-header>
              <ion-card-title>특이사항</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <p>{{ assignment()!.completion!.notes }}</p>
            </ion-card-content>
          </ion-card>
        }

        <!-- Action Buttons -->
        <div class="action-buttons">
          @if (assignment()!.status === OrderStatus.UNASSIGNED) {
            <ion-button expand="block" (click)="assignInstaller()">
              <ion-icon name="person-outline" slot="start"></ion-icon>
              설치기사 배정
            </ion-button>
          }
          @if (assignment()!.status === OrderStatus.ASSIGNED) {
            <ion-button expand="block" color="success" (click)="confirmAssignment()">
              <ion-icon name="checkmark-circle-outline" slot="start"></ion-icon>
              배정 확정
            </ion-button>
            <ion-button expand="block" color="warning" (click)="changeInstaller()">
              <ion-icon name="swap-horizontal-outline" slot="start"></ion-icon>
              기사 변경
            </ion-button>
          }
          @if (assignment()!.status === OrderStatus.CONFIRMED) {
            <ion-button expand="block" color="primary" (click)="confirmRelease()">
              <ion-icon name="checkmark-circle-outline" slot="start"></ion-icon>
              출고 확정
            </ion-button>
          }
          <ion-button expand="block" color="medium" (click)="changeAppointment()">
            <ion-icon name="calendar-outline" slot="start"></ion-icon>
            약속일 변경
          </ion-button>
          <ion-button expand="block" color="danger" fill="outline" (click)="cancelAssignment()">
            <ion-icon name="close-circle-outline" slot="start"></ion-icon>
            취소
          </ion-button>
        </div>
      } @else {
        <div class="empty-state">
          <p>배정 정보를 찾을 수 없습니다.</p>
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
  private readonly toastCtrl = inject(ToastController);
  private readonly ordersStore = inject(OrdersStore);
  private readonly reportsStore = inject(ReportsStore);

  // Expose OrderStatus to template
  protected readonly OrderStatus = OrderStatus;

  protected readonly isLoading = signal(false);
  protected readonly orderId = this.route.snapshot.paramMap.get('id') || '';

  // Get order from store
  protected readonly assignment = computed(() => {
    return this.ordersStore.orders().find((o: Order) => o.id === this.orderId) || null;
  });

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
    });
  }

  ngOnInit(): void {
    if (this.orderId) {
      this.loadAssignment();
    }
  }

  async loadAssignment(): Promise<void> {
    this.isLoading.set(true);
    try {
      // Select this order in store (loads if not present)
      this.ordersStore.selectOrder(this.orderId);
      
      // If not in store, load from API
      if (!this.assignment()) {
        await this.ordersStore.loadOrders(undefined, 1, 100);
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  getStatusColor(status: OrderStatus | string): string {
    const colors: Record<string, string> = {
      [OrderStatus.UNASSIGNED]: 'danger',
      [OrderStatus.ASSIGNED]: 'warning',
      [OrderStatus.CONFIRMED]: 'success',
      [OrderStatus.RELEASED]: 'primary',
      [OrderStatus.DISPATCHED]: 'tertiary',
      [OrderStatus.COMPLETED]: 'success',
      [OrderStatus.CANCELLED]: 'medium',
    };
    return colors[status] || 'medium';
  }

  getStatusLabel(status: OrderStatus | string): string {
    return ORDER_STATUS_LABELS[status as OrderStatus] || status;
  }

  async openActions(): Promise<void> {
    const order = this.assignment();
    if (!order) return;

    const buttons: any[] = [];

    // Actions based on current status
    if (order.status === OrderStatus.UNASSIGNED) {
      buttons.push({ text: '설치기사 배정', handler: () => this.assignInstaller() });
    }
    if (order.status === OrderStatus.ASSIGNED) {
      buttons.push({ text: '배정 확정', handler: () => this.confirmAssignment() });
      buttons.push({ text: '기사 변경', handler: () => this.changeInstaller() });
    }
    if (order.status === OrderStatus.CONFIRMED) {
      buttons.push({ text: '출고 확정', handler: () => this.confirmRelease() });
    }

    buttons.push({ text: '약속일 변경', handler: () => this.changeAppointment() });
    buttons.push({ text: '특이사항 추가', handler: () => this.addNote() });
    
    if (order.status !== OrderStatus.COMPLETED && order.status !== OrderStatus.CANCELLED) {
      buttons.push({ text: '취소 요청', role: 'destructive', handler: () => this.cancelAssignment() });
    }

    buttons.push({ text: '닫기', role: 'cancel' });

    const actionSheet = await this.actionSheetCtrl.create({
      header: '작업 선택',
      buttons,
    });
    await actionSheet.present();
  }

  async printDocument(): Promise<void> {
    try {
      const blob = await this.reportsStore.exportData({
        type: 'release',
        format: 'pdf',
      });
      this.reportsStore.downloadFile(blob, `배정서_${this.assignment()?.erpOrderNumber || this.orderId}.pdf`);
    } catch (error) {
      const toast = await this.toastCtrl.create({
        message: '인쇄 파일 생성에 실패했습니다.',
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    }
  }

  callCustomer(): void {
    const phone = this.assignment()?.customerPhone;
    if (phone) {
      window.open(`tel:${phone}`, '_system');
    }
  }

  async assignInstaller(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: '설치기사 배정',
      inputs: [
        { name: 'installerName', type: 'text', placeholder: '설치기사명' },
        { name: 'appointmentDate', type: 'date', placeholder: '약속일' },
      ],
      buttons: [
        { text: '취소', role: 'cancel' },
        {
          text: '배정',
          handler: async (data) => {
            if (data.installerName && data.appointmentDate) {
              await this.ordersStore.assignOrder(
                this.orderId,
                '', // installerId - would come from installer selection
                data.appointmentDate
              );
              const toast = await this.toastCtrl.create({
                message: '설치기사가 배정되었습니다.',
                duration: 2000,
                color: 'success',
              });
              await toast.present();
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async confirmAssignment(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: '배정 확정',
      message: '이 배정을 확정하시겠습니까?',
      buttons: [
        { text: '취소', role: 'cancel' },
        {
          text: '확정',
          handler: async () => {
            await this.ordersStore.updateOrderStatus(this.orderId, OrderStatus.CONFIRMED);
            const toast = await this.toastCtrl.create({
              message: '배정이 확정되었습니다.',
              duration: 2000,
              color: 'success',
            });
            await toast.present();
          },
        },
      ],
    });
    await alert.present();
  }

  async changeInstaller(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: '기사 변경',
      inputs: [
        { name: 'installerName', type: 'text', placeholder: '새 설치기사명' },
      ],
      buttons: [
        { text: '취소', role: 'cancel' },
        {
          text: '변경',
          handler: async (data) => {
            if (data.installerName) {
              const order = this.assignment();
              if (order) {
                await this.ordersStore.assignOrder(
                  this.orderId,
                  '', // new installerId
                  order.appointmentDate || ''
                );
                const toast = await this.toastCtrl.create({
                  message: '설치기사가 변경되었습니다.',
                  duration: 2000,
                  color: 'success',
                });
                await toast.present();
              }
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async confirmRelease(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: '출고 확정',
      message: '이 주문을 출고 확정하시겠습니까?',
      buttons: [
        { text: '취소', role: 'cancel' },
        {
          text: '확정',
          handler: async () => {
            await this.ordersStore.updateOrderStatus(this.orderId, OrderStatus.RELEASED);
            const toast = await this.toastCtrl.create({
              message: '출고가 확정되었습니다.',
              duration: 2000,
              color: 'success',
            });
            await toast.present();
          },
        },
      ],
    });
    await alert.present();
  }

  async changeAppointment(): Promise<void> {
    const order = this.assignment();
    const alert = await this.alertCtrl.create({
      header: '약속일 변경',
      inputs: [
        { 
          name: 'appointmentDate', 
          type: 'date', 
          value: order?.appointmentDate || '',
          placeholder: '새 약속일' 
        },
      ],
      buttons: [
        { text: '취소', role: 'cancel' },
        {
          text: '변경',
          handler: async (data) => {
            if (data.appointmentDate && order) {
              // Validate max +15 days per PRD FR-02
              const newDate = new Date(data.appointmentDate);
              const today = new Date();
              const maxDate = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000);
              
              if (newDate > maxDate) {
                const toast = await this.toastCtrl.create({
                  message: '약속일은 오늘로부터 15일 이내여야 합니다.',
                  duration: 2000,
                  color: 'warning',
                });
                await toast.present();
                return;
              }

              await this.ordersStore.assignOrder(
                this.orderId,
                order.installerId || '',
                data.appointmentDate
              );
              const toast = await this.toastCtrl.create({
                message: '약속일이 변경되었습니다.',
                duration: 2000,
                color: 'success',
              });
              await toast.present();
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async addNote(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: '특이사항 추가',
      inputs: [
        { name: 'note', type: 'textarea', placeholder: '특이사항을 입력하세요' },
      ],
      buttons: [
        { text: '취소', role: 'cancel' },
        {
          text: '저장',
          handler: async (data) => {
            if (data.note) {
              // Would call API to add note
              const toast = await this.toastCtrl.create({
                message: '특이사항이 추가되었습니다.',
                duration: 2000,
                color: 'success',
              });
              await toast.present();
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async cancelAssignment(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: '취소 확인',
      message: '정말로 이 배정을 취소 요청하시겠습니까?',
      inputs: [
        { name: 'reason', type: 'textarea', placeholder: '취소 사유' },
      ],
      buttons: [
        { text: '아니오', role: 'cancel' },
        {
          text: '예, 취소합니다',
          role: 'destructive',
          handler: async (data) => {
            await this.ordersStore.updateOrderStatus(this.orderId, OrderStatus.REQUEST_CANCEL);
            const toast = await this.toastCtrl.create({
              message: '취소 요청이 접수되었습니다. HQ 승인 후 처리됩니다.',
              duration: 3000,
              color: 'warning',
            });
            await toast.present();
            this.router.navigate(['/tabs/assignment']);
          },
        },
      ],
    });
    await alert.present();
  }
}
