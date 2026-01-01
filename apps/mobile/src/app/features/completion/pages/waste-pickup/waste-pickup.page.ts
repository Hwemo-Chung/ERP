// apps/web/src/app/features/completion/pages/waste-pickup/waste-pickup.page.ts
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
  IonSpinner,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  trashOutline,
  addOutline,
  removeOutline,
  saveOutline,
} from 'ionicons/icons';
import { OrdersStore } from '../../../../store/orders/orders.store';
import { Order, WasteEntry } from '../../../../store/orders/orders.models';
import { TranslateModule } from '@ngx-translate/core';

interface WasteItem {
  id: string;
  code: string;
  name: string;
  quantity: number;
  selected: boolean;
}

// PRD 명시된 폐가전 코드 (P01~P21)
const WASTE_CODES: { code: string; name: string }[] = [
  { code: 'P01', name: '냉장고' },
  { code: 'P02', name: '세탁기' },
  { code: 'P03', name: '에어컨' },
  { code: 'P04', name: 'TV' },
  { code: 'P05', name: '전자레인지' },
  { code: 'P06', name: '식기세척기' },
  { code: 'P07', name: '건조기' },
  { code: 'P08', name: '공기청정기' },
  { code: 'P09', name: '제습기' },
  { code: 'P10', name: '가습기' },
  { code: 'P11', name: '청소기' },
  { code: 'P12', name: '밥솥' },
  { code: 'P13', name: '정수기' },
  { code: 'P14', name: '비데' },
  { code: 'P15', name: '온수매트' },
  { code: 'P16', name: '선풍기' },
  { code: 'P17', name: '히터' },
  { code: 'P18', name: '안마의자' },
  { code: 'P19', name: '러닝머신' },
  { code: 'P20', name: '컴퓨터' },
  { code: 'P21', name: '기타' },
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
    IonSpinner,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button [defaultHref]="'/tabs/completion/process/' + orderId()"></ion-back-button>
        </ion-buttons>
        <ion-title>폐가전 회수</ion-title>
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
              폐가전 회수 등록
            </ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p class="instruction">
              회수할 폐가전 품목을 선택하고 수량을 입력해주세요.
            </p>
          </ion-card-content>
        </ion-card>

        <!-- Add New Item -->
        <ion-card>
          <ion-card-content>
            <ion-item>
              <ion-select
                placeholder="폐가전 품목 선택"
                [(ngModel)]="selectedCode"
                interface="action-sheet"
              >
                @for (waste of wasteCodes; track waste.code) {
                  <ion-select-option [value]="waste.code">
                    {{ waste.code }} - {{ waste.name }}
                  </ion-select-option>
                }
              </ion-select>
            </ion-item>
            <div class="add-row">
              <ion-input
                type="number"
                placeholder="수량"
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
            <ion-card-title>회수 품목 ({{ totalItems() }}건)</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            @if (items().length > 0) {
              <ion-list>
                @for (item of items(); track item.id) {
                  <ion-item>
                    <ion-label>
                      <h3>{{ item.code }} - {{ item.name }}</h3>
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
                <p>등록된 폐가전이 없습니다.</p>
              </div>
            }
          </ion-card-content>
        </ion-card>

        <!-- Save Button -->
        <div class="action-buttons">
          <ion-button expand="block" (click)="saveWastePickup()">
            <ion-icon name="save-outline" slot="start"></ion-icon>
            저장
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
        name: WASTE_CODES.find(wc => wc.code === w.code)?.name || w.code,
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
          name: waste.name,
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

  async saveWastePickup(): Promise<void> {
    try {
      const wasteData = this.items().map(i => ({
        code: i.code,
        quantity: i.quantity,
      }));
      await this.ordersStore.updateOrderWaste(this.orderId(), wasteData);
      
      const toast = await this.toastCtrl.create({
        message: '폐가전 회수 정보가 저장되었습니다.',
        duration: 2000,
        color: 'success',
      });
      await toast.present();
      this.router.navigate(['/tabs/completion/process', this.orderId()]);
    } catch (error) {
      const toast = await this.toastCtrl.create({
        message: '저장 중 오류가 발생했습니다.',
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    }
  }
}
