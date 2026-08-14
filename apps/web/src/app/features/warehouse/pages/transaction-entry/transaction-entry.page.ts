// apps/web/src/app/features/warehouse/pages/transaction-entry/transaction-entry.page.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonItem,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonList,
  IonNote,
  IonBackButton,
  IonButtons,
  IonSegment,
  IonSegmentButton,
  IonLabel,
} from '@ionic/angular/standalone';
import { getErrorCode, getErrorMessage } from '../../../../core/utils/error.util';
import {
  MasterDataService,
  PartnerRow,
  ProductRow,
  RateCardRow,
} from '../../../master-data/services/master-data.service';
import { WarehouseService } from '../../services/warehouse.service';
import type { AdjustmentReason, TransactionType } from '../../services/warehouse.service';
import { BarcodeScannerService } from '../../../../core/services/barcode-scanner.service';

// ponytail: Date#toISOString is UTC — at 00:00~08:59 KST it still reports yesterday.
// This date feeds the settlement-lock check and fee calc, so it has to read the
// browser's local calendar day, not the UTC one.
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

@Component({
  selector: 'app-transaction-entry',
  standalone: true,
  imports: [
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonItem,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonList,
    IonNote,
    IonBackButton,
    IonButtons,
    IonSegment,
    IonSegmentButton,
    IonLabel,
  ],
  template: `
    <ion-header
      ><ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs" /></ion-buttons>
        <ion-title>실적 입력</ion-title>
      </ion-toolbar></ion-header
    >
    <ion-content class="ion-padding"
      ><div class="work-surface">
        <ion-list>
          <ion-button expand="block" fill="outline" (click)="scanBarcode()"
            >바코드 / QR 스캔</ion-button
          >
          <ion-item>
            <ion-select
              label="거래처 *"
              required
              [(ngModel)]="partnerId"
              (ionChange)="onPartnerChange()"
              interface="popover"
            >
              @for (p of partners(); track p.id) {
                <ion-select-option [value]="p.id">{{ p.name }}</ion-select-option>
              }
            </ion-select>
          </ion-item>
          <ion-item>
            <ion-input
              label="품목 검색"
              type="search"
              [(ngModel)]="productSearch"
              [disabled]="!partnerId"
              (ionInput)="onProductSearch()"
              placeholder="품목명/코드 검색"
            />
          </ion-item>
          <ion-item>
            <ion-select
              label="품목 *"
              required
              [(ngModel)]="productId"
              [disabled]="!partnerId"
              interface="popover"
            >
              @for (p of products(); track p.id) {
                <ion-select-option [value]="p.id">{{ p.name }} ({{ p.code }})</ion-select-option>
              }
            </ion-select>
          </ion-item>
          @if (selectedProduct(); as selected) {
            <ion-item lines="none"
              ><ion-note class="selected-product ion-text-wrap"
                >선택 품목: {{ selected.name }} ({{ selected.code }})</ion-note
              ></ion-item
            >
          }
          <ion-item>
            <ion-segment [value]="type" (ionChange)="onTypeChange($event)">
              <ion-segment-button value="INBOUND"><ion-label>입고</ion-label></ion-segment-button>
              <ion-segment-button value="OUTBOUND"><ion-label>출고</ion-label></ion-segment-button>
              <ion-segment-button value="ADJUSTMENT_IN"
                ><ion-label>조정+</ion-label></ion-segment-button
              >
              <ion-segment-button value="ADJUSTMENT_OUT"
                ><ion-label>조정-</ion-label></ion-segment-button
              >
            </ion-segment>
          </ion-item>
          @if (isAdjustment()) {
            <ion-item
              ><ion-select label="조정 사유 *" required [(ngModel)]="adjustmentReason">
                <ion-select-option value="STOCKTAKE_DIFF">실사 차이</ion-select-option>
                <ion-select-option value="DAMAGE">파손</ion-select-option>
                <ion-select-option value="DISPOSAL">폐기</ion-select-option>
                <ion-select-option value="OTHER">기타</ion-select-option>
              </ion-select></ion-item
            >
            @if (adjustmentReason === 'OTHER') {
              <ion-item
                ><ion-input
                  label="기타 사유 *"
                  required
                  maxlength="300"
                  [(ngModel)]="adjustmentNote"
              /></ion-item>
            }
          }
          <ion-item
            ><ion-input
              label="수량 *"
              required
              labelPlacement="stacked"
              placeholder="1 이상의 정수"
              type="number"
              min="1"
              step="1"
              [(ngModel)]="quantity"
          /></ion-item>
          <ion-item
            ><ion-input label="일자 *" required type="date" [(ngModel)]="transactionDate"
          /></ion-item>
          <ion-item>
            <ion-select label="차량 (선택)" [(ngModel)]="vehicleRateId" interface="popover">
              <ion-select-option [value]="undefined">선택 안함</ion-select-option>
              @for (v of vehicleRates(); track v.id) {
                <ion-select-option [value]="v.id"
                  >{{ v.vehicleType }}
                  {{ v.tonnage ? '(' + v.tonnage + 't)' : '' }}</ion-select-option
                >
              }
            </ion-select>
          </ion-item>
        </ion-list>
        @if (error()) {
          <ion-note color="danger" role="alert">{{ error() }}</ion-note>
        }
        @if (saved()) {
          <ion-note color="success" role="status">저장되었습니다.</ion-note>
        }
        <ion-button expand="block" [disabled]="saving()" (click)="save()">저장</ion-button>
      </div></ion-content
    >
  `,
  styles: [
    `
      .work-surface {
        max-width: 760px;
        margin-inline: auto;
      }
      ion-select {
        white-space: normal;
      }
      ion-segment-button {
        min-height: 44px;
      }
      .selected-product {
        --color: var(--ion-text-color);
      }
    `,
  ],
})
export class TransactionEntryPage implements OnInit {
  private masterData = inject(MasterDataService);
  private warehouse = inject(WarehouseService);
  private barcodeScanner = inject(BarcodeScannerService);

  partners = signal<PartnerRow[]>([]);
  products = signal<ProductRow[]>([]);
  vehicleRates = signal<RateCardRow[]>([]);

  partnerId?: string;
  productId?: string;
  productSearch = '';
  type: TransactionType = 'INBOUND';
  adjustmentReason?: AdjustmentReason;
  adjustmentNote = '';
  quantity = '';
  transactionDate = today();
  vehicleRateId?: string;

  saving = signal(false);
  saved = signal(false);
  error = signal('');

  async ngOnInit() {
    const [partnersRes, rateCards] = await Promise.all([
      this.masterData.getPartners({ page: 1 }),
      this.masterData.getRateCards(),
    ]);
    this.partners.set(partnersRes.data);
    this.vehicleRates.set(rateCards);
  }

  async onPartnerChange() {
    this.productId = undefined;
    this.productSearch = '';
    this.products.set([]);
    await this.loadProducts();
  }

  async onProductSearch() {
    await this.loadProducts();
  }

  onTypeChange(event: CustomEvent) {
    this.type = event.detail.value;
    if (!this.isAdjustment()) {
      this.adjustmentReason = undefined;
      this.adjustmentNote = '';
    }
  }

  isAdjustment(): boolean {
    return this.type === 'ADJUSTMENT_IN' || this.type === 'ADJUSTMENT_OUT';
  }

  selectedProduct(): ProductRow | undefined {
    return this.products().find((product) => product.id === this.productId);
  }

  async scanBarcode(): Promise<void> {
    const scan = await this.barcodeScanner.scan({
      header: '바코드 / QR 입력',
      message: '스캐너 미지원 환경입니다. 바코드 또는 QR 값을 직접 입력하세요.',
      placeholder: '품목코드, 거래처코드 또는 내부 QR',
      minlength: 1,
      maxlength: 120,
    });
    if (!scan.hasContent) return;
    try {
      const result = await this.warehouse.scanBarcode(scan.content);
      if (result.type === 'PARTNER') {
        this.partnerId = result.entity.id;
        await this.onPartnerChange();
      } else {
        this.partnerId = result.entity.partnerId;
        await this.loadProducts();
        this.productId = result.entity.id;
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : '미등록 바코드입니다.');
    }
  }

  private async loadProducts() {
    if (!this.partnerId) return;
    const res = await this.masterData.getProducts({
      partnerId: this.partnerId,
      search: this.productSearch || undefined,
      page: 1,
    });
    this.products.set(res.data);
  }

  async save() {
    this.error.set('');
    this.saved.set(false);
    if (!this.partnerId || !this.productId || !this.quantity || !this.transactionDate) {
      this.error.set('필수 항목을 입력하세요.');
      return;
    }
    const quantity = Number(this.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      this.error.set('수량은 1 이상의 정수로 입력하세요.');
      return;
    }
    if (
      this.isAdjustment() &&
      (!this.adjustmentReason || (this.adjustmentReason === 'OTHER' && !this.adjustmentNote.trim()))
    ) {
      this.error.set('조정 사유를 입력하세요.');
      return;
    }
    this.saving.set(true);
    try {
      await this.warehouse.createTransaction({
        type: this.type,
        partnerId: this.partnerId,
        productId: this.productId,
        quantity,
        transactionDate: this.transactionDate,
        ...(this.vehicleRateId ? { vehicleRateId: this.vehicleRateId } : {}),
        ...(this.isAdjustment() && this.adjustmentReason
          ? { adjustmentReason: this.adjustmentReason }
          : {}),
        ...(this.isAdjustment() && this.adjustmentNote.trim()
          ? { adjustmentNote: this.adjustmentNote.trim() }
          : {}),
      });
      this.saved.set(true);
      this.quantity = '';
    } catch (error: unknown) {
      this.error.set(
        getErrorCode(error) === 'E2002'
          ? '해당 월은 정산 마감되어 입력 불가'
          : getErrorMessage(error, '저장 실패'),
      );
    } finally {
      this.saving.set(false);
    }
  }
}
