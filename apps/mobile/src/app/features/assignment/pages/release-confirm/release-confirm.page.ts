// apps/web/src/app/features/assignment/pages/release-confirm/release-confirm.page.ts
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
  IonNote,
  IonChip,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  AlertController,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  checkmarkCircleOutline,
  cubeOutline,
  printOutline,
} from 'ionicons/icons';

interface ReleaseItem {
  id: string;
  orderNumber: string;
  customerName: string;
  installerName: string;
  productCount: number;
  appointmentDate: string;
  selected: boolean;
}

@Component({
  selector: 'app-release-confirm',
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
    IonNote,
    IonChip,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/assignment"></ion-back-button>
        </ion-buttons>
        <ion-title>출고 확정</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="printSummary()">
            <ion-icon name="print-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
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
      <!-- Summary Card -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>출고 확정 대상</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div class="summary-row">
            <span>전체 항목:</span>
            <strong>{{ items().length }}건</strong>
          </div>
          <div class="summary-row">
            <span>선택된 항목:</span>
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
          <p>데이터 로딩 중...</p>
        </div>
      } @else {
        <ion-list>
          @for (item of items(); track item.id) {
            <ion-item>
              <ion-checkbox
                slot="start"
                [(ngModel)]="item.selected"
                (ionChange)="onSelectionChange()"
              ></ion-checkbox>
              <ion-label>
                <h2>{{ item.orderNumber }}</h2>
                <h3>{{ item.customerName }}</h3>
                <p>
                  <ion-icon name="cube-outline"></ion-icon>
                  {{ item.productCount }}개 제품 | {{ item.installerName }}
                </p>
                <ion-note>{{ item.appointmentDate }}</ion-note>
              </ion-label>
            </ion-item>
          } @empty {
            <div class="empty-state">
              <ion-icon name="checkmark-circle-outline"></ion-icon>
              <p>출고 확정 대상이 없습니다.</p>
            </div>
          }
        </ion-list>
      }

      <!-- Confirm Button -->
      @if (selectedCount() > 0) {
        <div class="confirm-button">
          <ion-button expand="block" (click)="confirmRelease()">
            <ion-icon name="checkmark-circle-outline" slot="start"></ion-icon>
            {{ selectedCount() }}건 출고 확정
          </ion-button>
        </div>
      }
    </ion-content>
  `,
  styles: [`
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
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 40vh;
      color: var(--ion-color-medium);
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 16px;
      color: var(--ion-color-medium);

      ion-icon {
        font-size: 64px;
        margin-bottom: 16px;
      }
    }

    ion-item {
      h2 {
        font-weight: 600;
      }

      p {
        display: flex;
        align-items: center;
        gap: 4px;
        color: var(--ion-color-medium);

        ion-icon {
          font-size: 14px;
        }
      }
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
export class ReleaseConfirmPage {
  protected readonly isLoading = signal(false);
  protected readonly items = signal<ReleaseItem[]>([]);
  protected readonly selectedCount = signal(0);

  constructor(
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {
    addIcons({
      checkmarkCircleOutline,
      cubeOutline,
      printOutline,
    });

    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    // TODO: Implement API call
    setTimeout(() => {
      this.isLoading.set(false);
    }, 500);
  }

  onSearch(event: CustomEvent): void {
    const query = event.detail.value || '';
    // TODO: Implement search
    console.log('Search:', query);
  }

  isAllSelected(): boolean {
    const allItems = this.items();
    return allItems.length > 0 && allItems.every(item => item.selected);
  }

  isIndeterminate(): boolean {
    const allItems = this.items();
    const selectedItems = allItems.filter(item => item.selected);
    return selectedItems.length > 0 && selectedItems.length < allItems.length;
  }

  toggleSelectAll(event: CustomEvent): void {
    const checked = event.detail.checked;
    this.items.update(items =>
      items.map(item => ({ ...item, selected: checked }))
    );
    this.updateSelectedCount();
  }

  onSelectionChange(): void {
    this.updateSelectedCount();
  }

  updateSelectedCount(): void {
    this.selectedCount.set(
      this.items().filter(item => item.selected).length
    );
  }

  printSummary(): void {
    // TODO: Implement print 출고요청집계표
    console.log('Print summary');
  }

  async confirmRelease(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: '출고 확정',
      message: `${this.selectedCount()}건을 출고 확정하시겠습니까?`,
      buttons: [
        { text: '취소', role: 'cancel' },
        {
          text: '확정',
          handler: async () => {
            // TODO: Implement confirm release API
            const toast = await this.toastCtrl.create({
              message: '출고 확정이 완료되었습니다.',
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
