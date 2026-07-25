// apps/web/src/app/features/partner-portal/pages/my-transactions/my-transactions.page.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonInput, IonList, IonLabel, IonNote,
  IonBackButton, IonButtons, IonButton, IonInfiniteScroll, IonInfiniteScrollContent, InfiniteScrollCustomEvent,
} from '@ionic/angular/standalone';
import { AuthService } from '../../../../core/services/auth.service';
import { WarehouseService, TransactionRow } from '../../../warehouse/services/warehouse.service';

const PAGE_SIZE = 50;

// ponytail: no partner select here (unlike transaction-list.page.ts) — the server
// (transactions.controller.ts findAll) force-scopes PARTNER_COORDINATOR requests to
// their own partnerId regardless of any partnerId query param, so a filter UI would be
// both redundant and misleading (it could never actually select another partner's data).
@Component({
  selector: 'app-my-transactions',
  standalone: true,
  imports: [FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonInput,
    IonList, IonLabel, IonNote, IonBackButton, IonButtons, IonButton,
    IonInfiniteScroll, IonInfiniteScrollContent],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-back-button defaultHref="/portal" /></ion-buttons>
      <ion-title>내 물량</ion-title>
    </ion-toolbar></ion-header>
    <ion-content>
      <ion-list>
        <ion-item><ion-input label="시작일" type="date" [(ngModel)]="dateFrom" (ionChange)="reload()" /></ion-item>
        <ion-item><ion-input label="종료일" type="date" [(ngModel)]="dateTo" (ionChange)="reload()" /></ion-item>
      </ion-list>
      <ion-button expand="block" fill="outline" (click)="download()">출고명세서 다운로드</ion-button>

      <ion-list>
        @for (t of transactions(); track t.id) {
          <ion-item>
            <ion-label>
              <h2>{{ t.product?.name ?? t.productId }} <ion-note>{{ t.product?.code }}</ion-note></h2>
              <p>{{ t.type === 'INBOUND' ? '입고' : '출고' }} · 수량 {{ t.quantity }} · {{ t.transactionDate.slice(0, 10) }}</p>
            </ion-label>
          </ion-item>
        } @empty {
          <ion-item><ion-label>조회된 실적이 없습니다.</ion-label></ion-item>
        }
      </ion-list>
      @if (error()) { <ion-note color="danger">{{ error() }}</ion-note> }
      @if (hasMore()) {
        <ion-infinite-scroll (ionInfinite)="loadMore($event)">
          <ion-infinite-scroll-content></ion-infinite-scroll-content>
        </ion-infinite-scroll>
      }
    </ion-content>
  `,
})
export class MyTransactionsPage implements OnInit {
  private auth = inject(AuthService);
  private warehouse = inject(WarehouseService);

  transactions = signal<TransactionRow[]>([]);
  hasMore = signal(false);
  error = signal('');

  dateFrom?: string;
  dateTo?: string;
  private page = 1;

  async ngOnInit() {
    await this.reload();
  }

  async reload() {
    this.error.set('');
    this.page = 1;
    try {
      const res = await this.fetch(this.page);
      this.transactions.set(res.data);
      this.hasMore.set(this.page * PAGE_SIZE < res.totalCount);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? '조회 실패');
    }
  }

  async loadMore(event: InfiniteScrollCustomEvent) {
    this.error.set('');
    this.page += 1;
    try {
      const res = await this.fetch(this.page);
      this.transactions.set([...this.transactions(), ...res.data]);
      this.hasMore.set(this.page * PAGE_SIZE < res.totalCount);
    } catch (e: any) {
      this.page -= 1; // roll back — this page never loaded
      this.error.set(e?.error?.message ?? '추가 조회 실패');
    } finally {
      event.target.complete();
    }
  }

  download() {
    this.warehouse.downloadShipmentList({
      partnerId: this.auth.user()?.partnerId,
      dateFrom: this.dateFrom || undefined,
      dateTo: this.dateTo || undefined,
    });
  }

  private fetch(page: number) {
    // partnerId intentionally omitted — server forces the caller's own scope.
    return this.warehouse.getTransactions({
      dateFrom: this.dateFrom || undefined,
      dateTo: this.dateTo || undefined,
      page,
      pageSize: PAGE_SIZE,
    });
  }
}
