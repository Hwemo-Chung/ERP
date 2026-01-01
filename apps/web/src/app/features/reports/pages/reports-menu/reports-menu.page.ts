// apps/web/src/app/features/reports/pages/reports-menu/reports-menu.page.ts
// Reports menu page - Navigation hub for all report features
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonList, IonItem, IonLabel, IonIcon } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { statsChartOutline, peopleOutline, trashOutline, downloadOutline, chevronForwardOutline, returnDownBackOutline } from 'ionicons/icons';

@Component({
  selector: 'app-reports-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule, IonContent, IonHeader, IonToolbar, IonTitle, IonList, IonItem, IonLabel, IonIcon],
  template: `
    <ion-header>
      <ion-toolbar>
        <!-- 리포트 메뉴 타이틀 -->
        <ion-title>{{ 'REPORTS.MENU.TITLE' | translate }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="page-header">
        <h1>{{ 'REPORTS.MENU.TITLE' | translate }}</h1>
        <p>{{ 'REPORTS.MENU.SUBTITLE' | translate }}</p>
      </div>

      <div class="menu-cards">
        <!-- 진행현황 대시보드 메뉴 -->
        <a class="menu-card" routerLink="progress">
          <div class="card-icon primary">
            <ion-icon name="stats-chart-outline"></ion-icon>
          </div>
          <div class="card-content">
            <h3>{{ 'REPORTS.MENU.PROGRESS_DASHBOARD' | translate }}</h3>
            <p>{{ 'REPORTS.MENU.PROGRESS_DASHBOARD_DESC' | translate }}</p>
          </div>
          <ion-icon name="chevron-forward-outline" class="chevron"></ion-icon>
        </a>

        <!-- 고객 이력 조회 메뉴 -->
        <a class="menu-card" routerLink="customer-history">
          <div class="card-icon success">
            <ion-icon name="people-outline"></ion-icon>
          </div>
          <div class="card-content">
            <h3>{{ 'REPORTS.MENU.CUSTOMER_HISTORY' | translate }}</h3>
            <p>{{ 'REPORTS.MENU.CUSTOMER_HISTORY_DESC' | translate }}</p>
          </div>
          <ion-icon name="chevron-forward-outline" class="chevron"></ion-icon>
        </a>

        <!-- 폐가전 집계 메뉴 -->
        <a class="menu-card" routerLink="waste-summary">
          <div class="card-icon warning">
            <ion-icon name="trash-outline"></ion-icon>
          </div>
          <div class="card-content">
            <h3>{{ 'REPORTS.MENU.WASTE_SUMMARY' | translate }}</h3>
            <p>{{ 'REPORTS.MENU.WASTE_SUMMARY_DESC' | translate }}</p>
          </div>
          <ion-icon name="chevron-forward-outline" class="chevron"></ion-icon>
        </a>

        <!-- 미환입 현황 메뉴 -->
        <a class="menu-card" routerLink="unreturned-items">
          <div class="card-icon danger">
            <ion-icon name="return-down-back-outline"></ion-icon>
          </div>
          <div class="card-content">
            <h3>{{ 'REPORTS.MENU.UNRETURNED_ITEMS' | translate }}</h3>
            <p>{{ 'REPORTS.MENU.UNRETURNED_ITEMS_DESC' | translate }}</p>
          </div>
          <ion-icon name="chevron-forward-outline" class="chevron"></ion-icon>
        </a>

        <!-- 데이터 내보내기 메뉴 -->
        <a class="menu-card" routerLink="export">
          <div class="card-icon secondary">
            <ion-icon name="download-outline"></ion-icon>
          </div>
          <div class="card-content">
            <h3>{{ 'REPORTS.MENU.EXPORT' | translate }}</h3>
            <p>{{ 'REPORTS.MENU.EXPORT_DESC' | translate }}</p>
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

      &.danger {
        background: linear-gradient(135deg, #ef4444, #dc2626);
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
  constructor() { addIcons({ statsChartOutline, peopleOutline, trashOutline, downloadOutline, chevronForwardOutline, returnDownBackOutline }); }
}
