/**
 * FR-17: Conflict Dialog Component
 * PRD: 동시 편집 보호 - Optimistic Locking 충돌 시 표시
 * 
 * 기능:
 * - 버전 불일치 감지 시 충돌 다이얼로그 표시
 * - 서버 값 vs 로컬 값 비교 표시
 * - 덮어쓰기/새로고침/취소 옵션
 */
import { Component, ChangeDetectionStrategy, inject, signal, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonBadge,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  warningOutline, 
  refreshOutline, 
  saveOutline, 
  closeOutline,
  gitCompareOutline,
} from 'ionicons/icons';

export interface ConflictField {
  fieldName: string;
  fieldLabel: string;
  localValue: unknown;
  serverValue: unknown;
}

export interface ConflictData {
  entityName: string;
  localVersion: number;
  serverVersion: number;
  localUpdatedAt: Date;
  serverUpdatedAt: Date;
  changedFields: ConflictField[];
}

export type ConflictResolution = 'overwrite' | 'refresh' | 'cancel';

@Component({
  selector: 'app-conflict-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonModal,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonButtons,
    IonIcon,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonBadge,
  ],
  template: `
    <ion-modal [isOpen]="isOpen()" (didDismiss)="onDismiss()">
      <ng-template>
        <ion-header>
          <ion-toolbar color="warning">
            <ion-title>
              <ion-icon name="warning-outline"></ion-icon>
              데이터 충돌 감지
            </ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="cancel()">
                <ion-icon name="close-outline"></ion-icon>
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>

        <ion-content class="ion-padding">
          <div class="conflict-info">
            <p class="conflict-message">
              다른 사용자가 이 데이터를 수정했습니다. 
              변경 사항을 검토하고 처리 방법을 선택하세요.
            </p>

            <!-- 충돌 필드 비교 -->
            <div class="conflict-list">
              @for (field of data()?.changedFields || []; track field.fieldName) {
                <ion-card class="conflict-card">
                  <ion-card-header>
                    <ion-card-title>{{ field.fieldLabel }}</ion-card-title>
                  </ion-card-header>
                  <ion-card-content>
                    <div class="comparison">
                      <div class="value-box local">
                        <ion-badge color="primary">내 변경</ion-badge>
                        <div class="value">{{ formatValue(field.localValue) }}</div>
                      </div>
                      <ion-icon name="git-compare-outline" class="compare-icon"></ion-icon>
                      <div class="value-box server">
                        <ion-badge color="warning">서버 값</ion-badge>
                        <div class="value">{{ formatValue(field.serverValue) }}</div>
                      </div>
                    </div>
                  </ion-card-content>
                </ion-card>
              }
            </div>

            @if (data()) {
              <div class="version-info">
                <p>내 버전: v{{ data()!.localVersion }} • 서버 버전: v{{ data()!.serverVersion }}</p>
              </div>
            }
          </div>

          <!-- 액션 버튼 -->
          <div class="action-buttons">
            <ion-button expand="block" color="danger" (click)="overwrite()">
              <ion-icon name="save-outline" slot="start"></ion-icon>
              내 변경으로 덮어쓰기
            </ion-button>
            <ion-button expand="block" color="primary" (click)="refresh()">
              <ion-icon name="refresh-outline" slot="start"></ion-icon>
              서버 값으로 새로고침
            </ion-button>
            <ion-button expand="block" fill="outline" (click)="cancel()">
              취소
            </ion-button>
          </div>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .conflict-message {
      text-align: center;
      color: var(--ion-color-medium);
      margin-bottom: 16px;
    }

    .conflict-card {
      margin: 8px 0;
    }

    .comparison {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .value-box {
      flex: 1;
      padding: 12px;
      border-radius: 8px;
      background: var(--ion-color-light);
    }

    .value-box.local {
      border-left: 4px solid var(--ion-color-primary);
    }

    .value-box.server {
      border-left: 4px solid var(--ion-color-warning);
    }

    .value {
      font-weight: 500;
      margin-top: 8px;
    }

    .meta {
      font-size: 12px;
      color: var(--ion-color-medium);
      margin-top: 4px;
    }

    .compare-icon {
      font-size: 24px;
      color: var(--ion-color-medium);
    }

    .action-buttons {
      margin-top: 24px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .version-info {
      text-align: center;
      font-size: 12px;
      color: var(--ion-color-medium);
      margin-top: 16px;
    }
  `]
})
export class ConflictDialogComponent {
  // Inputs
  isOpen = input<boolean>(false);
  data = input<ConflictData | null>(null);

  // Outputs
  resolved = output<ConflictResolution>();

  constructor() {
    addIcons({ 
      warningOutline, 
      refreshOutline, 
      saveOutline, 
      closeOutline,
      gitCompareOutline,
    });
  }

  formatValue(value: unknown): string {
    if (value === null || value === undefined) return '(비어있음)';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  overwrite() {
    this.resolved.emit('overwrite');
  }

  refresh() {
    this.resolved.emit('refresh');
  }

  cancel() {
    this.resolved.emit('cancel');
  }

  onDismiss() {
    this.resolved.emit('cancel');
  }
}
