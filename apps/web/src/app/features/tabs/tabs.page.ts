import { Component, inject } from '@angular/core';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonBadge } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  listOutline, gridOutline, clipboardOutline, checkmarkDoneOutline, 
  statsChartOutline, settingsOutline, homeOutline 
} from 'ionicons/icons';
import { TranslateModule } from '@ngx-translate/core';
import { SyncQueueService } from '@core/services/sync-queue.service';

/**
 * 탭 네비게이션 컴포넌트
 * 앱의 하단 탭 바를 구성하여 주요 기능 간 이동을 제공
 */
@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonBadge, TranslateModule],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="orders">
          <ion-icon name="list-outline"></ion-icon>
          <ion-label>{{ 'NAV.ORDERS' | translate }}</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="assignment">
          <ion-icon name="clipboard-outline"></ion-icon>
          <ion-label>{{ 'NAV.ASSIGNMENT' | translate }}</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="completion">
          <ion-icon name="checkmark-done-outline"></ion-icon>
          <ion-label>{{ 'NAV.COMPLETION' | translate }}</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="reports">
          <ion-icon name="stats-chart-outline"></ion-icon>
          <ion-label>{{ 'NAV.REPORTS' | translate }}</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="settings">
          <ion-icon name="settings-outline"></ion-icon>
          <ion-label>{{ 'NAV.SETTINGS' | translate }}</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
  styles: [`
    ion-tab-bar {
      --background: #ffffff;
      --border: 1px solid #e2e8f0;
      height: 60px;
      padding-bottom: env(safe-area-inset-bottom);
    }
    ion-tab-button {
      --color: #64748b;
      --color-selected: #3b82f6;
      font-size: 11px;
    }
    ion-tab-button::part(native) {
      padding: 6px 0;
    }
    ion-icon { font-size: 22px; margin-bottom: 2px; }
    ion-label { font-weight: 500; }
  `],
})
export class TabsPage {
  protected readonly syncQueue = inject(SyncQueueService);

  constructor() {
    addIcons({ listOutline, gridOutline, clipboardOutline, checkmarkDoneOutline, statsChartOutline, settingsOutline, homeOutline });
  }
}
