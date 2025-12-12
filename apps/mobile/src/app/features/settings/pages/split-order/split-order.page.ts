import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonList, IonItem, IonLabel, IonInput, IonButton, IonIcon, IonSpinner, ToastController, AlertController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { gitBranchOutline, addOutline, removeOutline, saveOutline } from 'ionicons/icons';

interface SplitItem { id: string; productName: string; totalQty: number; splits: { installerId: string; installerName: string; qty: number }[]; }

@Component({
  selector: 'app-split-order',
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonList, IonItem, IonLabel, IonInput, IonButton, IonIcon, IonSpinner],
  template: `
    <ion-header><ion-toolbar><ion-buttons slot="start"><ion-back-button></ion-back-button></ion-buttons><ion-title>분할 주문</ion-title></ion-toolbar></ion-header>
    <ion-content class="ion-padding">
      <ion-card><ion-card-header><ion-card-title><ion-icon name="git-branch-outline"></ion-icon> 주문 분할</ion-card-title></ion-card-header>
        <ion-card-content><p>주문번호: {{ orderId }}</p><p style="color:var(--ion-color-medium)">다중 제품 주문을 여러 설치기사에게 분할 배정합니다.</p></ion-card-content>
      </ion-card>
      @if (isLoading()) { <div style="text-align:center;padding:48px"><ion-spinner></ion-spinner></div> }
      @else {
        @for (item of items(); track item.id) {
          <ion-card>
            <ion-card-header><ion-card-title>{{ item.productName }}</ion-card-title></ion-card-header>
            <ion-card-content>
              <p>총 수량: {{ item.totalQty }}개</p>
              <ion-list>
                @for (split of item.splits; track split.installerId; let i = $index) {
                  <ion-item>
                    <ion-label>{{ split.installerName || '미지정' }}</ion-label>
                    <ion-input type="number" [(ngModel)]="split.qty" min="0" [max]="item.totalQty" style="max-width:80px" slot="end"></ion-input>
                  </ion-item>
                }
              </ion-list>
              <ion-button fill="clear" size="small" (click)="addSplit(item)"><ion-icon name="add-outline" slot="start"></ion-icon>분할 추가</ion-button>
            </ion-card-content>
          </ion-card>
        } @empty { <div style="text-align:center;padding:24px;color:var(--ion-color-medium)">분할 가능한 제품이 없습니다</div> }
        @if (items().length > 0) {
          <ion-button expand="block" (click)="saveSplit()"><ion-icon name="save-outline" slot="start"></ion-icon>분할 저장</ion-button>
        }
      }
    </ion-content>
  `,
})
export class SplitOrderPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);
  orderId = this.route.snapshot.paramMap.get('id') || '';
  isLoading = signal(false);
  items = signal<SplitItem[]>([]);
  constructor() { addIcons({ gitBranchOutline, addOutline, removeOutline, saveOutline }); }
  addSplit(item: SplitItem) { item.splits.push({ installerId: '', installerName: '', qty: 0 }); }
  async saveSplit() {
    const toast = await this.toastCtrl.create({ message: '분할이 저장되었습니다', duration: 2000, color: 'success' });
    await toast.present();
    this.router.navigate(['/tabs/orders']);
  }
}
