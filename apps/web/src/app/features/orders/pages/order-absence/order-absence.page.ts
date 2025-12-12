import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  OnInit,
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
  IonCheckbox,
  AlertController,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  homeOutline,
  chevronBackOutline,
  checkmarkOutline,
  warningOutline,
  callOutline,
  personOutline,
  locationOutline,
  calendarOutline,
  refreshOutline,
  alertCircleOutline,
} from 'ionicons/icons';
import { OrdersStore } from '../../../../store/orders/orders.store';
import { Order, OrderStatus } from '../../../../store/orders/orders.models';

/**
 * 부재 사유 코드 정의
 */
interface AbsenceReasonCode {
  value: string;
  label: string;
}

const ABSENCE_REASON_CODES: AbsenceReasonCode[] = [
  { value: 'NOT_HOME', label: '부재중' },
  { value: 'NO_CONTACT', label: '연락두절' },
  { value: 'REFUSED', label: '방문거부' },
  { value: 'WRONG_ADDRESS', label: '주소오류' },
  { value: 'OTHER', label: '기타' },
];

const MAX_RETRY_COUNT = 3;

@Component({
  selector: 'app-order-absence',
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
    IonCheckbox,
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
        <ion-title>부재 처리</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (isLoading()) {
        <div class="loading-container">
          <ion-spinner name="crescent" color="primary"></ion-spinner>
          <p>로딩 중...</p>
        </div>
      } @else if (order()) {
        <!-- Retry Count Badge -->
        <div class="retry-count-banner">
          <ion-icon name="refresh-outline"></ion-icon>
          <div class="retry-info">
            <span class="retry-label">재방문</span>
            <span class="retry-value" [class.max-reached]="isMaxRetryReached()">
              {{ currentRetryCount() }}/{{ maxRetryCount }}회
            </span>
          </div>
          @if (!isMaxRetryReached()) {
            <ion-badge class="retry-badge">
              {{ remainingRetries() }}회 남음
            </ion-badge>
          }
        </div>

        <!-- Max Retry Warning Banner -->
        @if (isMaxRetryReached()) {
          <div class="warning-banner">
            <ion-icon name="warning-outline"></ion-icon>
            <div class="warning-content">
              <strong>최대 재방문 횟수 도달</strong>
              <p>더 이상 재방문 예약이 불가합니다. 관리자에게 에스컬레이션 처리가 필요합니다.</p>
            </div>
          </div>
        }

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
            <span>예약일: {{ order()!.appointmentDate }} {{ order()!.appointmentSlot || '' }}</span>
          </div>

          @if (order()!.customerPhone) {
            <div class="info-row">
              <ion-icon name="call-outline"></ion-icon>
              <span>{{ order()!.customerPhone }}</span>
            </div>
          }
        </div>

        <!-- Absence Form -->
        <div class="form-section">
          <h2 class="section-title">부재 정보</h2>

          <!-- Absence Reason Select -->
          <div class="form-group">
            <label class="form-label">부재 사유 <span class="required">*</span></label>
            <ion-item class="custom-select" lines="none">
              <ion-select
                [(ngModel)]="selectedReasonCode"
                placeholder="사유를 선택하세요"
                interface="action-sheet"
                [interfaceOptions]="{ header: '부재 사유 선택' }"
              >
                @for (reason of reasonCodes; track reason.value) {
                  <ion-select-option [value]="reason.value">
                    {{ reason.label }}
                  </ion-select-option>
                }
              </ion-select>
            </ion-item>
          </div>

          <!-- Contact Attempt Checkbox -->
          <div class="form-group">
            <ion-item class="custom-checkbox" lines="none">
              <ion-checkbox
                [(ngModel)]="contactAttempted"
                slot="start"
                [disabled]="false"
              ></ion-checkbox>
              <ion-label>
                <span class="checkbox-label">고객 연락 시도</span>
                <ion-note class="checkbox-note">방문 전 고객에게 연락을 시도했습니다</ion-note>
              </ion-label>
            </ion-item>
          </div>

          <!-- Next Visit Date Picker (only if retries remaining) -->
          @if (!isMaxRetryReached()) {
            <div class="form-group">
              <label class="form-label">다음 방문 예정일 <span class="required">*</span></label>
              <div class="date-picker-container">
                <ion-datetime
                  [(ngModel)]="nextVisitDate"
                  presentation="date"
                  [min]="minDate()"
                  [max]="maxDate()"
                  [preferWheel]="false"
                  locale="ko-KR"
                  [firstDayOfWeek]="0"
                  class="custom-datetime"
                >
                  <span slot="title">다음 방문일 선택</span>
                </ion-datetime>
              </div>
              <div class="date-hint">
                <ion-icon name="calendar-outline"></ion-icon>
                <span>오늘로부터 최대 7일까지 선택 가능합니다</span>
              </div>
            </div>
          }

          <!-- Notes -->
          <div class="form-group">
            <label class="form-label">비고 (선택)</label>
            <ion-item class="custom-textarea" lines="none">
              <ion-textarea
                [(ngModel)]="notes"
                placeholder="추가 메모를 입력하세요... (방문 상황, 특이사항 등)"
                [rows]="4"
                [autoGrow]="true"
                [maxlength]="500"
              ></ion-textarea>
            </ion-item>
            <div class="char-count">{{ notes.length }}/500</div>
          </div>
        </div>

        <!-- Info Banner -->
        @if (!isMaxRetryReached()) {
          <div class="info-banner">
            <ion-icon name="alert-circle-outline"></ion-icon>
            <div>
              <strong>재방문 안내</strong>
              <p>부재 처리 시 선택한 날짜로 자동 재방문 예약됩니다.</p>
            </div>
          </div>
        }

        <!-- Submit Section -->
        <div class="submit-section">
          @if (isMaxRetryReached()) {
            <!-- Escalation Button -->
            <ion-button
              expand="block"
              color="warning"
              [disabled]="!isFormValidForEscalation() || isSubmitting()"
              (click)="submitEscalation()"
              class="escalation-button"
            >
              @if (isSubmitting()) {
                <ion-spinner name="crescent" class="button-spinner"></ion-spinner>
                <span>처리 중...</span>
              } @else {
                <ion-icon slot="start" name="warning-outline"></ion-icon>
                <span>에스컬레이션 요청</span>
              }
            </ion-button>
          } @else {
            <!-- Normal Absence Submit Button -->
            <ion-button
              expand="block"
              [disabled]="!isFormValid() || isSubmitting()"
              (click)="submitAbsence()"
              class="submit-button"
            >
              @if (isSubmitting()) {
                <ion-spinner name="crescent" class="button-spinner"></ion-spinner>
                <span>처리 중...</span>
              } @else {
                <ion-icon slot="start" name="checkmark-outline"></ion-icon>
                <span>부재 처리 및 재방문 예약</span>
              }
            </ion-button>
          }
        </div>
      } @else {
        <div class="error-container">
          <ion-icon name="alert-circle-outline" class="error-icon"></ion-icon>
          <p>주문을 찾을 수 없습니다.</p>
          <ion-button fill="outline" routerLink="/tabs/orders">
            주문 목록으로 돌아가기
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

    .error-icon {
      font-size: 48px;
      color: #d1d5db;
    }

    /* Retry Count Banner */
    .retry-count-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #ffffff;
      border-radius: var(--border-radius);
      padding: 14px 16px;
      margin-bottom: 16px;
      box-shadow: var(--card-shadow);
    }

    .retry-count-banner ion-icon {
      font-size: 24px;
      color: var(--primary-color);
    }

    .retry-info {
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .retry-label {
      font-size: 12px;
      color: #6b7280;
    }

    .retry-value {
      font-size: 18px;
      font-weight: 700;
      color: #111827;
    }

    .retry-value.max-reached {
      color: var(--danger-color);
    }

    .retry-badge {
      --background: #dbeafe;
      --color: #1d4ed8;
      font-size: 12px;
      font-weight: 500;
      padding: 4px 10px;
      border-radius: 16px;
    }

    /* Warning Banner */
    .warning-banner {
      display: flex;
      gap: 12px;
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: var(--border-radius);
      padding: 14px 16px;
      margin-bottom: 16px;
    }

    .warning-banner ion-icon {
      color: var(--warning-color);
      font-size: 24px;
      min-width: 24px;
      margin-top: 2px;
    }

    .warning-content {
      flex: 1;
    }

    .warning-content strong {
      display: block;
      font-size: 14px;
      color: #92400e;
      margin-bottom: 4px;
    }

    .warning-content p {
      font-size: 13px;
      color: #b45309;
      margin: 0;
      line-height: 1.4;
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

    .status-absent {
      --background: #fce7f3;
      --color: #be185d;
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

    /* Checkbox Styling */
    .custom-checkbox {
      --background: #f9fafb;
      --border-radius: 10px;
      --padding-start: 14px;
      --padding-end: 14px;
      --min-height: 56px;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
    }

    .custom-checkbox ion-checkbox {
      --size: 22px;
      --checkbox-background-checked: var(--primary-color);
      --border-color: #d1d5db;
      --border-color-checked: var(--primary-color);
      margin-right: 12px;
    }

    .checkbox-label {
      font-size: 14px;
      font-weight: 500;
      color: #374151;
      display: block;
    }

    .checkbox-note {
      font-size: 12px;
      color: #6b7280;
      display: block;
      margin-top: 2px;
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

    /* Info Banner */
    .info-banner {
      display: flex;
      gap: 12px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: var(--border-radius);
      padding: 14px 16px;
      margin-bottom: 24px;
    }

    .info-banner ion-icon {
      color: var(--primary-color);
      font-size: 22px;
      min-width: 22px;
      margin-top: 2px;
    }

    .info-banner strong {
      display: block;
      font-size: 14px;
      color: #1e40af;
      margin-bottom: 4px;
    }

    .info-banner p {
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

    .escalation-button {
      --background: var(--warning-color);
      --background-hover: #d97706;
      --background-activated: #b45309;
      --border-radius: 10px;
      --box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
      font-weight: 600;
      font-size: 16px;
      height: 52px;
    }

    .escalation-button[disabled] {
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

      .retry-count-banner,
      .warning-banner,
      .order-summary-card,
      .form-section,
      .info-banner,
      .submit-section {
        max-width: 600px;
        margin-left: auto;
        margin-right: auto;
      }
    }
  `],
})
export class OrderAbsencePage implements OnInit {
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
  nextVisitDate: string = '';
  contactAttempted: boolean = false;
  notes: string = '';

  // Constants
  readonly reasonCodes = ABSENCE_REASON_CODES;
  readonly maxRetryCount = MAX_RETRY_COUNT;

  // Simulated retry count (in real app, would come from order data)
  // This would typically be stored in the order model
  currentRetryCount = signal(0);

  // Computed values
  remainingRetries = computed(() => this.maxRetryCount - this.currentRetryCount());
  isMaxRetryReached = computed(() => this.currentRetryCount() >= this.maxRetryCount);

  minDate = computed(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });

  maxDate = computed(() => {
    const maxDay = new Date();
    maxDay.setDate(maxDay.getDate() + 7);
    return maxDay.toISOString().split('T')[0];
  });

  constructor() {
    addIcons({
      homeOutline,
      chevronBackOutline,
      checkmarkOutline,
      warningOutline,
      callOutline,
      personOutline,
      locationOutline,
      calendarOutline,
      refreshOutline,
      alertCircleOutline,
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
    this.nextVisitDate = this.minDate();
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
        this.loadRetryCount(selectedOrder);
      } else {
        // If not in store, check orders array
        const storeOrders = this.ordersStore.orders();
        const foundOrder = storeOrders.find(o => o.id === orderId);
        if (foundOrder) {
          this.order.set(foundOrder);
          this.loadRetryCount(foundOrder);
        }
      }
    } catch (error) {
      console.error('Failed to load order:', error);
      await this.showToast('주문 정보를 불러오는데 실패했습니다.', 'danger');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Load retry count from order data
   * In a real implementation, this would come from the order's history or a dedicated field
   */
  private loadRetryCount(order: Order): void {
    // Simulating retry count based on order status history
    // In production, this would be tracked in the order model or via API
    // For demo purposes, we'll use a random value or check if order was previously absent
    if (order.status === OrderStatus.ABSENT) {
      // If already marked absent, increment count
      this.currentRetryCount.set(Math.min(this.currentRetryCount() + 1, this.maxRetryCount));
    }
    // In real implementation:
    // this.currentRetryCount.set(order.absenceRetryCount || 0);
  }

  /**
   * Check if form is valid for normal absence processing
   */
  isFormValid(): boolean {
    return (
      this.selectedReasonCode !== '' &&
      this.nextVisitDate !== '' &&
      this.isDateValid(this.nextVisitDate) &&
      !this.isMaxRetryReached()
    );
  }

  /**
   * Check if form is valid for escalation
   */
  isFormValidForEscalation(): boolean {
    return this.selectedReasonCode !== '';
  }

  /**
   * Validate selected date is within allowed range
   */
  private isDateValid(dateStr: string): boolean {
    if (!dateStr) return false;

    const selected = new Date(dateStr);
    const min = new Date(this.minDate());
    const max = new Date(this.maxDate());

    selected.setHours(0, 0, 0, 0);
    min.setHours(0, 0, 0, 0);
    max.setHours(0, 0, 0, 0);

    return selected >= min && selected <= max;
  }

  /**
   * Get Korean label for order status
   */
  getStatusLabel(status: OrderStatus): string {
    const labels: Record<OrderStatus, string> = {
      [OrderStatus.UNASSIGNED]: '미배정',
      [OrderStatus.ASSIGNED]: '배정',
      [OrderStatus.CONFIRMED]: '배정확정',
      [OrderStatus.RELEASED]: '출고확정',
      [OrderStatus.DISPATCHED]: '출문',
      [OrderStatus.POSTPONED]: '연기',
      [OrderStatus.ABSENT]: '부재',
      [OrderStatus.COMPLETED]: '인수',
      [OrderStatus.PARTIAL]: '부분인수',
      [OrderStatus.COLLECTED]: '회수',
      [OrderStatus.CANCELLED]: '취소',
      [OrderStatus.REQUEST_CANCEL]: '의뢰취소',
    };
    return labels[status] || status;
  }

  /**
   * Get Korean label for absence reason
   */
  private getReasonLabel(reasonCode: string): string {
    const reason = ABSENCE_REASON_CODES.find(r => r.value === reasonCode);
    return reason?.label || reasonCode;
  }

  /**
   * Submit absence with retry scheduling
   */
  async submitAbsence(): Promise<void> {
    if (!this.isFormValid() || !this.order()) {
      return;
    }

    const nextRetryCount = this.currentRetryCount() + 1;
    const formattedDate = this.formatDate(this.nextVisitDate);

    const alert = await this.alertController.create({
      header: '부재 처리 확인',
      message: `
        <p>부재 사유: ${this.getReasonLabel(this.selectedReasonCode)}</p>
        <p>다음 방문일: ${formattedDate}</p>
        <p>재방문 횟수: ${nextRetryCount}/${this.maxRetryCount}회</p>
        <br>
        <p>부재 처리를 진행하시겠습니까?</p>
      `,
      buttons: [
        {
          text: '취소',
          role: 'cancel',
        },
        {
          text: '확인',
          handler: () => this.processAbsence(),
        },
      ],
    });

    await alert.present();
  }

  /**
   * Process the absence action with retry scheduling
   */
  private async processAbsence(): Promise<void> {
    this.isSubmitting.set(true);

    try {
      const orderId = this.orderId();
      const newDate = this.nextVisitDate.split('T')[0];

      // Update order status to ABSENT
      await this.ordersStore.updateOrderStatus(orderId, OrderStatus.ABSENT);

      // In a real implementation, you would also:
      // 1. Save the absence reason code
      // 2. Save contact attempt flag
      // 3. Save notes
      // 4. Increment retry count
      // 5. Schedule the next visit date
      // 6. Trigger notifications

      // Increment local retry count for demo
      this.currentRetryCount.set(this.currentRetryCount() + 1);

      await this.showToast('부재 처리가 완료되었습니다. 재방문이 예약되었습니다.', 'success');

      // Navigate back to order detail
      this.router.navigate(['/orders', orderId], { replaceUrl: true });
    } catch (error) {
      console.error('Failed to process absence:', error);
      await this.showToast('부재 처리에 실패했습니다. 다시 시도해주세요.', 'danger');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  /**
   * Submit escalation request when max retries reached
   */
  async submitEscalation(): Promise<void> {
    if (!this.isFormValidForEscalation() || !this.order()) {
      return;
    }

    const alert = await this.alertController.create({
      header: '에스컬레이션 확인',
      message: `
        <p>최대 재방문 횟수(${this.maxRetryCount}회)에 도달했습니다.</p>
        <p>부재 사유: ${this.getReasonLabel(this.selectedReasonCode)}</p>
        <br>
        <p>관리자에게 에스컬레이션 요청을 보내시겠습니까?</p>
      `,
      buttons: [
        {
          text: '취소',
          role: 'cancel',
        },
        {
          text: '요청',
          handler: () => this.processEscalation(),
        },
      ],
    });

    await alert.present();
  }

  /**
   * Process the escalation request
   */
  private async processEscalation(): Promise<void> {
    this.isSubmitting.set(true);

    try {
      const orderId = this.orderId();

      // Update order status to ABSENT
      await this.ordersStore.updateOrderStatus(orderId, OrderStatus.ABSENT);

      // In a real implementation, you would also:
      // 1. Create an escalation ticket
      // 2. Notify admin/manager
      // 3. Save all absence details
      // 4. Flag order for special handling

      await this.showToast('에스컬레이션 요청이 전송되었습니다. 관리자가 확인 후 연락드릴 예정입니다.', 'warning');

      // Navigate back to order detail
      this.router.navigate(['/orders', orderId], { replaceUrl: true });
    } catch (error) {
      console.error('Failed to process escalation:', error);
      await this.showToast('에스컬레이션 요청에 실패했습니다. 다시 시도해주세요.', 'danger');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  /**
   * Format date for display
   */
  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}년 ${month}월 ${day}일`;
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
