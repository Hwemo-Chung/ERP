import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonList, IonItem, IonLabel, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { statsChartOutline, peopleOutline, trashOutline, downloadOutline, returnDownBackOutline } from 'ionicons/icons';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-reports-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, IonContent, IonHeader, IonToolbar, IonTitle, IonList, IonItem, IonLabel, IonIcon, TranslateModule],
  template: `
    <ion-header><ion-toolbar><ion-title>{{ 'REPORTS.TITLE' | translate }}</ion-title></ion-toolbar></ion-header>
    <ion-content class="ion-padding">
      <ion-list>
        <ion-item routerLink="progress" detail>
          <ion-icon name="stats-chart-outline" slot="start"></ion-icon>
          <ion-label><h2>{{ 'REPORTS.MENU.PROGRESS' | translate }}</h2><p>{{ 'REPORTS.MENU.PROGRESS_DESC' | translate }}</p></ion-label>
        </ion-item>
        <ion-item routerLink="customer-history" detail>
          <ion-icon name="people-outline" slot="start"></ion-icon>
          <ion-label><h2>{{ 'REPORTS.MENU.CUSTOMER_HISTORY' | translate }}</h2><p>{{ 'REPORTS.MENU.CUSTOMER_HISTORY_DESC' | translate }}</p></ion-label>
        </ion-item>
        <ion-item routerLink="waste-summary" detail>
          <ion-icon name="trash-outline" slot="start"></ion-icon>
          <ion-label><h2>{{ 'REPORTS.MENU.WASTE_SUMMARY' | translate }}</h2><p>{{ 'REPORTS.MENU.WASTE_SUMMARY_DESC' | translate }}</p></ion-label>
        </ion-item>
        <ion-item routerLink="unreturned-items" detail>
          <ion-icon name="return-down-back-outline" slot="start"></ion-icon>
          <ion-label><h2>{{ 'REPORTS.MENU.UNRETURNED' | translate }}</h2><p>{{ 'REPORTS.MENU.UNRETURNED_DESC' | translate }}</p></ion-label>
        </ion-item>
        <ion-item routerLink="export" detail>
          <ion-icon name="download-outline" slot="start"></ion-icon>
          <ion-label><h2>{{ 'REPORTS.MENU.EXPORT' | translate }}</h2><p>{{ 'REPORTS.MENU.EXPORT_DESC' | translate }}</p></ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  `,
})
export class ReportsMenuPage {
  constructor() { addIcons({ statsChartOutline, peopleOutline, trashOutline, downloadOutline, returnDownBackOutline }); }
}
