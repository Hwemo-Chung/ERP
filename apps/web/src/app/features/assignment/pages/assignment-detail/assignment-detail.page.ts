// apps/web/src/app/features/assignment/pages/assignment-detail/assignment-detail.page.ts
import {
  Component,
  signal,
  computed,
  ChangeDetectionStrategy,
  inject,
  OnInit,
} from '@angular/core';
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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { OrdersStore } from '../../../../store/orders/orders.store';
import { Order, OrderStatus } from '../../../../store/orders/orders.models';
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
    IonGrid,
    IonRow,
    IonCol,
    TranslateModule,
  ],
  template: `
    <!-- 배정 상세 헤더 -->
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/assignment"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ 'ASSIGNMENT.DETAIL.TITLE' | translate }}</ion-title>
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
        <!-- 로딩 상태 -->
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
          <p>{{ 'ASSIGNMENT.DETAIL.LOADING' | translate }}</p>
        </div>
      } @else if (assignment()) {
        <!-- Status Card -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>
              {{ assignment()!.orderNo }}
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
                      <ion-note>{{ 'ASSIGNMENT.DETAIL.APPOINTMENT_DATE' | translate }}</ion-note>
                      <p>{{ assignment()!.appointmentDate || '-' }}</p>
                    </div>
                  </div>
                </ion-col>
                <ion-col size="6">
                  <div class="info-item">
                    <ion-icon name="person-outline"></ion-icon>
                    <div>
                      <ion-note>{{ 'ASSIGNMENT.DETAIL.INSTALLER' | translate }}</ion-note>
                      <p>
                        {{
                          assignment()!.installer?.name ||
                            assignment()!.installerName ||
                            ('ASSIGNMENT.DETAIL.NOT_ASSIGNED' | translate)
                        }}
                      </p>
                    </div>
                  </div>
                </ion-col>
              </ion-row>
            </ion-grid>
          </ion-card-content>
        </ion-card>

        <!-- 고객 정보 카드 -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ 'ASSIGNMENT.DETAIL.CUSTOMER_INFO' | translate }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list lines="none">
              <ion-item>
                <ion-icon name="person-outline" slot="start"></ion-icon>
                <ion-label>
                  <ion-note>{{ 'ASSIGNMENT.DETAIL.CUSTOMER_NAME' | translate }}</ion-note>
                  <p>{{ assignment()!.customerName }}</p>
                </ion-label>
              </ion-item>
              <ion-item>
                <ion-icon name="call-outline" slot="start"></ion-icon>
                <ion-label>
                  <ion-note>{{ 'ASSIGNMENT.DETAIL.CONTACT' | translate }}</ion-note>
                  <p>{{ assignment()!.customerPhone }}</p>
                </ion-label>
                <ion-button slot="end" fill="clear" (click)="callCustomer()">
                  {{ 'ASSIGNMENT.DETAIL.CALL' | translate }}
                </ion-button>
              </ion-item>
              <ion-item>
                <ion-icon name="location-outline" slot="start"></ion-icon>
                <ion-label>
                  <ion-note>{{ 'ASSIGNMENT.DETAIL.ADDRESS' | translate }}</ion-note>
                  <p>{{ getFormattedAddress() }}</p>
                </ion-label>
              </ion-item>
            </ion-list>
          </ion-card-content>
        </ion-card>

        <!-- 제품 목록 카드 -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ 'ASSIGNMENT.DETAIL.PRODUCT_LIST' | translate }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list>
              @for (line of assignment()!.lines || assignment()!.orderLines || []; track line.id) {
                <ion-item>
                  <ion-icon name="cube-outline" slot="start"></ion-icon>
                  <ion-label>
                    <h3>{{ line.itemName || line.productName }}</h3>
                    <p>{{ line.itemCode || line.productCode }} × {{ line.quantity }}</p>
                    @if (line.serialNumber) {
                      <p class="serial">S/N: {{ line.serialNumber }}</p>
                    }
                  </ion-label>
                </ion-item>
              }
            </ion-list>
          </ion-card-content>
        </ion-card>

        <!-- 특이사항 카드 -->
        @if (assignment()!.completion?.notes) {
          <ion-card>
            <ion-card-header>
              <ion-card-title>{{ 'ASSIGNMENT.DETAIL.SPECIAL_NOTES' | translate }}</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <p>{{ assignment()!.completion!.notes }}</p>
            </ion-card-content>
          </ion-card>
        }

        <!-- 액션 버튼 -->
        <div class="action-buttons">
          @if (assignment()!.status === OrderStatus.UNASSIGNED) {
            <ion-button (click)="assignInstaller()">
              <ion-icon name="person-outline" slot="start"></ion-icon>
              {{ 'ASSIGNMENT.DETAIL.ASSIGN_INSTALLER' | translate }}
            </ion-button>
          }
          @if (assignment()!.status === OrderStatus.ASSIGNED) {
            <ion-button color="success" (click)="confirmAssignment()">
              <ion-icon name="checkmark-circle-outline" slot="start"></ion-icon>
              {{ 'ASSIGNMENT.DETAIL.CONFIRM_ASSIGNMENT' | translate }}
            </ion-button>
            <ion-button color="warning" (click)="changeInstaller()">
              <ion-icon name="swap-horizontal-outline" slot="start"></ion-icon>
              {{ 'ASSIGNMENT.DETAIL.CHANGE_INSTALLER' | translate }}
            </ion-button>
          }
          @if (assignment()!.status === OrderStatus.CONFIRMED) {
            <ion-button color="primary" (click)="confirmRelease()">
              <ion-icon name="checkmark-circle-outline" slot="start"></ion-icon>
              {{ 'ASSIGNMENT.DETAIL.CONFIRM_RELEASE' | translate }}
            </ion-button>
          }
          <ion-button color="medium" (click)="changeAppointment()">
            <ion-icon name="calendar-outline" slot="start"></ion-icon>
            {{ 'ASSIGNMENT.DETAIL.CHANGE_APPOINTMENT' | translate }}
          </ion-button>
          <ion-button color="danger" fill="outline" (click)="cancelAssignment()">
            <ion-icon name="close-circle-outline" slot="start"></ion-icon>
            {{ 'ASSIGNMENT.DETAIL.CANCEL' | translate }}
          </ion-button>
        </div>
      } @else {
        <!-- 배정 정보 없음 상태 -->
        <div class="empty-state">
          <p>{{ 'ASSIGNMENT.DETAIL.NOT_FOUND' | translate }}</p>
        </div>
      }
    </ion-content>
  `,
  styles: [
    `
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
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 24px;

        ion-button {
          flex: 1 1 auto;
          min-width: 160px;
          max-width: 220px;
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
export class AssignmentDetailPage implements OnInit {
  /** @description 라우트 정보 접근 */
  private readonly route = inject(ActivatedRoute);
  /** @description 라우터 네비게이션 */
  private readonly router = inject(Router);
  /** @description 액션 시트 컨트롤러 */
  private readonly actionSheetCtrl = inject(ActionSheetController);
  /** @description 알림창 컨트롤러 */
  private readonly alertCtrl = inject(AlertController);
  /** @description 토스트 컨트롤러 */
  private readonly toastCtrl = inject(ToastController);
  /** @description 주문 스토어 */
  private readonly ordersStore = inject(OrdersStore);
  /** @description 리포트 스토어 */
  private readonly reportsStore = inject(ReportsStore);
  /** @description 다국어 번역 서비스 */
  private readonly translateService = inject(TranslateService);

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

  /**
   * @description 주문 상태에 따른 i18n 라벨 반환
   * @param status 주문 상태
   * @returns 번역된 상태 라벨
   */
  getStatusLabel(status: OrderStatus | string): string {
    // Try ORDER_STATUS first (root level), fallback to ORDERS.STATUS (nested)
    const key = `ORDER_STATUS.${status}`;
    const translated = this.translateService.instant(key);
    if (translated !== key) return translated;

    // Fallback for compatibility
    const altKey = `ORDERS.STATUS.${status}`;
    const altTranslated = this.translateService.instant(altKey);
    return altTranslated !== altKey ? altTranslated : status;
  }

  /**
   * @description 주소 포맷팅 (객체/문자열 모두 지원)
   * @returns 포맷된 주소 문자열
   */
  getFormattedAddress(): string {
    const o = this.assignment();
    if (!o) return '-';

    // If customerAddress is a string, use it directly
    if (typeof o.customerAddress === 'string' && o.customerAddress) {
      return o.customerAddress;
    }

    // If address is an object (API format), format it
    const addr = o.address;
    if (addr && typeof addr === 'object') {
      const parts = [addr.line1, addr.line2, addr.city].filter(Boolean);
      return parts.join(' ') || '-';
    }

    // If address is a string
    if (typeof addr === 'string' && addr) {
      return addr;
    }

    return '-';
  }

  /**
   * @description 작업 선택 액션 시트 열기
   */
  async openActions(): Promise<void> {
    const order = this.assignment();
    if (!order) return;

    const buttons: any[] = [];

    // 상태에 따른 액션 버튼 구성
    if (order.status === OrderStatus.UNASSIGNED) {
      buttons.push({
        text: this.translateService.instant('ASSIGNMENT.DETAIL.ASSIGN_INSTALLER'),
        handler: () => this.assignInstaller(),
      });
    }
    if (order.status === OrderStatus.ASSIGNED) {
      buttons.push({
        text: this.translateService.instant('ASSIGNMENT.DETAIL.CONFIRM_ASSIGNMENT'),
        handler: () => this.confirmAssignment(),
      });
      buttons.push({
        text: this.translateService.instant('ASSIGNMENT.DETAIL.CHANGE_INSTALLER'),
        handler: () => this.changeInstaller(),
      });
    }
    if (order.status === OrderStatus.CONFIRMED) {
      buttons.push({
        text: this.translateService.instant('ASSIGNMENT.DETAIL.CONFIRM_RELEASE'),
        handler: () => this.confirmRelease(),
      });
    }

    buttons.push({
      text: this.translateService.instant('ASSIGNMENT.DETAIL.CHANGE_APPOINTMENT'),
      handler: () => this.changeAppointment(),
    });
    buttons.push({
      text: this.translateService.instant('ASSIGNMENT.DETAIL.ADD_NOTE'),
      handler: () => this.addNote(),
    });

    if (order.status !== OrderStatus.COMPLETED && order.status !== OrderStatus.CANCELLED) {
      buttons.push({
        text: this.translateService.instant('ASSIGNMENT.DETAIL.CANCEL_REQUEST'),
        role: 'destructive',
        handler: () => this.cancelAssignment(),
      });
    }

    buttons.push({
      text: this.translateService.instant('ASSIGNMENT.DETAIL.CLOSE'),
      role: 'cancel',
    });

    const actionSheet = await this.actionSheetCtrl.create({
      header: this.translateService.instant('ASSIGNMENT.DETAIL.ACTION_HEADER'),
      buttons,
    });
    await actionSheet.present();
  }

  /**
   * @description 문서 인쇄 (PDF 다운로드)
   */
  async printDocument(): Promise<void> {
    try {
      const blob = await this.reportsStore.exportData({
        type: 'release',
        format: 'pdf',
      });
      this.reportsStore.downloadFile(
        blob,
        `${this.translateService.instant('ASSIGNMENT.DETAIL.TITLE')}_${this.assignment()?.orderNo || this.orderId}.pdf`,
      );
    } catch (error) {
      const toast = await this.toastCtrl.create({
        message: this.translateService.instant('ASSIGNMENT.DETAIL.PRINT_FAILED'),
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    }
  }

  /**
   * @description 고객에게 전화 걸기
   */
  callCustomer(): void {
    const phone = this.assignment()?.customerPhone;
    if (phone) {
      window.open(`tel:${phone}`, '_system');
    }
  }

  /**
   * @description 설치기사 배정 알림창
   */
  async assignInstaller(): Promise<void> {
    const installerAssignedMsg = this.translateService.instant(
      'ASSIGNMENT.DETAIL.INSTALLER_ASSIGNED',
    );
    const ordersStore = this.ordersStore;
    const toastController = this.toastCtrl;
    const orderId = this.orderId;

    const alert = await this.alertCtrl.create({
      header: this.translateService.instant('ASSIGNMENT.DETAIL.ASSIGN_INSTALLER'),
      inputs: [
        {
          name: 'installerName',
          type: 'text',
          placeholder: this.translateService.instant('ASSIGNMENT.DETAIL.INSTALLER_NAME'),
        },
        {
          name: 'appointmentDate',
          type: 'date',
          placeholder: this.translateService.instant('ASSIGNMENT.DETAIL.APPOINTMENT_DATE_INPUT'),
        },
      ],
      buttons: [
        { text: this.translateService.instant('COMMON.CANCEL'), role: 'cancel' },
        {
          text: this.translateService.instant('ASSIGNMENT.DETAIL.ASSIGN'),
          handler: async (data) => {
            if (data.installerName && data.appointmentDate) {
              await ordersStore.assignOrder(
                orderId,
                '', // installerId - would come from installer selection
                data.appointmentDate,
              );
              const toast = await toastController.create({
                message: installerAssignedMsg,
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

  /**
   * @description 배정 확정 알림창
   */
  async confirmAssignment(): Promise<void> {
    const assignmentConfirmedMsg = this.translateService.instant(
      'ASSIGNMENT.DETAIL.ASSIGNMENT_CONFIRMED',
    );
    const ordersStore = this.ordersStore;
    const toastController = this.toastCtrl;
    const orderId = this.orderId;

    const alert = await this.alertCtrl.create({
      header: this.translateService.instant('ASSIGNMENT.DETAIL.CONFIRM_ASSIGNMENT'),
      message: this.translateService.instant('ASSIGNMENT.DETAIL.CONFIRM_ASSIGNMENT_MSG'),
      buttons: [
        { text: this.translateService.instant('COMMON.CANCEL'), role: 'cancel' },
        {
          text: this.translateService.instant('ASSIGNMENT.DETAIL.CONFIRM'),
          handler: async () => {
            await ordersStore.updateOrderStatus(orderId, OrderStatus.CONFIRMED);
            const toast = await toastController.create({
              message: assignmentConfirmedMsg,
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

  /**
   * @description 설치기사 변경 알림창
   */
  async changeInstaller(): Promise<void> {
    const installerChangedMsg = this.translateService.instant(
      'ASSIGNMENT.DETAIL.INSTALLER_CHANGED',
    );
    const ordersStore = this.ordersStore;
    const toastController = this.toastCtrl;
    const orderId = this.orderId;
    const assignment = this.assignment;

    const alert = await this.alertCtrl.create({
      header: this.translateService.instant('ASSIGNMENT.DETAIL.CHANGE_INSTALLER'),
      inputs: [
        {
          name: 'installerName',
          type: 'text',
          placeholder: this.translateService.instant('ASSIGNMENT.DETAIL.NEW_INSTALLER_NAME'),
        },
      ],
      buttons: [
        { text: this.translateService.instant('COMMON.CANCEL'), role: 'cancel' },
        {
          text: this.translateService.instant('ASSIGNMENT.DETAIL.CHANGE'),
          handler: async (data) => {
            if (data.installerName) {
              const order = assignment();
              if (order) {
                await ordersStore.assignOrder(
                  orderId,
                  '', // new installerId
                  order.appointmentDate || '',
                );
                const toast = await toastController.create({
                  message: installerChangedMsg,
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

  /**
   * @description 출고 확정 알림창
   */
  async confirmRelease(): Promise<void> {
    const releaseConfirmedMsg = this.translateService.instant(
      'ASSIGNMENT.DETAIL.RELEASE_CONFIRMED',
    );
    const ordersStore = this.ordersStore;
    const toastController = this.toastCtrl;
    const orderId = this.orderId;

    const alert = await this.alertCtrl.create({
      header: this.translateService.instant('ASSIGNMENT.DETAIL.CONFIRM_RELEASE'),
      message: this.translateService.instant('ASSIGNMENT.DETAIL.CONFIRM_RELEASE_MSG'),
      buttons: [
        { text: this.translateService.instant('COMMON.CANCEL'), role: 'cancel' },
        {
          text: this.translateService.instant('ASSIGNMENT.DETAIL.CONFIRM'),
          handler: async () => {
            await ordersStore.updateOrderStatus(orderId, OrderStatus.RELEASED);
            const toast = await toastController.create({
              message: releaseConfirmedMsg,
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

  /**
   * @description 약속일 변경 알림창
   */
  async changeAppointment(): Promise<void> {
    const order = this.assignment();
    const appointmentDateLimitMsg = this.translateService.instant(
      'ASSIGNMENT.DETAIL.APPOINTMENT_DATE_LIMIT',
    );
    const appointmentChangedMsg = this.translateService.instant(
      'ASSIGNMENT.DETAIL.APPOINTMENT_CHANGED',
    );
    const ordersStore = this.ordersStore;
    const toastController = this.toastCtrl;
    const orderId = this.orderId;

    const alert = await this.alertCtrl.create({
      header: this.translateService.instant('ASSIGNMENT.DETAIL.CHANGE_APPOINTMENT'),
      inputs: [
        {
          name: 'appointmentDate',
          type: 'date',
          value: order?.appointmentDate || '',
          placeholder: this.translateService.instant('ASSIGNMENT.DETAIL.NEW_APPOINTMENT'),
        },
      ],
      buttons: [
        { text: this.translateService.instant('COMMON.CANCEL'), role: 'cancel' },
        {
          text: this.translateService.instant('ASSIGNMENT.DETAIL.CHANGE'),
          handler: async (data) => {
            if (data.appointmentDate && order) {
              // Validate max +15 days per PRD FR-02
              const newDate = new Date(data.appointmentDate);
              const today = new Date();
              const maxDate = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000);

              if (newDate > maxDate) {
                const toast = await toastController.create({
                  message: appointmentDateLimitMsg,
                  duration: 2000,
                  color: 'warning',
                });
                await toast.present();
                return;
              }

              await ordersStore.assignOrder(orderId, order.installerId || '', data.appointmentDate);
              const toast = await toastController.create({
                message: appointmentChangedMsg,
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

  /**
   * @description 특이사항 추가 알림창
   */
  async addNote(): Promise<void> {
    const noteAddedMsg = this.translateService.instant('ASSIGNMENT.DETAIL.NOTE_ADDED');
    const toastController = this.toastCtrl;

    const alert = await this.alertCtrl.create({
      header: this.translateService.instant('ASSIGNMENT.DETAIL.ADD_NOTE'),
      inputs: [
        {
          name: 'note',
          type: 'textarea',
          placeholder: this.translateService.instant('ASSIGNMENT.DETAIL.NOTE_PLACEHOLDER'),
        },
      ],
      buttons: [
        { text: this.translateService.instant('COMMON.CANCEL'), role: 'cancel' },
        {
          text: this.translateService.instant('ASSIGNMENT.DETAIL.SAVE'),
          handler: async (data) => {
            if (data.note) {
              // Would call API to add note
              const toast = await toastController.create({
                message: noteAddedMsg,
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

  /**
   * @description 배정 취소 요청 알림창
   */
  async cancelAssignment(): Promise<void> {
    const cancelRequestedMsg = this.translateService.instant('ASSIGNMENT.DETAIL.CANCEL_REQUESTED');
    const ordersStore = this.ordersStore;
    const toastController = this.toastCtrl;
    const router = this.router;
    const orderId = this.orderId;

    const alert = await this.alertCtrl.create({
      header: this.translateService.instant('ASSIGNMENT.DETAIL.CANCEL_CONFIRM_HEADER'),
      message: this.translateService.instant('ASSIGNMENT.DETAIL.CANCEL_CONFIRM_MSG'),
      inputs: [
        {
          name: 'reason',
          type: 'textarea',
          placeholder: this.translateService.instant('ASSIGNMENT.DETAIL.CANCEL_REASON'),
        },
      ],
      buttons: [
        { text: this.translateService.instant('ASSIGNMENT.DETAIL.NO'), role: 'cancel' },
        {
          text: this.translateService.instant('ASSIGNMENT.DETAIL.YES_CANCEL'),
          role: 'destructive',
          handler: async () => {
            await ordersStore.updateOrderStatus(orderId, OrderStatus.REQUEST_CANCEL);
            const toast = await toastController.create({
              message: cancelRequestedMsg,
              duration: 3000,
              color: 'warning',
            });
            await toast.present();
            router.navigate(['/tabs/assignment']);
          },
        },
      ],
    });
    await alert.present();
  }
}
