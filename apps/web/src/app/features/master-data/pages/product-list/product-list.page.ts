// apps/web/src/app/features/master-data/pages/product-list/product-list.page.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonSearchbar, IonSelect, IonSelectOption,
  IonList, IonItem, IonLabel, IonNote, IonFab, IonFabButton, IonIcon, IonBackButton, IonButtons,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline } from 'ionicons/icons';
import { MasterDataService, ProductRow, PartnerRow } from '../../services/master-data.service';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [FormsModule, RouterLink, IonHeader, IonToolbar, IonTitle, IonContent, IonSearchbar,
    IonSelect, IonSelectOption, IonList, IonItem, IonLabel, IonNote, IonFab, IonFabButton,
    IonIcon, IonBackButton, IonButtons],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-back-button defaultHref="/tabs" /></ion-buttons>
      <ion-title>품목 관리</ion-title>
    </ion-toolbar></ion-header>
    <ion-content>
      <ion-searchbar [(ngModel)]="search" (ionInput)="load()" placeholder="품목명/코드 검색" />
      <ion-item>
        <ion-select label="거래처 필터" [(ngModel)]="partnerId" (ionChange)="load()" interface="popover">
          <ion-select-option [value]="undefined">전체</ion-select-option>
          @for (p of partners(); track p.id) {
            <ion-select-option [value]="p.id">{{ p.name }}</ion-select-option>
          }
        </ion-select>
      </ion-item>
      <ion-list>
        @for (item of products(); track item.id) {
          <ion-item>
            <ion-label>
              <h2>{{ item.name }} <ion-note>{{ item.code }}</ion-note></h2>
              <p>단가: {{ item.unitPrice }} / 원가: {{ item.costPrice }}</p>
            </ion-label>
          </ion-item>
        } @empty {
          <ion-item><ion-label>등록된 품목이 없습니다.</ion-label></ion-item>
        }
      </ion-list>
      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button routerLink="/master-data/products/new" color="primary">
          <ion-icon name="add-outline" />
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  `,
})
export class ProductListPage implements OnInit {
  private api = inject(MasterDataService);

  search = '';
  partnerId?: string;
  products = signal<ProductRow[]>([]);
  partners = signal<PartnerRow[]>([]);

  constructor() {
    addIcons({ addOutline });
  }

  async ngOnInit() {
    const res = await this.api.getPartners({ page: 1 });
    this.partners.set(res.data);
    await this.load();
  }

  async load() {
    const res = await this.api.getProducts({
      search: this.search || undefined,
      partnerId: this.partnerId || undefined,
      page: 1,
    });
    this.products.set(res.data);
  }
}
