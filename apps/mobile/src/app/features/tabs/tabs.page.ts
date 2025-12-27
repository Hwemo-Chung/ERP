import { Component, inject } from '@angular/core';
import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { listOutline, gridOutline, personOutline, clipboardOutline, checkmarkDoneOutline, statsChartOutline, settingsOutline } from 'ionicons/icons';
import { SyncQueueService } from '@core/services/sync-queue.service';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="assignment">
          <ion-icon name="clipboard-outline"></ion-icon>
          <ion-label>배정</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="completion">
          <ion-icon name="checkmark-done-outline"></ion-icon>
          <ion-label>완료</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="dashboard">
          <ion-icon name="grid-outline"></ion-icon>
          <ion-label>대시보드</ion-label>
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
      --background: var(--ion-toolbar-background);
    }

    ion-badge {
      position: absolute;
      top: 4px;
      right: 4px;
      min-width: 18px;
      height: 18px;
      font-size: 10px;
    }
  `],
})
export class TabsPage {
  protected readonly syncQueue = inject(SyncQueueService);

  constructor() {
    addIcons({ listOutline, gridOutline, personOutline, clipboardOutline, checkmarkDoneOutline, statsChartOutline, settingsOutline });
  }
}
