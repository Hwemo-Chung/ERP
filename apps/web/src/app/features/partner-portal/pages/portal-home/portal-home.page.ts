// apps/web/src/app/features/partner-portal/pages/portal-home/portal-home.page.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonNote, IonButton,
  IonBackButton, IonButtons,
} from '@ionic/angular/standalone';
import { AuthService } from '../../../../core/services/auth.service';
import { SettlementFeesService, StatementResponse } from '../../../settlement-fees/services/settlement-fees.service';

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

@Component({
  selector: 'app-portal-home',
  standalone: true,
  imports: [RouterLink, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel,
    IonNote, IonButton, IonBackButton, IonButtons],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-back-button defaultHref="/tabs" /></ion-buttons>
      <ion-title>거래처 포털</ion-title>
    </ion-toolbar></ion-header>
    <ion-content class="ion-padding">
      <ion-note>{{ yearMonth }} 기준</ion-note>

      @if (error()) {
        <ion-note color="danger">{{ error() }}</ion-note>
      } @else {
        <ion-list>
          <ion-item>
            <ion-label>이번 달 출고 건수</ion-label>
            <ion-note slot="end">{{ statement()?.transport?.count ?? 0 }}건</ion-note>
          </ion-item>
          <ion-item>
            <ion-label>이번 달 정산 총액</ion-label>
            <ion-note slot="end">{{ statement()?.grandTotal ?? '0' }}</ion-note>
          </ion-item>
        </ion-list>
      }

      <ion-button expand="block" routerLink="/portal/my-transactions">내 물량 조회</ion-button>
      <ion-button expand="block" fill="outline" routerLink="/portal/my-statement">내 정산서 조회</ion-button>
    </ion-content>
  `,
})
export class PortalHomePage implements OnInit {
  private auth = inject(AuthService);
  private settlementFees = inject(SettlementFeesService);

  yearMonth = currentYearMonth();
  statement = signal<StatementResponse | null>(null);
  error = signal('');

  async ngOnInit() {
    const partnerId = this.auth.user()?.partnerId;
    if (!partnerId) {
      this.error.set('거래처 정보가 없습니다. 관리자에게 문의하세요.');
      return;
    }
    try {
      // getStatement never throws for a caller's own partnerId — an absent settlement
      // just yields zero counts/totals (settlement-fees.service.ts getStatement returns
      // an empty-records summary rather than 404/error), so no special "not closed yet"
      // branch is needed here.
      this.statement.set(await this.settlementFees.getStatement(partnerId, this.yearMonth));
    } catch (e: any) {
      this.error.set(e?.error?.message ?? '조회 실패');
    }
  }
}
