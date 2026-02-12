/**
 * Split Order Page
 * FR-10: Split multi-product orders to multiple installers
 */
import {
  Component,
  signal,
  computed,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonList,
  IonItem,
  IonInput,
  IonButton,
  IonIcon,
  IonSpinner,
  IonSelect,
  IonSelectOption,
  IonBadge,
  ToastController,
  AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  gitBranchOutline,
  addOutline,
  removeOutline,
  saveOutline,
  checkmarkCircleOutline,
  warningOutline,
} from 'ionicons/icons';
import { OrdersStore } from '../../../../store/orders/orders.store';
import { InstallersStore } from '../../../../store/installers/installers.store';
import { Order, OrderLine } from '../../../../store/orders/orders.models';
import { TranslateModule } from '@ngx-translate/core';
import { LoggerService } from '../../../../core/services/logger.service';

interface SplitAssignment {
  installerId: string;
  installerName: string;
  quantity: number;
}

interface SplitLineItem {
  lineId: string;
  productCode: string;
  productName: string;
  totalQuantity: number;
  assignments: SplitAssignment[];
}

@Component({
  selector: 'app-split-order',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonList,
    IonItem,
    IonInput,
    IonButton,
    IonIcon,
    IonSpinner,
    IonSelect,
    IonSelectOption,
    IonBadge,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/orders"></ion-back-button>
        </ion-buttons>
        <ion-title>분할 주문</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Order Info Card -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            <ion-icon name="git-branch-outline"></ion-icon>
            주문 분할
          </ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p><strong>주문번호:</strong> {{ order()?.orderNo || orderId }}</p>
          <p><strong>고객명:</strong> {{ order()?.customerName || '-' }}</p>
          <p class="hint">다중 제품 주문을 여러 설치기사에게 분할 배정합니다.</p>
        </ion-card-content>
      </ion-card>

      @if (isLoading()) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      } @else {
        <!-- Split Lines -->
        @for (item of splitLines(); track item.lineId) {
          <ion-card>
            <ion-card-header>
              <ion-card-title>{{ item.productName }}</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <div class="quantity-summary">
                <span
                  >총 수량: <strong>{{ item.totalQuantity }}개</strong></span
                >
                <ion-badge [color]="getAssignmentStatus(item).color">
                  {{ getAssignmentStatus(item).label }}
                </ion-badge>
              </div>

              <ion-list>
                @for (assignment of item.assignments; track $index; let i = $index) {
                  <ion-item>
                    <ion-select
                      label="설치기사"
                      labelPlacement="stacked"
                      [value]="assignment.installerId"
                      (ionChange)="onInstallerChange(item, i, $any($event).detail.value)"
                      interface="popover"
                    >
                      <ion-select-option value="">미지정</ion-select-option>
                      @for (installer of installers(); track installer.id) {
                        <ion-select-option [value]="installer.id">
                          {{ installer.name }}
                        </ion-select-option>
                      }
                    </ion-select>
                    <ion-input
                      type="number"
                      [(ngModel)]="assignment.quantity"
                      min="1"
                      [max]="item.totalQuantity"
                      slot="end"
                      class="quantity-input"
                      (ionInput)="validateAssignments()"
                    ></ion-input>
                    @if (item.assignments.length > 1) {
                      <ion-button
                        fill="clear"
                        color="danger"
                        slot="end"
                        (click)="removeAssignment(item, i)"
                      >
                        <ion-icon name="remove-outline"></ion-icon>
                      </ion-button>
                    }
                  </ion-item>
                }
              </ion-list>

              <ion-button
                fill="clear"
                size="small"
                (click)="addAssignment(item)"
                [disabled]="getAssignedQuantity(item) >= item.totalQuantity"
              >
                <ion-icon name="add-outline" slot="start"></ion-icon>
                분할 추가
              </ion-button>
            </ion-card-content>
          </ion-card>
        } @empty {
          <div class="empty-state">
            <p>분할 가능한 제품이 없습니다</p>
          </div>
        }

        <!-- Validation Summary -->
        @if (splitLines().length > 0) {
          <ion-card [color]="isValid() ? 'success' : 'warning'">
            <ion-card-content>
              <div class="validation-summary">
                <ion-icon
                  [name]="isValid() ? 'checkmark-circle-outline' : 'warning-outline'"
                ></ion-icon>
                @if (isValid()) {
                  <span>모든 수량이 올바르게 배정되었습니다</span>
                } @else {
                  <span>{{ validationMessage() }}</span>
                }
              </div>
            </ion-card-content>
          </ion-card>

          <!-- Save Button -->
          <ion-button expand="block" [disabled]="!isValid() || isSaving()" (click)="saveSplit()">
            @if (isSaving()) {
              <ion-spinner name="crescent" slot="start"></ion-spinner>
            } @else {
              <ion-icon name="save-outline" slot="start"></ion-icon>
            }
            분할 저장
          </ion-button>
        }
      }
    </ion-content>
  `,
  styles: [
    `
      ion-card-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
      }

      .hint {
        color: var(--ion-color-medium);
        font-size: 13px;
        margin-top: 8px;
      }

      .loading-container {
        display: flex;
        justify-content: center;
        padding: 48px;
      }

      .quantity-summary {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--ion-color-light);
      }

      .quantity-input {
        max-width: 80px;
        text-align: right;
      }

      .empty-state {
        text-align: center;
        padding: 24px;
        color: var(--ion-color-medium);
      }

      .validation-summary {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;

        ion-icon {
          font-size: 20px;
        }
      }

      ion-button[expand='block'] {
        margin-top: 16px;
      }
    `,
  ],
})
export class SplitOrderPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);
  private readonly logger = inject(LoggerService);
  protected readonly ordersStore = inject(OrdersStore);
  protected readonly installersStore = inject(InstallersStore);

  readonly orderId = this.route.snapshot.paramMap.get('id') || '';
  protected readonly isLoading = computed(() => this.ordersStore.isLoading());
  protected readonly isSaving = signal(false);
  protected readonly splitLines = signal<SplitLineItem[]>([]);
  protected readonly validationMessage = signal('');

  protected readonly order = computed(() => {
    return this.ordersStore.orders().find((o: Order) => o.id === this.orderId);
  });

  protected readonly installers = computed(() => {
    return this.installersStore.activeInstallers();
  });

  protected readonly isValid = computed(() => {
    const lines = this.splitLines();
    if (lines.length === 0) return false;

    for (const line of lines) {
      const assigned = line.assignments.reduce((sum, a) => sum + (a.quantity || 0), 0);
      if (assigned !== line.totalQuantity) return false;

      // Check each assignment has quantity > 0
      for (const assignment of line.assignments) {
        if (!assignment.quantity || assignment.quantity <= 0) return false;
      }
    }
    return true;
  });

  constructor() {
    addIcons({
      gitBranchOutline,
      addOutline,
      removeOutline,
      saveOutline,
      checkmarkCircleOutline,
      warningOutline,
    });
  }

  async ngOnInit(): Promise<void> {
    // Load installers
    await this.installersStore.loadInstallers();

    // Initialize split lines from order
    this.initializeSplitLines();
  }

  private initializeSplitLines(): void {
    const order = this.order();
    const lines = order?.lines || order?.orderLines || [];

    this.splitLines.set(
      lines.map((line: OrderLine) => ({
        lineId: line.id,
        productCode: line.itemCode || line.productCode || '',
        productName: line.itemName || line.productName || '',
        totalQuantity: line.quantity,
        assignments: [
          {
            installerId: order?.installerId || '',
            installerName: order?.installerName || '',
            quantity: line.quantity,
          },
        ],
      })),
    );
  }

  getAssignedQuantity(item: SplitLineItem): number {
    return item.assignments.reduce((sum, a) => sum + (a.quantity || 0), 0);
  }

  getAssignmentStatus(item: SplitLineItem): { color: string; label: string } {
    const assigned = this.getAssignedQuantity(item);
    if (assigned === item.totalQuantity) {
      return { color: 'success', label: `${assigned}/${item.totalQuantity} 완료` };
    } else if (assigned > item.totalQuantity) {
      return { color: 'danger', label: `${assigned}/${item.totalQuantity} 초과` };
    } else {
      return { color: 'warning', label: `${assigned}/${item.totalQuantity} 부족` };
    }
  }

  onInstallerChange(item: SplitLineItem, index: number, installerId: string): void {
    const installer = this.installers().find((i) => i.id === installerId);
    this.splitLines.update((lines) => {
      const updated = [...lines];
      const lineIndex = updated.findIndex((l) => l.lineId === item.lineId);
      if (lineIndex >= 0) {
        updated[lineIndex].assignments[index].installerId = installerId;
        updated[lineIndex].assignments[index].installerName = installer?.name || '';
      }
      return updated;
    });
  }

  addAssignment(item: SplitLineItem): void {
    this.splitLines.update((lines) => {
      const updated = [...lines];
      const lineIndex = updated.findIndex((l) => l.lineId === item.lineId);
      if (lineIndex >= 0) {
        const remaining = item.totalQuantity - this.getAssignedQuantity(item);
        updated[lineIndex].assignments.push({
          installerId: '',
          installerName: '',
          quantity: Math.max(1, remaining),
        });
      }
      return updated;
    });
    this.validateAssignments();
  }

  removeAssignment(item: SplitLineItem, index: number): void {
    this.splitLines.update((lines) => {
      const updated = [...lines];
      const lineIndex = updated.findIndex((l) => l.lineId === item.lineId);
      if (lineIndex >= 0 && updated[lineIndex].assignments.length > 1) {
        updated[lineIndex].assignments.splice(index, 1);
      }
      return updated;
    });
    this.validateAssignments();
  }

  validateAssignments(): void {
    const lines = this.splitLines();
    const issues: string[] = [];

    for (const line of lines) {
      const assigned = line.assignments.reduce((sum, a) => sum + (a.quantity || 0), 0);
      if (assigned !== line.totalQuantity) {
        if (assigned > line.totalQuantity) {
          issues.push(`${line.productName}: 수량 초과 (${assigned - line.totalQuantity}개)`);
        } else {
          issues.push(`${line.productName}: 수량 부족 (${line.totalQuantity - assigned}개)`);
        }
      }
    }

    this.validationMessage.set(issues.length > 0 ? issues.join(', ') : '');
  }

  async saveSplit(): Promise<void> {
    if (!this.isValid()) {
      const toast = await this.toastCtrl.create({
        message: '모든 제품의 수량이 올바르게 배정되어야 합니다',
        duration: 2000,
        color: 'warning',
      });
      await toast.present();
      return;
    }

    // Confirm before saving
    const alert = await this.alertCtrl.create({
      header: '분할 확인',
      message: '주문을 분할하시겠습니까? 분할 후에는 취소할 수 없습니다.',
      buttons: [
        { text: '취소', role: 'cancel' },
        {
          text: '분할',
          handler: async () => {
            await this.performSplit();
          },
        },
      ],
    });
    await alert.present();
  }

  private async performSplit(): Promise<void> {
    this.isSaving.set(true);

    try {
      const splits = this.splitLines().map((line) => ({
        lineId: line.lineId,
        assignments: line.assignments.map((a) => ({
          installerId: a.installerId || undefined,
          installerName: a.installerName || '미지정',
          quantity: a.quantity,
        })),
      }));

      const result = await this.ordersStore.splitOrder(this.orderId, splits);

      if (result.success) {
        const toast = await this.toastCtrl.create({
          message: `주문이 ${result.childOrders?.length || 0}개로 분할되었습니다`,
          duration: 2000,
          color: 'success',
        });
        await toast.present();
        this.router.navigate(['/tabs/orders']);
      } else {
        const errorMessage = this.ordersStore.error() || '분할에 실패했습니다';
        const toast = await this.toastCtrl.create({
          message: errorMessage,
          duration: 2000,
          color: 'danger',
        });
        await toast.present();
      }
    } catch (error) {
      this.logger.error('Split error:', error);
      const toast = await this.toastCtrl.create({
        message: '분할 중 오류가 발생했습니다',
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    } finally {
      this.isSaving.set(false);
    }
  }
}
