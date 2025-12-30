/**
 * 폐가전 회수 페이지 컴포넌트
 * PRD 명시된 폐가전 코드(P01~P21) 기반 회수 정보 입력
 */
import { Component, signal, computed, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
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
  IonButton,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonBadge,
  IonSpinner,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonCheckbox,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  trashOutline,
  addOutline,
  removeOutline,
  saveOutline,
} from 'ionicons/icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { OrdersStore } from '../../../../store/orders/orders.store';
import { Order, WasteEntry } from '../../../../store/orders/orders.models';

interface WasteItem {
  id: string;
  code: string;
  labelKey: string;
  quantity: number;
  selected: boolean;
}

// PRD 명시된 폐가전 코드 (P01~P21)
const WASTE_CODES: { code: string; labelKey: string }[] = [
  { code: 'P01', labelKey: 'WASTE_CODES.P01' },
  { code: 'P02', labelKey: 'WASTE_CODES.P02' },
  { code: 'P03', labelKey: 'WASTE_CODES.P03' },
  { code: 'P04', labelKey: 'WASTE_CODES.P04' },
  { code: 'P05', labelKey: 'WASTE_CODES.P05' },
  { code: 'P06', labelKey: 'WASTE_CODES.P06' },
  { code: 'P07', labelKey: 'WASTE_CODES.P07' },
  { code: 'P08', labelKey: 'WASTE_CODES.P08' },
  { code: 'P09', labelKey: 'WASTE_CODES.P09' },
  { code: 'P10', labelKey: 'WASTE_CODES.P10' },
  { code: 'P11', labelKey: 'WASTE_CODES.P11' },
  { code: 'P12', labelKey: 'WASTE_CODES.P12' },
  { code: 'P13', labelKey: 'WASTE_CODES.P13' },
  { code: 'P14', labelKey: 'WASTE_CODES.P14' },
  { code: 'P15', labelKey: 'WASTE_CODES.P15' },
  { code: 'P16', labelKey: 'WASTE_CODES.P16' },
  { code: 'P17', labelKey: 'WASTE_CODES.P17' },
  { code: 'P18', labelKey: 'WASTE_CODES.P18' },
  { code: 'P19', labelKey: 'WASTE_CODES.P19' },
  { code: 'P20', labelKey: 'WASTE_CODES.P20' },
  { code: 'P21', labelKey: 'WASTE_CODES.P21' },
];

@Component({
  selector: 'app-waste-pickup',
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
    IonButton,
    IonIcon,
    IonList,
    IonItem,
    IonLabel,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonBadge,
    IonSpinner,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonCheckbox,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button [defaultHref]="'/tabs/completion/process/' + orderId()"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ 'COMPLETION.WASTE.TITLE' | translate }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (isLoading()) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      } @else {
        <!-- Info Card -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>
              <ion-icon name="trash-outline"></ion-icon>
              {{ 'COMPLETION.WASTE.CARD_TITLE' | translate }}
            </ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p class="instruction">
              {{ 'COMPLETION.WASTE.INSTRUCTION' | translate }}
            </p>
          </ion-card-content>
        </ion-card>

        <!-- Add New Item -->
        <ion-card>
          <ion-card-content>
            <ion-item>
              <ion-select
                [placeholder]="'COMPLETION.WASTE.SELECT_PLACEHOLDER' | translate"
                [(ngModel)]="selectedCode"
                interface="action-sheet"
              >
                @for (waste of wasteCodes; track waste.code) {
                  <ion-select-option [value]="waste.code">
                    {{ waste.code }} - {{ waste.labelKey | translate }}
                  </ion-select-option>
                }
              </ion-select>
            </ion-item>
            <div class="add-row">
              <ion-input
                type="number"
                [placeholder]="'COMPLETION.WASTE.QUANTITY_PLACEHOLDER' | translate"
                [(ngModel)]="selectedQuantity"
                min="1"
                max="99"
              ></ion-input>
              <ion-button (click)="addItem()" [disabled]="!selectedCode">
                <ion-icon name="add-outline" slot="icon-only"></ion-icon>
              </ion-button>
            </div>
          </ion-card-content>
        </ion-card>

        <!-- Selected Items -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ 'COMPLETION.WASTE.ITEMS_TITLE' | translate }} ({{ 'COMPLETION.WASTE.ITEMS_COUNT' | translate:{ count: totalItems() } }})</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            @if (items().length > 0) {
              <ion-list>
                @for (item of items(); track item.id) {
                  <ion-item>
                    <ion-label>
                      <h3>{{ item.code }} - {{ item.labelKey | translate }}</h3>
                    </ion-label>
                    <div class="quantity-controls" slot="end">
                      <ion-button fill="clear" size="small" (click)="decreaseQuantity(item)">
                        <ion-icon name="remove-outline"></ion-icon>
                      </ion-button>
                      <span class="quantity">{{ item.quantity }}</span>
                      <ion-button fill="clear" size="small" (click)="increaseQuantity(item)">
                        <ion-icon name="add-outline"></ion-icon>
                      </ion-button>
                    </div>
                  </ion-item>
                }
              </ion-list>
            } @else {
              <div class="empty-state">
                <p>{{ 'COMPLETION.WASTE.NO_ITEMS' | translate }}</p>
              </div>
            }
          </ion-card-content>
        </ion-card>

        <!-- Save Button -->
        <div class="action-buttons">
          <ion-button expand="block" (click)="saveWastePickup()">
            <ion-icon name="save-outline" slot="start"></ion-icon>
            {{ 'COMPLETION.WASTE.SAVE_BTN' | translate }}
          </ion-button>
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .loading-container {
      display: flex;
      justify-content: center;
      padding: 48px;
    }

    ion-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
    }

    .instruction {
      color: var(--ion-color-medium);
      font-size: 14px;
    }

    .add-row {
      display: flex;
      gap: 8px;
      margin-top: 12px;

      ion-input {
        flex: 1;
        max-width: 100px;
      }
    }

    .quantity-controls {
      display: flex;
      align-items: center;
      gap: 4px;

      .quantity {
        min-width: 24px;
        text-align: center;
        font-weight: 600;
      }
    }

    .empty-state {
      text-align: center;
      padding: 24px;
      color: var(--ion-color-medium);
    }

    .action-buttons {
      margin-top: 24px;
    }
  `],
})
export class WastePickupPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);
  protected readonly ordersStore = inject(OrdersStore);
  private readonly translateService = inject(TranslateService);

  protected readonly orderId = signal('');
  protected readonly isLoading = computed(() => this.ordersStore.isLoading());
  protected readonly items = signal<WasteItem[]>([]);

  protected readonly order = computed(() => {
    const id = this.orderId();
    return this.ordersStore.orders().find((o: Order) => o.id === id);
  });

  readonly wasteCodes = WASTE_CODES;
  selectedCode: string = '';
  selectedQuantity: number = 1;

  constructor() {
    addIcons({
      trashOutline,
      addOutline,
      removeOutline,
      saveOutline,
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.orderId.set(id);
    this.loadExistingWaste();
  }

  loadExistingWaste(): void {
    const order = this.order();
    if (order?.completion?.waste?.length) {
      this.items.set(order.completion.waste.map((w: WasteEntry) => ({
        id: crypto.randomUUID(),
        code: w.code,
        labelKey: WASTE_CODES.find(wc => wc.code === w.code)?.labelKey || `WASTE_CODES.${w.code}`,
        quantity: w.quantity,
        selected: true,
      })));
    }
  }

  totalItems(): number {
    return this.items().reduce((sum, item) => sum + item.quantity, 0);
  }

  addItem(): void {
    if (!this.selectedCode) return;

    const waste = WASTE_CODES.find(w => w.code === this.selectedCode);
    if (!waste) return;

    this.items.update(items => {
      const existing = items.find(i => i.code === this.selectedCode);
      if (existing) {
        return items.map(i =>
          i.code === this.selectedCode
            ? { ...i, quantity: i.quantity + this.selectedQuantity }
            : i
        );
      }
      return [
        ...items,
        {
          id: crypto.randomUUID(),
          code: waste.code,
          labelKey: waste.labelKey,
          quantity: this.selectedQuantity,
          selected: true,
        },
      ];
    });

    this.selectedCode = '';
    this.selectedQuantity = 1;
  }

  increaseQuantity(item: WasteItem): void {
    this.items.update(items =>
      items.map(i =>
        i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
      )
    );
  }

  decreaseQuantity(item: WasteItem): void {
    this.items.update(items => {
      if (item.quantity <= 1) {
        return items.filter(i => i.id !== item.id);
      }
      return items.map(i =>
        i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i
      );
    });
  }

  /**
   * 폐가전 회수 정보 저장
   */
  async saveWastePickup(): Promise<void> {
    try {
      const wasteData = this.items().map(i => ({
        code: i.code,
        quantity: i.quantity,
      }));
      await this.ordersStore.updateOrderWaste(this.orderId(), wasteData);
      
      const toast = await this.toastCtrl.create({
        message: this.translateService.instant('COMPLETION.WASTE.SAVE_SUCCESS'),
        duration: 2000,
        color: 'success',
      });
      await toast.present();
      this.router.navigate(['/tabs/completion/process', this.orderId()]);
    } catch (error) {
      const toast = await this.toastCtrl.create({
        message: this.translateService.instant('COMPLETION.WASTE.SAVE_ERROR'),
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    }
  }
}
