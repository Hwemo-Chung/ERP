// apps/web/src/app/features/assignment/pages/assignment-detail/assignment-detail.page.ts
import { Component, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonSpinner,
  IonNote,
  IonChip,
  IonGrid,
  IonRow,
  IonCol,
  ActionSheetController,
  AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  personOutline,
  calendarOutline,
  locationOutline,
  callOutline,
  cubeOutline,
  createOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  swapHorizontalOutline,
  printOutline,
} from 'ionicons/icons';

interface AssignmentDetail {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  appointmentDate: string;
  appointmentTime: string;
  installerName?: string;
  installerId?: string;
  branchCode: string;
  branchName: string;
  products: ProductItem[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface ProductItem {
  id: string;
  productCode: string;
  productName: string;
  quantity: number;
  serialNumber?: string;
}

@Component({
  selector: 'app-assignment-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
    IonSpinner,
    IonNote,
    IonChip,
    IonGrid,
    IonRow,
    IonCol,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/assignment"></ion-back-button>
        </ion-buttons>
        <ion-title>배정 상세</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="openActions()">
            <ion-icon name="create-outline"></ion-icon>
          </ion-button>
          <ion-button (click)="printDocument()">
            <ion-icon name="print-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (isLoading()) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
          <p>데이터 로딩 중...</p>
        </div>
      } @else if (assignment()) {
        <!-- Status Card -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>
              {{ assignment()!.orderNumber }}
              <ion-badge [color]="getStatusColor(assignment()!.status)">
                {{ assignment()!.status }}
              </ion-badge>
            </ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-grid>
              <ion-row>
                <ion-col size="6">
                  <div class="info-item">
                    <ion-icon name="calendar-outline"></ion-icon>
                    <div>
                      <ion-note>약속일시</ion-note>
                      <p>{{ assignment()!.appointmentDate }} {{ assignment()!.appointmentTime }}</p>
                    </div>
                  </div>
                </ion-col>
                <ion-col size="6">
                  <div class="info-item">
                    <ion-icon name="person-outline"></ion-icon>
                    <div>
                      <ion-note>설치기사</ion-note>
                      <p>{{ assignment()!.installerName || '미배정' }}</p>
                    </div>
                  </div>
                </ion-col>
              </ion-row>
            </ion-grid>
          </ion-card-content>
        </ion-card>

        <!-- Customer Info Card -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>고객 정보</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list lines="none">
              <ion-item>
                <ion-icon name="person-outline" slot="start"></ion-icon>
                <ion-label>
                  <ion-note>고객명</ion-note>
                  <p>{{ assignment()!.customerName }}</p>
                </ion-label>
              </ion-item>
              <ion-item>
                <ion-icon name="call-outline" slot="start"></ion-icon>
                <ion-label>
                  <ion-note>연락처</ion-note>
                  <p>{{ assignment()!.customerPhone }}</p>
                </ion-label>
                <ion-button slot="end" fill="clear" (click)="callCustomer()">
                  전화
                </ion-button>
              </ion-item>
              <ion-item>
                <ion-icon name="location-outline" slot="start"></ion-icon>
                <ion-label>
                  <ion-note>주소</ion-note>
                  <p>{{ assignment()!.customerAddress }}</p>
                </ion-label>
              </ion-item>
            </ion-list>
          </ion-card-content>
        </ion-card>

        <!-- Products Card -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>제품 목록</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list>
              @for (product of assignment()!.products; track product.id) {
                <ion-item>
                  <ion-icon name="cube-outline" slot="start"></ion-icon>
                  <ion-label>
                    <h3>{{ product.productName }}</h3>
                    <p>{{ product.productCode }} × {{ product.quantity }}</p>
                    @if (product.serialNumber) {
                      <p class="serial">S/N: {{ product.serialNumber }}</p>
                    }
                  </ion-label>
                </ion-item>
              }
            </ion-list>
          </ion-card-content>
        </ion-card>

        <!-- Notes Card -->
        @if (assignment()!.notes) {
          <ion-card>
            <ion-card-header>
              <ion-card-title>특이사항</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <p>{{ assignment()!.notes }}</p>
            </ion-card-content>
          </ion-card>
        }

        <!-- Action Buttons -->
        <div class="action-buttons">
          @if (assignment()!.status === '미배정') {
            <ion-button expand="block" (click)="assignInstaller()">
              <ion-icon name="person-outline" slot="start"></ion-icon>
              설치기사 배정
            </ion-button>
          }
          @if (assignment()!.status === '배정') {
            <ion-button expand="block" color="success" (click)="confirmAssignment()">
              <ion-icon name="checkmark-circle-outline" slot="start"></ion-icon>
              배정 확정
            </ion-button>
            <ion-button expand="block" color="warning" (click)="changeInstaller()">
              <ion-icon name="swap-horizontal-outline" slot="start"></ion-icon>
              기사 변경
            </ion-button>
          }
          @if (assignment()!.status === '배정확정') {
            <ion-button expand="block" color="primary" (click)="confirmRelease()">
              <ion-icon name="checkmark-circle-outline" slot="start"></ion-icon>
              출고 확정
            </ion-button>
          }
          <ion-button expand="block" color="medium" (click)="changeAppointment()">
            <ion-icon name="calendar-outline" slot="start"></ion-icon>
            약속일 변경
          </ion-button>
          <ion-button expand="block" color="danger" fill="outline" (click)="cancelAssignment()">
            <ion-icon name="close-circle-outline" slot="start"></ion-icon>
            취소
          </ion-button>
        </div>
      } @else {
        <div class="empty-state">
          <p>배정 정보를 찾을 수 없습니다.</p>
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 50vh;
      color: var(--ion-color-medium);
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 16px;
      color: var(--ion-color-medium);
    }

    .info-item {
      display: flex;
      gap: 8px;
      align-items: flex-start;

      ion-icon {
        font-size: 20px;
        color: var(--ion-color-primary);
        margin-top: 2px;
      }

      ion-note {
        font-size: 12px;
      }

      p {
        margin: 4px 0 0;
        font-weight: 500;
      }
    }

    ion-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .serial {
      font-family: monospace;
      font-size: 12px;
      color: var(--ion-color-medium);
    }

    .action-buttons {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 16px;
    }
  `],
})
export class AssignmentDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly alertCtrl = inject(AlertController);

  protected readonly isLoading = signal(false);
  protected readonly assignment = signal<AssignmentDetail | null>(null);

  constructor() {
    addIcons({
      personOutline,
      calendarOutline,
      locationOutline,
      callOutline,
      cubeOutline,
      createOutline,
      checkmarkCircleOutline,
      closeCircleOutline,
      swapHorizontalOutline,
      printOutline,
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadAssignment(id);
    }
  }

  loadAssignment(id: string): void {
    this.isLoading.set(true);
    // TODO: Implement API call
    setTimeout(() => {
      this.isLoading.set(false);
      // Mock data - will be replaced with actual API
      this.assignment.set(null);
    }, 500);
  }

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      '미배정': 'danger',
      '배정': 'warning',
      '배정확정': 'success',
      '출고확정': 'primary',
    };
    return colors[status] || 'medium';
  }

  async openActions(): Promise<void> {
    const actionSheet = await this.actionSheetCtrl.create({
      header: '작업 선택',
      buttons: [
        { text: '약속일 변경', handler: () => this.changeAppointment() },
        { text: '기사 변경', handler: () => this.changeInstaller() },
        { text: '특이사항 추가', handler: () => this.addNote() },
        { text: '취소', role: 'cancel' },
      ],
    });
    await actionSheet.present();
  }

  printDocument(): void {
    // TODO: Implement print functionality
    console.log('Print document');
  }

  callCustomer(): void {
    const phone = this.assignment()?.customerPhone;
    if (phone) {
      window.open(`tel:${phone}`, '_system');
    }
  }

  assignInstaller(): void {
    // TODO: Open installer selection modal
    console.log('Assign installer');
  }

  confirmAssignment(): void {
    // TODO: Confirm assignment
    console.log('Confirm assignment');
  }

  changeInstaller(): void {
    // TODO: Open installer change modal
    console.log('Change installer');
  }

  confirmRelease(): void {
    // TODO: Confirm release
    console.log('Confirm release');
  }

  changeAppointment(): void {
    // TODO: Open appointment change modal
    console.log('Change appointment');
  }

  addNote(): void {
    // TODO: Open note modal
    console.log('Add note');
  }

  async cancelAssignment(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: '취소 확인',
      message: '정말로 이 배정을 취소하시겠습니까?',
      buttons: [
        { text: '아니오', role: 'cancel' },
        {
          text: '예, 취소합니다',
          role: 'destructive',
          handler: () => {
            // TODO: Implement cancel
            console.log('Cancel assignment');
          },
        },
      ],
    });
    await alert.present();
  }
}
