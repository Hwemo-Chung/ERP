// apps/web/src/app/features/settlement-fees/pages/statement/statement.page.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { getErrorMessage } from '../../../../core/utils/error.util';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonBackButton,
  IonButtons,
  IonInput,
} from '@ionic/angular/standalone';
import { MasterDataService, PartnerRow } from '../../../master-data/services/master-data.service';
import {
  SettlementFeesService,
  SettlementInvoiceRow,
  StatementResponse,
} from '../../services/settlement-fees.service';

function currentYearMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

@Component({
  selector: 'app-statement',
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
    IonSelect,
    IonSelectOption,
    IonButton,
    IonBackButton,
    IonButtons,
    IonInput,
  ],
  template: `
    <ion-header
      ><ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/settlement-fees" /></ion-buttons>
        <ion-title>정산서</ion-title>
      </ion-toolbar></ion-header
    >
    <ion-content class="ion-padding"
      ><div class="work-surface">
        <ion-list>
          <ion-item>
            <ion-select label="거래처" [(ngModel)]="partnerId" interface="popover">
              @for (p of partners(); track p.id) {
                <ion-select-option [value]="p.id">{{ p.name }}</ion-select-option>
              }
            </ion-select>
          </ion-item>
          <ion-item>
            <ion-input
              label="정산월"
              type="month"
              [(ngModel)]="monthValue"
              (ionChange)="onMonthChange()"
            />
          </ion-item>
        </ion-list>
        <ion-button expand="block" [disabled]="!partnerId || loading()" (click)="load()"
          >조회</ion-button
        >

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
                ><ion-note class="financial total" slot="end"
                  >{{ formatMoney(inv.totalAmount) }}원</ion-note
                ></ion-item
              ></ion-list
            >
            @if (inv.status === 'DRAFT') {
              <ion-button expand="block" (click)="changeInvoiceStatus(inv, 'ISSUED')"
                >발행</ion-button
              >
            }
            @if (inv.status === 'ISSUED') {
              <ion-button expand="block" color="success" (click)="changeInvoiceStatus(inv, 'PAID')"
                >입금 완료</ion-button
              >
            }
            @if (inv.status === 'DRAFT' || inv.status === 'ISSUED') {
              <ion-button expand="block" fill="outline" color="danger" (click)="cancelInvoice(inv)"
                >청구서 취소</ion-button
              >
            }
            @if (inv.status === 'ISSUED' || inv.status === 'PAID') {
              <ion-button
                expand="block"
                fill="outline"
                (click)="settlementFees.downloadInvoice(inv.id)"
                >청구서 PDF</ion-button
              >
            }
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
                [routerLink]="
                  rec.transactionId ? ['/settlement-fees/breakdown', rec.transactionId] : null
                "
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

          <ion-button expand="block" fill="outline" (click)="download()">엑셀 다운로드</ion-button>
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
      .total {
        font-weight: var(--font-weight-semibold);
      }
    `,
  ],
})
export class StatementPage implements OnInit {
  private route = inject(ActivatedRoute);
  readonly settlementFees = inject(SettlementFeesService);
  private masterData = inject(MasterDataService);

  partners = signal<PartnerRow[]>([]);
  statement = signal<StatementResponse | null>(null);
  invoice = signal<SettlementInvoiceRow | null>(null);
  loading = signal(false);
  error = signal('');

  partnerId?: string;
  monthValue = currentYearMonthIso();
  yearMonth = this.monthValue.slice(0, 7);

  async ngOnInit() {
    // ponytail: pageSize:100 is the backend max (partners.service.ts caps at 100) —
    // move to a typeahead/search-backed lookup if the partner count ever exceeds it.
    this.partners.set((await this.masterData.getPartners({ page: 1, pageSize: 100 })).data);
    const qp = this.route.snapshot.queryParamMap;
    const partnerId = qp.get('partnerId');
    const yearMonth = qp.get('yearMonth');
    if (partnerId) this.partnerId = partnerId;
    if (yearMonth) {
      this.yearMonth = yearMonth;
      this.monthValue = yearMonth;
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

  async changeInvoiceStatus(
    invoice: SettlementInvoiceRow,
    status: 'ISSUED' | 'PAID',
  ): Promise<void> {
    this.error.set('');
    if (
      !window.confirm(
        status === 'ISSUED' ? '청구서를 발행하시겠습니까?' : '입금 완료로 변경하시겠습니까?',
      )
    )
      return;
    try {
      this.invoice.set(await this.settlementFees.changeInvoiceStatus(invoice.id, status));
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : '상태 변경 실패');
    }
  }

  async cancelInvoice(invoice: SettlementInvoiceRow): Promise<void> {
    const reason = window.prompt('취소 사유를 입력하세요.');
    if (
      reason?.trim() &&
      window.confirm('취소된 청구서는 합계에서 제외됩니다. 계속하시겠습니까?')
    ) {
      try {
        this.invoice.set(
          await this.settlementFees.changeInvoiceStatus(invoice.id, 'CANCELLED', reason.trim()),
        );
      } catch (error: unknown) {
        this.error.set(error instanceof Error ? error.message : '청구서 취소 실패');
      }
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
