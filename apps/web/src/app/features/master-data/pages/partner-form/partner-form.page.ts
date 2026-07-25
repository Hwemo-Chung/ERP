// apps/web/src/app/features/master-data/pages/partner-form/partner-form.page.ts
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonInput, IonSelect,
  IonSelectOption, IonButton, IonList, IonNote, IonBackButton, IonButtons,
} from '@ionic/angular/standalone';
import { MasterDataService, StorageContractRow } from '../../services/master-data.service';

@Component({
  selector: 'app-partner-form',
  standalone: true,
  imports: [FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonInput,
    IonSelect, IonSelectOption, IonButton, IonList, IonNote, IonBackButton, IonButtons],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-back-button defaultHref="/master-data/partners" /></ion-buttons>
      <ion-title>거래처 등록</ion-title>
    </ion-toolbar></ion-header>
    <ion-content class="ion-padding">
      <ion-list>
        <ion-item><ion-input label="거래처명 *" [(ngModel)]="name" /></ion-item>
        <ion-item><ion-input label="거래처코드 (비우면 자동채번)" [(ngModel)]="code" /></ion-item>
        <ion-item>
          <ion-input label="사업자등록번호" placeholder="000-00-00000" [(ngModel)]="brn" />
        </ion-item>
        <ion-item><ion-input label="대표자" [(ngModel)]="representativeName" /></ion-item>
        <ion-item><ion-input label="업태" [(ngModel)]="businessType" /></ion-item>
        <ion-item><ion-input label="종목" [(ngModel)]="businessCategory" /></ion-item>
        <ion-item><ion-input label="주소" [(ngModel)]="address" /></ion-item>
        <ion-item><ion-input label="담당자" [(ngModel)]="contactName" /></ion-item>
        <ion-item><ion-input label="연락처" [(ngModel)]="phone" /></ion-item>
        <ion-item><ion-input label="건당 기본 운송요율" type="number" [(ngModel)]="defaultTransportRate" /></ion-item>

        <ion-item>
          <ion-select label="보관료 방식 *" [(ngModel)]="contractType" interface="popover">
            <ion-select-option value="PALLET_DAILY">파렛트 × 일수 단가</ion-select-option>
            <ion-select-option value="AREA_MONTHLY">면적 월임대</ion-select-option>
            <ion-select-option value="AREA_YEARLY">면적 년임대</ion-select-option>
          </ion-select>
        </ion-item>
        @if (contractType === 'PALLET_DAILY') {
          <ion-item><ion-input label="파렛트 1일당 단가 *" type="number" [(ngModel)]="palletDailyRate" /></ion-item>
        } @else {
          <ion-item><ion-input label="계약 면적(평) *" type="number" [(ngModel)]="areaPyeong" /></ion-item>
          <ion-item><ion-input label="평당 단가 *" type="number" [(ngModel)]="areaRate" /></ion-item>
        }
        <ion-item><ion-input label="계약 시작일 *" type="date" [(ngModel)]="startDate" /></ion-item>
      </ion-list>
      @if (error()) { <ion-note color="danger">{{ error() }}</ion-note> }
      <ion-button expand="block" (click)="save()" [disabled]="saving()">저장</ion-button>
    </ion-content>
  `,
})
export class PartnerFormPage {
  private api = inject(MasterDataService);
  private router = inject(Router);

  name = ''; code = ''; brn = ''; representativeName = ''; businessType = '';
  businessCategory = ''; address = ''; contactName = ''; phone = '';
  defaultTransportRate = '';
  contractType: StorageContractRow['contractType'] = 'PALLET_DAILY';
  palletDailyRate = ''; areaPyeong = ''; areaRate = ''; startDate = '';

  saving = signal(false);
  error = signal('');

  async save() {
    this.error.set('');
    if (!this.name || !this.startDate) { this.error.set('필수 항목을 입력하세요.'); return; }
    if (this.contractType === 'PALLET_DAILY' && !this.palletDailyRate) { this.error.set('파렛트 단가는 필수입니다.'); return; }
    if (this.contractType !== 'PALLET_DAILY' && (!this.areaPyeong || !this.areaRate)) { this.error.set('면적과 단가는 필수입니다.'); return; }
    this.saving.set(true);
    try {
      await this.api.createPartner({
        name: this.name,
        ...(this.code ? { code: this.code } : {}),
        ...(this.brn ? { businessRegistrationNo: this.brn } : {}),
        representativeName: this.representativeName, businessType: this.businessType,
        businessCategory: this.businessCategory, address: this.address,
        contactName: this.contactName, phone: this.phone,
        ...(this.defaultTransportRate ? { defaultTransportRate: this.defaultTransportRate } : {}),
        storageContract: {
          contractType: this.contractType,
          ...(this.contractType === 'PALLET_DAILY'
            ? { palletDailyRate: this.palletDailyRate }
            : { areaPyeong: this.areaPyeong, areaRate: this.areaRate }),
          startDate: this.startDate,
        },
      } as any);
      this.router.navigate(['/master-data/partners']);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? '저장 실패');
    } finally {
      this.saving.set(false);
    }
  }
}
