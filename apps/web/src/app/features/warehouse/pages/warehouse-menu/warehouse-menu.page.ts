// apps/web/src/app/features/warehouse/pages/warehouse-menu/warehouse-menu.page.ts
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel,
  IonIcon, IonBackButton, IonButtons,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { createOutline, listOutline, cloudUploadOutline } from 'ionicons/icons';

const ENTRIES = [
  { path: 'entry', icon: 'create-outline', label: '실적 입력' },
  { path: 'list', icon: 'list-outline', label: '실적 목록' },
  { path: 'import', icon: 'cloud-upload-outline', label: '엑셀 일괄 등록' },
];

@Component({
  selector: 'app-warehouse-menu',
  standalone: true,
  imports: [RouterLink, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem,
    IonLabel, IonIcon, IonBackButton, IonButtons],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-back-button defaultHref="/tabs" /></ion-buttons>
      <ion-title>입출고 실적</ion-title>
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
export class WarehouseMenuPage {
  entries = ENTRIES;

  constructor() {
    addIcons({ createOutline, listOutline, cloudUploadOutline });
  }
}
