// apps/web/src/app/features/settings/pages/split-order/split-order.page.ts
import { Component, signal, computed, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonList, IonItem,
  IonLabel, IonInput, IonButton, IonIcon, IonSpinner, IonSelect, IonSelectOption,
  ToastController, AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { gitBranchOutline, addOutline, removeOutline, saveOutline, personOutline } from 'ionicons/icons';
import { OrdersStore } from '../../../../store/orders/orders.store';
import { Order, OrderLine } from '../../../../store/orders/orders.models';

interface SplitAssignment {
  installerId: string;
  installerName: string;
  qty: number;
}

interface SplitItem {
  lineId: string;
  productName: string;
  productCode: string;
  totalQty: number;
  splits: SplitAssignment[];
}

@Component({
  selector: 'app-split-order',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonList, IonItem,
    IonLabel, IonInput, IonButton, IonIcon, IonSpinner, IonSelect, IonSelectOption,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/assignment"></ion-back-button></ion-buttons>
        <ion-title>분할 주문</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Order Info -->
      <ion-card>
        <ion-card-header>
          <ion-card-title><ion-icon name="git-branch-outline"></ion-icon> 주문 분할</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          @if (order()) {
            <p><strong>주문번호:</strong> {{ order()!.erpOrderNumber }}</p>
            <p><strong>고객명:</strong> {{ order()!.customerName }}</p>
            <p><strong>예약일:</strong> {{ order()!.appointmentDate || '-' }}</p>
          } @else {
            <p>주문번호: {{ orderId }}</p>
          }
          <p class="sub">다중 제품 주문을 여러 설치기사에게 분할 배정합니다.</p>
        </ion-card-content>
      </ion-card>

      @if (isLoading()) {
        <div class="center"><ion-spinner name="crescent"></ion-spinner></div>
      } @else {
        @for (item of items(); track item.lineId) {
          <ion-card>
            <ion-card-header>
              <ion-card-title>{{ item.productName }}</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <p><strong>제품코드:</strong> {{ item.productCode }}</p>
              <p><strong>총 수량:</strong> {{ item.totalQty }}개</p>
              <p class="remaining" [class.error]="getRemainingQty(item) < 0">
                <strong>남은 수량:</strong> {{ getRemainingQty(item) }}개
              </p>
              
              <ion-list>
                @for (split of item.splits; track $index; let i = $index) {
                  <ion-item>
                    <ion-icon name="person-outline" slot="start"></ion-icon>
                    <ion-input 
                      type="text" 
                      placeholder="설치기사명"
                      [(ngModel)]="split.installerName"
                      style="flex:2"
                    ></ion-input>
                    <ion-input 
                      type="number" 
                      placeholder="수량"
                      [(ngModel)]="split.qty" 
                      min="0" 
                      [max]="item.totalQty"
                      style="max-width:80px"
                    ></ion-input>
                    <ion-button fill="clear" color="danger" (click)="removeSplit(item, i)">
                      <ion-icon name="remove-outline" slot="icon-only"></ion-icon>
                    </ion-button>
                  </ion-item>
                }
              </ion-list>
              
              <ion-button fill="clear" size="small" (click)="addSplit(item)">
                <ion-icon name="add-outline" slot="start"></ion-icon>분할 추가
              </ion-button>
            </ion-card-content>
          </ion-card>
        } @empty {
          <div class="empty">분할 가능한 제품이 없습니다</div>
        }

        @if (items().length > 0) {
          <ion-button 
            expand="block" 
            [disabled]="!isValid()"
            (click)="saveSplit()"
          >
            <ion-icon name="save-outline" slot="start"></ion-icon>
            분할 저장
          </ion-button>
        }
      }
    </ion-content>
  `,
  styles: [`
    .center { display: flex; justify-content: center; padding: 48px; }
    .empty { text-align: center; padding: 24px; color: var(--ion-color-medium); }
    .sub { color: var(--ion-color-medium); font-size: 13px; margin-top: 8px; }
    .remaining { margin-top: 8px; }
    .remaining.error { color: var(--ion-color-danger); }
    ion-card-title { display: flex; align-items: center; gap: 8px; font-size: 16px; }
  `],
})
export class SplitOrderPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);
  private readonly ordersStore = inject(OrdersStore);

  protected readonly orderId = this.route.snapshot.paramMap.get('id') || '';
  protected readonly isLoading = signal(false);
  protected readonly items = signal<SplitItem[]>([]);

  protected readonly order = computed(() => {
    return this.ordersStore.orders().find((o: Order) => o.id === this.orderId);
  });

  constructor() {
    addIcons({ gitBranchOutline, addOutline, removeOutline, saveOutline, personOutline });
  }

  ngOnInit() {
    this.loadOrderData();
  }

  loadOrderData() {
    const order = this.order();
    if (order) {
      const lines = order.lines || order.orderLines || [];
      this.items.set(lines.map((line: OrderLine) => ({
        lineId: line.id,
        productName: line.productName,
        productCode: line.productCode,
        totalQty: line.quantity,
        splits: [{ installerId: '', installerName: order.installerName || '', qty: line.quantity }],
      })));
    }
  }

  addSplit(item: SplitItem) {
    item.splits.push({ installerId: '', installerName: '', qty: 0 });
    this.items.update(list => [...list]); // Trigger update
  }

  removeSplit(item: SplitItem, index: number) {
    if (item.splits.length > 1) {
      item.splits.splice(index, 1);
      this.items.update(list => [...list]);
    }
  }

  getRemainingQty(item: SplitItem): number {
    const assigned = item.splits.reduce((sum, s) => sum + (s.qty || 0), 0);
    return item.totalQty - assigned;
  }

  isValid(): boolean {
    return this.items().every(item => this.getRemainingQty(item) === 0);
  }

  async saveSplit() {
    if (!this.isValid()) {
      const toast = await this.toastCtrl.create({
        message: '모든 수량이 배정되어야 합니다.',
        duration: 2000,
        color: 'warning',
      });
      await toast.present();
      return;
    }

    const alert = await this.alertCtrl.create({
      header: '분할 저장',
      message: '주문을 분할하시겠습니까? 이 작업은 취소할 수 없습니다.',
      buttons: [
        { text: '취소', role: 'cancel' },
        {
          text: '저장',
          handler: async () => {
            try {
              // Call API to split order
              const splits = this.items().map(item => ({
                lineId: item.lineId,
                assignments: item.splits.filter(s => s.qty > 0).map(s => ({
                  installerId: s.installerId,
                  installerName: s.installerName,
                  quantity: s.qty,
                })),
              }));

              const success = await this.ordersStore.splitOrder(this.orderId, splits);
              
              if (success) {
                const toast = await this.toastCtrl.create({
                  message: '분할이 저장되었습니다.',
                  duration: 2000,
                  color: 'success',
                });
                await toast.present();
                this.router.navigate(['/tabs/assignment']);
              } else {
                const toast = await this.toastCtrl.create({
                  message: this.ordersStore.error() || '분할 저장에 실패했습니다.',
                  duration: 2000,
                  color: 'danger',
                });
                await toast.present();
              }
            } catch (error) {
              const toast = await this.toastCtrl.create({
                message: '저장 중 오류가 발생했습니다.',
                duration: 2000,
                color: 'danger',
              });
              await toast.present();
            }
          },
        },
      ],
    });
    await alert.present();
  }
}
