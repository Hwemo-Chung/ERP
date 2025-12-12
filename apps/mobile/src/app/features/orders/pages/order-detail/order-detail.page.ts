import { Component, inject, OnInit, signal } from '@angular/core';
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
  IonActionSheet,
  ActionSheetController,
  AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  callOutline,
  navigateOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  timeOutline,
  personOutline,
} from 'ionicons/icons';
import { OrdersService, Order } from '../../services/orders.service';
import {
  OrderStatus,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
} from '../../../../store/orders/orders.models';

/**
 * Valid state transitions per status
 * Based on ARCHITECTURE.md Order State Machine
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.UNASSIGNED]: [OrderStatus.ASSIGNED],
  [OrderStatus.ASSIGNED]: [OrderStatus.CONFIRMED, OrderStatus.UNASSIGNED],
  [OrderStatus.CONFIRMED]: [OrderStatus.RELEASED, OrderStatus.ASSIGNED],
  [OrderStatus.RELEASED]: [OrderStatus.DISPATCHED, OrderStatus.CONFIRMED],
  [OrderStatus.DISPATCHED]: [
    OrderStatus.COMPLETED,
    OrderStatus.PARTIAL,
    OrderStatus.POSTPONED,
    OrderStatus.ABSENT,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.POSTPONED]: [OrderStatus.DISPATCHED, OrderStatus.ABSENT, OrderStatus.CANCELLED],
  [OrderStatus.ABSENT]: [OrderStatus.DISPATCHED, OrderStatus.POSTPONED, OrderStatus.CANCELLED],
  [OrderStatus.COMPLETED]: [OrderStatus.COLLECTED],
  [OrderStatus.PARTIAL]: [OrderStatus.COMPLETED, OrderStatus.COLLECTED],
  [OrderStatus.COLLECTED]: [], // Terminal
  [OrderStatus.CANCELLED]: [], // Terminal
  [OrderStatus.REQUEST_CANCEL]: [], // Terminal
};

/**
 * Action labels for status transition buttons
 */
const TRANSITION_ACTION_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.UNASSIGNED]: '미배정으로',
  [OrderStatus.ASSIGNED]: '배정으로 되돌리기',
  [OrderStatus.CONFIRMED]: '배정 확정',
  [OrderStatus.RELEASED]: '출고 확정',
  [OrderStatus.DISPATCHED]: '출문 처리',
  [OrderStatus.POSTPONED]: '연기',
  [OrderStatus.ABSENT]: '부재 처리',
  [OrderStatus.COMPLETED]: '인수 완료',
  [OrderStatus.PARTIAL]: '부분 인수',
  [OrderStatus.COLLECTED]: '회수 완료',
  [OrderStatus.CANCELLED]: '취소',
  [OrderStatus.REQUEST_CANCEL]: '취소 요청',
};

/**
 * Button colors for status transitions
 */
const TRANSITION_BUTTON_COLORS: Record<OrderStatus, string> = {
  [OrderStatus.UNASSIGNED]: 'medium',
  [OrderStatus.ASSIGNED]: 'medium',
  [OrderStatus.CONFIRMED]: 'primary',
  [OrderStatus.RELEASED]: 'tertiary',
  [OrderStatus.DISPATCHED]: 'secondary',
  [OrderStatus.POSTPONED]: 'warning',
  [OrderStatus.ABSENT]: 'warning',
  [OrderStatus.COMPLETED]: 'success',
  [OrderStatus.PARTIAL]: 'success',
  [OrderStatus.COLLECTED]: 'success',
  [OrderStatus.CANCELLED]: 'danger',
  [OrderStatus.REQUEST_CANCEL]: 'danger',
};

/**
 * Icons for status transitions
 */
const TRANSITION_ICONS: Record<OrderStatus, string> = {
  [OrderStatus.UNASSIGNED]: 'arrow-undo-outline',
  [OrderStatus.ASSIGNED]: 'person-outline',
  [OrderStatus.CONFIRMED]: 'checkmark-circle-outline',
  [OrderStatus.RELEASED]: 'cube-outline',
  [OrderStatus.DISPATCHED]: 'navigate-outline',
  [OrderStatus.POSTPONED]: 'time-outline',
  [OrderStatus.ABSENT]: 'close-circle-outline',
  [OrderStatus.COMPLETED]: 'checkmark-circle-outline',
  [OrderStatus.PARTIAL]: 'checkmark-outline',
  [OrderStatus.COLLECTED]: 'checkmark-done-outline',
  [OrderStatus.CANCELLED]: 'close-outline',
  [OrderStatus.REQUEST_CANCEL]: 'alert-circle-outline',
};

@Component({
  selector: 'app-order-detail',
  standalone: true,
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
    IonActionSheet,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/orders"></ion-back-button>
        </ion-buttons>
        <ion-title>Order Details</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (isLoading()) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      } @else if (order()) {
        <!-- Status Badge -->
        <div class="status-section">
          <ion-badge [class]="'status-badge status-' + order()!.status.toLowerCase()">
            {{ order()!.status }}
          </ion-badge>
        </div>

        <!-- Order Info Card -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ order()!.erpOrderNumber }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list lines="none">
              <ion-item>
                <ion-icon slot="start" name="time-outline"></ion-icon>
                <ion-label>
                  <p>Appointment</p>
                  <h3>{{ order()!.appointmentDate | date:'yyyy-MM-dd' }} {{ order()!.appointmentSlot }}</h3>
                </ion-label>
              </ion-item>
              @if (order()!.installerName) {
                <ion-item>
                  <ion-icon slot="start" name="person-outline"></ion-icon>
                  <ion-label>
                    <p>Installer</p>
                    <h3>{{ order()!.installerName }}</h3>
                  </ion-label>
                </ion-item>
              }
            </ion-list>
          </ion-card-content>
        </ion-card>

        <!-- Customer Info Card -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>Customer Information</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list lines="none">
              <ion-item>
                <ion-label>
                  <h2>{{ order()!.customerName }}</h2>
                  <p>{{ order()!.customerAddress }}</p>
                </ion-label>
              </ion-item>
            </ion-list>
            <div class="action-buttons">
              <ion-button fill="outline" size="small" (click)="callCustomer()">
                <ion-icon slot="start" name="call-outline"></ion-icon>
                Call
              </ion-button>
              <ion-button fill="outline" size="small" (click)="navigateToAddress()">
                <ion-icon slot="start" name="navigate-outline"></ion-icon>
                Navigate
              </ion-button>
            </div>
          </ion-card-content>
        </ion-card>

        <!-- Order Lines Card -->
        @if (order()!.orderLines?.length) {
          <ion-card>
            <ion-card-header>
              <ion-card-title>Products ({{ order()!.orderLines!.length }})</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <ion-list>
                @for (line of order()!.orderLines; track line.id) {
                  <ion-item>
                    <ion-label>
                      <h3>{{ line.productName }}</h3>
                      <p>{{ line.productCode }} × {{ line.quantity }}</p>
                      @if (line.serialNumber) {
                        <p><strong>S/N:</strong> {{ line.serialNumber }}</p>
                      }
                    </ion-label>
                  </ion-item>
                }
              </ion-list>
            </ion-card-content>
          </ion-card>
        }

        <!-- Status Actions -->
        @if (allowedTransitions().length > 0) {
          <div class="status-actions">
            @for (status of allowedTransitions(); track status) {
              <ion-button
                [color]="getStatusButtonColor(status)"
                expand="block"
                (click)="confirmStatusChange(status)"
              >
                <ion-icon slot="start" [name]="getStatusIcon(status)"></ion-icon>
                {{ getStatusLabel(status) }}
              </ion-button>
            }
          </div>
        }
      } @else {
        <div class="empty-state">
          <h3>Order not found</h3>
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .loading-container {
      display: flex;
      justify-content: center;
      padding: 48px;
    }

    .status-section {
      text-align: center;
      margin-bottom: 16px;

      ion-badge {
        font-size: 16px;
        padding: 8px 24px;
      }
    }

    ion-card {
      margin-bottom: 16px;
    }

    .action-buttons {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }

    .status-actions {
      margin-top: 24px;

      ion-button {
        margin-bottom: 8px;
      }
    }
  `],
})
export class OrderDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ordersService = inject(OrdersService);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly alertCtrl = inject(AlertController);

  protected readonly order = signal<Order | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly allowedTransitions = signal<string[]>([]);

  constructor() {
    addIcons({
      callOutline,
      navigateOutline,
      checkmarkCircleOutline,
      closeCircleOutline,
      timeOutline,
      personOutline,
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadOrder(id);
    }
  }

  private async loadOrder(id: string): Promise<void> {
    this.isLoading.set(true);
    try {
      const order = await this.ordersService.getOrder(id);
      this.order.set(order);

      if (order) {
        const transitions = ALLOWED_TRANSITIONS[order.status as OrderStatus] || [];
        this.allowedTransitions.set(transitions as string[]);
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  protected callCustomer(): void {
    const phone = this.order()?.customerPhone;
    if (phone) {
      window.open(`tel:${phone}`, '_system');
    }
  }

  protected navigateToAddress(): void {
    const address = this.order()?.customerAddress;
    if (address) {
      const encoded = encodeURIComponent(address);
      window.open(`https://maps.google.com?q=${encoded}`, '_system');
    }
  }

  protected async confirmStatusChange(newStatus: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Confirm Status Change',
      message: `Change status to ${this.getStatusLabel(newStatus)}?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Confirm',
          handler: () => this.updateStatus(newStatus),
        },
      ],
    });

    await alert.present();
  }

  private async updateStatus(newStatus: string): Promise<void> {
    const currentOrder = this.order();
    if (!currentOrder) return;

    try {
      const updated = await this.ordersService.updateStatus(currentOrder.id, {
        status: newStatus,
        version: currentOrder.version,
      });

      this.order.set(updated);
      const transitions = ALLOWED_TRANSITIONS[updated.status as OrderStatus] || [];
      this.allowedTransitions.set(transitions as string[]);
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  }

  protected getStatusLabel(status: string): string {
    return TRANSITION_ACTION_LABELS[status as OrderStatus] || status;
  }

  protected getStatusButtonColor(status: string): string {
    return TRANSITION_BUTTON_COLORS[status as OrderStatus] || 'primary';
  }

  protected getStatusIcon(status: string): string {
    return TRANSITION_ICONS[status as OrderStatus] || 'checkmark-circle-outline';
  }
}
