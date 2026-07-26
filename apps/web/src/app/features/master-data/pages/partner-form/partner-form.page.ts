// apps/web/src/app/features/master-data/pages/partner-form/partner-form.page.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonInput, IonSelect,
  IonSelectOption, IonButton, IonList, IonLabel, IonNote, IonBackButton, IonButtons,
} from '@ionic/angular/standalone';
import { MasterDataService, PartnerRow, StorageContractRow, RateHistoryRow } from '../../services/master-data.service';

@Component({
  selector: 'app-partner-form',
  standalone: true,
  imports: [FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonInput,
    IonSelect, IonSelectOption, IonButton, IonList, IonLabel, IonNote, IonBackButton, IonButtons],
  template: `
    <ion-header><ion-toolbar>
      <ion-buttons slot="start"><ion-back-button defaultHref="/master-data/partners" /></ion-buttons>
      <ion-title>{{ editingId ? '거래처 수정' : '거래처 등록' }}</ion-title>
    </ion-toolbar></ion-header>
    <ion-content class="ion-padding">
      @if (editingId && !loaded()) {
        <ion-note>{{ error() || '불러오는 중...' }}</ion-note>
      } @else {
        <ion-list>
          <ion-item><ion-input label="거래처명 *" [(ngModel)]="name" /></ion-item>
          @if (editingId) {
            <ion-item><ion-note>거래처코드: {{ code || '-' }} (수정 불가)</ion-note></ion-item>
          } @else {
            <ion-item><ion-input label="거래처코드 (비우면 자동채번)" [(ngModel)]="code" /></ion-item>
          }
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
          <ion-item><ion-input label="적용 시작일" type="date" [(ngModel)]="rateEffectiveFrom" /></ion-item>

          @if (!editingId) {
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
              <ion-item>
                <ion-select label="청구 방식" [(ngModel)]="areaBillingMode" interface="popover">
                  <ion-select-option value="FULL_MONTH">월할 고정</ion-select-option>
                  <ion-select-option value="DAILY_PRORATED">일할 계산</ion-select-option>
                </ion-select>
              </ion-item>
            }
            <ion-item><ion-input label="계약 시작일 *" type="date" [(ngModel)]="startDate" /></ion-item>
          } @else {
            <ion-note class="ion-padding-start">보관계약은 이 화면에서 변경할 수 없습니다.</ion-note>
          }
        </ion-list>
        @if (editingId && rateHistory().length > 0) {
          <ion-list>
            <ion-item lines="none"><ion-label><h3>기본 운송요율 이력</h3></ion-label></ion-item>
            @for (h of rateHistory(); track h.id) {
              <ion-item lines="none">
                <ion-label>{{ h.effectiveFrom }} ~ {{ h.effectiveTo || '현재' }} : {{ h.rate }}</ion-label>
              </ion-item>
            }
          </ion-list>
        }
        @if (error()) { <ion-note color="danger">{{ error() }}</ion-note> }
        <ion-button expand="block" (click)="save()" [disabled]="saving()">저장</ion-button>
      }
    </ion-content>
  `,
})
export class PartnerFormPage implements OnInit {
  private api = inject(MasterDataService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);

  editingId = this.route.snapshot.paramMap.get('id');
  loaded = signal(false);

  name = ''; code = ''; brn = ''; representativeName = ''; businessType = '';
  businessCategory = ''; address = ''; contactName = ''; phone = '';
  defaultTransportRate = ''; rateEffectiveFrom = '';
  contractType: StorageContractRow['contractType'] = 'PALLET_DAILY';
  palletDailyRate = ''; areaPyeong = ''; areaRate = ''; startDate = '';
  areaBillingMode: NonNullable<StorageContractRow['areaBillingMode']> = 'FULL_MONTH';

  rateHistory = signal<RateHistoryRow[]>([]);
  saving = signal(false);
  error = signal('');

  async ngOnInit() {
    if (!this.editingId) return;
    // ponytail: no GET /master-data/partners/:id endpoint exists yet — the list page
    // passes the full row via router state. Direct URL access / page reload has no
    // fallback fetch (would need a list scan with no id filter in GetPartnersDto);
    // surface an error and let the admin go back to the list instead of faking data.
    const partner = (this.location.getState() as { partner?: PartnerRow } | null)?.partner;
    if (!partner) {
      this.error.set('거래처 정보를 불러올 수 없습니다. 목록에서 다시 선택해주세요.');
      return;
    }
    this.name = partner.name;
    this.code = partner.code;
    this.brn = partner.businessRegistrationNo ?? '';
    this.representativeName = partner.representativeName ?? '';
    this.businessType = partner.businessType ?? '';
    this.businessCategory = partner.businessCategory ?? '';
    this.address = partner.address ?? '';
    this.contactName = partner.contactName ?? '';
    this.phone = partner.phone ?? '';
    this.defaultTransportRate = partner.defaultTransportRate ?? '';
    this.loaded.set(true);
    this.rateHistory.set(await this.api.getPartnerRateHistory(this.editingId));
  }

  async save() {
    this.error.set('');
    if (!this.name) { this.error.set('필수 항목을 입력하세요.'); return; }
    if (!this.editingId) {
      if (!this.startDate) { this.error.set('필수 항목을 입력하세요.'); return; }
      if (this.contractType === 'PALLET_DAILY' && !this.palletDailyRate) { this.error.set('파렛트 단가는 필수입니다.'); return; }
      if (this.contractType !== 'PALLET_DAILY' && (!this.areaPyeong || !this.areaRate)) { this.error.set('면적과 단가는 필수입니다.'); return; }
    }
    this.saving.set(true);
    try {
      if (this.editingId) {
        await this.api.updatePartner(this.editingId, {
          name: this.name,
          businessRegistrationNo: this.brn || undefined,
          representativeName: this.representativeName,
          businessType: this.businessType,
          businessCategory: this.businessCategory,
          address: this.address,
          contactName: this.contactName,
          phone: this.phone,
          defaultTransportRate: this.defaultTransportRate || undefined,
          ...(this.rateEffectiveFrom ? { rateEffectiveFrom: this.rateEffectiveFrom } : {}),
        });
      } else {
        await this.api.createPartner({
          name: this.name,
          ...(this.code ? { code: this.code } : {}),
          ...(this.brn ? { businessRegistrationNo: this.brn } : {}),
          representativeName: this.representativeName, businessType: this.businessType,
          businessCategory: this.businessCategory, address: this.address,
          contactName: this.contactName, phone: this.phone,
          ...(this.defaultTransportRate ? { defaultTransportRate: this.defaultTransportRate } : {}),
          ...(this.rateEffectiveFrom ? { rateEffectiveFrom: this.rateEffectiveFrom } : {}),
          storageContract: {
            contractType: this.contractType,
            ...(this.contractType === 'PALLET_DAILY'
              ? { palletDailyRate: this.palletDailyRate }
              : { areaPyeong: this.areaPyeong, areaRate: this.areaRate, areaBillingMode: this.areaBillingMode }),
            startDate: this.startDate,
          },
        } as any);
      }
      this.router.navigate(['/master-data/partners']);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? '저장 실패');
    } finally {
      this.saving.set(false);
    }
  }
}
