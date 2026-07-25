// apps/web/src/app/features/master-data/pages/rate-cards/rate-cards.page.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonInput,
  IonButton, IonNote, IonBackButton, IonButtons,
} from '@ionic/angular/standalone';
import { MasterDataService, RateCardRow } from '../../services/master-data.service';

@Component({
  selector: 'app-rate-cards',
  standalone: true,
  imports: [FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem,
    IonLabel, IonInput, IonButton, IonNote, IonBackButton, IonButtons],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-back-button defaultHref="/tabs" /></ion-buttons>
      <ion-title>운송 단가표</ion-title>
    </ion-toolbar></ion-header>
    <ion-content class="ion-padding">
      <ion-list>
        @for (r of rateCards(); track r.id) {
          <ion-item>
            <ion-label>
              <h2>{{ r.vehicleType }} {{ r.tonnage ? '(' + r.tonnage + 't)' : '' }}</h2>
              <p>{{ r.containerSize || '-' }} / {{ r.specialEquipment || '-' }} / 단가: {{ r.rate }}</p>
            </ion-label>
          </ion-item>
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

  rateCards = signal<RateCardRow[]>([]);
  saving = signal(false);
  error = signal('');

  vehicleType = ''; tonnage = ''; containerSize = ''; specialEquipment = ''; rate = '';

  ngOnInit() {
    this.load();
  }

  async load() {
    this.rateCards.set(await this.api.getRateCards());
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
