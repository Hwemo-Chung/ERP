// apps/web/src/app/features/settlement-fees/pages/statement/statement.page.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonNote,
  IonSelect, IonSelectOption, IonButton, IonBackButton, IonButtons, IonDatetime,
} from '@ionic/angular/standalone';
import { MasterDataService, PartnerRow } from '../../../master-data/services/master-data.service';
import { SettlementFeesService, StatementResponse } from '../../services/settlement-fees.service';

function currentYearMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

@Component({
  selector: 'app-statement',
  standalone: true,
  imports: [FormsModule, RouterLink, IonHeader, IonToolbar, IonTitle, IonContent, IonList,
    IonItem, IonLabel, IonNote, IonSelect, IonSelectOption, IonButton, IonBackButton,
    IonButtons, IonDatetime],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-back-button defaultHref="/settlement-fees" /></ion-buttons>
      <ion-title>정산서</ion-title>
    </ion-toolbar></ion-header>
    <ion-content class="ion-padding">
      <ion-list>
        <ion-item>
          <ion-select label="거래처" [(ngModel)]="partnerId" interface="popover">
            @for (p of partners(); track p.id) {
              <ion-select-option [value]="p.id">{{ p.name }}</ion-select-option>
            }
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-datetime presentation="month-year" [(ngModel)]="monthValue" (ionChange)="onMonthChange()" />
        </ion-item>
      </ion-list>
      <ion-button expand="block" [disabled]="!partnerId || loading()" (click)="load()">조회</ion-button>

      @if (error()) { <ion-note color="danger">{{ error() }}</ion-note> }

      @if (statement(); as s) {
        <ion-list>
          <ion-item lines="none"><ion-label><h2>운송료 ({{ s.transport.count }}건 / {{ s.transport.total }})</h2></ion-label></ion-item>
          @for (rec of s.transport.records; track rec.id) {
            <ion-item [routerLink]="rec.transactionId ? ['/settlement-fees/breakdown', rec.transactionId] : null">
              <ion-label>
                <h3>{{ rec.transaction?.product?.name ?? rec.transactionId }}</h3>
                <p>{{ rec.transaction?.transactionDate?.slice(0, 10) }}</p>
              </ion-label>
              <ion-note slot="end">{{ rec.amount }}</ion-note>
            </ion-item>
          } @empty {
            <ion-item><ion-label>운송 건이 없습니다.</ion-label></ion-item>
          }
        </ion-list>

        <ion-list>
          <ion-item lines="none"><ion-label><h2>보관료 ({{ s.storage.total }})</h2></ion-label></ion-item>
        </ion-list>

        <ion-list>
          <ion-item>
            <ion-label><h2>총계</h2></ion-label>
            <ion-note slot="end">{{ s.grandTotal }}</ion-note>
          </ion-item>
        </ion-list>

        <ion-button expand="block" fill="outline" (click)="download()">엑셀 다운로드</ion-button>
      }
    </ion-content>
  `,
})
export class StatementPage implements OnInit {
  private route = inject(ActivatedRoute);
  private settlementFees = inject(SettlementFeesService);
  private masterData = inject(MasterDataService);

  partners = signal<PartnerRow[]>([]);
  statement = signal<StatementResponse | null>(null);
  loading = signal(false);
  error = signal('');

  partnerId?: string;
  monthValue = currentYearMonthIso();
  yearMonth = this.monthValue.slice(0, 7);

  async ngOnInit() {
    this.partners.set((await this.masterData.getPartners({ page: 1 })).data);
    const qp = this.route.snapshot.queryParamMap;
    const partnerId = qp.get('partnerId');
    const yearMonth = qp.get('yearMonth');
    if (partnerId) this.partnerId = partnerId;
    if (yearMonth) {
      this.yearMonth = yearMonth;
      this.monthValue = `${yearMonth}-01`;
    }
    if (this.partnerId) await this.load();
  }

  onMonthChange() {
    this.yearMonth = this.monthValue.slice(0, 7);
  }

  async load() {
    if (!this.partnerId) return;
    this.error.set('');
    this.loading.set(true);
    try {
      this.statement.set(await this.settlementFees.getStatement(this.partnerId, this.yearMonth));
    } catch (e: any) {
      this.error.set(e?.error?.message ?? '조회 실패');
    } finally {
      this.loading.set(false);
    }
  }

  download() {
    if (!this.partnerId) return;
    this.settlementFees.downloadStatement(this.partnerId, this.yearMonth);
  }
}
