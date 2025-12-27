import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonList, IonItem, IonLabel, IonIcon, IonBadge, AlertController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { walletOutline, gitBranchOutline, notificationsOutline, personOutline, logOutOutline } from 'ionicons/icons';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-settings-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, IonContent, IonHeader, IonToolbar, IonTitle, IonList, IonItem, IonLabel, IonIcon, IonBadge],
  template: `
    <ion-header><ion-toolbar><ion-title>설정</ion-title></ion-toolbar></ion-header>
    <ion-content class="ion-padding">
      <ion-list>
        <!-- 사용자 정보 -->
        <ion-item routerLink="/tabs/profile" detail>
          <ion-icon name="person-outline" slot="start"></ion-icon>
          <ion-label><h2>내 프로필</h2><p>계정 정보 및 설정</p></ion-label>
        </ion-item>
        
        <ion-item routerLink="settlement" detail>
          <ion-icon name="wallet-outline" slot="start"></ion-icon>
          <ion-label><h2>정산 관리</h2><p>주간 정산 기간 관리</p></ion-label>
        </ion-item>
        <ion-item routerLink="notifications" detail>
          <ion-icon name="notifications-outline" slot="start"></ion-icon>
          <ion-label><h2>알림 센터</h2><p>푸시 알림 설정 및 이력</p></ion-label>
          <ion-badge slot="end" color="danger">3</ion-badge>
        </ion-item>
        
        <!-- 로그아웃 -->
        <ion-item button (click)="confirmLogout()" lines="none" class="logout-item">
          <ion-icon name="log-out-outline" slot="start" color="danger"></ion-icon>
          <ion-label color="danger"><h2>로그아웃</h2></ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  `,
  styles: [`
    .logout-item {
      margin-top: 24px;
    }
  `]
})
export class SettingsMenuPage {
  private authService = inject(AuthService);
  private alertController = inject(AlertController);
  private router = inject(Router);

  constructor() { 
    addIcons({ walletOutline, gitBranchOutline, notificationsOutline, personOutline, logOutOutline }); 
  }

  async confirmLogout() {
    const alert = await this.alertController.create({
      header: '로그아웃',
      message: '정말 로그아웃 하시겠습니까?',
      buttons: [
        {
          text: '취소',
          role: 'cancel'
        },
        {
          text: '로그아웃',
          role: 'destructive',
          handler: () => {
            this.logout();
          }
        }
      ]
    });
    await alert.present();
  }

  private logout() {
    this.authService.logout();
    this.router.navigate(['/auth/login'], { replaceUrl: true });
  }
}
