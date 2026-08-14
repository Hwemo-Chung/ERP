// apps/web/src/app/features/partner-portal/pages/my-statement/my-statement.page.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonNote,
  IonButton,
  IonBackButton,
  IonButtons,
  IonInput,
} from '@ionic/angular/standalone';
import { AuthService } from '../../../../core/services/auth.service';
import { getErrorMessage } from '../../../../core/utils/error.util';
import {
  SettlementFeesService,
  SettlementInvoiceRow,
  StatementResponse,
} from '../../../settlement-fees/services/settlement-fees.service';

function currentYearMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ponytail: no partner select (unlike settlement-fees/pages/statement.page.ts) — the
// caller's own partnerId comes from the auth store; the server (settlement-fees
// controller scopeFor()) 403s (E4110) any explicit partnerId that doesn't match it, so
// there's nothing else a PARTNER_COORDINATOR could select anyway.
@Component({
  selector: 'app-my-statement',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    IonButton,
    IonBackButton,
    IonButtons,
    IonInput,
  ],
  template: `
    <ion-header
      ><ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/portal" /></ion-buttons>
        <ion-title>내 정산서</ion-title>
      </ion-toolbar></ion-header
    >
    <ion-content class="ion-padding"
      ><div class="work-surface">
        @if (!partnerId) {
          <ion-note color="danger" role="alert"
            >거래처 정보가 없습니다. 관리자에게 문의하세요.</ion-note
          >
        } @else {
          <ion-list>
            <ion-item>
              <ion-input
                label="정산월"
                type="month"
                [(ngModel)]="monthValue"
                (ionChange)="onMonthChange()"
              />
            </ion-item>
          </ion-list>
          <ion-button expand="block" [disabled]="loading()" (click)="load()">조회</ion-button>

          @if (error()) {
            <ion-note color="danger" role="alert">{{ error() }}</ion-note>
          }

          @if (statement(); as s) {
            @if (invoice(); as inv) {
              <ion-list
                ><ion-item
                  ><ion-label
                    ><h2>{{ inv.invoiceNo }}</h2>
                    <p class="invoice-meta">{{ invoiceStatusLabel(inv.status) }}</p>
                    <p class="invoice-meta">
                      공급가 {{ formatMoney(inv.subtotalAmount) }} · 부가세
                      {{ formatMoney(inv.vatAmount) }}
                    </p></ion-label
                  ><ion-note class="financial" slot="end"
                    >{{ formatMoney(inv.totalAmount) }}원</ion-note
                  ></ion-item
                ></ion-list
              >
              <ion-button expand="block" (click)="settlementFees.downloadInvoice(inv.id)"
                >청구서 PDF</ion-button
              >
            }
            <ion-list>
              <ion-item lines="none"
                  ><ion-label
                  ><h2>
                    운송료 ({{ s.transport.count }}건 / {{ formatMoney(s.transport.total) }})
                  </h2></ion-label
                ></ion-item
              >
              @for (rec of s.transport.records; track rec.id) {
                <ion-item
                  [routerLink]="rec.transactionId ? ['/portal/breakdown', rec.transactionId] : null"
                >
                  <ion-label>
                    <h3>{{ rec.transaction?.product?.name ?? rec.transactionId }}</h3>
                    <p>{{ rec.transaction?.transactionDate?.slice(0, 10) }}</p>
                  </ion-label>
                  <ion-note class="financial" slot="end">{{ formatMoney(rec.amount) }}</ion-note>
                </ion-item>
              } @empty {
                <ion-item><ion-label>운송 건이 없습니다.</ion-label></ion-item>
              }
            </ion-list>

            <ion-list>
              <ion-item lines="none"
                  ><ion-label
                  ><h2>보관료 ({{ formatMoney(s.storage.total) }})</h2></ion-label
                ></ion-item
              >
            </ion-list>

            <ion-list>
              <ion-item>
                <ion-label><h2>공급가</h2></ion-label>
                <ion-note class="financial" slot="end">{{ formatMoney(s.grandTotal) }}</ion-note>
              </ion-item>
              @if (invoice(); as inv) {
                <ion-item
                  ><ion-label>부가세(10%)</ion-label
                  ><ion-note class="financial" slot="end">{{
                    formatMoney(inv.vatAmount)
                  }}</ion-note></ion-item
                >
                <ion-item
                  ><ion-label><h2>총액</h2></ion-label
                  ><ion-note class="financial" slot="end">{{
                    formatMoney(inv.totalAmount)
                  }}</ion-note></ion-item
                >
              }
            </ion-list>

            <ion-button expand="block" fill="outline" (click)="download()"
              >정산서 다운로드</ion-button
            >
          }
        }
      </div></ion-content
    >
  `,
  styles: [
    `
      .work-surface {
        max-width: 960px;
        margin-inline: auto;
      }
      .financial {
        color: var(--ion-text-color);
      }
      .invoice-meta {
        color: var(--gray-500);
      }
    `,
  ],
})
export class MyStatementPage implements OnInit {
  private auth = inject(AuthService);
  readonly settlementFees = inject(SettlementFeesService);

  // ponytail: read in ngOnInit (not a field initializer) — authGuard awaits
  // authService.initialize() before this route activates, so user() is already
  // populated by construction time either way, but reading it in ngOnInit matches the
  // safer pattern used by portal-home.page.ts / my-transactions.page.ts.
  partnerId?: string;

  statement = signal<StatementResponse | null>(null);
  invoice = signal<SettlementInvoiceRow | null>(null);
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
      const [statement, invoice] = await Promise.all([
        this.settlementFees.getStatement(this.partnerId, this.yearMonth),
        this.settlementFees.getInvoice(this.partnerId, this.yearMonth),
      ]);
      this.statement.set(statement);
      this.invoice.set(invoice);
    } catch (error: unknown) {
      this.error.set(getErrorMessage(error, '조회 실패'));
    } finally {
      this.loading.set(false);
    }
  }

  download() {
    if (!this.partnerId) return;
    this.settlementFees.downloadStatement(this.partnerId, this.yearMonth);
  }

  formatMoney(value: string): string {
    return Number(value).toLocaleString('ko-KR');
  }
  invoiceStatusLabel(status: SettlementInvoiceRow['status']): string {
    return { DRAFT: '작성중', ISSUED: '발행', PAID: '입금완료', CANCELLED: '취소' }[status];
  }
}
