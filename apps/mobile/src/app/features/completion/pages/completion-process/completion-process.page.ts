/**
 * Completion Process Page
 * PRD FR-06: Order completion workflow with serial input, waste pickup, photos, and certificate
 */
import {
  Component,
  signal,
  computed,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
  AlertController,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  barcodeOutline,
  trashOutline,
  documentTextOutline,
  checkmarkCircleOutline,
  cameraOutline,
  closeCircleOutline,
} from 'ionicons/icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { OrdersStore } from '../../../../store/orders/orders.store';
import { OrderStatus, Order, OrderLine } from '../../../../store/orders/orders.models';
import { CameraService } from '../../../../core/services/camera.service';
import { UIStore } from '../../../../store/ui/ui.store';
import { LoggerService } from '../../../../core/services/logger.service';

@Component({
  selector: 'app-completion-process',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    TranslateModule,
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
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/completion"></ion-back-button>
        </ion-buttons>
        <ion-title>완료 처리</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (isLoading()) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      } @else {
        <!-- Order Info -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>주문 정보</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p><strong>주문번호:</strong> {{ order()?.orderNo || orderId() }}</p>
            <p><strong>고객명:</strong> {{ order()?.customerName || '-' }}</p>
            <p><strong>설치기사:</strong> {{ order()?.installerName || '-' }}</p>
          </ion-card-content>
        </ion-card>

        <!-- Completion Steps -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>완료 처리 단계</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list>
              <!-- Step 1: Serial Input -->
              <ion-item [routerLink]="['../serial-input', orderId()]" detail>
                <ion-icon name="barcode-outline" slot="start" color="primary"></ion-icon>
                <ion-label>
                  <h2>시리얼 번호 입력</h2>
                  <p>제품별 제조번호 입력</p>
                </ion-label>
                @if (serialCompleted()) {
                  <ion-badge slot="end" color="success">완료</ion-badge>
                } @else {
                  <ion-badge slot="end" color="warning">미완료</ion-badge>
                }
              </ion-item>

              <!-- Step 2: Waste Pickup -->
              <ion-item [routerLink]="['../waste-pickup', orderId()]" detail>
                <ion-icon name="trash-outline" slot="start" color="primary"></ion-icon>
                <ion-label>
                  <h2>폐가전 회수</h2>
                  <p>폐가전 회수 정보 입력</p>
                </ion-label>
                @if (wasteCompleted()) {
                  <ion-badge slot="end" color="success">완료</ion-badge>
                } @else {
                  <ion-badge slot="end" color="medium">선택</ion-badge>
                }
              </ion-item>

              <!-- Step 3: Photo Upload -->
              <ion-item (click)="uploadPhoto()" detail>
                <ion-icon name="camera-outline" slot="start" color="primary"></ion-icon>
                <ion-label>
                  <h2>사진 첨부</h2>
                  <p>설치 완료 사진 (선택)</p>
                </ion-label>
                <ion-badge slot="end" [color]="photoCount() > 0 ? 'success' : 'medium'"
                  >{{ photoCount() }}장</ion-badge
                >
              </ion-item>

              <!-- Step 4: Certificate -->
              <ion-item [routerLink]="['../certificate', orderId()]" detail>
                <ion-icon name="document-text-outline" slot="start" color="primary"></ion-icon>
                <ion-label>
                  <h2>설치 확인서</h2>
                  <p>확인서 발행 및 서명</p>
                </ion-label>
                @if (certificateIssued()) {
                  <ion-badge slot="end" color="success">발행완료</ion-badge>
                } @else {
                  <ion-badge slot="end" color="warning">미발행</ion-badge>
                }
              </ion-item>
            </ion-list>
          </ion-card-content>
        </ion-card>

        <!-- Photo Gallery Card -->
        @if (photos().length > 0) {
          <ion-card>
            <ion-card-header>
              <ion-card-title>첨부 사진</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <div class="photo-grid">
                @for (photo of photos(); track $index) {
                  <div class="photo-item">
                    <img [src]="photo" alt="설치 사진 {{ $index + 1 }}" />
                    <ion-button
                      fill="clear"
                      size="small"
                      color="danger"
                      class="remove-btn"
                      (click)="removePhoto($index); $event.stopPropagation()"
                    >
                      <ion-icon name="close-circle-outline"></ion-icon>
                    </ion-button>
                  </div>
                }
              </div>
            </ion-card-content>
          </ion-card>
        }

        <!-- Notes -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>특이사항</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-item lines="none" (click)="addNote()">
              <ion-label color="primary">+ 특이사항 추가</ion-label>
            </ion-item>
          </ion-card-content>
        </ion-card>

        <!-- Complete Button -->
        <div class="action-buttons">
          <ion-button
            expand="block"
            color="success"
            [disabled]="!canComplete()"
            (click)="completeOrder()"
          >
            <ion-icon name="checkmark-circle-outline" slot="start"></ion-icon>
            완료 처리
          </ion-button>
        </div>
      }
    </ion-content>
  `,
  styles: [
    `
      .loading-container {
        display: flex;
        justify-content: center;
        padding: 48px;
      }

      ion-card-title {
        font-size: 16px;
      }

      ion-item {
        --padding-start: 0;

        ion-icon[slot='start'] {
          font-size: 24px;
          margin-right: 16px;
        }
      }

      .photo-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
      }

      .photo-item {
        position: relative;
        aspect-ratio: 1;
        border-radius: 8px;
        overflow: hidden;

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .remove-btn {
          position: absolute;
          top: 0;
          right: 0;
          --padding-start: 4px;
          --padding-end: 4px;
          margin: 0;
        }
      }

      .action-buttons {
        margin-top: 24px;
      }
    `,
  ],
})
export class CompletionProcessPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  protected readonly translate = inject(TranslateService);
  protected readonly ordersStore = inject(OrdersStore);
  private readonly cameraService = inject(CameraService);
  private readonly uiStore = inject(UIStore);
  private readonly logger = inject(LoggerService);

  protected readonly orderId = signal('');
  protected readonly isLoading = computed(() => this.ordersStore.isLoading());
  protected readonly photos = this.cameraService.photos;
  protected readonly notes = signal<string[]>([]);

  protected readonly order = computed(() => {
    const id = this.orderId();
    return this.ordersStore.orders().find((o: Order) => o.id === id);
  });

  protected readonly serialCompleted = computed(() => {
    const order = this.order();
    const lines = order?.lines || order?.orderLines;
    if (!lines?.length) return false;
    return lines.every((line: OrderLine) => !!line.serialNumber);
  });

  protected readonly wasteCompleted = computed(() => {
    const order = this.order();
    return (order?.completion?.waste?.length || 0) > 0;
  });

  protected readonly photoCount = computed(() => {
    return this.photos().length;
  });

  protected readonly certificateIssued = computed(() => {
    const order = this.order();
    return !!order?.completion?.certificateIssuedAt;
  });

  constructor() {
    addIcons({
      barcodeOutline,
      trashOutline,
      documentTextOutline,
      checkmarkCircleOutline,
      cameraOutline,
      closeCircleOutline,
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.orderId.set(id);

    // Load existing photos if any
    const order = this.order();
    if (order?.completion?.photos?.length) {
      this.cameraService.setPhotos(order.completion.photos);
    }
  }

  ngOnDestroy(): void {
    // Clear photos when leaving
    this.cameraService.clearPhotos();
  }

  /**
   * Check if order can be completed
   */
  canComplete(): boolean {
    return this.serialCompleted();
  }

  /**
   * Upload a photo using camera service
   */
  async uploadPhoto(): Promise<void> {
    try {
      const result = await this.cameraService.takePhoto({
        quality: 80,
        maxWidth: 1920,
        maxHeight: 1920,
      });

      if (result.success) {
        this.uiStore.showToast('사진이 추가되었습니다', 'success');
      } else if (result.error && result.error !== 'Cancelled') {
        this.uiStore.showToast('사진 촬영에 실패했습니다', 'danger');
      }
    } catch (error) {
      this.logger.error('Photo upload error:', error);
      this.uiStore.showToast('사진 촬영 중 오류가 발생했습니다', 'danger');
    }
  }

  /**
   * Remove a photo by index
   */
  removePhoto(index: number): void {
    this.cameraService.removePhoto(index);
    this.uiStore.showToast('사진이 삭제되었습니다', 'info');
  }

  /**
   * Add a note to the order
   */
  async addNote(): Promise<void> {
    const cancelBtn = await this.translate.get('COMMON.BUTTONS.CANCEL').toPromise();
    const addBtn = await this.translate.get('COMMON.BUTTONS.ADD').toPromise();

    const alert = await this.alertCtrl.create({
      header: '특이사항 추가',
      inputs: [
        {
          name: 'note',
          type: 'textarea',
          placeholder: '특이사항을 입력하세요...',
          attributes: {
            maxlength: 500,
            rows: 4,
          },
        },
      ],
      buttons: [
        { text: cancelBtn, role: 'cancel' },
        {
          text: addBtn,
          handler: async (data) => {
            const note = data.note?.trim();
            if (note) {
              this.notes.update((notes) => [...notes, note]);
              this.uiStore.showToast('특이사항이 추가되었습니다', 'success');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  /**
   * Complete the order
   */
  async completeOrder(): Promise<void> {
    const cancelBtn = await this.translate.get('COMMON.BUTTONS.CANCEL').toPromise();
    const okBtn = await this.translate.get('COMMON.BUTTONS.OK').toPromise();

    const alert = await this.alertCtrl.create({
      header: '완료 처리',
      message: '주문을 완료 처리하시겠습니까?',
      buttons: [
        { text: cancelBtn, role: 'cancel' },
        {
          text: okBtn,
          handler: async () => {
            await this.performComplete();
          },
        },
      ],
    });
    await alert.present();
  }

  /**
   * Perform the actual order completion
   */
  private async performComplete(): Promise<void> {
    try {
      // Save photos and notes to order completion data
      const completionData = {
        photos: this.photos(),
        notes: this.notes(),
        completedAt: new Date().toISOString(),
      };

      // Update order with completion data and status
      await this.ordersStore.updateOrderCompletion(this.orderId(), completionData);
      await this.ordersStore.updateOrderStatus(this.orderId(), OrderStatus.COMPLETED);

      const toast = await this.toastCtrl.create({
        message: '완료 처리되었습니다.',
        duration: 2000,
        color: 'success',
      });
      await toast.present();

      // Clear camera photos and navigate
      this.cameraService.clearPhotos();
      this.router.navigate(['/tabs/completion']);
    } catch (error) {
      const toast = await this.toastCtrl.create({
        message: '처리 중 오류가 발생했습니다.',
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    }
  }
}
