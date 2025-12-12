import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonList, IonItem, IonLabel, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { statsChartOutline, peopleOutline, trashOutline, downloadOutline, chevronForwardOutline } from 'ionicons/icons';

@Component({
  selector: 'app-reports-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, IonContent, IonHeader, IonToolbar, IonTitle, IonList, IonItem, IonLabel, IonIcon],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>리포트</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="page-header">
        <h1>리포트</h1>
        <p>진행 현황 및 데이터 분석</p>
      </div>

      <div class="menu-cards">
        <a class="menu-card" routerLink="progress">
          <div class="card-icon primary">
            <ion-icon name="stats-chart-outline"></ion-icon>
          </div>
          <div class="card-content">
            <h3>진행현황 대시보드</h3>
            <p>설치기사별/지점별 진행 현황</p>
          </div>
          <ion-icon name="chevron-forward-outline" class="chevron"></ion-icon>
        </a>

        <a class="menu-card" routerLink="customer-history">
          <div class="card-icon success">
            <ion-icon name="people-outline"></ion-icon>
          </div>
          <div class="card-content">
            <h3>고객 이력 조회</h3>
            <p>고객별 주문/설치 이력 검색</p>
          </div>
          <ion-icon name="chevron-forward-outline" class="chevron"></ion-icon>
        </a>

        <a class="menu-card" routerLink="waste-summary">
          <div class="card-icon warning">
            <ion-icon name="trash-outline"></ion-icon>
          </div>
          <div class="card-content">
            <h3>폐가전 집계</h3>
            <p>폐가전 회수 현황 및 통계</p>
          </div>
          <ion-icon name="chevron-forward-outline" class="chevron"></ion-icon>
        </a>

        <a class="menu-card" routerLink="export">
          <div class="card-icon secondary">
            <ion-icon name="download-outline"></ion-icon>
          </div>
          <div class="card-content">
            <h3>데이터 내보내기</h3>
            <p>ECOAS, CSV, PDF 출력</p>
          </div>
          <ion-icon name="chevron-forward-outline" class="chevron"></ion-icon>
        </a>
      </div>
    </ion-content>
  `,
  styles: [`
    .page-header {
      padding: 24px 20px 16px;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      
      h1 {
        font-size: 26px;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 4px 0;
        letter-spacing: -0.5px;
      }
      
      p {
        font-size: 14px;
        color: #64748b;
        margin: 0;
      }
    }

    .menu-cards {
      padding: 8px 16px 24px;
    }

    .menu-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: #ffffff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      margin-bottom: 12px;
      text-decoration: none;
      transition: all 0.2s ease;
      
      &:active {
        transform: scale(0.98);
        background: #f8fafc;
      }
    }

    .card-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      
      ion-icon {
        font-size: 24px;
        color: #ffffff;
      }

      &.primary {
        background: linear-gradient(135deg, #3b82f6, #2563eb);
      }
      
      &.success {
        background: linear-gradient(135deg, #10b981, #059669);
      }
      
      &.warning {
        background: linear-gradient(135deg, #f59e0b, #d97706);
      }
      
      &.secondary {
        background: linear-gradient(135deg, #8b5cf6, #7c3aed);
      }
    }

    .card-content {
      flex: 1;
      min-width: 0;
      
      h3 {
        font-size: 15px;
        font-weight: 600;
        color: #0f172a;
        margin: 0 0 2px 0;
      }
      
      p {
        font-size: 13px;
        color: #64748b;
        margin: 0;
      }
    }

    .chevron {
      color: #cbd5e1;
      font-size: 18px;
      flex-shrink: 0;
    }
  `],
})
export class ReportsMenuPage {
  constructor() { addIcons({ statsChartOutline, peopleOutline, trashOutline, downloadOutline, chevronForwardOutline }); }
}
