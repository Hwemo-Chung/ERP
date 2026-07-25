// apps/web/src/app/features/warehouse/pages/transaction-import/transaction-import.page.ts
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonSelect,
  IonSelectOption, IonButton, IonList, IonNote, IonLabel, IonBackButton, IonButtons,
} from '@ionic/angular/standalone';
import { WarehouseService, ImportParseResult, ImportCommitResult } from '../../services/warehouse.service';

const COLUMNS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)); // A..Z
const FIELDS = ['partnerCode', 'productCode', 'type', 'quantity', 'transactionDate'];

@Component({
  selector: 'app-transaction-import',
  standalone: true,
  imports: [FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonItem,
    IonSelect, IonSelectOption, IonButton, IonList, IonNote, IonLabel, IonBackButton, IonButtons],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-back-button defaultHref="/tabs" /></ion-buttons>
      <ion-title>실적 엑셀 일괄 등록</ion-title>
    </ion-toolbar></ion-header>
    <ion-content class="ion-padding">
      <ion-list>
        <ion-item>
          <ion-label>엑셀 파일 *</ion-label>
          <input type="file" accept=".xlsx" (change)="onFileSelected($event)" />
        </ion-item>
      </ion-list>

      <ion-list>
        <ion-note class="ion-padding-start">컬럼 매핑 (필드 → 엑셀 열)</ion-note>
        @for (field of fields; track field) {
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
export class TransactionImportPage {
  private api = inject(WarehouseService);

  columns = COLUMNS;
  fields = FIELDS;
  mapping: Record<string, string | undefined> = {};
  file = signal<File | null>(null);

  parsing = signal(false);
  committing = signal(false);
  error = signal('');
  parseResult = signal<ImportParseResult | null>(null);
  commitResult = signal<ImportCommitResult | null>(null);

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
      const result = await this.api.importParse(file, mapping);
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
      this.commitResult.set(await this.api.importCommit(result.validRows));
    } catch (e: any) {
      // ponytail: import/commit returns 200 with per-row { failed } even when a row hits
      // E2002 (transaction-import.service.ts catches per-row) — this catch only covers
      // network/validation failures, not settlement-lock. Per-row E2002 messages surface
      // via commitResult().failed[].error instead.
      this.error.set(e?.error?.message ?? '반영 실패');
    } finally {
      this.committing.set(false);
    }
  }
}
