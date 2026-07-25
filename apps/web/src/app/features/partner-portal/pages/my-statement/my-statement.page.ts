// apps/web/src/app/features/partner-portal/pages/my-statement/my-statement.page.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonNote,
  IonButton, IonBackButton, IonButtons, IonDatetime,
} from '@ionic/angular/standalone';
import { AuthService } from '../../../../core/services/auth.service';
import { SettlementFeesService, StatementResponse } from '../../../settlement-fees/services/settlement-fees.service';

function currentYearMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// ponytail: no partner select (unlike settlement-fees/pages/statement.page.ts) — the
// caller's own partnerId comes from the auth store; the server (settlement-fees
// controller scopeFor()) 403s (E4110) any explicit partnerId that doesn't match it, so
// there's nothing else a PARTNER_COORDINATOR could select anyway.
@Component({
  selector: 'app-my-statement',
  standalone: true,
  imports: [FormsModule, RouterLink, IonHeader, IonToolbar, IonTitle, IonContent, IonList,
    IonItem, IonLabel, IonNote, IonButton, IonBackButton, IonButtons, IonDatetime],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-back-button defaultHref="/portal" /></ion-buttons>
      <ion-title>내 정산서</ion-title>
    </ion-toolbar></ion-header>
    <ion-content class="ion-padding">
      @if (!partnerId) {
        <ion-note color="danger">거래처 정보가 없습니다. 관리자에게 문의하세요.</ion-note>
      } @else {
        <ion-list>
          <ion-item>
            <ion-datetime presentation="month-year" [(ngModel)]="monthValue" (ionChange)="onMonthChange()" />
          </ion-item>
        </ion-list>
        <ion-button expand="block" [disabled]="loading()" (click)="load()">조회</ion-button>

        @if (error()) { <ion-note color="danger">{{ error() }}</ion-note> }

        @if (statement(); as s) {
          <ion-list>
            <ion-item lines="none"><ion-label><h2>운송료 ({{ s.transport.count }}건 / {{ s.transport.total }})</h2></ion-label></ion-item>
            @for (rec of s.transport.records; track rec.id) {
              <ion-item [routerLink]="rec.transactionId ? ['/portal/breakdown', rec.transactionId] : null">
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

          <ion-button expand="block" fill="outline" (click)="download()">정산서 다운로드</ion-button>
        }
      }
    </ion-content>
  `,
})
export class MyStatementPage implements OnInit {
  private auth = inject(AuthService);
  private settlementFees = inject(SettlementFeesService);

  // ponytail: read in ngOnInit (not a field initializer) — authGuard awaits
  // authService.initialize() before this route activates, so user() is already
  // populated by construction time either way, but reading it in ngOnInit matches the
  // safer pattern used by portal-home.page.ts / my-transactions.page.ts.
  partnerId?: string;

  statement = signal<StatementResponse | null>(null);
  loading = signal(false);
  error = signal('');

  monthValue = currentYearMonthIso();
  yearMonth = this.monthValue.slice(0, 7);

  async ngOnInit() {
    this.partnerId = this.auth.user()?.partnerId;
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
