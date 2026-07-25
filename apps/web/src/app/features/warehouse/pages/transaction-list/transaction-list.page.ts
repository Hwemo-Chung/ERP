// apps/web/src/app/features/warehouse/pages/transaction-list/transaction-list.page.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonInput, IonSelect,
  IonSelectOption, IonList, IonLabel, IonNote, IonBackButton, IonButtons,
  IonInfiniteScroll, IonInfiniteScrollContent, InfiniteScrollCustomEvent,
} from '@ionic/angular/standalone';
import { MasterDataService, PartnerRow } from '../../../master-data/services/master-data.service';
import { WarehouseService, TransactionRow } from '../../services/warehouse.service';

const PAGE_SIZE = 50;

@Component({
  selector: 'app-transaction-list',
  standalone: true,
  imports: [FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonInput,
    IonSelect, IonSelectOption, IonList, IonLabel, IonNote, IonBackButton, IonButtons,
    IonInfiniteScroll, IonInfiniteScrollContent],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-back-button defaultHref="/tabs" /></ion-buttons>
      <ion-title>실적 목록</ion-title>
    </ion-toolbar></ion-header>
    <ion-content>
      <ion-list>
        <ion-item>
          <ion-select label="거래처" [(ngModel)]="partnerId" (ionChange)="reload()" interface="popover">
            <ion-select-option [value]="undefined">전체</ion-select-option>
            @for (p of partners(); track p.id) {
              <ion-select-option [value]="p.id">{{ p.name }}</ion-select-option>
            }
          </ion-select>
        </ion-item>
        <ion-item><ion-input label="시작일" type="date" [(ngModel)]="dateFrom" (ionChange)="reload()" /></ion-item>
        <ion-item><ion-input label="종료일" type="date" [(ngModel)]="dateTo" (ionChange)="reload()" /></ion-item>
      </ion-list>
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
export class TransactionListPage implements OnInit {
  private masterData = inject(MasterDataService);
  private warehouse = inject(WarehouseService);

  partners = signal<PartnerRow[]>([]);
  transactions = signal<TransactionRow[]>([]);
  hasMore = signal(false);
  error = signal('');

  partnerId?: string;
  dateFrom?: string;
  dateTo?: string;
  private page = 1;

  async ngOnInit() {
    this.partners.set((await this.masterData.getPartners({ page: 1 })).data);
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

  private fetch(page: number) {
    return this.warehouse.getTransactions({
      partnerId: this.partnerId || undefined,
      dateFrom: this.dateFrom || undefined,
      dateTo: this.dateTo || undefined,
      page,
      pageSize: PAGE_SIZE,
    });
  }
}
