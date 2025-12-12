import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonList, IonItem, IonLabel, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { statsChartOutline, peopleOutline, trashOutline, downloadOutline, returnDownBackOutline } from 'ionicons/icons';

@Component({
  selector: 'app-reports-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, IonContent, IonHeader, IonToolbar, IonTitle, IonList, IonItem, IonLabel, IonIcon],
  template: `
    <ion-header><ion-toolbar><ion-title>리포트</ion-title></ion-toolbar></ion-header>
    <ion-content class="ion-padding">
      <ion-list>
        <ion-item routerLink="progress" detail>
          <ion-icon name="stats-chart-outline" slot="start"></ion-icon>
          <ion-label><h2>진행현황 대시보드</h2><p>설치기사별/지점별 진행 현황</p></ion-label>
        </ion-item>
        <ion-item routerLink="customer-history" detail>
          <ion-icon name="people-outline" slot="start"></ion-icon>
          <ion-label><h2>고객 이력 조회</h2><p>고객별 주문/설치 이력 검색</p></ion-label>
        </ion-item>
        <ion-item routerLink="waste-summary" detail>
          <ion-icon name="trash-outline" slot="start"></ion-icon>
          <ion-label><h2>폐가전 집계</h2><p>폐가전 회수 현황 및 통계</p></ion-label>
        </ion-item>
        <ion-item routerLink="unreturned-items" detail>
          <ion-icon name="return-down-back-outline" slot="start"></ion-icon>
          <ion-label><h2>미환입 현황</h2><p>취소건 환입 대상 및 미환입 현황</p></ion-label>
        </ion-item>
        <ion-item routerLink="export" detail>
          <ion-icon name="download-outline" slot="start"></ion-icon>
          <ion-label><h2>데이터 내보내기</h2><p>ECOAS, CSV, PDF 출력</p></ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  `,
})
export class ReportsMenuPage {
  constructor() { addIcons({ statsChartOutline, peopleOutline, trashOutline, downloadOutline, returnDownBackOutline }); }
}
