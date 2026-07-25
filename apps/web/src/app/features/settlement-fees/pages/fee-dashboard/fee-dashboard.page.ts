// apps/web/src/app/features/settlement-fees/pages/fee-dashboard/fee-dashboard.page.ts
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonNote,
  IonBadge, IonButton, IonBackButton, IonButtons,
} from '@ionic/angular/standalone';
import { MasterDataService } from '../../../master-data/services/master-data.service';
import { SettlementFeesService, PartnerPreviewResult } from '../../services/settlement-fees.service';

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

@Component({
  selector: 'app-fee-dashboard',
  standalone: true,
  imports: [RouterLink, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem,
    IonLabel, IonNote, IonBadge, IonButton, IonBackButton, IonButtons],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-back-button defaultHref="/tabs" /></ion-buttons>
      <ion-title>정산 대시보드</ion-title>
    </ion-toolbar></ion-header>
    <ion-content class="ion-padding">
      <ion-note>{{ yearMonth }} 기준</ion-note>

      @if (error()) { <ion-note color="danger">{{ error() }}</ion-note> }

      <ion-list>
        <ion-item>
          <ion-label>운송료 합계</ion-label>
          <ion-note slot="end">{{ transportSum() }}</ion-note>
        </ion-item>
        <ion-item>
          <ion-label>보관료 합계</ion-label>
          <ion-note slot="end">{{ storageSum() }}</ion-note>
        </ion-item>
        <ion-item [routerLink]="['/settlement-fees/close']">
          <ion-label>요율 누락 오류</ion-label>
          <ion-badge [color]="errorCount() > 0 ? 'danger' : 'success'" slot="end">{{ errorCount() }}건</ion-badge>
        </ion-item>
      </ion-list>

      <ion-list>
        <ion-item lines="none"><ion-label><h2>거래처별 물량 상위 5</h2></ion-label></ion-item>
        @for (row of top5(); track row.partnerId) {
          <ion-item>
            <ion-label>{{ row.name }}</ion-label>
            <ion-note slot="end">{{ row.total }}</ion-note>
          </ion-item>
        } @empty {
          <ion-item><ion-label>데이터가 없습니다.</ion-label></ion-item>
        }
      </ion-list>

      <ion-button expand="block" routerLink="/settlement-fees/close">월 마감</ion-button>
      <ion-button expand="block" fill="outline" routerLink="/settlement-fees/statement">정산서 조회</ion-button>
    </ion-content>
  `,
})
export class FeeDashboardPage implements OnInit {
  private settlementFees = inject(SettlementFeesService);
  private masterData = inject(MasterDataService);

  yearMonth = currentYearMonth();
  error = signal('');
  partners = signal<PartnerPreviewResult[]>([]);
  partnerNames = signal<Record<string, string>>({});

  transportSum = computed(() => this.sumField('transportTotal'));
  storageSum = computed(() => this.sumField('storageTotal'));
  errorCount = computed(() => this.partners().reduce((n, p) => n + p.errors.length, 0));

  // ponytail: preview API returns fee totals per partner, not raw shipment quantity —
  // "물량 상위 5" is approximated by combined fee total (transport + storage), the best
  // volume proxy available without a dedicated quantity endpoint.
  top5 = computed(() => {
    const names = this.partnerNames();
    return [...this.partners()]
      .sort((a, b) => (Number(b.transportTotal) + Number(b.storageTotal)) - (Number(a.transportTotal) + Number(a.storageTotal)))
      .slice(0, 5)
      .map((p) => ({
        partnerId: p.partnerId,
        name: names[p.partnerId] ?? p.partnerId,
        total: (Number(p.transportTotal) + Number(p.storageTotal)).toFixed(0),
      }));
  });

  async ngOnInit() {
    try {
      const [preview, partnerPage] = await Promise.all([
        this.settlementFees.preview(this.yearMonth),
        this.masterData.getPartners({ page: 1 }),
      ]);
      this.partners.set(preview.partners);
      this.partnerNames.set(Object.fromEntries(partnerPage.data.map((p) => [p.id, p.name])));
    } catch (e: any) {
      this.error.set(e?.error?.message ?? '조회 실패');
    }
  }

  private sumField(field: 'transportTotal' | 'storageTotal'): string {
    return this.partners().reduce((sum, p) => sum + Number(p[field]), 0).toFixed(0);
  }
}
