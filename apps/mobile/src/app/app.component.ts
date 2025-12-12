import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { IonApp, IonRouterOutlet, IonIcon } from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { addIcons } from 'ionicons';
import { cloudOfflineOutline } from 'ionicons/icons';
import { NetworkService } from '@core/services/network.service';
import { AppInitService } from '@core/services/app-init.service';

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
  `],
})
export class AppComponent implements OnInit {
  protected readonly networkService = inject(NetworkService);
  private readonly appInit = inject(AppInitService);

  constructor() {
    addIcons({ cloudOfflineOutline });
  }

  async ngOnInit(): Promise<void> {
    await this.appInit.initialize();
  }
}
