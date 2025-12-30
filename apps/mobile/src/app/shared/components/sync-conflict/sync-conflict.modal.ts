/**
 * Sync Conflict Resolution Modal
 * Displays server vs local data differences and allows manual merge
 * Per ARCHITECTURE.md section 11 - Offline Conflict Resolution
 */

import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
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
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonBadge,
  IonRadio,
  IonRadioGroup,
  IonNote,
  ModalController,
  NavParams,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cloudOutline,
  phonePortraitOutline,
  checkmarkOutline,
  closeOutline,
  warningOutline,
  swapHorizontalOutline,
  timeOutline,
} from 'ionicons/icons';
import {
  OrderStatus,
  ORDER_STATUS_LABELS,
} from '../../../store/orders/orders.models';

/**
 * Field comparison item for display
 */
interface FieldComparison {
  field: string;
  label: string;
  serverValue: unknown;
  localValue: unknown;
  isCritical: boolean;
  selectedSource: 'server' | 'local';
}

/**
 * Conflict data passed to modal
 */
export interface ConflictData {
  entityType: 'order' | 'completion';
  entityId: string;
  serverVersion: number;
  localVersion: number;
  serverData: Record<string, unknown>;
  localData: Record<string, unknown>;
  timestamp: number;
}

/**
 * Field labels for Korean display
 * @deprecated Use FIELD_LABELS_I18N_KEYS with TranslateService instead
 */
const FIELD_LABELS: Record<string, string> = {
  status: 'FIELD_LABELS.STATUS',
  installerId: 'FIELD_LABELS.INSTALLER_ID',
  installerName: 'FIELD_LABELS.INSTALLER_NAME',
  appointmentDate: 'FIELD_LABELS.APPOINTMENT_DATE',
  appointmentSlot: 'FIELD_LABELS.APPOINTMENT_SLOT',
  notes: 'FIELD_LABELS.NOTES',
  customerName: 'FIELD_LABELS.CUSTOMER_NAME',
  customerPhone: 'FIELD_LABELS.CUSTOMER_PHONE',
  customerAddress: 'FIELD_LABELS.CUSTOMER_ADDRESS',
  serialNumber: 'FIELD_LABELS.SERIAL_NUMBER',
  wasteCode: 'FIELD_LABELS.WASTE_CODE',
  quantity: 'FIELD_LABELS.QUANTITY',
};

/**
 * Critical fields that require manual merge decision
 */
const CRITICAL_FIELDS = ['status', 'installerId', 'serialNumber'];

@Component({
  selector: 'app-sync-conflict-modal',
  standalone: true,
  imports: [
    CommonModule,
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
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonBadge,
    IonRadio,
    IonRadioGroup,
    IonNote,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="warning">
        <ion-title>
          <ion-icon name="warning-outline"></ion-icon>
          데이터 충돌 발생
        </ion-title>
        <ion-button slot="end" fill="clear" (click)="dismiss()">
          <ion-icon name="close-outline"></ion-icon>
        </ion-button>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Conflict Summary -->
      <ion-card class="summary-card">
        <ion-card-content>
          <div class="conflict-info">
            <ion-icon name="swap-horizontal-outline" color="warning"></ion-icon>
            <div>
              <h3>동기화 중 충돌이 발생했습니다</h3>
              <p>다른 사용자가 같은 데이터를 수정했습니다. 아래에서 유지할 값을 선택해주세요.</p>
            </div>
          </div>
          <div class="version-info">
            <ion-note>
              <ion-icon name="time-outline"></ion-icon>
              충돌 시간: {{ conflictTime | date:'MM/dd HH:mm:ss' }}
            </ion-note>
          </div>
        </ion-card-content>
      </ion-card>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <ion-button
          expand="block"
          fill="outline"
          color="primary"
          (click)="acceptAllServer()"
        >
          <ion-icon slot="start" name="cloud-outline"></ion-icon>
          서버 값 전체 적용
        </ion-button>
        <ion-button
          expand="block"
          fill="outline"
          color="secondary"
          (click)="acceptAllLocal()"
        >
          <ion-icon slot="start" name="phone-portrait-outline"></ion-icon>
          내 변경사항 유지
        </ion-button>
      </div>

      <!-- Field-by-field Comparison -->
      <h3 class="section-title">항목별 비교</h3>
      @for (comparison of comparisons(); track comparison.field) {
        <ion-card [class.critical]="comparison.isCritical">
          <ion-card-header>
            <ion-card-title>
              {{ comparison.label }}
              @if (comparison.isCritical) {
                <ion-badge color="danger">중요</ion-badge>
              }
            </ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-radio-group
              [value]="comparison.selectedSource"
              (ionChange)="selectSource(comparison.field, $event)"
            >
              <ion-list lines="none">
                <!-- Server Value -->
                <ion-item
                  [class.selected]="comparison.selectedSource === 'server'"
                >
                  <ion-radio slot="start" value="server"></ion-radio>
                  <ion-icon
                    slot="start"
                    name="cloud-outline"
                    color="primary"
                  ></ion-icon>
                  <ion-label>
                    <p class="source-label">서버 값</p>
                    <h3>{{ formatValue(comparison.field, comparison.serverValue) }}</h3>
                  </ion-label>
                </ion-item>

                <!-- Local Value -->
                <ion-item
                  [class.selected]="comparison.selectedSource === 'local'"
                >
                  <ion-radio slot="start" value="local"></ion-radio>
                  <ion-icon
                    slot="start"
                    name="phone-portrait-outline"
                    color="secondary"
                  ></ion-icon>
                  <ion-label>
                    <p class="source-label">내 변경사항</p>
                    <h3>{{ formatValue(comparison.field, comparison.localValue) }}</h3>
                  </ion-label>
                </ion-item>
              </ion-list>
            </ion-radio-group>
          </ion-card-content>
        </ion-card>
      }
    </ion-content>

    <ion-footer>
      <ion-toolbar>
        <ion-button slot="start" fill="outline" color="medium" (click)="dismiss()">
          나중에
        </ion-button>
        <ion-button slot="end" (click)="resolve()">
          <ion-icon slot="start" name="checkmark-outline"></ion-icon>
          적용
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

    .summary-card {
      margin-bottom: 16px;

      .conflict-info {
        display: flex;
        align-items: flex-start;
        gap: 12px;

        ion-icon {
          font-size: 32px;
          flex-shrink: 0;
        }

        h3 {
          margin: 0 0 4px 0;
          font-size: 16px;
          font-weight: 600;
        }

        p {
          margin: 0;
          font-size: 14px;
          color: var(--ion-color-medium);
        }
      }

      .version-info {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid var(--ion-color-light);

        ion-note {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
        }
      }
    }

    .quick-actions {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;

      ion-button {
        flex: 1;
      }
    }

    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--ion-color-primary);
      margin: 16px 0 8px 0;
    }

    ion-card {
      margin-bottom: 12px;

      &.critical {
        border-left: 4px solid var(--ion-color-danger);
      }

      ion-card-title {
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;

        ion-badge {
          font-size: 10px;
        }
      }

      ion-list {
        padding: 0;
      }

      ion-item {
        --padding-start: 0;
        --inner-padding-end: 0;
        --background: var(--ion-color-light);
        margin-bottom: 4px;
        border-radius: 8px;

        &.selected {
          --background: var(--ion-color-primary-tint);
        }

        .source-label {
          font-size: 11px;
          color: var(--ion-color-medium);
          margin: 0 0 2px 0;
        }

        h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 500;
        }
      }
    }

    ion-footer ion-toolbar {
      padding: 8px;
    }
  `],
})
export class SyncConflictModal implements OnInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly navParams = inject(NavParams);

  protected conflictData!: ConflictData;
  protected conflictTime!: Date;
  protected readonly comparisons = signal<FieldComparison[]>([]);

  constructor() {
    addIcons({
      cloudOutline,
      phonePortraitOutline,
      checkmarkOutline,
      closeOutline,
      warningOutline,
      swapHorizontalOutline,
      timeOutline,
    });
  }

  ngOnInit(): void {
    this.conflictData = this.navParams.get('conflictData');
    this.conflictTime = new Date(this.conflictData.timestamp);
    this.buildComparisons();
  }

  /**
   * Build field comparisons from server and local data
   */
  private buildComparisons(): void {
    const { serverData, localData } = this.conflictData;
    const comparisons: FieldComparison[] = [];

    // Find all fields that differ
    const allFields = new Set([
      ...Object.keys(serverData),
      ...Object.keys(localData),
    ]);

    for (const field of allFields) {
      // Skip internal fields
      if (field.startsWith('_') || field === 'id' || field === 'version') {
        continue;
      }

      const serverValue = serverData[field];
      const localValue = localData[field];

      // Only show differing values
      if (JSON.stringify(serverValue) !== JSON.stringify(localValue)) {
        const isCritical = CRITICAL_FIELDS.includes(field);
        comparisons.push({
          field,
          label: FIELD_LABELS[field] || field,
          serverValue,
          localValue,
          isCritical,
          // Default: server wins for non-critical, manual for critical
          selectedSource: isCritical ? 'server' : 'server',
        });
      }
    }

    // Sort: critical fields first
    comparisons.sort((a, b) => {
      if (a.isCritical && !b.isCritical) return -1;
      if (!a.isCritical && b.isCritical) return 1;
      return 0;
    });

    this.comparisons.set(comparisons);
  }

  /**
   * Format value for display
   */
  protected formatValue(field: string, value: unknown): string {
    if (value === null || value === undefined) {
      return '(없음)';
    }

    // Special formatting for known fields
    if (field === 'status') {
      return ORDER_STATUS_LABELS[value as OrderStatus] || String(value);
    }

    if (value instanceof Date || (typeof value === 'string' && field.includes('Date'))) {
      try {
        return new Date(value as string).toLocaleDateString('ko-KR');
      } catch {
        return String(value);
      }
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  /**
   * Select source for a specific field
   */
  protected selectSource(field: string, event: CustomEvent): void {
    const source = event.detail.value as 'server' | 'local';
    this.comparisons.update((current) =>
      current.map((c) =>
        c.field === field ? { ...c, selectedSource: source } : c
      )
    );
  }

  /**
   * Accept all server values
   */
  protected acceptAllServer(): void {
    this.comparisons.update((current) =>
      current.map((c) => ({ ...c, selectedSource: 'server' as const }))
    );
  }

  /**
   * Accept all local values
   */
  protected acceptAllLocal(): void {
    this.comparisons.update((current) =>
      current.map((c) => ({ ...c, selectedSource: 'local' as const }))
    );
  }

  /**
   * Resolve conflict and return merged data
   */
  protected async resolve(): Promise<void> {
    const mergedData: Record<string, unknown> = {
      ...this.conflictData.serverData, // Start with server data as base
    };

    // Apply user selections
    for (const comparison of this.comparisons()) {
      if (comparison.selectedSource === 'local') {
        mergedData[comparison.field] = comparison.localValue;
      }
    }

    // Set version to server version (will be incremented on save)
    mergedData['version'] = this.conflictData.serverVersion;

    await this.modalCtrl.dismiss({
      resolved: true,
      mergedData,
      resolutionSummary: this.comparisons().map((c) => ({
        field: c.field,
        selectedSource: c.selectedSource,
      })),
    });
  }

  /**
   * Dismiss without resolving
   */
  protected async dismiss(): Promise<void> {
    await this.modalCtrl.dismiss({
      resolved: false,
    });
  }
}
