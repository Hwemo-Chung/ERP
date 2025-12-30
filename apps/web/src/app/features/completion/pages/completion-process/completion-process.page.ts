/**
 * 완료 처리 페이지 컴포넌트
 * 주문 완료 처리를 위한 단계별 진행 화면
 * - 시리얼 입력, 폐가전 회수, 사진 첨부, 확인서 발행 단계 표시
 */
import { Component, signal, computed, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
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
  IonNote,
  IonCheckbox,
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
} from 'ionicons/icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { OrdersStore } from '../../../../store/orders/orders.store';
import { OrderStatus, Order, OrderLine } from '../../../../store/orders/orders.models';
import { CameraService, CapturedPhoto } from '../../../../core/services/camera.service';

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
    IonNote,
    IonCheckbox,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/completion"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ 'COMPLETION.PROCESS.TITLE' | translate }}</ion-title>
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
            <ion-card-title>{{ 'COMPLETION.PROCESS.ORDER_INFO' | translate }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p><strong>{{ 'COMPLETION.PROCESS.ORDER_NUMBER' | translate }}:</strong> {{ order()?.erpOrderNumber || orderId() }}</p>
            <p><strong>{{ 'COMPLETION.PROCESS.CUSTOMER_NAME' | translate }}:</strong> {{ order()?.customerName || '-' }}</p>
            <p><strong>{{ 'COMPLETION.PROCESS.INSTALLER' | translate }}:</strong> {{ order()?.installerName || '-' }}</p>
          </ion-card-content>
        </ion-card>

        <!-- Completion Steps -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ 'COMPLETION.PROCESS.STEPS_TITLE' | translate }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list>
              <!-- Step 1: Serial Input -->
              <ion-item [routerLink]="['../serial-input', orderId()]" detail>
                <ion-icon name="barcode-outline" slot="start" color="primary"></ion-icon>
                <ion-label>
                  <h2>{{ 'COMPLETION.PROCESS.SERIAL_INPUT' | translate }}</h2>
                  <p>{{ 'COMPLETION.PROCESS.SERIAL_INPUT_DESC' | translate }}</p>
                </ion-label>
                @if (serialCompleted()) {
                  <ion-badge slot="end" color="success">{{ 'COMPLETION.STATUS.COMPLETED' | translate }}</ion-badge>
                } @else {
                  <ion-badge slot="end" color="warning">{{ 'COMPLETION.STATUS.NOT_COMPLETED' | translate }}</ion-badge>
                }
              </ion-item>

              <!-- Step 2: Waste Pickup -->
              <ion-item [routerLink]="['../waste-pickup', orderId()]" detail>
                <ion-icon name="trash-outline" slot="start" color="primary"></ion-icon>
                <ion-label>
                  <h2>{{ 'COMPLETION.PROCESS.WASTE_PICKUP' | translate }}</h2>
                  <p>{{ 'COMPLETION.PROCESS.WASTE_PICKUP_DESC' | translate }}</p>
                </ion-label>
                @if (wasteCompleted()) {
                  <ion-badge slot="end" color="success">{{ 'COMPLETION.STATUS.COMPLETED' | translate }}</ion-badge>
                } @else {
                  <ion-badge slot="end" color="medium">{{ 'COMPLETION.STATUS.OPTIONAL' | translate }}</ion-badge>
                }
              </ion-item>

              <!-- Step 3: Photo Upload -->
              <ion-item (click)="uploadPhoto()" detail>
                <ion-icon name="camera-outline" slot="start" color="primary"></ion-icon>
                <ion-label>
                  <h2>{{ 'COMPLETION.PROCESS.PHOTO_UPLOAD' | translate }}</h2>
                  <p>{{ 'COMPLETION.PROCESS.PHOTO_UPLOAD_DESC' | translate }}</p>
                </ion-label>
                <ion-badge slot="end" color="medium">{{ 'COMPLETION.PHOTO.COUNT' | translate:{ count: photoCount() } }}</ion-badge>
              </ion-item>

              <!-- Step 4: Certificate -->
              <ion-item [routerLink]="['../certificate', orderId()]" detail>
                <ion-icon name="document-text-outline" slot="start" color="primary"></ion-icon>
                <ion-label>
                  <h2>{{ 'COMPLETION.PROCESS.CERTIFICATE' | translate }}</h2>
                  <p>{{ 'COMPLETION.PROCESS.CERTIFICATE_DESC' | translate }}</p>
                </ion-label>
                @if (certificateIssued()) {
                  <ion-badge slot="end" color="success">{{ 'COMPLETION.STATUS.ISSUED' | translate }}</ion-badge>
                } @else {
                  <ion-badge slot="end" color="warning">{{ 'COMPLETION.STATUS.NOT_ISSUED' | translate }}</ion-badge>
                }
              </ion-item>
            </ion-list>
          </ion-card-content>
        </ion-card>

        <!-- Notes -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ 'COMPLETION.PROCESS.NOTES_TITLE' | translate }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-item lines="none" (click)="addNote()">
              <ion-label color="primary">{{ 'COMPLETION.PROCESS.ADD_NOTE' | translate }}</ion-label>
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
            {{ 'COMPLETION.PROCESS.COMPLETE_BTN' | translate }}
          </ion-button>
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

    ion-card-title {
      font-size: 16px;
    }

    ion-item {
      --padding-start: 0;

      ion-icon[slot="start"] {
        font-size: 24px;
        margin-right: 16px;
      }
    }

    .action-buttons {
      margin-top: 24px;
    }
  `],
})
export class CompletionProcessPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  protected readonly ordersStore = inject(OrdersStore);
  private readonly cameraService = inject(CameraService);
  private readonly translateService = inject(TranslateService);

  protected readonly orderId = signal('');
  protected readonly isLoading = computed(() => this.ordersStore.isLoading());
  protected readonly photos = signal<CapturedPhoto[]>([]);
  protected readonly notes = signal<string[]>([]);
  protected readonly isCapturing = this.cameraService.isCapturing;

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
    // Combine local photos with server-saved photos
    const serverPhotos = this.order()?.completion?.photos?.length || 0;
    return this.photos().length + serverPhotos;
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
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.orderId.set(id);
  }

  canComplete(): boolean {
    return this.serialCompleted();
  }

  /**
   * 사진 촬영 후 사진 목록에 추가
   */
  async uploadPhoto(): Promise<void> {
    const photo = await this.cameraService.capturePhoto();
    
    if (photo) {
      this.photos.update(photos => [...photos, photo]);
      
      const toast = await this.toastCtrl.create({
        message: this.translateService.instant('COMPLETION.PHOTO.ADDED'),
        duration: 1500,
        color: 'success',
      });
      await toast.present();
    }
  }

  /**
   * 특이사항 추가 Alert 표시
   */
  async addNote(): Promise<void> {
    // 변수 캡처 (핸들러 내부에서 this 참조 문제 방지)
    const cancelText = this.translateService.instant('COMMON.CANCEL');
    const addText = this.translateService.instant('COMMON.SAVE');
    const notePlaceholder = this.translateService.instant('COMPLETION.PROCESS.NOTE_PLACEHOLDER');
    const notes = this.notes;

    const alert = await this.alertCtrl.create({
      header: this.translateService.instant('COMPLETION.PROCESS.NOTE_HEADER'),
      inputs: [
        {
          name: 'note',
          type: 'textarea',
          placeholder: notePlaceholder,
          attributes: {
            rows: 4,
          },
        },
      ],
      buttons: [
        {
          text: cancelText,
          role: 'cancel',
        },
        {
          text: addText,
          handler: (data) => {
            if (data.note?.trim()) {
              notes.update(n => [...n, data.note.trim()]);
            }
          },
        },
      ],
    });
    await alert.present();
  }

  /**
   * 주문 완료 처리 확인 및 실행
   */
  async completeOrder(): Promise<void> {
    // 변수 캡처 (핸들러 내부에서 this 참조 문제 방지)
    const cancelText = this.translateService.instant('COMMON.CANCEL');
    const completeText = this.translateService.instant('COMPLETION.PROCESS.COMPLETE');
    const successMsg = this.translateService.instant('COMPLETION.PROCESS.SUCCESS_MESSAGE');
    const errorMsg = this.translateService.instant('COMPLETION.PROCESS.ERROR_MESSAGE');
    const ordersStore = this.ordersStore;
    const orderId = this.orderId;
    const toastCtrl = this.toastCtrl;
    const router = this.router;

    const alert = await this.alertCtrl.create({
      header: this.translateService.instant('COMPLETION.PROCESS.CONFIRM_HEADER'),
      message: this.translateService.instant('COMPLETION.PROCESS.CONFIRM_MESSAGE'),
      buttons: [
        { text: cancelText, role: 'cancel' },
        {
          text: completeText,
          handler: async () => {
            try {
              await ordersStore.updateOrderStatus(orderId(), OrderStatus.COMPLETED);
              const toast = await toastCtrl.create({
                message: successMsg,
                duration: 2000,
                color: 'success',
              });
              await toast.present();
              router.navigate(['/tabs/completion']);
            } catch (error) {
              const toast = await toastCtrl.create({
                message: errorMsg,
                duration: 2000,
                color: 'danger',
              });
              await toast.present();
            }
          },
        },
      ],
    });
    await alert.present();
  }
}
