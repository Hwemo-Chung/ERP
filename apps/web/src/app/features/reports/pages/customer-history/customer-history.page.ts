// apps/web/src/app/features/reports/pages/customer-history/customer-history.page.ts
// PRD FR-16 - Customer order history search
import { Component, signal, inject, OnInit, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonSearchbar, IonList, IonItem, IonLabel, IonBadge, IonSpinner,
  IonButton, IonIcon, IonRefresher, IonRefresherContent, IonChip,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  downloadOutline, personOutline, callOutline, locationOutline, 
  calendarOutline, bagHandleOutline, searchOutline, chevronForwardOutline,
} from 'ionicons/icons';
import { ReportsStore } from '../../../../store/reports/reports.store';
import { CustomerHistoryItem } from '../../../../store/reports/reports.models';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

@Component({
  selector: 'app-customer-history',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonSearchbar, IonList, IonItem, IonLabel, IonBadge, IonSpinner,
    IonButton, IonIcon, IonRefresher, IonRefresherContent, IonChip,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/reports"></ion-back-button>
        </ion-buttons>
        <ion-title>고객 이력 조회</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="exportCSV()" [disabled]="reportsStore.customerHistory().length === 0">
            <ion-icon slot="icon-only" name="download-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- Search Section -->
      <div class="search-section">
        <div class="search-card">
          <ion-searchbar
            mode="ios"
            [debounce]="0"
            placeholder="고객명, 연락처, 주소로 검색..."
            (ionInput)="onSearch($event)"
            [value]="searchQuery()"
            class="custom-searchbar"
          ></ion-searchbar>
          <p class="search-hint">
            <ion-icon name="search-outline"></ion-icon>
            2글자 이상 입력하세요
          </p>
        </div>

        <!-- Recent Searches -->
        @if (recentSearches().length > 0 && !searchQuery()) {
          <div class="recent-section">
            <span class="recent-label">최근 검색</span>
            <div class="recent-chips">
              @for (term of recentSearches(); track term) {
                <ion-chip (click)="applyRecentSearch(term)">{{ term }}</ion-chip>
              }
            </div>
          </div>
        }
      </div>

      @if (reportsStore.isLoading()) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
          <p>검색 중...</p>
        </div>
      } @else {
        <!-- Results Count -->
        @if (searchQuery() && searchQuery().length >= 2) {
          <div class="results-header">
            <span class="results-count">검색 결과 {{ reportsStore.customerHistory().length }}건</span>
          </div>
        }

        <!-- Customer List -->
        <div class="customer-list">
          @for (customer of reportsStore.customerHistory(); track customer.orderId) {
            <div class="customer-card" (click)="viewDetail(customer)">
              <div class="customer-avatar">
                <ion-icon name="person-outline"></ion-icon>
              </div>
              <div class="customer-info">
                <div class="customer-header">
                  <span class="customer-name">{{ customer.customerName }}</span>
                  <ion-badge class="order-badge">{{ customer.orderNumber }}</ion-badge>
                </div>
                <div class="customer-details">
                  <span class="detail-item">
                    <ion-icon name="call-outline"></ion-icon>
                    {{ formatPhone(customer.customerPhone) }}
                  </span>
                  @if (customer.customerAddress) {
                    <span class="detail-item">
                      <ion-icon name="location-outline"></ion-icon>
                      {{ truncateAddress(customer.customerAddress) }}
                    </span>
                  }
                </div>
                <div class="customer-footer">
                  <span class="last-order">
                    <ion-icon name="calendar-outline"></ion-icon>
                    예약: {{ customer.appointmentDate | date:'yyyy.MM.dd' }}
                  </span>
                  <span class="total-amount">
                    {{ customer.status }}
                  </span>
                </div>
              </div>
              <ion-icon name="chevron-forward-outline" class="arrow-icon"></ion-icon>
            </div>
          } @empty {
            <div class="empty-state">
              @if (searchQuery() && searchQuery().length >= 2) {
                <ion-icon name="search-outline"></ion-icon>
                <h3>검색 결과가 없습니다</h3>
                <p>다른 검색어를 시도해보세요</p>
              } @else {
                <ion-icon name="person-outline"></ion-icon>
                <h3>고객 이력 조회</h3>
                <p>고객명, 연락처, 주소로 검색해주세요</p>
              }
            </div>
          }
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .search-section { padding: 16px; background: linear-gradient(180deg, #f8fafc 0%, transparent 100%); }
    .search-card { background: white; border-radius: 16px; padding: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
    .custom-searchbar { --background: #f1f5f9; --border-radius: 12px; --box-shadow: none; --padding-start: 12px; }
    .search-hint { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #94a3b8; margin: 8px 0 0 4px; }
    .search-hint ion-icon { font-size: 14px; }
    .recent-section { margin-top: 16px; }
    .recent-label { font-size: 13px; color: #64748b; font-weight: 500; }
    .recent-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
    .recent-chips ion-chip { --background: #e2e8f0; --color: #475569; font-size: 13px; }
    .loading-container { display: flex; flex-direction: column; align-items: center; padding: 64px; color: #64748b; }
    .loading-container p { margin-top: 12px; }
    .results-header { padding: 0 16px 8px; }
    .results-count { font-size: 13px; color: #64748b; font-weight: 500; }
    .customer-list { padding: 0 16px 16px; }
    .customer-card { display: flex; align-items: center; gap: 12px; background: white; border-radius: 16px; padding: 16px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; }
    .customer-card:active { transform: scale(0.98); box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    .customer-avatar { width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #3b82f6, #2563eb); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .customer-avatar ion-icon { font-size: 24px; color: white; }
    .customer-info { flex: 1; min-width: 0; }
    .customer-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
    .customer-name { font-size: 16px; font-weight: 600; color: #0f172a; }
    .order-badge { --background: #dbeafe; --color: #1d4ed8; font-size: 12px; font-weight: 600; border-radius: 6px; }
    .customer-details { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 6px; }
    .detail-item { display: flex; align-items: center; gap: 4px; font-size: 13px; color: #64748b; }
    .detail-item ion-icon { font-size: 14px; }
    .customer-footer { display: flex; justify-content: space-between; align-items: center; }
    .last-order { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #94a3b8; }
    .last-order ion-icon { font-size: 12px; }
    .total-amount { font-size: 13px; font-weight: 600; color: #059669; }
    .arrow-icon { font-size: 20px; color: #cbd5e1; flex-shrink: 0; }
    .empty-state { display: flex; flex-direction: column; align-items: center; padding: 64px 24px; text-align: center; }
    .empty-state ion-icon { font-size: 64px; color: #cbd5e1; margin-bottom: 16px; }
    .empty-state h3 { font-size: 18px; font-weight: 600; color: #475569; margin: 0 0 8px; }
    .empty-state p { font-size: 14px; color: #94a3b8; margin: 0; }
  `],
})
export class CustomerHistoryPage implements OnInit, OnDestroy {
  protected readonly reportsStore = inject(ReportsStore);
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);

  protected readonly searchQuery = signal('');
  protected readonly recentSearches = signal<string[]>([]);

  private readonly searchSubject = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  constructor() {
    addIcons({ 
      downloadOutline, personOutline, callOutline, locationOutline, 
      calendarOutline, bagHandleOutline, searchOutline, chevronForwardOutline,
    });

    // Debounced search with ReportsStore
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    ).subscribe(query => {
      if (query && query.length >= 2) {
        this.reportsStore.searchCustomerHistory({ customerQuery: query });
        this.addRecentSearch(query);
      }
    });
  }

  ngOnInit() {
    // Load recent searches from localStorage
    const saved = localStorage.getItem('recentCustomerSearches');
    if (saved) {
      this.recentSearches.set(JSON.parse(saved));
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearch(event: CustomEvent) {
    const query = (event.detail.value || '').trim();
    this.searchQuery.set(query);
    this.searchSubject.next(query);
  }

  applyRecentSearch(term: string) {
    this.searchQuery.set(term);
    this.searchSubject.next(term);
  }

  private addRecentSearch(query: string) {
    const searches = this.recentSearches();
    const filtered = searches.filter(s => s !== query);
    const updated = [query, ...filtered].slice(0, 5);
    this.recentSearches.set(updated);
    localStorage.setItem('recentCustomerSearches', JSON.stringify(updated));
  }

  async onRefresh(event: any) {
    if (this.searchQuery() && this.searchQuery().length >= 2) {
      this.reportsStore.searchCustomerHistory({ customerQuery: this.searchQuery() });
    }
    setTimeout(() => event.target.complete(), 500);
  }

  viewDetail(customer: CustomerHistoryItem) {
    // Navigate to order list filtered by customer
    this.router.navigate(['/tabs/orders'], {
      queryParams: { orderId: customer.orderId, customerName: customer.customerName }
    });
  }

  formatPhone(phone: string): string {
    if (!phone) return '-';
    // Format: 010-1234-5678
    return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  }

  truncateAddress(address: string): string {
    if (!address) return '';
    return address.length > 25 ? address.substring(0, 25) + '...' : address;
  }

  async exportCSV() {
    const customers = this.reportsStore.customerHistory();
    if (customers.length === 0) return;

    try {
      // Generate CSV
      const headers = ['고객명', '연락처', '주소', '주문번호', '상태', '예약일'];
      const rows = customers.map(c => [
        c.customerName,
        c.customerPhone,
        c.customerAddress || '',
        c.orderNumber,
        c.status,
        c.appointmentDate || '-',
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
