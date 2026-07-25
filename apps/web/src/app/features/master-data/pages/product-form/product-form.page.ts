// apps/web/src/app/features/master-data/pages/product-form/product-form.page.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonInput, IonSelect,
  IonSelectOption, IonButton, IonList, IonNote, IonBackButton, IonButtons,
} from '@ionic/angular/standalone';
import { MasterDataService, CategoryNode, PartnerRow } from '../../services/master-data.service';

interface FlatCategory { id: string; label: string; }

function flattenCategories(nodes: CategoryNode[], depth = 0): FlatCategory[] {
  return nodes.flatMap((n) => [
    { id: n.id, label: `${'　'.repeat(depth)}${n.name}` },
    ...flattenCategories(n.children ?? [], depth + 1),
  ]);
}

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonInput,
    IonSelect, IonSelectOption, IonButton, IonList, IonNote, IonBackButton, IonButtons],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-back-button defaultHref="/master-data/products" /></ion-buttons>
      <ion-title>품목 등록</ion-title>
    </ion-toolbar></ion-header>
    <ion-content class="ion-padding">
      <ion-list>
        <ion-item><ion-input label="품목명 *" [(ngModel)]="name" /></ion-item>
        <ion-item><ion-input label="품목코드 (비우면 자동채번)" [(ngModel)]="code" /></ion-item>
        <ion-item>
          <ion-select label="카테고리 *" [(ngModel)]="categoryId" interface="popover">
            @for (c of flatCategories(); track c.id) {
              <ion-select-option [value]="c.id">{{ c.label }}</ion-select-option>
            }
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-select label="거래처 *" [(ngModel)]="partnerId" interface="popover">
            @for (p of partners(); track p.id) {
              <ion-select-option [value]="p.id">{{ p.name }}</ion-select-option>
            }
          </ion-select>
        </ion-item>
        <ion-item><ion-input label="단가 *" type="number" [(ngModel)]="unitPrice" /></ion-item>
        <ion-item><ion-input label="원가 *" type="number" [(ngModel)]="costPrice" /></ion-item>
        <ion-item><ion-input label="건당 운송요율" type="number" [(ngModel)]="transportRate" /></ion-item>
        <ion-item>
          <ion-input label="파렛트당 최대 적재수" type="number" [(ngModel)]="maxUnitsPerPallet" />
        </ion-item>
        <ion-item>
          <ion-input label="파렛트 적재 기준(%)" type="number" placeholder="미입력 시 전역 70%" [(ngModel)]="palletThreshold" />
        </ion-item>
      </ion-list>
      @if (error()) { <ion-note color="danger">{{ error() }}</ion-note> }
      <ion-button expand="block" (click)="save()" [disabled]="saving()">저장</ion-button>
    </ion-content>
  `,
})
export class ProductFormPage implements OnInit {
  private api = inject(MasterDataService);
  private router = inject(Router);

  name = ''; code = ''; categoryId = ''; partnerId = '';
  unitPrice = ''; costPrice = ''; transportRate = '';
  maxUnitsPerPallet = ''; palletThreshold = '';

  flatCategories = signal<FlatCategory[]>([]);
  partners = signal<PartnerRow[]>([]);
  saving = signal(false);
  error = signal('');

  async ngOnInit() {
    const [tree, partnersRes] = await Promise.all([
      this.api.getCategoryTree(),
      this.api.getPartners({ page: 1 }),
    ]);
    this.flatCategories.set(flattenCategories(tree));
    this.partners.set(partnersRes.data);
  }

  async save() {
    this.error.set('');
    if (!this.name || !this.categoryId || !this.partnerId || !this.unitPrice || !this.costPrice) {
      this.error.set('필수 항목을 입력하세요.');
      return;
    }
    this.saving.set(true);
    try {
      await this.api.createProduct({
        name: this.name,
        ...(this.code ? { code: this.code } : {}),
        categoryId: this.categoryId,
        partnerId: this.partnerId,
        unitPrice: this.unitPrice,
        costPrice: this.costPrice,
        ...(this.transportRate ? { transportRate: this.transportRate } : {}),
        ...(this.maxUnitsPerPallet ? { maxUnitsPerPallet: Number(this.maxUnitsPerPallet) } : {}),
        ...(this.palletThreshold ? { palletThreshold: this.palletThreshold } : {}),
      } as any);
      this.router.navigate(['/master-data/products']);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? '저장 실패');
    } finally {
      this.saving.set(false);
    }
  }
}
