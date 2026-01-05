/**
 * FR-18: Bulk Operation Result Component
 * PRD: 일괄 작업 부분 실패 처리 - 항목별 성공/실패 표시
 *
 * 기능:
 * - 일괄 작업 결과 요약 표시
 * - 성공/실패 항목 목록
 * - 실패 항목만 재시도 옵션
 */
import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonNote,
  IonProgressBar,
  IonCard,
  IonCardContent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  checkmarkCircleOutline,
  closeCircleOutline,
  refreshOutline,
  closeOutline,
  alertCircleOutline,
} from 'ionicons/icons';

export interface BulkOperationItem {
  id: string;
  label: string;
  success: boolean;
  error?: string;
}

export interface BulkOperationResult {
  operation: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  items: BulkOperationItem[];
}

@Component({
  selector: 'app-bulk-operation-result',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    IonModal,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonButtons,
    IonIcon,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
    IonNote,
    IonProgressBar,
    IonCard,
    IonCardContent,
  ],
  template: `
    <ion-modal [isOpen]="isOpen()" (didDismiss)="onClose()">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title
              >{{ result()?.operation || ('BULK.DEFAULT_OPERATION' | translate) }}
              {{ 'BULK.RESULT' | translate }}</ion-title
            >
            <ion-buttons slot="end">
              <ion-button (click)="onClose()">
                <ion-icon name="close-outline"></ion-icon>
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>

        <ion-content class="ion-padding">
          @if (result(); as r) {
            <!-- 요약 카드 -->
            <ion-card>
              <ion-card-content>
                <div class="summary">
                  <div class="stat success">
                    <ion-icon name="checkmark-circle-outline"></ion-icon>
                    <span class="count">{{ r.successCount }}</span>
                    <span class="label">{{ 'BULK.SUCCESS' | translate }}</span>
                  </div>
                  <div class="stat failed">
                    <ion-icon name="close-circle-outline"></ion-icon>
                    <span class="count">{{ r.failedCount }}</span>
                    <span class="label">{{ 'BULK.FAILED' | translate }}</span>
                  </div>
                </div>
                <ion-progress-bar
                  [value]="successRate()"
                  [color]="r.failedCount > 0 ? 'warning' : 'success'"
                >
                </ion-progress-bar>
                <p class="summary-text">
                  {{ 'BULK.SUMMARY' | translate: { total: r.totalCount, success: r.successCount } }}
                </p>
              </ion-card-content>
            </ion-card>

            <!-- 실패 항목 목록 -->
            @if (failedItems().length > 0) {
              <div class="failed-section">
                <h3>
                  <ion-icon name="alert-circle-outline" color="danger"></ion-icon>
                  {{ 'BULK.FAILED_ITEMS' | translate: { count: failedItems().length } }}
                </h3>
                <ion-list>
                  @for (item of failedItems(); track item.id) {
                    <ion-item>
                      <ion-icon name="close-circle-outline" color="danger" slot="start"></ion-icon>
                      <ion-label>
                        <h3>{{ item.label }}</h3>
                        <p>{{ item.error || ('BULK.UNKNOWN_ERROR' | translate) }}</p>
                      </ion-label>
                    </ion-item>
                  }
                </ion-list>
              </div>
            }

            <!-- 성공 항목 목록 (접힘) -->
            @if (successItems().length > 0) {
              <div class="success-section">
                <h3>
                  <ion-icon name="checkmark-circle-outline" color="success"></ion-icon>
                  {{ 'BULK.SUCCESS_ITEMS' | translate: { count: successItems().length } }}
                </h3>
                <ion-list>
                  @for (item of successItems(); track item.id) {
                    <ion-item>
                      <ion-icon
                        name="checkmark-circle-outline"
                        color="success"
                        slot="start"
                      ></ion-icon>
                      <ion-label>{{ item.label }}</ion-label>
                    </ion-item>
                  }
                </ion-list>
              </div>
            }

            <!-- 액션 버튼 -->
            <div class="action-buttons">
              @if (r.failedCount > 0) {
                <ion-button color="primary" (click)="retryFailed()">
                  <ion-icon name="refresh-outline" slot="start"></ion-icon>
                  {{ 'BULK.RETRY_FAILED' | translate: { count: r.failedCount } }}
                </ion-button>
              }
              <ion-button fill="outline" (click)="onClose()">
                {{ 'COMMON.CLOSE' | translate }}
              </ion-button>
            </div>
          }
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [
    `
      .summary {
        display: flex;
        justify-content: center;
        gap: 48px;
        padding: 16px 0;
      }

      .stat {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
      }

      .stat ion-icon {
        font-size: 32px;
      }

      .stat.success ion-icon {
        color: var(--ion-color-success);
      }
      .stat.failed ion-icon {
        color: var(--ion-color-danger);
      }

      .stat .count {
        font-size: 28px;
        font-weight: 700;
      }

      .stat .label {
        font-size: 14px;
        color: var(--ion-color-medium);
      }

      .summary-text {
        text-align: center;
        margin-top: 12px;
        color: var(--ion-color-medium);
      }

      .failed-section,
      .success-section {
        margin-top: 16px;
      }

      .failed-section h3,
      .success-section h3 {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        margin-bottom: 8px;
      }

      .action-buttons {
        margin-top: 24px;
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 12px;

        ion-button {
          flex: 0 1 auto;
          min-width: 140px;
          max-width: 200px;
        }

        @media (max-width: 767px) {
          flex-direction: column;
          align-items: center;

          ion-button {
            width: 100%;
            max-width: 100%;
          }
        }
      }
    `,
  ],
})
export class BulkOperationResultComponent {
  isOpen = input<boolean>(false);
  result = input<BulkOperationResult | null>(null);

  close = output<void>();
  retry = output<string[]>();

  successRate = computed(() => {
    const r = this.result();
    if (!r || r.totalCount === 0) return 0;
    return r.successCount / r.totalCount;
  });

  failedItems = computed(() => this.result()?.items.filter((i) => !i.success) || []);

  successItems = computed(() => this.result()?.items.filter((i) => i.success) || []);

  constructor() {
    addIcons({
      checkmarkCircleOutline,
      closeCircleOutline,
      refreshOutline,
      closeOutline,
      alertCircleOutline,
    });
  }

  retryFailed() {
    const failedIds = this.failedItems().map((i) => i.id);
    this.retry.emit(failedIds);
  }

  onClose() {
    this.close.emit();
  }
}
