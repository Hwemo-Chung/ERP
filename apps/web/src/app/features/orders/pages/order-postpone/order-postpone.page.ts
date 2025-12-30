// i18n 적용됨 - 번역 키: ORDERS.POSTPONE.*, ORDERS.STATUS.*
import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
  OnInit,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonBackButton,
  IonButtons,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonDatetime,
  IonTextarea,
  IonButton,
  IonSpinner,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonBadge,
  IonNote,
  AlertController,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  calendarOutline,
  chevronBackOutline,
  checkmarkOutline,
  timeOutline,
  personOutline,
  locationOutline,
  documentTextOutline,
} from 'ionicons/icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { OrdersStore } from '../../../../store/orders/orders.store';
import { Order, OrderStatus } from '../../../../store/orders/orders.models';

/**
 * 연기 사유 코드 정의 - i18n 키 참조용
 */
interface ReasonCode {
  value: string;
  labelKey: string;
}

const REASON_CODES: ReasonCode[] = [
  { value: 'CUSTOMER_REQUEST', labelKey: 'ORDERS.POSTPONE.REASON.CUSTOMER_REQUEST' },
  { value: 'OUT_OF_STOCK', labelKey: 'ORDERS.POSTPONE.REASON.OUT_OF_STOCK' },
  { value: 'INSTALLER_SCHEDULE', labelKey: 'ORDERS.POSTPONE.REASON.INSTALLER_SCHEDULE' },
  { value: 'WEATHER', labelKey: 'ORDERS.POSTPONE.REASON.WEATHER' },
  { value: 'OTHER', labelKey: 'ORDERS.POSTPONE.REASON.OTHER' },
];

@Component({
  selector: 'app-order-postpone',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonBackButton,
    IonButtons,
    IonItem,
    IonLabel,
    IonSelect,
    IonSelectOption,
    IonDatetime,
    IonTextarea,
    IonButton,
    IonSpinner,
    IonIcon,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonBadge,
    IonNote,
    TranslateModule,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button
            [defaultHref]="'/orders/' + orderId()"
            text=""
          ></ion-back-button>
        </ion-buttons>
        <ion-title>{{ 'ORDERS.POSTPONE.TITLE' | translate }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (isLoading()) {
        <div class="loading-container">
          <ion-spinner name="crescent" color="primary"></ion-spinner>
          <p>{{ 'ORDERS.POSTPONE.LOADING' | translate }}</p>
        </div>
      } @else if (order()) {
        <!-- Order Summary Card -->
        <div class="order-summary-card">
          <div class="card-header">
            <div class="order-number">{{ order()!.erpOrderNumber }}</div>
            <ion-badge [class]="'status-badge status-' + order()!.status.toLowerCase()">
              {{ getStatusLabel(order()!.status) }}
            </ion-badge>
          </div>

          <div class="info-row">
            <ion-icon name="person-outline"></ion-icon>
            <span>{{ order()!.customerName }}</span>
          </div>

          <div class="info-row">
            <ion-icon name="location-outline"></ion-icon>
            <span>{{ order()!.customerAddress || order()!.address || '-' }}</span>
          </div>

          <div class="info-row">
            <ion-icon name="calendar-outline"></ion-icon>
            <span>{{ 'ORDERS.POSTPONE.CURRENT_APPOINTMENT' | translate }}: {{ order()!.appointmentDate }} {{ order()!.appointmentSlot || '' }}</span>
          </div>

          @if (order()!.installerName) {
            <div class="info-row">
              <ion-icon name="time-outline"></ion-icon>
              <span>{{ 'ORDERS.POSTPONE.INSTALLER' | translate }}: {{ order()!.installerName }}</span>
            </div>
          }
        </div>

        <!-- Postpone Form -->
        <div class="form-section">
          <h2 class="section-title">{{ 'ORDERS.POSTPONE.FORM_TITLE' | translate }}</h2>

          <!-- Reason Code Select -->
          <div class="form-group">
            <label class="form-label">{{ 'ORDERS.POSTPONE.REASON.TITLE' | translate }} <span class="required">*</span></label>
            <ion-item class="custom-select" lines="none">
              <ion-select
                [(ngModel)]="selectedReasonCode"
                [placeholder]="'COMMON.PLACEHOLDER.SELECT' | translate"
                interface="action-sheet"
                [interfaceOptions]="{ header: translate.instant('ORDERS.POSTPONE.REASON.TITLE') }"
              >
                @for (reason of reasonCodes; track reason.value) {
                  <ion-select-option [value]="reason.value">
                    {{ reason.labelKey | translate }}
                  </ion-select-option>
                }
              </ion-select>
            </ion-item>
          </div>

          <!-- New Appointment Date -->
          <div class="form-group">
            <label class="form-label">{{ 'ORDERS.POSTPONE.NEW_DATE.TITLE' | translate }} <span class="required">*</span></label>
            <div class="date-picker-container">
              <ion-datetime
                [(ngModel)]="selectedDate"
                presentation="date"
                [min]="minDate()"
                [max]="maxDate()"
                [preferWheel]="false"
                locale="ko-KR"
                [firstDayOfWeek]="0"
                class="custom-datetime"
              >
                <span slot="title">{{ 'ORDERS.POSTPONE.NEW_DATE.DATE_HINT' | translate }}</span>
              </ion-datetime>
            </div>
            <div class="date-hint">
              <ion-icon name="time-outline"></ion-icon>
              <span>{{ 'ORDERS.POSTPONE.NEW_DATE.DATE_HINT' | translate }}</span>
            </div>
          </div>

          <!-- Notes -->
          <div class="form-group">
            <label class="form-label">{{ 'ORDERS.POSTPONE.MEMO.LABEL' | translate }}</label>
            <ion-item class="custom-textarea" lines="none">
              <ion-textarea
                [(ngModel)]="notes"
                [placeholder]="'ORDERS.POSTPONE.MEMO.PLACEHOLDER' | translate"
                [rows]="4"
                [autoGrow]="true"
                [maxlength]="500"
              ></ion-textarea>
            </ion-item>
            <div class="char-count">{{ notes.length }}/500</div>
          </div>
        </div>

        <!-- Notification Info -->
        <div class="notification-info">
          <ion-icon name="document-text-outline"></ion-icon>
          <div>
            <strong>{{ 'ORDERS.POSTPONE.CONFIRM.TITLE' | translate }}</strong>
            <p>{{ 'ORDERS.POSTPONE.CONFIRM.MESSAGE' | translate }}</p>
          </div>
        </div>

        <!-- Submit Button -->
        <div class="submit-section">
          <ion-button
            expand="block"
            [disabled]="!isFormValid() || isSubmitting()"
            (click)="submitPostpone()"
            class="submit-button"
          >
            @if (isSubmitting()) {
              <ion-spinner name="crescent" class="button-spinner"></ion-spinner>
              <span>{{ 'COMMON.LOADING' | translate }}</span>
            } @else {
              <ion-icon slot="start" name="checkmark-outline"></ion-icon>
              <span>{{ 'ORDERS.POSTPONE.SUBMIT' | translate }}</span>
            }
          </ion-button>
        </div>
      } @else {
        <div class="error-container">
          <p>{{ 'COMMON.ERROR.NOT_FOUND' | translate }}</p>
          <ion-button fill="outline" routerLink="/tabs/orders">
            {{ 'COMMON.BUTTON.BACK_TO_LIST' | translate }}
          </ion-button>
        </div>
      }
    </ion-content>
  `,
  styles: [`
    :host {
      --primary-color: #3b82f6;
      --success-color: #10b981;
      --warning-color: #f59e0b;
      --danger-color: #ef4444;
      --border-radius: 12px;
      --card-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    ion-toolbar {
      --background: #ffffff;
      --border-color: #e5e7eb;
    }

    ion-title {
      font-weight: 600;
      font-size: 17px;
    }

    ion-content {
      --background: #f9fafb;
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 60vh;
      gap: 12px;
      color: #6b7280;
    }

    .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 60vh;
      gap: 16px;
      color: #6b7280;
      text-align: center;
    }

    /* Order Summary Card */
    .order-summary-card {
      background: #ffffff;
      border-radius: var(--border-radius);
      padding: 16px;
      margin-bottom: 20px;
      box-shadow: var(--card-shadow);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e5e7eb;
    }

    .order-number {
      font-size: 16px;
      font-weight: 600;
      color: #111827;
    }

    .status-badge {
      font-size: 12px;
      font-weight: 500;
      padding: 4px 10px;
      border-radius: 20px;
    }

    .status-dispatched {
      --background: #dbeafe;
      --color: #1d4ed8;
    }

    .status-assigned,
    .status-confirmed {
      --background: #fef3c7;
      --color: #d97706;
    }

    .status-completed {
      --background: #d1fae5;
      --color: #059669;
    }

    .status-postponed {
      --background: #fee2e2;
      --color: #dc2626;
    }

    .info-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
      color: #4b5563;
      font-size: 14px;
    }

    .info-row ion-icon {
      color: #9ca3af;
      font-size: 18px;
      min-width: 18px;
    }

    /* Form Section */
    .form-section {
      background: #ffffff;
      border-radius: var(--border-radius);
      padding: 20px 16px;
      margin-bottom: 20px;
      box-shadow: var(--card-shadow);
    }

    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #111827;
      margin: 0 0 20px 0;
    }

    .form-group {
      margin-bottom: 24px;
    }

    .form-group:last-child {
      margin-bottom: 0;
    }

    .form-label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: #374151;
      margin-bottom: 8px;
    }

    .required {
      color: var(--danger-color);
    }

    .custom-select {
      --background: #f9fafb;
      --border-radius: 10px;
      --padding-start: 14px;
      --padding-end: 14px;
      --min-height: 48px;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
    }

    .custom-select ion-select {
      width: 100%;
      --placeholder-color: #9ca3af;
      --placeholder-opacity: 1;
    }

    .date-picker-container {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      overflow: hidden;
    }

    .custom-datetime {
      --background: transparent;
      width: 100%;
    }

    .custom-datetime::part(calendar-day active),
    .custom-datetime::part(calendar-day):focus {
      background: var(--primary-color);
      color: white;
    }

    .date-hint {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
      font-size: 12px;
      color: #6b7280;
    }

    .date-hint ion-icon {
      font-size: 14px;
    }

    .custom-textarea {
      --background: #f9fafb;
      --border-radius: 10px;
      --padding-start: 14px;
      --padding-end: 14px;
      --padding-top: 12px;
      --padding-bottom: 12px;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
    }

    .custom-textarea ion-textarea {
      --placeholder-color: #9ca3af;
      --placeholder-opacity: 1;
      font-size: 14px;
    }

    .char-count {
      text-align: right;
      font-size: 12px;
      color: #9ca3af;
      margin-top: 6px;
    }

    /* Notification Info */
    .notification-info {
      display: flex;
      gap: 12px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: var(--border-radius);
      padding: 14px 16px;
      margin-bottom: 24px;
    }

    .notification-info ion-icon {
      color: var(--primary-color);
      font-size: 22px;
      min-width: 22px;
      margin-top: 2px;
    }

    .notification-info strong {
      display: block;
      font-size: 14px;
      color: #1e40af;
      margin-bottom: 4px;
    }

    .notification-info p {
      font-size: 13px;
      color: #3b82f6;
      margin: 0;
      line-height: 1.4;
    }

    /* Submit Section */
    .submit-section {
      padding-bottom: 20px;
    }

    .submit-button {
      --background: var(--primary-color);
      --background-hover: #2563eb;
      --background-activated: #1d4ed8;
      --border-radius: 10px;
      --box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
      font-weight: 600;
      font-size: 16px;
      height: 52px;
    }

    .submit-button[disabled] {
      --background: #d1d5db;
      --box-shadow: none;
    }

    .button-spinner {
      width: 20px;
      height: 20px;
      margin-right: 8px;
    }

    /* Responsive adjustments */
    @media (min-width: 768px) {
      ion-content {
        --padding-start: 24px;
        --padding-end: 24px;
      }

      .order-summary-card,
      .form-section {
        max-width: 600px;
        margin-left: auto;
        margin-right: auto;
      }

      .notification-info,
      .submit-section {
        max-width: 600px;
        margin-left: auto;
        margin-right: auto;
      }
    }
  `],
})
export class OrderPostponePage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private ordersStore = inject(OrdersStore);
  private alertController = inject(AlertController);
  private toastController = inject(ToastController);

  // State signals
  orderId = signal<string>('');
  order = signal<Order | null>(null);
  isLoading = signal(true);
  isSubmitting = signal(false);

  // Form fields
  selectedReasonCode: string = '';
  selectedDate: string = '';
  notes: string = '';

  // Constants
  readonly reasonCodes = REASON_CODES;

  // TranslateService를 템플릿에서 사용하기 위해 public으로 노출
  readonly translate = inject(TranslateService);

  // Computed values for date constraints
  minDate = computed(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });

  maxDate = computed(() => {
    const maxDay = new Date();
    maxDay.setDate(maxDay.getDate() + 15);
    return maxDay.toISOString().split('T')[0];
  });

  constructor() {
    addIcons({
      calendarOutline,
      chevronBackOutline,
      checkmarkOutline,
      timeOutline,
      personOutline,
      locationOutline,
      documentTextOutline,
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.orderId.set(id);
      this.loadOrder(id);
    } else {
      this.isLoading.set(false);
    }

    // Set default date to tomorrow
    this.selectedDate = this.minDate();
  }

  /**
   * Load order details from store or API
   */
  private async loadOrder(orderId: string): Promise<void> {
    this.isLoading.set(true);

    try {
      // First try to get from store
      this.ordersStore.selectOrder(orderId);
      const selectedOrder = this.ordersStore.selectedOrder();

      if (selectedOrder) {
        this.order.set(selectedOrder);
      } else {
        // If not in store, the order might need to be loaded
        // For now, we'll check the orders array
        const storeOrders = this.ordersStore.orders();
        const foundOrder = storeOrders.find(o => o.id === orderId);
        if (foundOrder) {
          this.order.set(foundOrder);
        }
      }
    } catch (error) {
      console.error('Failed to load order:', error);
      const msg = this.translate.instant('ORDERS.POSTPONE.ERROR.LOAD_FAILED');
      await this.showToast(msg, 'danger');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Check if form is valid
   */
  isFormValid(): boolean {
    return (
      this.selectedReasonCode !== '' &&
      this.selectedDate !== '' &&
      this.isDateValid(this.selectedDate)
    );
  }

  /**
   * Validate selected date is within allowed range
   */
  private isDateValid(dateStr: string): boolean {
    if (!dateStr) return false;

    const selected = new Date(dateStr);
    const min = new Date(this.minDate());
    const max = new Date(this.maxDate());

    // Reset time parts for comparison
    selected.setHours(0, 0, 0, 0);
    min.setHours(0, 0, 0, 0);
    max.setHours(0, 0, 0, 0);

    return selected >= min && selected <= max;
  }

  /**
   * Get translated label for order status
   */
  getStatusLabel(status: OrderStatus): string {
    return this.translate.instant(`ORDERS.STATUS.${status}`);
  }

  /**
   * Submit postpone request
   */
  async submitPostpone(): Promise<void> {
    if (!this.isFormValid() || !this.order()) {
      return;
    }

    // 비동기 핸들러를 위한 변수 캡처
    const translateService = this.translate;

    // Show confirmation dialog
    const alert = await this.alertController.create({
      header: translateService.instant('ORDERS.POSTPONE.CONFIRM.TITLE'),
      message: translateService.instant('ORDERS.POSTPONE.CONFIRM.MESSAGE'),
      buttons: [
        {
          text: translateService.instant('ORDERS.POSTPONE.CONFIRM.CANCEL'),
          role: 'cancel',
        },
        {
          text: translateService.instant('ORDERS.POSTPONE.CONFIRM.CONFIRM'),
          handler: () => this.processPostpone(),
        },
      ],
    });

    await alert.present();
  }

  /**
   * Process the postpone action
   */
  private async processPostpone(): Promise<void> {
    this.isSubmitting.set(true);

    try {
      const orderId = this.orderId();
      const newDate = this.selectedDate.split('T')[0]; // Extract date part only

      // Update order status to POSTPONED with new appointment date
      await this.ordersStore.updateOrderStatus(orderId, OrderStatus.POSTPONED);

      // In a real implementation, you would also:
      // 1. Update the appointment date
      // 2. Save the reason code and notes
      // 3. Trigger notifications to customer and installer

      // Show success message
      await this.showToast(this.translate.instant('ORDERS.POSTPONE.TOAST.SUCCESS'), 'success');

      // Navigate back to order detail
      this.router.navigate(['/orders', orderId], { replaceUrl: true });
    } catch (error) {
      console.error('Failed to postpone order:', error);
      await this.showToast(this.translate.instant('ORDERS.POSTPONE.TOAST.ERROR'), 'danger');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  /**
   * Format date for display using locale
   */
  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString(this.translate.currentLang || 'ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /**
   * Show toast notification
   */
  private async showToast(
    message: string,
    color: 'success' | 'danger' | 'warning' = 'success'
  ): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color,
    });
    await toast.present();
  }
}
