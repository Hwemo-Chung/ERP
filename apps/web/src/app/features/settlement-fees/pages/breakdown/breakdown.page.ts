// apps/web/src/app/features/settlement-fees/pages/breakdown/breakdown.page.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonNote,
  IonBackButton, IonButtons,
} from '@ionic/angular/standalone';
import {
  SettlementFeesService, SettlementRecordRow, TransportFeeDetail, PalletDailyDetail, AreaFeeDetail,
} from '../../services/settlement-fees.service';

const RATE_SOURCE_LABEL: Record<TransportFeeDetail['rateSource'], string> = {
  VEHICLE: '차량 단가',
  PRODUCT: '품목 단가',
  PARTNER_DEFAULT: '거래처 기본 단가',
};

const VEHICLE_RATE_MODE_LABEL: Record<TransportFeeDetail['vehicleRateMode'], string> = {
  REPLACE: '차량 단가로 대체',
  ADD: '건당 요율에 합산',
};

@Component({
  selector: 'app-breakdown',
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonNote,
    IonBackButton, IonButtons],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-back-button [defaultHref]="backHref" /></ion-buttons>
      <ion-title>정산 상세</ion-title>
    </ion-toolbar></ion-header>
    <ion-content class="ion-padding">
      @if (error()) { <ion-note color="danger">{{ error() }}</ion-note> }

      @if (record(); as r) {
        <ion-list>
          <ion-item>
            <ion-label>구분</ion-label>
            <ion-note slot="end">{{ r.feeType === 'TRANSPORT' ? '운송료' : '보관료' }}</ion-note>
          </ion-item>
          <ion-item>
            <ion-label>금액</ion-label>
            <ion-note slot="end">{{ r.amount }}</ion-note>
          </ion-item>
          @if (r.transaction; as t) {
            <ion-item>
              <ion-label>거래건</ion-label>
              <ion-note slot="end">{{ t.product?.name ?? t.product?.code ?? '' }} · {{ t.transactionDate.slice(0, 10) }}</ion-note>
            </ion-item>
          }
        </ion-list>

        @if (isTransportDetail(r.calculationDetail); as td) {
          <ion-list>
            <ion-item lines="none"><ion-label><h2>운송료 계산 내역</h2></ion-label></ion-item>
            <ion-item>
              <ion-label>요율 출처</ion-label>
              <ion-note slot="end">{{ rateSourceLabel(td.rateSource) }}</ion-note>
            </ion-item>
            <ion-item>
              <ion-label>운송료 계산 방식</ion-label>
              <ion-note slot="end">{{ vehicleRateModeLabel(td.vehicleRateMode) }}</ion-note>
            </ion-item>
            <ion-item>
              <ion-label>적용 요율</ion-label>
              <ion-note slot="end">{{ td.appliedRate }}</ion-note>
            </ion-item>
            @if (td.vehicleRateMode === 'ADD' && td.baseRate) {
              <ion-item>
                <ion-label>차량 단가</ion-label>
                <ion-note slot="end">{{ td.vehicleRate }}</ion-note>
              </ion-item>
              <ion-item>
                <ion-label>건당 요율</ion-label>
                <ion-note slot="end">{{ td.baseRate }}</ion-note>
              </ion-item>
            }
            <ion-item>
              <ion-label>계산식</ion-label>
              <ion-note slot="end">{{ td.formula }}</ion-note>
            </ion-item>
          </ion-list>
        }

        @if (isPalletDetail(r.calculationDetail); as pd) {
          <ion-list>
            <ion-item lines="none"><ion-label><h2>보관료 계산 내역 (파렛트일수)</h2></ion-label></ion-item>
            <ion-item>
              <ion-label>파렛트일 단가</ion-label>
              <ion-note slot="end">{{ pd.palletDailyRate }}</ion-note>
            </ion-item>
            <ion-item>
              <ion-label>총 파렛트일수</ion-label>
              <ion-note slot="end">{{ pd.totalPalletDays }}</ion-note>
            </ion-item>
            <ion-item>
              <ion-label>계산식</ion-label>
              <ion-note slot="end">{{ pd.formula }}</ion-note>
            </ion-item>
          </ion-list>
          <ion-list>
            <ion-item lines="none"><ion-label><h3>품목별 상세</h3></ion-label></ion-item>
            @for (entry of productEntries(pd.perProduct); track entry.productId) {
              <ion-item>
                <ion-label>{{ entry.productId }}</ion-label>
                <ion-note slot="end">{{ entry.palletDays }}일 (기준 {{ entry.threshold }}%)</ion-note>
              </ion-item>
            }
          </ion-list>
          @if (pd.skippedProducts.length > 0) {
            <ion-note color="warning" class="ion-text-wrap">
              ⚠ 파렛트당 최대수량 미설정으로 제외된 품목: {{ pd.skippedProducts.join(', ') }}
            </ion-note>
          }
          @if (pd.negativeStockProducts.length > 0) {
            <ion-note color="warning" class="ion-text-wrap">
              ⚠ 재고 마이너스 발생 품목(입고 누락 의심): {{ pd.negativeStockProducts.join(', ') }}
            </ion-note>
          }
        }

        @if (isAreaDetail(r.calculationDetail); as ad) {
          <ion-list>
            <ion-item lines="none"><ion-label><h2>보관료 계산 내역 (면적)</h2></ion-label></ion-item>
            <ion-item>
              <ion-label>계약 유형</ion-label>
              <ion-note slot="end">{{ ad.contractType === 'AREA_YEARLY' ? '연 임대(월할)' : '월 임대' }}</ion-note>
            </ion-item>
            <ion-item>
              <ion-label>면적</ion-label>
              <ion-note slot="end">{{ ad.areaPyeong }}평</ion-note>
            </ion-item>
            <ion-item>
              <ion-label>평당 단가</ion-label>
              <ion-note slot="end">{{ ad.areaRate }}</ion-note>
            </ion-item>
            <ion-item>
              <ion-label>계산식</ion-label>
              <ion-note slot="end">{{ ad.formula }}</ion-note>
            </ion-item>
          </ion-list>
        }
      } @else if (!error()) {
        <ion-note>조회 중...</ion-note>
      }
    </ion-content>
  `,
})
export class BreakdownPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private settlementFees = inject(SettlementFeesService);

  record = signal<SettlementRecordRow | null>(null);
  error = signal('');

  // This component is reused under two route trees (/settlement-fees/breakdown/:id for
  // HQ_ADMIN, /portal/breakdown/:id for PARTNER_COORDINATOR — see
  // partner-portal.routes.ts). ion-back-button prefers the actual in-app navigation
  // stack over defaultHref, but defaultHref is still what fires on a direct deep link /
  // page reload with no stack — a hardcoded "/settlement-fees" there would dead-end a
  // PARTNER_COORDINATOR at an HQ_ADMIN-only route (roleGuard redirects them away).
  // Deriving it from the current URL prefix (rather than an injected role check) keeps
  // this generic to whichever route tree the page was actually entered from.
  backHref = this.router.url.startsWith('/portal') ? '/portal/my-statement' : '/settlement-fees';

  async ngOnInit() {
    const transactionId = this.route.snapshot.paramMap.get('transactionId')!;
    try {
      const record = await this.settlementFees.getBreakdown(transactionId);
      if (!record) {
        this.error.set('정산 내역을 찾을 수 없습니다.');
        return;
      }
      this.record.set(record);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? '조회 실패');
    }
  }

  rateSourceLabel(source: TransportFeeDetail['rateSource']): string {
    return RATE_SOURCE_LABEL[source];
  }

  vehicleRateModeLabel(mode: TransportFeeDetail['vehicleRateMode']): string {
    return VEHICLE_RATE_MODE_LABEL[mode];
  }

  productEntries(perProduct: PalletDailyDetail['perProduct']) {
    return Object.entries(perProduct).map(([productId, v]) => ({ productId, ...v }));
  }

  isTransportDetail(detail: SettlementRecordRow['calculationDetail']): TransportFeeDetail | null {
    return 'rateSource' in detail ? (detail as TransportFeeDetail) : null;
  }

  isPalletDetail(detail: SettlementRecordRow['calculationDetail']): PalletDailyDetail | null {
    return 'contractType' in detail && detail.contractType === 'PALLET_DAILY' ? (detail as PalletDailyDetail) : null;
  }

  isAreaDetail(detail: SettlementRecordRow['calculationDetail']): AreaFeeDetail | null {
    return 'contractType' in detail && detail.contractType !== 'PALLET_DAILY' ? (detail as AreaFeeDetail) : null;
  }
}
