/**
 * Serial Input Page
 * PRD FR-04: Serial number capture via barcode scanning or manual input
 */
import { Component, signal, computed, ChangeDetectionStrategy, inject, OnInit, OnDestroy } from '@angular/core';
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
import {
  barcodeOutline,
  scanOutline,
  checkmarkCircleOutline,
  saveOutline,
} from 'ionicons/icons';
import { OrdersStore } from '../../../../store/orders/orders.store';
import { Order, OrderLine } from '../../../../store/orders/orders.models';
import { BarcodeScannerService } from '../../../../core/services/barcode-scanner.service';
import { UIStore } from '../../../../store/ui/ui.store';
import { TranslateModule } from '@ngx-translate/core';

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
          <ion-back-button [defaultHref]="'/tabs/completion/process/' + orderId()"></ion-back-button>
        </ion-buttons>
        <ion-title>시리얼 번호 입력</ion-title>
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
              제품 시리얼 번호
            </ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p class="instruction">
              각 제품의 제조번호(시리얼 번호)를 입력해주세요.
              영문/숫자 10-20자리
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
                    placeholder="시리얼 번호 입력"
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
                  <ion-badge color="success">유효</ion-badge>
                } @else if (product.serialNumber) {
                  <ion-badge color="danger">형식 오류</ion-badge>
                }
              </ion-card-content>
            </ion-card>
          } @empty {
            <div class="empty-state">
              <p>등록된 제품이 없습니다.</p>
            </div>
          }
        </ion-list>

        <!-- Save Button -->
        <div class="action-buttons">
          <ion-button 
            expand="block" 
            [disabled]="!allValid()"
            (click)="saveSerials()"
          >
            <ion-icon name="save-outline" slot="start"></ion-icon>
            저장
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
      margin-top: 24px;
    }
  `],
})
export class SerialInputPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);
  protected readonly ordersStore = inject(OrdersStore);
  private readonly barcodeScanner = inject(BarcodeScannerService);
  private readonly uiStore = inject(UIStore);

  protected readonly orderId = signal('');
  protected readonly isLoading = computed(() => this.ordersStore.isLoading());
  protected readonly products = signal<ProductSerial[]>([]);
  protected readonly isScanning = this.barcodeScanner.isScanning;
  private currentScanIndex = -1;

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

  ngOnDestroy(): void {
    // Stop any active scanning when leaving the page
    this.barcodeScanner.stopScan();
  }

  loadProducts(): void {
    const order = this.order();
    const lines = order?.lines || order?.orderLines;
    if (lines) {
      this.products.set(lines.map((line: OrderLine) => ({
        lineId: line.id,
        productCode: line.itemCode || line.productCode || '',
        productName: line.itemName || line.productName || '',
        quantity: line.quantity,
        serialNumber: line.serialNumber || '',
        isValid: line.serialNumber ? /^[A-Za-z0-9]{10,20}$/.test(line.serialNumber) : false,
      })));
    }
  }

  /**
   * Open scanner to scan all products sequentially
   */
  async openScanner(): Promise<void> {
    const prods = this.products();
    const unscannedIndex = prods.findIndex(p => !p.isValid);

    if (unscannedIndex === -1) {
      this.uiStore.showToast('모든 시리얼 번호가 이미 입력되었습니다', 'success');
      return;
    }

    // Start scanning from the first unscanned product
    await this.scanSerial(unscannedIndex);
  }

  /**
   * Scan serial for a specific product
   */
  async scanSerial(index: number): Promise<void> {
    if (this.isScanning()) {
      return;
    }

    this.currentScanIndex = index;
    const product = this.products()[index];

    if (!product) {
      return;
    }

    try {
      const result = await this.barcodeScanner.scan();

      if (result.hasContent) {
        // Update the serial number
        this.products.update(products => {
          const updated = [...products];
          updated[index].serialNumber = result.content.toUpperCase();
          updated[index].isValid = /^[A-Za-z0-9]{10,20}$/.test(result.content);
          return updated;
        });

        if (this.products()[index].isValid) {
          // Auto-advance to next unscanned product
          const nextIndex = this.products().findIndex((p, i) => i > index && !p.isValid);
          if (nextIndex !== -1) {
            // Small delay before scanning next
            setTimeout(() => this.scanSerial(nextIndex), 500);
          } else {
            this.uiStore.showToast('모든 시리얼 번호가 입력되었습니다', 'success');
          }
        } else {
          this.uiStore.showToast('시리얼 번호 형식이 올바르지 않습니다 (영문/숫자 10-20자)', 'warning');
        }
      }
    } catch (error) {
      console.error('Scan error:', error);
      this.uiStore.showToast('스캔 중 오류가 발생했습니다', 'danger');
    } finally {
      this.currentScanIndex = -1;
    }
  }

  /**
   * Handle manual serial input
   */
  onSerialInput(index: number): void {
    this.products.update(products => {
      const updated = [...products];
      const serial = updated[index].serialNumber.toUpperCase();
      updated[index].serialNumber = serial;
      // Validate: alphanumeric, 10-20 chars
      updated[index].isValid = /^[A-Za-z0-9]{10,20}$/.test(serial);
      return updated;
    });
  }

  /**
   * Check if all products have valid serial numbers
   */
  allValid(): boolean {
    const prods = this.products();
    return prods.length > 0 && prods.every(p => p.isValid);
  }

  /**
   * Get progress percentage
   */
  getProgress(): number {
    const prods = this.products();
    if (prods.length === 0) return 0;
    const valid = prods.filter(p => p.isValid).length;
    return Math.round((valid / prods.length) * 100);
  }

  /**
   * Save all serial numbers
   */
  async saveSerials(): Promise<void> {
    if (!this.allValid()) {
      this.uiStore.showToast('모든 시리얼 번호를 입력해주세요', 'warning');
      return;
    }

    try {
      const serialUpdates = this.products().map(p => ({
        lineId: p.lineId,
        serialNumber: p.serialNumber,
      }));
      await this.ordersStore.updateOrderSerials(this.orderId(), serialUpdates);

      const toast = await this.toastCtrl.create({
        message: '시리얼 번호가 저장되었습니다.',
        duration: 2000,
        color: 'success',
      });
      await toast.present();
      this.router.navigate(['/tabs/completion/process', this.orderId()]);
    } catch (error) {
      const toast = await this.toastCtrl.create({
        message: '저장 중 오류가 발생했습니다.',
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    }
  }
}
