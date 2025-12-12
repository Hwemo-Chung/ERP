import { Component, signal, computed, ChangeDetectionStrategy, inject, ElementRef, ViewChild, OnInit } from '@angular/core';
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
  IonSpinner,
  IonModal,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  documentTextOutline,
  printOutline,
  createOutline,
  checkmarkCircleOutline,
} from 'ionicons/icons';
import { OrdersStore } from '../../../../store/orders/orders.store';
import { Order, OrderLine } from '../../../../store/orders/orders.models';
import { AuthService } from '../../../../core/services/auth.service';
import { SignaturePadComponent } from '../../../../shared/components/signature-pad/signature-pad.component';

@Component({
  selector: 'app-completion-certificate',
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
    IonSpinner,
    IonModal,
    SignaturePadComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button [defaultHref]="'/tabs/completion/process/' + orderId()"></ion-back-button>
        </ion-buttons>
        <ion-title>설치 확인서</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="printCertificate()">
            <ion-icon name="print-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (isLoading()) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      } @else {
        <!-- Certificate Preview -->
        <ion-card class="certificate-card">
          <ion-card-content>
            <div class="certificate" #certificateContent>
              <h1>설치 확인서</h1>
              <div class="cert-section">
                <h3>주문 정보</h3>
                <table>
                  <tr>
                    <td>주문번호</td>
                    <td>{{ orderInfo().orderNumber }}</td>
                  </tr>
                  <tr>
                    <td>설치일</td>
                    <td>{{ orderInfo().installDate }}</td>
                  </tr>
                  <tr>
                    <td>고객명</td>
                    <td>{{ orderInfo().customerName }}</td>
                  </tr>
                  <tr>
                    <td>설치주소</td>
                    <td>{{ orderInfo().address }}</td>
                  </tr>
                </table>
              </div>

              <div class="cert-section">
                <h3>설치 제품</h3>
                <table>
                  <thead>
                    <tr>
                      <th>제품명</th>
                      <th>수량</th>
                      <th>시리얼번호</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (product of products(); track product.id) {
                      <tr>
                        <td>{{ product.name }}</td>
                        <td>{{ product.quantity }}</td>
                        <td>{{ product.serial }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              <div class="cert-section">
                <h3>설치 기사</h3>
                <p>{{ installerInfo().name }} ({{ installerInfo().company }})</p>
              </div>

              <div class="signature-section">
                <div class="signature-box">
                  <p>고객 서명</p>
                  <div class="signature-area" (click)="openSignaturePad('customer')">
                    @if (customerSignature()) {
                      <img [src]="customerSignature()" alt="고객 서명" />
                    } @else {
                      <p class="placeholder">터치하여 서명</p>
                    }
                  </div>
                </div>
                <div class="signature-box">
                  <p>설치기사 서명</p>
                  <div class="signature-area" (click)="openSignaturePad('installer')">
                    @if (installerSignature()) {
                      <img [src]="installerSignature()" alt="설치기사 서명" />
                    } @else {
                      <p class="placeholder">터치하여 서명</p>
                    }
                  </div>
                </div>
              </div>

              <div class="cert-footer">
                <p>위와 같이 설치가 완료되었음을 확인합니다.</p>
                <p class="date">{{ todayDate }}</p>
              </div>
            </div>
          </ion-card-content>
        </ion-card>

        <!-- Action Buttons -->
        <div class="action-buttons">
          <ion-button expand="block" fill="outline" (click)="printCertificate()">
            <ion-icon name="print-outline" slot="start"></ion-icon>
            인쇄
          </ion-button>
          <ion-button 
            expand="block" 
            [disabled]="!canIssue()"
            (click)="issueCertificate()"
          >
            <ion-icon name="checkmark-circle-outline" slot="start"></ion-icon>
            확인서 발행
          </ion-button>
        </div>
      }

      <!-- Signature Pad Modal -->
      <ion-modal 
        [isOpen]="isSignatureModalOpen()"
        (didDismiss)="closeSignatureModal()"
      >
        <ng-template>
          <app-signature-pad
            (confirmed)="onSignatureConfirmed($event)"
            (cancelled)="closeSignatureModal()"
          ></app-signature-pad>
        </ng-template>
      </ion-modal>
    </ion-content>
  `,
  styles: [`
    .loading-container {
      display: flex;
      justify-content: center;
      padding: 48px;
    }

    .certificate-card {
      background: white;
    }

    .certificate {
      padding: 16px;
      font-size: 14px;

      h1 {
        text-align: center;
        font-size: 20px;
        margin-bottom: 24px;
        border-bottom: 2px solid #333;
        padding-bottom: 12px;
      }

      h3 {
        font-size: 14px;
        margin: 16px 0 8px;
        color: #333;
      }

      table {
        width: 100%;
        border-collapse: collapse;

        td, th {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }

        th {
          background: #f5f5f5;
        }

        td:first-child {
          width: 100px;
          font-weight: 500;
          background: #fafafa;
        }
      }
    }

    .cert-section {
      margin-bottom: 20px;
    }

    .signature-section {
      display: flex;
      gap: 16px;
      margin-top: 24px;
    }

    .signature-box {
      flex: 1;
      text-align: center;

      p {
        margin-bottom: 8px;
        font-weight: 500;
      }
    }

    .signature-area {
      border: 1px dashed #ccc;
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fafafa;
      cursor: pointer;

      img {
        max-width: 100%;
        max-height: 100%;
      }

      .placeholder {
        color: #999;
        font-size: 12px;
      }
    }

    .cert-footer {
      margin-top: 24px;
      text-align: center;

      .date {
        margin-top: 8px;
        font-weight: 500;
      }
    }

    .action-buttons {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 16px;
    }
  `],
})
export class CompletionCertificatePage implements OnInit {
  @ViewChild('certificateContent') certificateContent!: ElementRef;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);
  protected readonly ordersStore = inject(OrdersStore);
  private readonly authService = inject(AuthService);

  protected readonly orderId = signal('');
  protected readonly isLoading = computed(() => this.ordersStore.isLoading());
  protected readonly customerSignature = signal<string | null>(null);
  protected readonly installerSignature = signal<string | null>(null);
  protected readonly isSignatureModalOpen = signal(false);
  private signatureType: 'customer' | 'installer' = 'customer';

  protected readonly order = computed(() => {
    const id = this.orderId();
    return this.ordersStore.orders().find((o: Order) => o.id === id);
  });

  protected readonly orderInfo = computed(() => {
    const o = this.order();
    return {
      orderNumber: o?.erpOrderNumber || '',
      installDate: o?.appointmentDate || new Date().toISOString().split('T')[0],
      customerName: o?.customerName || '',
      address: o?.address || '',
    };
  });

  protected readonly products = computed(() => {
    const o = this.order();
    const lines = o?.lines || o?.orderLines || [];
    return lines.map((line: OrderLine) => ({
      id: line.id,
      name: line.productName,
      quantity: line.quantity,
      serial: line.serialNumber || '-',
    }));
  });

  protected readonly installerInfo = computed(() => {
    const user = this.authService.user();
    return {
      name: user?.name || '',
      company: (user as any)?.branchName || user?.branchCode || '',
    };
  });

  todayDate: string = new Date().toLocaleDateString('ko-KR');

  constructor() {
    addIcons({
      documentTextOutline,
      printOutline,
      createOutline,
      checkmarkCircleOutline,
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.orderId.set(id);
    this.loadExistingSignatures();
  }

  loadExistingSignatures(): void {
    const order = this.order();
    if (order?.completion) {
      if (order.completion.customerSignature) {
        this.customerSignature.set(order.completion.customerSignature);
      }
      if (order.completion.installerSignature) {
        this.installerSignature.set(order.completion.installerSignature);
      }
    }
  }

  openSignaturePad(type: 'customer' | 'installer'): void {
    this.signatureType = type;
    this.isSignatureModalOpen.set(true);
  }

  closeSignatureModal(): void {
    this.isSignatureModalOpen.set(false);
  }

  onSignatureConfirmed(dataUrl: string): void {
    if (this.signatureType === 'customer') {
      this.customerSignature.set(dataUrl);
    } else {
      this.installerSignature.set(dataUrl);
    }
    this.closeSignatureModal();
  }

  canIssue(): boolean {
    return !!this.customerSignature() && !!this.installerSignature();
  }

  printCertificate(): void {
    window.print();
  }

  async issueCertificate(): Promise<void> {
    try {
      await this.ordersStore.issueCertificate(this.orderId(), {
        customerSignature: this.customerSignature(),
        installerSignature: this.installerSignature(),
      });
      
      const toast = await this.toastCtrl.create({
        message: '확인서가 발행되었습니다.',
        duration: 2000,
        color: 'success',
      });
      await toast.present();
      this.router.navigate(['/tabs/completion/process', this.orderId()]);
    } catch (error) {
      const toast = await this.toastCtrl.create({
        message: '발행 중 오류가 발생했습니다.',
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    }
  }
}
