// apps/web/src/app/features/warehouse/pages/transaction-entry/transaction-entry.page.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonInput, IonSelect,
  IonSelectOption, IonButton, IonList, IonNote, IonBackButton, IonButtons,
  IonSegment, IonSegmentButton, IonLabel, IonSearchbar,
} from '@ionic/angular/standalone';
import { MasterDataService, PartnerRow, ProductRow, RateCardRow } from '../../../master-data/services/master-data.service';
import { WarehouseService } from '../../services/warehouse.service';

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
  imports: [FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonInput,
    IonSelect, IonSelectOption, IonButton, IonList, IonNote, IonBackButton, IonButtons,
    IonSegment, IonSegmentButton, IonLabel, IonSearchbar],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-back-button defaultHref="/tabs" /></ion-buttons>
      <ion-title>실적 입력</ion-title>
    </ion-toolbar></ion-header>
    <ion-content class="ion-padding">
      <ion-list>
        <ion-item>
          <ion-select label="거래처 *" [(ngModel)]="partnerId" (ionChange)="onPartnerChange()" interface="popover">
            @for (p of partners(); track p.id) {
              <ion-select-option [value]="p.id">{{ p.name }}</ion-select-option>
            }
          </ion-select>
        </ion-item>
        <ion-searchbar [(ngModel)]="productSearch" [disabled]="!partnerId" (ionInput)="onProductSearch()" placeholder="품목명/코드 검색" />
        <ion-item>
          <ion-select label="품목 *" [(ngModel)]="productId" [disabled]="!partnerId" interface="popover">
            @for (p of products(); track p.id) {
              <ion-select-option [value]="p.id">{{ p.name }} ({{ p.code }})</ion-select-option>
            }
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-segment [value]="type" (ionChange)="onTypeChange($event)">
            <ion-segment-button value="INBOUND"><ion-label>입고</ion-label></ion-segment-button>
            <ion-segment-button value="OUTBOUND"><ion-label>출고</ion-label></ion-segment-button>
          </ion-segment>
        </ion-item>
        <ion-item><ion-input label="수량 *" type="number" min="1" step="1" [(ngModel)]="quantity" /></ion-item>
        <ion-item><ion-input label="일자 *" type="date" [(ngModel)]="transactionDate" /></ion-item>
        <ion-item>
          <ion-select label="차량 (선택)" [(ngModel)]="vehicleRateId" interface="popover">
            <ion-select-option [value]="undefined">선택 안함</ion-select-option>
            @for (v of vehicleRates(); track v.id) {
              <ion-select-option [value]="v.id">{{ v.vehicleType }} {{ v.tonnage ? '(' + v.tonnage + 't)' : '' }}</ion-select-option>
            }
          </ion-select>
        </ion-item>
      </ion-list>
      @if (error()) { <ion-note color="danger">{{ error() }}</ion-note> }
      @if (saved()) { <ion-note color="success">저장되었습니다.</ion-note> }
      <ion-button expand="block" [disabled]="saving()" (click)="save()">저장</ion-button>
    </ion-content>
  `,
})
export class TransactionEntryPage implements OnInit {
  private masterData = inject(MasterDataService);
  private warehouse = inject(WarehouseService);

  partners = signal<PartnerRow[]>([]);
  products = signal<ProductRow[]>([]);
  vehicleRates = signal<RateCardRow[]>([]);

  partnerId?: string;
  productId?: string;
  productSearch = '';
  type: 'INBOUND' | 'OUTBOUND' = 'INBOUND';
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
    this.type = event.detail.value as 'INBOUND' | 'OUTBOUND';
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
    this.saving.set(true);
    try {
      await this.warehouse.createTransaction({
        type: this.type,
        partnerId: this.partnerId,
        productId: this.productId,
        quantity,
        transactionDate: this.transactionDate,
        ...(this.vehicleRateId ? { vehicleRateId: this.vehicleRateId } : {}),
      });
      this.saved.set(true);
      this.quantity = '';
    } catch (e: any) {
      this.error.set(
        e?.error?.code === 'E2002'
          ? '해당 월은 정산 마감되어 입력 불가'
          : (e?.error?.message ?? '저장 실패'),
      );
    } finally {
      this.saving.set(false);
    }
  }
}
