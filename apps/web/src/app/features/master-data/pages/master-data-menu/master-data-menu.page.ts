// apps/web/src/app/features/master-data/pages/master-data-menu/master-data-menu.page.ts
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel,
  IonIcon, IonBackButton, IonButtons,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  businessOutline, cubeOutline, pricetagsOutline, carOutline, cloudUploadOutline,
} from 'ionicons/icons';

const ENTRIES = [
  { path: 'partners', icon: 'business-outline', label: '거래처 관리' },
  { path: 'products', icon: 'cube-outline', label: '품목 관리' },
  { path: 'categories', icon: 'pricetags-outline', label: '카테고리 관리' },
  { path: 'rate-cards', icon: 'car-outline', label: '운송 단가표' },
  { path: 'import', icon: 'cloud-upload-outline', label: '엑셀 일괄 등록' },
];

@Component({
  selector: 'app-master-data-menu',
  standalone: true,
  imports: [RouterLink, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem,
    IonLabel, IonIcon, IonBackButton, IonButtons],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-back-button defaultHref="/tabs" /></ion-buttons>
      <ion-title>마스터데이터</ion-title>
    </ion-toolbar></ion-header>
    <ion-content>
      <ion-list>
        @for (entry of entries; track entry.path) {
          <ion-item button [routerLink]="entry.path">
            <ion-icon slot="start" [name]="entry.icon" />
            <ion-label>{{ entry.label }}</ion-label>
          </ion-item>
        }
      </ion-list>
    </ion-content>
  `,
})
export class MasterDataMenuPage {
  entries = ENTRIES;

  constructor() {
    addIcons({ businessOutline, cubeOutline, pricetagsOutline, carOutline, cloudUploadOutline });
  }
}
