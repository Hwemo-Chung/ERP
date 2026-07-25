// apps/web/src/app/features/master-data/pages/partner-list/partner-list.page.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonSearchbar, IonList, IonItem,
  IonLabel, IonNote, IonFab, IonFabButton, IonIcon, IonBackButton, IonButtons,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline } from 'ionicons/icons';
import { MasterDataService, PartnerRow } from '../../services/master-data.service';

@Component({
  selector: 'app-partner-list',
  standalone: true,
  imports: [FormsModule, RouterLink, IonHeader, IonToolbar, IonTitle, IonContent, IonSearchbar, IonList,
    IonItem, IonLabel, IonNote, IonFab, IonFabButton, IonIcon, IonBackButton, IonButtons],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-back-button defaultHref="/tabs" /></ion-buttons>
      <ion-title>거래처 관리</ion-title>
    </ion-toolbar></ion-header>
    <ion-content>
      <ion-searchbar [(ngModel)]="search" (ionInput)="load()" placeholder="거래처명/코드 검색" />
      <ion-list>
        @for (p of partners(); track p.id) {
          <ion-item button (click)="selected.set(selected() === p.id ? null : p.id)">
            <ion-label>
              <h2>{{ p.name }} <ion-note>{{ p.code }}</ion-note></h2>
              @if (selected() === p.id) {
                <p>사업자번호: {{ p.businessRegistrationNo || '-' }}</p>
                <p>담당자: {{ p.contactName || '-' }} / {{ p.phone || '-' }}</p>
                <p>주소: {{ p.address || '-' }}</p>
              }
            </ion-label>
          </ion-item>
        } @empty {
          <ion-item><ion-label>등록된 거래처가 없습니다.</ion-label></ion-item>
        }
      </ion-list>
      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button routerLink="/master-data/partners/new" color="primary">
          <ion-icon name="add-outline" />
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  `,
})
export class PartnerListPage implements OnInit {
  private api = inject(MasterDataService);

  search = '';
  partners = signal<PartnerRow[]>([]);
  selected = signal<string | null>(null);

  constructor() {
    addIcons({ addOutline });
  }

  ngOnInit() {
    this.load();
  }

  async load() {
    const res = await this.api.getPartners({ search: this.search || undefined, page: 1 });
    this.partners.set(res.data);
  }
}
