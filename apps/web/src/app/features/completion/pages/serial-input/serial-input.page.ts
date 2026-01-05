/**
 * 시리얼 번호 입력 페이지 컴포넌트
 * 제품별 시리얼 번호(10-20자리 영숫자) 입력 및 바코드 스캔 기능
 */
import {
  Component,
  signal,
  computed,
  ChangeDetectionStrategy,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonBadge,
  IonSpinner,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { barcodeOutline, scanOutline, checkmarkCircleOutline, saveOutline } from 'ionicons/icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { OrdersStore } from '../../../../store/orders/orders.store';
import { Order, OrderLine } from '../../../../store/orders/orders.models';
import { BarcodeScannerService } from '../../../../core/services/barcode-scanner.service';

interface ProductSerial {
  lineId: string;
  productCode: string;
  productName: string;
  quantity: number;
  serialNumber: string;
  isValid: boolean;
}

@Component({
  selector: 'app-serial-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonList,
    IonItem,
    IonLabel,
    IonInput,
    IonBadge,
    IonSpinner,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button
            [defaultHref]="'/tabs/completion/process/' + orderId()"
          ></ion-back-button>
        </ion-buttons>
        <ion-title>{{ 'COMPLETION.SERIAL.TITLE' | translate }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="openScanner()">
            <ion-icon name="scan-outline"></ion-icon>
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
        <ion-card>
          <ion-card-header>
            <ion-card-title>
              <ion-icon name="barcode-outline"></ion-icon>
              {{ 'COMPLETION.SERIAL.CARD_TITLE' | translate }}
            </ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p class="instruction">
              {{ 'COMPLETION.SERIAL.INSTRUCTION' | translate }}
              {{ 'COMPLETION.SERIAL.FORMAT_HINT' | translate }}
            </p>
          </ion-card-content>
        </ion-card>

        <ion-list>
          @for (product of products(); track product.lineId; let i = $index) {
            <ion-card>
              <ion-card-content>
                <div class="product-info">
                  <h3>{{ product.productName }}</h3>
                  <p>{{ product.productCode }} × {{ product.quantity }}</p>
                </div>
                <ion-item>
                  <ion-input
                    type="text"
                    [placeholder]="'COMPLETION.SERIAL.PLACEHOLDER' | translate"
                    [(ngModel)]="product.serialNumber"
                    (ionInput)="onSerialInput(i)"
                    [class.valid]="product.isValid"
                    [class.invalid]="product.serialNumber && !product.isValid"
                  ></ion-input>
                  <ion-button slot="end" fill="clear" (click)="scanSerial(i)">
                    <ion-icon name="scan-outline"></ion-icon>
                  </ion-button>
                </ion-item>
                @if (product.isValid) {
                  <ion-badge color="success">{{ 'COMPLETION.SERIAL.VALID' | translate }}</ion-badge>
                } @else if (product.serialNumber) {
                  <ion-badge color="danger">{{
                    'COMPLETION.SERIAL.FORMAT_ERROR' | translate
                  }}</ion-badge>
                }
              </ion-card-content>
            </ion-card>
          } @empty {
            <div class="empty-state">
              <p>{{ 'COMPLETION.SERIAL.NO_PRODUCTS' | translate }}</p>
            </div>
          }
        </ion-list>

        <!-- Save Button -->
        <div class="action-buttons">
          <ion-button [disabled]="!allValid()" (click)="saveSerials()">
            <ion-icon name="save-outline" slot="start"></ion-icon>
            {{ 'COMPLETION.SERIAL.SAVE_BTN' | translate }}
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
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
      }

      .instruction {
        color: var(--ion-color-medium);
        font-size: 14px;
      }

      .product-info {
        margin-bottom: 12px;

        h3 {
          margin: 0;
          font-weight: 600;
        }

        p {
          margin: 4px 0 0;
          color: var(--ion-color-medium);
          font-size: 13px;
        }
      }

      ion-item {
        --padding-start: 0;
      }

      ion-input.valid {
        --color: var(--ion-color-success);
      }

      ion-input.invalid {
        --color: var(--ion-color-danger);
      }

      .empty-state {
        text-align: center;
        padding: 24px;
        color: var(--ion-color-medium);
      }

      .action-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 24px;

        ion-button {
          flex: 1 1 auto;
          min-width: 140px;
          max-width: 200px;
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
export class SerialInputPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);
  protected readonly ordersStore = inject(OrdersStore);
  private readonly scannerService = inject(BarcodeScannerService);
  private readonly translateService = inject(TranslateService);

  protected readonly orderId = signal('');
  protected readonly isLoading = computed(() => this.ordersStore.isLoading());
  protected readonly products = signal<ProductSerial[]>([]);
  protected readonly isScanning = this.scannerService.isScanning;

  protected readonly order = computed(() => {
    const id = this.orderId();
    return this.ordersStore.orders().find((o: Order) => o.id === id);
  });

  constructor() {
    addIcons({
      barcodeOutline,
      scanOutline,
      checkmarkCircleOutline,
      saveOutline,
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.orderId.set(id);
    this.loadProducts();
  }

  loadProducts(): void {
    const order = this.order();
    const lines = order?.lines || order?.orderLines;
    if (lines) {
      this.products.set(
        lines.map((line: OrderLine) => ({
          lineId: line.id,
          productCode: line.itemCode || line.productCode || '',
          productName: line.itemName || line.productName || '',
          quantity: line.quantity,
          serialNumber: line.serialNumber || '',
          isValid: line.serialNumber ? /^[A-Za-z0-9]{10,20}$/.test(line.serialNumber) : false,
        })),
      );
    }
  }

  async openScanner(): Promise<void> {
    // Scan for first product without serial
    const products = this.products();
    const emptyIndex = products.findIndex((p) => !p.serialNumber);

    if (emptyIndex >= 0) {
      await this.scanSerial(emptyIndex);
    } else if (products.length > 0) {
      // All have serials, scan for first product
      await this.scanSerial(0);
    }
  }

  /**
   * 바코드 스캔으로 시리얼 번호 입력
   * @param index 대상 제품 인덱스
   */
  async scanSerial(index: number): Promise<void> {
    try {
      const result = await this.scannerService.scan();

      if (result.hasContent) {
        this.products.update((products) => {
          const updated = [...products];
          updated[index].serialNumber = result.content;
          updated[index].isValid = /^[A-Za-z0-9]{10,20}$/.test(result.content);
          return updated;
        });

        const toast = await this.toastCtrl.create({
          message: this.translateService.instant('COMPLETION.SERIAL.SCAN_SUCCESS', {
            content: result.content,
          }),
          duration: 1500,
          color: 'success',
        });
        await toast.present();
      }
    } catch (error) {
      const toast = await this.toastCtrl.create({
        message: this.translateService.instant('COMPLETION.SERIAL.SCAN_ERROR'),
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    }
  }

  /**
   * 수동 입력 시 시리얼 번호 유효성 검증
   * @param index 대상 제품 인덱스
   */
  onSerialInput(index: number): void {
    this.products.update((products) => {
      const updated = [...products];
      const serial = updated[index].serialNumber;
      // Validate: alphanumeric, 10-20 chars
      updated[index].isValid = /^[A-Za-z0-9]{10,20}$/.test(serial);
      return updated;
    });
  }

  /**
   * 모든 시리얼 번호가 유효한지 확인
   */
  allValid(): boolean {
    const prods = this.products();
    return prods.length > 0 && prods.every((p) => p.isValid);
  }

  /**
   * 시리얼 번호 저장
   */
  async saveSerials(): Promise<void> {
    try {
      const serialUpdates = this.products().map((p) => ({
        lineId: p.lineId,
        serialNumber: p.serialNumber,
      }));
      await this.ordersStore.updateOrderSerials(this.orderId(), serialUpdates);

      const toast = await this.toastCtrl.create({
        message: this.translateService.instant('COMPLETION.SERIAL.SAVE_SUCCESS'),
        duration: 2000,
        color: 'success',
      });
      await toast.present();
      this.router.navigate(['/tabs/completion/process', this.orderId()]);
    } catch (error) {
      const toast = await this.toastCtrl.create({
        message: this.translateService.instant('COMPLETION.SERIAL.SAVE_ERROR'),
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    }
  }
}
