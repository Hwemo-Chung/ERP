import { Component, inject } from '@angular/core';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonBadge } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  listOutline, gridOutline, clipboardOutline, checkmarkDoneOutline, 
  statsChartOutline, settingsOutline, homeOutline 
} from 'ionicons/icons';
import { SyncQueueService } from '@core/services/sync-queue.service';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonBadge],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="orders">
          <ion-icon name="list-outline"></ion-icon>
          <ion-label>주문</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="assignment">
          <ion-icon name="clipboard-outline"></ion-icon>
          <ion-label>배정</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="completion">
          <ion-icon name="checkmark-done-outline"></ion-icon>
          <ion-label>완료처리</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="reports">
          <ion-icon name="stats-chart-outline"></ion-icon>
          <ion-label>리포트</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="settings">
          <ion-icon name="settings-outline"></ion-icon>
          <ion-label>설정</ion-label>
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
