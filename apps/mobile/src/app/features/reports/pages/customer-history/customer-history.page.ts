// apps/web/src/app/features/reports/pages/customer-history/customer-history.page.ts
import { Component, signal, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonSearchbar, IonList, IonItem, IonLabel, IonBadge, IonSpinner,
  IonButton, IonIcon, IonRefresher, IonRefresherContent,
  ModalController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { downloadOutline, personOutline, callOutline } from 'ionicons/icons';
import { ReportsService, CustomerRecord } from '../../../../core/services/reports.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

@Component({
  selector: 'app-customer-history',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonSearchbar, IonList, IonItem, IonLabel, IonBadge, IonSpinner,
    IonButton, IonIcon, IonRefresher, IonRefresherContent, TranslateModule,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/reports"></ion-back-button></ion-buttons>
        <ion-title>고객 이력 조회</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="exportCSV()" [disabled]="customers().length === 0">
            <ion-icon name="download-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar
          [debounce]="300"
          placeholder="고객명, 연락처, 주문번호..."
          (ionInput)="onSearch($event)"
          [value]="searchQuery()"
        ></ion-searchbar>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (isLoading()) {
        <div class="center"><ion-spinner name="crescent"></ion-spinner></div>
      } @else {
        <ion-list>
          @for (customer of customers(); track customer.id) {
            <ion-item detail button (click)="viewDetail(customer)">
              <ion-icon name="person-outline" slot="start" color="primary"></ion-icon>
              <ion-label>
                <h2>{{ customer.name }}</h2>
                <p>
                  <ion-icon name="call-outline" style="font-size:12px"></ion-icon>
                  {{ formatPhone(customer.phone) }}
                </p>
                <p class="sub">최근 주문: {{ customer.lastOrderDate || '-' }}</p>
              </ion-label>
              <ion-badge slot="end">{{ customer.orderCount }}건</ion-badge>
            </ion-item>
          } @empty {
            <div class="empty">
              @if (searchQuery()) {
                검색 결과가 없습니다
              } @else {
                고객명 또는 연락처로 검색해주세요
              }
            </div>
          }
        </ion-list>
      }
    </ion-content>
  `,
  styles: [`
    .center { display: flex; justify-content: center; padding: 48px; }
    .empty { text-align: center; padding: 48px; color: var(--ion-color-medium); }
    .sub { font-size: 12px; color: var(--ion-color-medium); }
  `],
})
export class CustomerHistoryPage implements OnInit {
  private readonly reportsService = inject(ReportsService);
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);
  private readonly translate = inject(TranslateService);

  protected readonly isLoading = signal(false);
  protected readonly searchQuery = signal('');
  protected readonly customers = signal<CustomerRecord[]>([]);

  private readonly searchSubject = new Subject<string>();

  constructor() {
    addIcons({ downloadOutline, personOutline, callOutline });

    // Debounced search
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query || query.length < 2) {
          this.customers.set([]);
          return [];
        }
        this.isLoading.set(true);
        return this.reportsService.searchCustomers(query);
      }),
    ).subscribe({
      next: (result) => {
        this.customers.set(result?.data || []);
        this.isLoading.set(false);
      },
      error: () => {
        this.customers.set([]);
        this.isLoading.set(false);
      },
    });
  }

  ngOnInit() {}

  onSearch(event: CustomEvent) {
    const query = event.detail.value || '';
    this.searchQuery.set(query);
    this.searchSubject.next(query);
  }

  async onRefresh(event: any) {
    if (this.searchQuery()) {
      this.searchSubject.next(this.searchQuery());
    }
    event.target.complete();
  }

  viewDetail(customer: CustomerRecord) {
    // Navigate to order list filtered by customer
    this.router.navigate(['/tabs/orders'], {
      queryParams: { customerId: customer.id, customerName: customer.name }
    });
  }

  formatPhone(phone: string): string {
    if (!phone) return '-';
    // Format: 010-1234-5678
    return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  }

  async exportCSV() {
    if (this.customers().length === 0) return;

    try {
      // Generate CSV
      const headers = this.translate.instant('REPORTS.CUSTOMER_HISTORY.EXPORT_HEADERS');
      const rows = this.customers().map(c => [
        c.name,
        c.phone,
        String(c.orderCount),
        c.lastOrderDate || '-',
      ]);

      const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `customers_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      const toast = await this.toastCtrl.create({
        message: 'CSV 다운로드 완료',
        duration: 2000,
        color: 'success',
      });
      await toast.present();
    } catch (error) {
      const toast = await this.toastCtrl.create({
        message: '다운로드 실패',
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    }
  }
}
