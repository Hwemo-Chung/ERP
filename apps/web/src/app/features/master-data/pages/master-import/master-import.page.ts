// apps/web/src/app/features/master-data/pages/master-import/master-import.page.ts
import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonInput, IonSelect,
  IonSelectOption, IonButton, IonList, IonNote, IonLabel, IonBackButton, IonButtons,
} from '@ionic/angular/standalone';
import {
  MasterDataService, PartnerRow, ImportParseResult, ImportCommitResult, StorageContractRow,
} from '../../services/master-data.service';

const COLUMNS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)); // A..Z

const PARTNER_FIELDS = [
  'code', 'name', 'businessRegistrationNo', 'representativeName', 'businessType',
  'businessCategory', 'address', 'contactName', 'phone', 'email', 'defaultTransportRate',
];
const PRODUCT_FIELDS = ['code', 'name', 'categoryName', 'unitPrice', 'costPrice', 'transportRate', 'palletThreshold', 'maxUnitsPerPallet'];

@Component({
  selector: 'app-master-import',
  standalone: true,
  imports: [FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonInput,
    IonSelect, IonSelectOption, IonButton, IonList, IonNote, IonLabel, IonBackButton, IonButtons],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-back-button defaultHref="/tabs" /></ion-buttons>
      <ion-title>엑셀 일괄 등록</ion-title>
    </ion-toolbar></ion-header>
    <ion-content class="ion-padding">
      <ion-list>
        <ion-item>
          <ion-select label="대상 *" [(ngModel)]="kind" (ionChange)="onKindChange()" interface="popover">
            <ion-select-option value="partners">거래처</ion-select-option>
            <ion-select-option value="products">품목</ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-label>엑셀 파일 *</ion-label>
          <input type="file" accept=".xlsx" (change)="onFileSelected($event)" />
        </ion-item>
      </ion-list>

      <ion-list>
        <ion-note class="ion-padding-start">컬럼 매핑 (필드 → 엑셀 열)</ion-note>
        @for (field of fields(); track field) {
          <ion-item>
            <ion-select [label]="field" [(ngModel)]="mapping[field]" interface="popover">
              <ion-select-option [value]="undefined">사용 안함</ion-select-option>
              @for (col of columns; track col) {
                <ion-select-option [value]="col">{{ col }}</ion-select-option>
              }
            </ion-select>
          </ion-item>
        }
      </ion-list>

      @if (kind === 'partners') {
        <ion-list>
          <ion-note class="ion-padding-start">일괄 적용 보관계약 *</ion-note>
          <ion-item>
            <ion-select label="보관료 방식" [(ngModel)]="defaultContractType" interface="popover">
              <ion-select-option value="PALLET_DAILY">파렛트 × 일수 단가</ion-select-option>
              <ion-select-option value="AREA_MONTHLY">면적 월임대</ion-select-option>
              <ion-select-option value="AREA_YEARLY">면적 년임대</ion-select-option>
            </ion-select>
          </ion-item>
          @if (defaultContractType === 'PALLET_DAILY') {
            <ion-item><ion-input label="파렛트 1일당 단가 *" type="number" [(ngModel)]="defaultPalletDailyRate" /></ion-item>
          } @else {
            <ion-item><ion-input label="계약 면적(평) *" type="number" [(ngModel)]="defaultAreaPyeong" /></ion-item>
            <ion-item><ion-input label="평당 단가 *" type="number" [(ngModel)]="defaultAreaRate" /></ion-item>
          }
          <ion-item><ion-input label="계약 시작일 *" type="date" [(ngModel)]="defaultStartDate" /></ion-item>
        </ion-list>
      } @else {
        <ion-list>
          <ion-item>
            <ion-select label="기본 거래처 *" [(ngModel)]="defaultPartnerId" interface="popover">
              @for (p of partners(); track p.id) {
                <ion-select-option [value]="p.id">{{ p.name }}</ion-select-option>
              }
            </ion-select>
          </ion-item>
        </ion-list>
      }

      @if (error()) { <ion-note color="danger">{{ error() }}</ion-note> }
      <ion-button expand="block" [disabled]="!file() || parsing()" (click)="parse()">파일 분석</ion-button>

      @if (parseResult(); as result) {
        <ion-note>정상 {{ result.validRows.length }}건 / 오류 {{ result.invalidRows.length }}건</ion-note>
        @if (result.invalidRows.length > 0) {
          <ion-list>
            @for (row of result.invalidRows; track row.rowIndex) {
              <ion-item>
                <ion-label>
                  <h3>{{ row.rowIndex }}행</h3>
                  <p>{{ row.errors.join(', ') }}</p>
                </ion-label>
              </ion-item>
            }
          </ion-list>
        }
        <ion-button expand="block" color="success" [disabled]="result.validRows.length === 0 || committing()" (click)="commit()">
          {{ result.validRows.length }}건 반영
        </ion-button>
      }

      @if (commitResult(); as result) {
        <ion-note color="success">{{ result.created }}건 생성 완료 ({{ result.failed.length }}건 실패)</ion-note>
      }
    </ion-content>
  `,
})
export class MasterImportPage {
  private api = inject(MasterDataService);

  columns = COLUMNS;
  kind: 'partners' | 'products' = 'partners';
  mapping: Record<string, string | undefined> = {};
  file = signal<File | null>(null);

  defaultContractType: StorageContractRow['contractType'] = 'PALLET_DAILY';
  defaultPalletDailyRate = ''; defaultAreaPyeong = ''; defaultAreaRate = ''; defaultStartDate = '';
  defaultPartnerId = '';
  partners = signal<PartnerRow[]>([]);

  parsing = signal(false);
  committing = signal(false);
  error = signal('');
  parseResult = signal<ImportParseResult | null>(null);
  commitResult = signal<ImportCommitResult | null>(null);

  fields = computed(() => (this.kind === 'partners' ? PARTNER_FIELDS : PRODUCT_FIELDS));

  constructor() {
    this.api.getPartners({ page: 1 }).then((res) => this.partners.set(res.data));
  }

  onKindChange() {
    this.mapping = {};
    this.parseResult.set(null);
    this.commitResult.set(null);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.file.set(input.files?.[0] ?? null);
    this.parseResult.set(null);
    this.commitResult.set(null);
  }

  async parse() {
    this.error.set('');
    const file = this.file();
    if (!file) return;
    const mapping = Object.fromEntries(
      Object.entries(this.mapping).filter(([, col]) => !!col),
    ) as Record<string, string>;
    this.parsing.set(true);
    try {
      const result = await this.api.importParse(this.kind, file, mapping);
      this.parseResult.set(result);
      this.commitResult.set(null);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? '분석 실패');
    } finally {
      this.parsing.set(false);
    }
  }

  async commit() {
    this.error.set('');
    const result = this.parseResult();
    if (!result || result.validRows.length === 0) return;

    this.committing.set(true);
    try {
      if (this.kind === 'partners') {
        if (!this.defaultStartDate) { this.error.set('보관계약 시작일은 필수입니다.'); return; }
        const defaultStorageContract: StorageContractRow = {
          contractType: this.defaultContractType,
          ...(this.defaultContractType === 'PALLET_DAILY'
            ? { palletDailyRate: this.defaultPalletDailyRate }
            : { areaPyeong: this.defaultAreaPyeong, areaRate: this.defaultAreaRate }),
          startDate: this.defaultStartDate,
        };
        this.commitResult.set(
          await this.api.importCommit('partners', result.validRows, { defaultStorageContract }),
        );
      } else {
        if (!this.defaultPartnerId) { this.error.set('기본 거래처는 필수입니다.'); return; }
        this.commitResult.set(
          await this.api.importCommit('products', result.validRows, { defaultPartnerId: this.defaultPartnerId }),
        );
      }
    } catch (e: any) {
      this.error.set(e?.error?.message ?? '반영 실패');
    } finally {
      this.committing.set(false);
    }
  }
}
