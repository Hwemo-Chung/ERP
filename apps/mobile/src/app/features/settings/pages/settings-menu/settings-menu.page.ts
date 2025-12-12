import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonList, IonItem, IonLabel, IonIcon, IonBadge } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { walletOutline, gitBranchOutline, notificationsOutline } from 'ionicons/icons';

@Component({
  selector: 'app-settings-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, IonContent, IonHeader, IonToolbar, IonTitle, IonList, IonItem, IonLabel, IonIcon, IonBadge],
  template: `
    <ion-header><ion-toolbar><ion-title>설정</ion-title></ion-toolbar></ion-header>
    <ion-content class="ion-padding">
      <ion-list>
        <ion-item routerLink="settlement" detail>
          <ion-icon name="wallet-outline" slot="start"></ion-icon>
          <ion-label><h2>정산 관리</h2><p>주간 정산 기간 관리</p></ion-label>
        </ion-item>
        <ion-item routerLink="notifications" detail>
          <ion-icon name="notifications-outline" slot="start"></ion-icon>
          <ion-label><h2>알림 센터</h2><p>푸시 알림 설정 및 이력</p></ion-label>
          <ion-badge slot="end" color="danger">3</ion-badge>
        </ion-item>
      </ion-list>
    </ion-content>
  `,
})
export class SettingsMenuPage {
  constructor() { addIcons({ walletOutline, gitBranchOutline, notificationsOutline }); }
}
