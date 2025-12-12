import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonList, IonItem, IonLabel, IonIcon, IonBadge, IonButton } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { walletOutline, notificationsOutline, chevronForwardOutline, logOutOutline, personOutline, settingsOutline, optionsOutline, fingerPrintOutline } from 'ionicons/icons';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-settings-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, IonContent, IonHeader, IonToolbar, IonTitle, IonList, IonItem, IonLabel, IonIcon, IonBadge, IonButton],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>설정</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <!-- User Profile Card -->
      <div class="profile-card">
        <div class="profile-avatar">
          <ion-icon name="person-outline"></ion-icon>
        </div>
        <div class="profile-info">
          <h2>{{ userName() }}</h2>
          <p>{{ userRole() }}</p>
        </div>
      </div>

      <div class="menu-section">
        <div class="section-title">관리</div>
        <div class="menu-cards">
          <a class="menu-card" routerLink="settlement">
            <div class="card-icon primary">
              <ion-icon name="wallet-outline"></ion-icon>
            </div>
            <div class="card-content">
              <h3>정산 관리</h3>
              <p>주간 정산 기간 관리</p>
            </div>
            <ion-icon name="chevron-forward-outline" class="chevron"></ion-icon>
          </a>

          <a class="menu-card" routerLink="notifications">
            <div class="card-icon warning">
              <ion-icon name="notifications-outline"></ion-icon>
            </div>
            <div class="card-content">
              <h3>알림 센터</h3>
              <p>푸시 알림 설정 및 이력</p>
            </div>
            <ion-badge color="danger" class="badge">3</ion-badge>
            <ion-icon name="chevron-forward-outline" class="chevron"></ion-icon>
          </a>

          <a class="menu-card" routerLink="notification-settings">
            <div class="card-icon secondary">
              <ion-icon name="options-outline"></ion-icon>
            </div>
            <div class="card-content">
              <h3>알림 설정</h3>
              <p>카테고리별 알림 활성화/무음</p>
            </div>
            <ion-icon name="chevron-forward-outline" class="chevron"></ion-icon>
          </a>

          <a class="menu-card" routerLink="biometric">
            <div class="card-icon success">
              <ion-icon name="fingerprint-outline"></ion-icon>
            </div>
            <div class="card-content">
              <h3>생체 인증</h3>
              <p>빠른 로그인 설정</p>
            </div>
            <ion-icon name="chevron-forward-outline" class="chevron"></ion-icon>
          </a>
        </div>
      </div>

      <div class="menu-section">
        <div class="section-title">계정</div>
        <div class="menu-cards">
          <button class="menu-card logout" (click)="logout()">
            <div class="card-icon danger">
              <ion-icon name="log-out-outline"></ion-icon>
            </div>
            <div class="card-content">
              <h3>로그아웃</h3>
              <p>계정에서 로그아웃</p>
            </div>
          </button>
        </div>
      </div>

      <div class="app-version">
        <p>앱 버전 1.0.0</p>
      </div>
    </ion-content>
  `,
  styles: [`
    .profile-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 24px 20px;
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      margin: 16px;
      border-radius: 16px;
      box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);
    }

    .profile-avatar {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      
      ion-icon {
        font-size: 28px;
        color: #ffffff;
      }
    }

    .profile-info {
      h2 {
        font-size: 18px;
        font-weight: 600;
        color: #ffffff;
        margin: 0 0 2px 0;
      }
      
      p {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.8);
        margin: 0;
      }
    }

    .menu-section {
      padding: 0 16px;
      margin-bottom: 24px;
    }

    .section-title {
      font-size: 13px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 0 4px;
      margin-bottom: 12px;
    }

    .menu-cards {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .menu-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: #ffffff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      text-decoration: none;
      transition: all 0.2s ease;
      width: 100%;
      text-align: left;
      cursor: pointer;
      
      &:active {
        transform: scale(0.98);
        background: #f8fafc;
      }

      &.logout {
        border-color: #fee2e2;
        
        &:active {
          background: #fef2f2;
        }
      }
    }

    .card-icon {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      
      ion-icon {
        font-size: 22px;
        color: #ffffff;
      }

      &.primary {
        background: linear-gradient(135deg, #3b82f6, #2563eb);
      }
      
      &.secondary {
        background: linear-gradient(135deg, #8b5cf6, #7c3aed);
      }
      
      &.success {
        background: linear-gradient(135deg, #10b981, #059669);
      }
      
      &.warning {
        background: linear-gradient(135deg, #f59e0b, #d97706);
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

    .badge {
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 10px;
    }

    .chevron {
      color: #cbd5e1;
      font-size: 18px;
      flex-shrink: 0;
    }

    .app-version {
      text-align: center;
      padding: 24px;
      
      p {
        font-size: 13px;
        color: #94a3b8;
        margin: 0;
      }
    }
  `],
})
export class SettingsMenuPage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  constructor() { 
    addIcons({ walletOutline, notificationsOutline, chevronForwardOutline, logOutOutline, personOutline, settingsOutline, optionsOutline, fingerPrintOutline }); 
  }

  userName() {
    return this.authService.user()?.name || '사용자';
  }

  userRole() {
    const role = this.authService.user()?.roles?.[0];
    const roles: Record<string, string> = {
      admin: '관리자',
      manager: '매니저',
      coordinator: '코디네이터',
      installer: '설치기사',
    };
    return roles[role || ''] || role || '일반 사용자';
  }

  async logout(): Promise<void> {
    await this.authService.logout();
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}
