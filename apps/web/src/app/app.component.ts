import { Component, inject, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Location } from '@angular/common';
import { IonApp, IonRouterOutlet, IonIcon, AlertController, Platform } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cloudOfflineOutline, timeOutline } from 'ionicons/icons';
import { CommonModule } from '@angular/common';
import { App } from '@capacitor/app';
import { NetworkService } from '@core/services/network.service';
import { AppInitService } from '@core/services/app-init.service';
import { SessionManagerService } from './shared/services/session-manager.service';
import { AuthService } from '@core/services/auth.service';
import { Subject, filter, takeUntil } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonApp, IonRouterOutlet, IonIcon, CommonModule],
  template: `
    @if (networkService.isOffline()) {
      <div class="offline-banner">
        <ion-icon name="cloud-offline-outline"></ion-icon>
        오프라인 모드 - 온라인 복구 시 자동 동기화됩니다
      </div>
    }
    @if (sessionManager.showWarning()) {
      <div class="session-warning-banner">
        <ion-icon name="time-outline"></ion-icon>
        세션이 {{ formatRemainingTime() }} 후 만료됩니다
      </div>
    }
    <ion-app>
      <ion-router-outlet></ion-router-outlet>
    </ion-app>
  `,
  styles: [`
    .offline-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--ion-color-warning);
      color: white;
      padding: 12px 16px;
      font-size: 14px;
      font-weight: 500;
      text-align: center;
      z-index: 9999;
    }
    
    .session-warning-banner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: var(--ion-color-danger);
      color: white;
      padding: 12px 16px;
      font-size: 14px;
      font-weight: 500;
      text-align: center;
      z-index: 9999;
    }
  `],
})
export class AppComponent implements OnInit, OnDestroy {
  protected readonly networkService = inject(NetworkService);
  protected readonly sessionManager = inject(SessionManagerService);
  private readonly appInit = inject(AppInitService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly alertCtrl = inject(AlertController);
  private readonly platform = inject(Platform);
  
  private readonly destroy$ = new Subject<void>();
  private lastBackPress = 0;
  private readonly DOUBLE_BACK_EXIT_DELAY = 2000; // 2초

  constructor() {
    addIcons({ cloudOfflineOutline, timeOutline });
  }

  async ngOnInit(): Promise<void> {
    await this.appInit.initialize();
    
    // FR-19: 인증 상태에 따라 세션 관리 시작
    if (this.authService.isAuthenticated()) {
      this.sessionManager.startSession();
    }

    // FR-21: Hardware back button handler
    this.setupHardwareBackButton();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * FR-21: Android hardware back button handling
   * PRD: Hardware back must map to Ionic router stack rules (no accidental logout)
   * and prompt before discarding unsaved forms.
   */
  private setupHardwareBackButton(): void {
    // Only handle on native platforms
    if (!this.platform.is('capacitor')) {
      return;
    }

    // Listen to hardware back button
    App.addListener('backButton', async ({ canGoBack }: { canGoBack: boolean }) => {
      const currentUrl = this.router.url;

      // Check if we're on a root tab (don't go back further)
      const rootTabs = ['/tabs/orders', '/tabs/assignment', '/tabs/completion', '/tabs/reports', '/tabs/settings'];
      const isRootTab = rootTabs.some(tab => currentUrl.startsWith(tab) && currentUrl.split('/').length === 3);

      if (isRootTab) {
        // Double-back to exit app
        const now = Date.now();
        if (now - this.lastBackPress < this.DOUBLE_BACK_EXIT_DELAY) {
          App.exitApp();
        } else {
          this.lastBackPress = now;
          // Show toast or alert
          const alert = await this.alertCtrl.create({
            message: '뒤로 버튼을 한 번 더 누르면 앱이 종료됩니다.',
            cssClass: 'exit-warning-toast',
            buttons: ['확인'],
          });
          await alert.present();
          setTimeout(() => alert.dismiss(), 2000);
        }
        return;
      }

      // Check for unsaved data (you can implement form guard here)
      const hasUnsavedData = this.checkUnsavedData();
      if (hasUnsavedData) {
        const alert = await this.alertCtrl.create({
          header: '저장하지 않은 변경사항',
          message: '저장하지 않은 변경사항이 있습니다. 나가시겠습니까?',
          buttons: [
            {
              text: '취소',
              role: 'cancel',
            },
            {
              text: '나가기',
              role: 'confirm',
              handler: () => {
                if (canGoBack) {
                  this.location.back();
                } else {
                  this.router.navigate(['/tabs/orders'], { replaceUrl: true });
                }
              },
            },
          ],
        });
        await alert.present();
        return;
      }

      // Normal navigation
      if (canGoBack) {
        this.location.back();
      } else {
        // Navigate to home if no history
        this.router.navigate(['/tabs/orders'], { replaceUrl: true });
      }
    });
  }

  /**
   * Check if there's unsaved data in session manager
   * This integrates with FR-19 form data preservation
   */
  private checkUnsavedData(): boolean {
    const preservedData = this.sessionManager.state().preservedFormData;
    return Object.keys(preservedData).length > 0;
  }

  protected formatRemainingTime(): string {
    const seconds = this.sessionManager.remainingSeconds();
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}
