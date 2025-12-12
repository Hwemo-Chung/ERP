// apps/web/src/app/features/assignment/pages/batch-assign/batch-assign.page.ts
import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  IonCheckbox,
  IonBadge,
  IonSpinner,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonDatetime,
  IonDatetimeButton,
  IonModal,
  AlertController,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  peopleOutline,
  calendarOutline,
  checkmarkCircleOutline,
} from 'ionicons/icons';

interface UnassignedOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  appointmentDate: string;
  productCount: number;
  selected: boolean;
}

interface Installer {
  id: string;
  name: string;
  assignedCount: number;
  capacity: number;
}

@Component({
  selector: 'app-batch-assign',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
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
    IonCheckbox,
    IonBadge,
    IonSpinner,
    IonSearchbar,
    IonSelect,
    IonSelectOption,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/assignment"></ion-back-button>
        </ion-buttons>
        <ion-title>일괄 배정</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar
          [debounce]="300"
          placeholder="주문번호, 고객명 검색..."
          (ionInput)="onSearch($event)"
        ></ion-searchbar>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Installer Selection -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            <ion-icon name="people-outline"></ion-icon>
            설치기사 선택
          </ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-select
            placeholder="설치기사를 선택하세요"
            [(ngModel)]="selectedInstallerId"
            interface="action-sheet"
          >
            @for (installer of installers(); track installer.id) {
              <ion-select-option [value]="installer.id">
                {{ installer.name }} ({{ installer.assignedCount }}/{{ installer.capacity }})
              </ion-select-option>
            }
          </ion-select>
        </ion-card-content>
      </ion-card>

      <!-- Date Selection -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>
            <ion-icon name="calendar-outline"></ion-icon>
            배정 날짜
          </ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-datetime-button datetime="datetime"></ion-datetime-button>
          <ion-modal [keepContentsMounted]="true">
            <ng-template>
              <ion-datetime
                id="datetime"
                presentation="date"
                [(ngModel)]="selectedDate"
                [min]="minDate"
                [max]="maxDate"
              ></ion-datetime>
            </ng-template>
          </ion-modal>
        </ion-card-content>
      </ion-card>

      <!-- Order Selection -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>미배정 주문 선택</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div class="summary-row">
            <span>미배정 주문:</span>
            <strong>{{ orders().length }}건</strong>
          </div>
          <div class="summary-row">
            <span>선택된 주문:</span>
            <strong>{{ selectedCount() }}건</strong>
          </div>
        </ion-card-content>
      </ion-card>

      <!-- Select All -->
      <ion-item>
        <ion-checkbox
          slot="start"
          [checked]="isAllSelected()"
          [indeterminate]="isIndeterminate()"
          (ionChange)="toggleSelectAll($event)"
        ></ion-checkbox>
        <ion-label>전체 선택</ion-label>
      </ion-item>

      @if (isLoading()) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      } @else {
        <ion-list>
          @for (order of orders(); track order.id) {
            <ion-item>
              <ion-checkbox
                slot="start"
                [(ngModel)]="order.selected"
                (ionChange)="onSelectionChange()"
              ></ion-checkbox>
              <ion-label>
                <h2>{{ order.orderNumber }}</h2>
                <h3>{{ order.customerName }}</h3>
                <p>{{ order.appointmentDate }} | {{ order.productCount }}개 제품</p>
              </ion-label>
            </ion-item>
          } @empty {
            <div class="empty-state">
              <p>미배정 주문이 없습니다.</p>
            </div>
          }
        </ion-list>
      }

      <!-- Assign Button -->
      @if (selectedCount() > 0 && selectedInstallerId) {
        <div class="confirm-button">
          <ion-button expand="block" (click)="batchAssign()">
            <ion-icon name="checkmark-circle-outline" slot="start"></ion-icon>
            {{ selectedCount() }}건 배정
          </ion-button>
        </div>
      }
    </ion-content>
  `,
  styles: [`
    ion-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid var(--ion-color-light);

      &:last-child {
        border-bottom: none;
      }
    }

    .loading-container {
      display: flex;
      justify-content: center;
      padding: 24px;
    }

    .empty-state {
      text-align: center;
      padding: 24px;
      color: var(--ion-color-medium);
    }

    .confirm-button {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 16px;
      background: var(--ion-background-color);
      box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
    }
  `],
})
export class BatchAssignPage {
  protected readonly isLoading = signal(false);
  protected readonly orders = signal<UnassignedOrder[]>([]);
  protected readonly installers = signal<Installer[]>([]);
  protected readonly selectedCount = signal(0);

  selectedInstallerId: string | null = null;
  selectedDate: string = new Date().toISOString();
  minDate: string = new Date().toISOString();
  maxDate: string = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

  constructor(
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {
    addIcons({
      peopleOutline,
      calendarOutline,
      checkmarkCircleOutline,
    });

    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    // TODO: Load unassigned orders and installers
    setTimeout(() => {
      this.isLoading.set(false);
    }, 500);
  }

  onSearch(event: CustomEvent): void {
    const query = event.detail.value || '';
    console.log('Search:', query);
  }

  isAllSelected(): boolean {
    const allOrders = this.orders();
    return allOrders.length > 0 && allOrders.every(o => o.selected);
  }

  isIndeterminate(): boolean {
    const allOrders = this.orders();
    const selectedOrders = allOrders.filter(o => o.selected);
    return selectedOrders.length > 0 && selectedOrders.length < allOrders.length;
  }

  toggleSelectAll(event: CustomEvent): void {
    const checked = event.detail.checked;
    this.orders.update(orders =>
      orders.map(order => ({ ...order, selected: checked }))
    );
    this.updateSelectedCount();
  }

  onSelectionChange(): void {
    this.updateSelectedCount();
  }

  updateSelectedCount(): void {
    this.selectedCount.set(
      this.orders().filter(o => o.selected).length
    );
  }

  async batchAssign(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: '일괄 배정',
      message: `${this.selectedCount()}건을 선택한 기사에게 배정하시겠습니까?`,
      buttons: [
        { text: '취소', role: 'cancel' },
        {
          text: '배정',
          handler: async () => {
            // TODO: Implement batch assign API
            const toast = await this.toastCtrl.create({
              message: '배정이 완료되었습니다.',
              duration: 2000,
              color: 'success',
            });
            await toast.present();
          },
        },
      ],
    });
    await alert.present();
  }
}
