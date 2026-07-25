// apps/web/src/app/features/settlement-fees/pages/monthly-close/monthly-close.page.ts
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonLabel, IonNote, IonList,
  IonButton, IonBackButton, IonButtons, IonDatetime, IonBadge,
} from '@ionic/angular/standalone';
import { MasterDataService } from '../../../master-data/services/master-data.service';
import {
  SettlementFeesService, PartnerPreviewResult, CloseResponse,
} from '../../services/settlement-fees.service';

function currentYearMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

@Component({
  selector: 'app-monthly-close',
  standalone: true,
  imports: [FormsModule, RouterLink, IonHeader, IonToolbar, IonTitle, IonContent, IonItem,
    IonLabel, IonNote, IonList, IonButton, IonBackButton, IonButtons, IonDatetime, IonBadge],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-back-button defaultHref="/settlement-fees" /></ion-buttons>
      <ion-title>월 마감</ion-title>
    </ion-toolbar></ion-header>
    <ion-content class="ion-padding">
      <ion-datetime presentation="month-year" [(ngModel)]="monthValue" (ionChange)="onMonthChange()" />
      <ion-button expand="block" [disabled]="previewLoading()" (click)="runPreview()">미리보기</ion-button>

      @if (error()) { <ion-note color="danger">{{ error() }}</ion-note> }

      @if (preview()) {
        <ion-list>
          <ion-item lines="none"><ion-label><h2>거래처별 합계 — {{ yearMonth }}</h2></ion-label></ion-item>
          @for (row of preview()!.partners; track row.partnerId) {
            <ion-item>
              <ion-label>
                <h3><a [routerLink]="['/master-data/partners', row.partnerId]">{{ partnerName(row.partnerId) }}</a></h3>
                <p>운송료 {{ row.transportTotal }} / 보관료 {{ row.storageTotal }}</p>
              </ion-label>
              @if (row.errors.length > 0) {
                <ion-badge color="danger" slot="end">{{ row.errors.length }}건 오류</ion-badge>
              }
            </ion-item>
            @for (err of row.errors; track $index) {
              <ion-item lines="none">
                <ion-note color="danger" class="ion-text-wrap">
                  [{{ err.code }}] {{ err.message }}{{ err.transactionId ? ' (거래건: ' + err.transactionId + ')' : '' }}
                </ion-note>
              </ion-item>
            }
          }
        </ion-list>

        <ion-button expand="block" color="danger" [disabled]="totalErrors() > 0 || closing()" (click)="runClose()">
          마감 실행 {{ totalErrors() > 0 ? '(오류 ' + totalErrors() + '건 해결 필요)' : '' }}
        </ion-button>
      }

      @if (closeResult()) {
        <ion-list>
          <ion-item lines="none"><ion-label><h2>마감 완료 — 정산서 바로가기</h2></ion-label></ion-item>
          @for (row of closeResult()!.partners; track row.partnerId) {
            <ion-item [routerLink]="['/settlement-fees/statement']" [queryParams]="{ partnerId: row.partnerId, yearMonth: closeResult()!.yearMonth }">
              <ion-label>{{ partnerName(row.partnerId) }}</ion-label>
              <ion-note slot="end">정산서 보기</ion-note>
            </ion-item>
          }
        </ion-list>
      }
    </ion-content>
  `,
})
export class MonthlyClosePage implements OnInit {
  private settlementFees = inject(SettlementFeesService);
  private masterData = inject(MasterDataService);

  monthValue = currentYearMonthIso();
  yearMonth = this.monthValue.slice(0, 7);

  previewLoading = signal(false);
  closing = signal(false);
  error = signal('');
  preview = signal<{ partners: PartnerPreviewResult[] } | null>(null);
  closeResult = signal<CloseResponse | null>(null);
  partnerNames = signal<Record<string, string>>({});

  totalErrors = computed(() => this.preview()?.partners.reduce((n, p) => n + p.errors.length, 0) ?? 0);

  async ngOnInit() {
    const partnerPage = await this.masterData.getPartners({ page: 1 });
    this.partnerNames.set(Object.fromEntries(partnerPage.data.map((p) => [p.id, p.name])));
  }

  onMonthChange() {
    this.yearMonth = this.monthValue.slice(0, 7);
    this.preview.set(null);
    this.closeResult.set(null);
  }

  partnerName(id: string): string {
    return this.partnerNames()[id] ?? id;
  }

  async runPreview() {
    this.error.set('');
    this.closeResult.set(null);
    this.previewLoading.set(true);
    try {
      this.preview.set(await this.settlementFees.preview(this.yearMonth));
    } catch (e: any) {
      this.error.set(e?.error?.message ?? '미리보기 실패');
    } finally {
      this.previewLoading.set(false);
    }
  }

  async runClose() {
    this.error.set('');
    this.closing.set(true);
    try {
      this.closeResult.set(await this.settlementFees.close(this.yearMonth));
    } catch (e: any) {
      // E4109: unresolved calculation errors surfaced by the backend at close time
      // even though the button is disabled at 0 errors — data may have changed
      // between preview and close (race). Re-run preview so the error table shown
      // to the user reflects the state the backend just rejected.
      if (e?.error?.errors) {
        await this.runPreview();
      }
      this.error.set(e?.error?.message ?? '마감 실패');
    } finally {
      this.closing.set(false);
    }
  }
}
