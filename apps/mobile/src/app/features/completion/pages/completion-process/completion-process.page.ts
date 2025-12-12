// apps/web/src/app/features/completion/pages/completion-process/completion-process.page.ts
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
import { OrdersStore } from '../../../../store/orders/orders.store';
import { OrderStatus, Order, OrderLine } from '../../../../store/orders/orders.models';

@Component({
  selector: 'app-completion-process',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
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
            <p><strong>주문번호:</strong> {{ order()?.erpOrderNumber || orderId() }}</p>
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
                <ion-badge slot="end" color="medium">{{ photoCount() }}장</ion-badge>
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

  protected readonly orderId = signal('');
  protected readonly isLoading = computed(() => this.ordersStore.isLoading());

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
    const order = this.order();
    return order?.completion?.photos?.length || 0;
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

  uploadPhoto(): void {
    // TODO: Implement photo upload via Capacitor Camera
    console.log('Upload photo');
  }

  addNote(): void {
    // TODO: Open note modal
    console.log('Add note');
  }

  async completeOrder(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: '완료 처리',
      message: '주문을 완료 처리하시겠습니까?',
      buttons: [
        { text: '취소', role: 'cancel' },
        {
          text: '완료',
          handler: async () => {
            try {
              await this.ordersStore.updateOrderStatus(this.orderId(), OrderStatus.COMPLETED);
              const toast = await this.toastCtrl.create({
                message: '완료 처리되었습니다.',
                duration: 2000,
                color: 'success',
              });
              await toast.present();
              this.router.navigate(['/tabs/completion']);
            } catch (error) {
              const toast = await this.toastCtrl.create({
                message: '처리 중 오류가 발생했습니다.',
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
