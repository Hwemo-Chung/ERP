/**
 * Sync Conflict List Modal
 * Displays all pending conflicts for batch resolution
 * Per ARCHITECTURE.md section 11 - Offline Conflict Resolution
 */

import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonFooter,
  IonButton,
  IonLabel,
  IonItem,
  IonList,
  IonIcon,
  IonBadge,
  IonNote,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  closeOutline,
  chevronForwardOutline,
  trashOutline,
  checkmarkDoneOutline,
} from 'ionicons/icons';
import {
  SyncQueueService,
  SyncOperation,
} from '../../../core/services/sync-queue.service';

@Component({
  selector: 'app-sync-conflict-list-modal',
  standalone: true,
  imports: [
    CommonModule,
    IonModal,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonFooter,
    IonButton,
    IonLabel,
    IonItem,
    IonList,
    IonIcon,
    IonBadge,
    IonNote,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="danger">
        <ion-title>
          <ion-icon name="alert-circle-outline"></ion-icon>
          충돌 목록
        </ion-title>
        <ion-button slot="end" fill="clear" (click)="dismiss()">
          <ion-icon name="close-outline"></ion-icon>
        </ion-button>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (conflicts().length === 0) {
        <div class="empty-state">
          <ion-icon name="checkmark-done-outline" color="success"></ion-icon>
          <h3>모든 충돌이 해결되었습니다</h3>
          <p>동기화 대기 중인 충돌이 없습니다.</p>
        </div>
      } @else {
        <ion-list>
          @for (conflict of conflicts(); track conflict.id) {
            <ion-item button (click)="resolveConflict(conflict)">
              <ion-icon
                slot="start"
                name="alert-circle-outline"
                color="danger"
              ></ion-icon>
              <ion-label>
                <h2>{{ getEntityLabel(conflict) }}</h2>
                <p>{{ getConflictDescription(conflict) }}</p>
                <ion-note>
                  {{ conflict.timestamp | date:'MM/dd HH:mm' }}
                </ion-note>
              </ion-label>
              <ion-badge slot="end" color="danger">충돌</ion-badge>
              <ion-icon slot="end" name="chevron-forward-outline"></ion-icon>
            </ion-item>
          }
        </ion-list>
      }
    </ion-content>

    <ion-footer>
      <ion-toolbar>
        @if (conflicts().length > 0) {
          <ion-button
            slot="start"
            fill="outline"
            color="danger"
            (click)="discardAll()"
          >
            <ion-icon slot="start" name="trash-outline"></ion-icon>
            전체 취소
          </ion-button>
        }
        <ion-button slot="end" fill="outline" (click)="dismiss()">
          닫기
        </ion-button>
      </ion-toolbar>
    </ion-footer>
  `,
  styles: [`
    ion-title {
      display: flex;
      align-items: center;
      gap: 8px;

      ion-icon {
        font-size: 24px;
      }
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      text-align: center;

      ion-icon {
        font-size: 64px;
        margin-bottom: 16px;
      }

      h3 {
        margin: 0 0 8px 0;
        font-size: 18px;
        font-weight: 600;
      }

      p {
        margin: 0;
        font-size: 14px;
        color: var(--ion-color-medium);
      }
    }

    ion-item {
      --padding-top: 12px;
      --padding-bottom: 12px;

      h2 {
        font-weight: 600;
        margin-bottom: 4px;
      }

      p {
        font-size: 13px;
        color: var(--ion-color-medium);
        margin: 0 0 4px 0;
      }

      ion-note {
        font-size: 12px;
      }
    }

    ion-footer ion-toolbar {
      padding: 8px;
    }
  `],
})
export class SyncConflictListModal implements OnInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly syncQueue = inject(SyncQueueService);

  protected readonly conflicts = signal<SyncOperation[]>([]);

  constructor() {
    addIcons({
      alertCircleOutline,
      closeOutline,
      chevronForwardOutline,
      trashOutline,
      checkmarkDoneOutline,
    });
  }

  async ngOnInit(): Promise<void> {
    await this.loadConflicts();
  }

  private async loadConflicts(): Promise<void> {
    const conflicts = await this.syncQueue.getConflicts();
    this.conflicts.set(conflicts);
  }

  protected getEntityLabel(conflict: SyncOperation): string {
    const entityType = conflict.entityType || 'order';
    const entityId = conflict.entityId || '';

    switch (entityType) {
      case 'order':
        return `주문 ${entityId}`;
      case 'completion':
        return `완료 처리 ${entityId}`;
      default:
        return `데이터 ${entityId}`;
    }
  }

  protected getConflictDescription(conflict: SyncOperation): string {
    if (!conflict.conflictData) return '데이터 충돌 발생';

    const { serverVersion, localVersion } = conflict.conflictData;
    return `서버 버전: ${serverVersion}, 로컬 버전: ${localVersion}`;
  }

  protected async resolveConflict(conflict: SyncOperation): Promise<void> {
    if (!conflict.id) return;

    await this.syncQueue.resolveConflict(conflict.id);
    await this.loadConflicts();

    // If all conflicts resolved, close the list
    if (this.conflicts().length === 0) {
      await this.dismiss();
    }
  }

  protected async discardAll(): Promise<void> {
    // Clear all conflict operations (user chooses to discard local changes)
    await this.syncQueue.clearQueue();
    await this.dismiss();
  }

  protected async dismiss(): Promise<void> {
    await this.modalCtrl.dismiss();
  }
}
