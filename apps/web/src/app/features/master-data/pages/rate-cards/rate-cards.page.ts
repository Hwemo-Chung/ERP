// apps/web/src/app/features/master-data/pages/rate-cards/rate-cards.page.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonInput,
  IonButton, IonNote, IonBackButton, IonButtons, IonIcon, AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { createOutline, closeCircleOutline } from 'ionicons/icons';
import { MasterDataService, RateCardRow } from '../../services/master-data.service';

@Component({
  selector: 'app-rate-cards',
  standalone: true,
  imports: [FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem,
    IonLabel, IonInput, IonButton, IonNote, IonBackButton, IonButtons, IonIcon],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-back-button defaultHref="/tabs" /></ion-buttons>
      <ion-title>운송 단가표</ion-title>
    </ion-toolbar></ion-header>
    <ion-content class="ion-padding">
      <ion-list>
        <ion-item>
          <ion-input label="전역 파렛트 적재 기준(%)" type="number" [(ngModel)]="palletThreshold" />
          <ion-button slot="end" fill="clear" [disabled]="savingThreshold()" (click)="savePalletThreshold()">저장</ion-button>
        </ion-item>
      </ion-list>

      <ion-list>
        @for (r of rateCards(); track r.id) {
          @if (editingId() === r.id) {
            <ion-item><ion-input label="차량유형" [(ngModel)]="editVehicleType" /></ion-item>
            <ion-item><ion-input label="톤수" [(ngModel)]="editTonnage" /></ion-item>
            <ion-item><ion-input label="컨테이너 규격" [(ngModel)]="editContainerSize" /></ion-item>
            <ion-item><ion-input label="특장 사양" [(ngModel)]="editSpecialEquipment" /></ion-item>
            <ion-item><ion-input label="단가" type="number" [(ngModel)]="editRate" /></ion-item>
            <ion-item>
              <ion-button fill="clear" (click)="saveEdit(r.id)">저장</ion-button>
              <ion-button fill="clear" color="medium" (click)="editingId.set(null)">취소</ion-button>
            </ion-item>
          } @else {
            <ion-item>
              <ion-label>
                <h2>{{ r.vehicleType }} {{ r.tonnage ? '(' + r.tonnage + 't)' : '' }}</h2>
                <p>{{ r.containerSize || '-' }} / {{ r.specialEquipment || '-' }} / 단가: {{ r.rate }}</p>
              </ion-label>
              <ion-button fill="clear" size="small" (click)="startEdit(r)">
                <ion-icon slot="icon-only" name="create-outline" />
              </ion-button>
              <ion-button fill="clear" size="small" color="danger" (click)="deactivate(r.id)">
                <ion-icon slot="icon-only" name="close-circle-outline" />
              </ion-button>
            </ion-item>
          }
        } @empty {
          <ion-item><ion-label>등록된 단가표가 없습니다.</ion-label></ion-item>
        }
      </ion-list>

      <ion-list>
        <ion-item><ion-input label="차량유형 *" [(ngModel)]="vehicleType" /></ion-item>
        <ion-item><ion-input label="톤수" [(ngModel)]="tonnage" /></ion-item>
        <ion-item><ion-input label="컨테이너 규격" [(ngModel)]="containerSize" /></ion-item>
        <ion-item><ion-input label="특장 사양" [(ngModel)]="specialEquipment" /></ion-item>
        <ion-item><ion-input label="단가 *" type="number" [(ngModel)]="rate" /></ion-item>
      </ion-list>
      @if (error()) { <ion-note color="danger">{{ error() }}</ion-note> }
      <ion-button expand="block" (click)="save()" [disabled]="saving()">추가</ion-button>
    </ion-content>
  `,
})
export class RateCardsPage implements OnInit {
  private api = inject(MasterDataService);
  private alertCtrl = inject(AlertController);

  rateCards = signal<RateCardRow[]>([]);
  saving = signal(false);
  error = signal('');

  vehicleType = ''; tonnage = ''; containerSize = ''; specialEquipment = ''; rate = '';

  editingId = signal<string | null>(null);
  editVehicleType = ''; editTonnage = ''; editContainerSize = ''; editSpecialEquipment = ''; editRate = '';

  palletThreshold = '';
  savingThreshold = signal(false);

  constructor() {
    addIcons({ createOutline, closeCircleOutline });
  }

  async ngOnInit() {
    await Promise.all([this.load(), this.loadPalletThreshold()]);
  }

  async load() {
    this.rateCards.set(await this.api.getRateCards());
  }

  async loadPalletThreshold() {
    const res = await this.api.getPalletThreshold();
    this.palletThreshold = String(res.value);
  }

  async savePalletThreshold() {
    if (!this.palletThreshold) return;
    this.savingThreshold.set(true);
    try {
      await this.api.setPalletThreshold(Number(this.palletThreshold));
    } finally {
      this.savingThreshold.set(false);
    }
  }

  startEdit(r: RateCardRow) {
    this.editingId.set(r.id);
    this.editVehicleType = r.vehicleType;
    this.editTonnage = r.tonnage ?? '';
    this.editContainerSize = r.containerSize ?? '';
    this.editSpecialEquipment = r.specialEquipment ?? '';
    this.editRate = r.rate;
  }

  async saveEdit(id: string) {
    await this.api.updateRateCard(id, {
      vehicleType: this.editVehicleType,
      tonnage: this.editTonnage || undefined,
      containerSize: this.editContainerSize || undefined,
      specialEquipment: this.editSpecialEquipment || undefined,
      rate: this.editRate,
    });
    this.editingId.set(null);
    await this.load();
  }

  async deactivate(id: string) {
    const alert = await this.alertCtrl.create({
      header: '단가표 비활성화',
      message: '이 단가표를 비활성화하시겠습니까?',
      buttons: [
        { text: '취소', role: 'cancel' },
        {
          text: '비활성화',
          role: 'destructive',
          handler: async () => {
            await this.api.deactivateRateCard(id);
            await this.load();
          },
        },
      ],
    });
    await alert.present();
  }

  async save() {
    this.error.set('');
    if (!this.vehicleType || !this.rate) { this.error.set('필수 항목을 입력하세요.'); return; }
    this.saving.set(true);
    try {
      await this.api.createRateCard({
        vehicleType: this.vehicleType,
        ...(this.tonnage ? { tonnage: this.tonnage } : {}),
        ...(this.containerSize ? { containerSize: this.containerSize } : {}),
        ...(this.specialEquipment ? { specialEquipment: this.specialEquipment } : {}),
        rate: this.rate,
      });
      this.vehicleType = ''; this.tonnage = ''; this.containerSize = '';
      this.specialEquipment = ''; this.rate = '';
      await this.load();
    } catch (e: any) {
      this.error.set(e?.error?.message ?? '저장 실패');
    } finally {
      this.saving.set(false);
    }
  }
}
