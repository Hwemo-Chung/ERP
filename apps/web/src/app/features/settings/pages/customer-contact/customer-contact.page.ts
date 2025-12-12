import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
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
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonAlert,
  IonFab,
  IonFabButton,
  IonBadge,
  IonSearchbar,
  ToastController,
  AlertController,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, createOutline, trashOutline, closeOutline, checkmarkOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { CustomerContact, PaginatedResponse, CustomerContactFilter } from './customer-contact.models';

@Component({
  selector: 'app-customer-contact',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonList,
    IonItem,
    IonLabel,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonAlert,
    IonFab,
    IonFabButton,
    IonBadge,
    IonSearchbar,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/settings"></ion-back-button>
        </ion-buttons>
        <ion-title>고객사 연락처</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Search Bar -->
      <ion-searchbar
        [(ngModel)]="searchTerm"
        (ionInput)="onSearch()"
        placeholder="고객명 또는 담당자 검색..."
        class="search-bar"
      ></ion-searchbar>

      <!-- Filter Tabs -->
      <div class="filter-tabs">
        <button
          [class.active]="activeFilter === 'all'"
          (click)="activeFilter = 'all'; loadContacts()"
        >
          전체
        </button>
        <button
          [class.active]="activeFilter === 'receiver'"
          (click)="activeFilter = 'receiver'; loadContacts()"
        >
          수신처
        </button>
        <button
          [class.active]="activeFilter === 'pickup'"
          (click)="activeFilter = 'pickup'; loadContacts()"
        >
          픽업처
        </button>
        <button
          [class.active]="activeFilter === 'both'"
          (click)="activeFilter = 'both'; loadContacts()"
        >
          겸용
        </button>
      </div>

      <!-- Loading -->
      <div *ngIf="isLoading" class="loading-container">
        <ion-spinner></ion-spinner>
      </div>

      <!-- Contacts List -->
      <div *ngIf="!isLoading && contacts.length > 0" class="contacts-list">
        <div *ngFor="let contact of contacts" class="contact-card">
          <div class="contact-header">
            <div class="contact-info">
              <h3>{{ contact.customerName }}</h3>
              <p class="contact-person">담당자: {{ contact.contactName }}</p>
            </div>
            <ion-badge [color]="getBusinessTypeColor(contact.businessType)">
              {{ formatBusinessType(contact.businessType) }}
            </ion-badge>
          </div>
          <div class="contact-details">
            <div class="detail-row">
              <span class="label">부서</span>
              <span class="value">{{ contact.department }}</span>
            </div>
            <div class="detail-row">
              <span class="label">전화</span>
              <span class="value">{{ contact.phone }}</span>
            </div>
            <div class="detail-row">
              <span class="label">이메일</span>
              <span class="value">{{ contact.email }}</span>
            </div>
            <div class="detail-row">
              <span class="label">주소</span>
              <span class="value">{{ truncate(contact.address, 30) }}</span>
            </div>
          </div>
          <div class="contact-actions">
            <ion-button size="small" fill="outline" (click)="editContact(contact)">
              <ion-icon slot="start" name="create-outline"></ion-icon>
              수정
            </ion-button>
            <ion-button
              size="small"
              fill="outline"
              color="danger"
              (click)="deleteContact(contact.id)"
            >
              <ion-icon slot="start" name="trash-outline"></ion-icon>
              삭제
            </ion-button>
          </div>
        </div>

        <!-- Load More -->
        <div *ngIf="hasMore" class="load-more">
          <ion-button expand="block" fill="outline" (click)="loadMore()" [disabled]="isLoading">
            더보기
          </ion-button>
        </div>
      </div>

      <!-- Empty State -->
      <div *ngIf="!isLoading && contacts.length === 0" class="empty-state">
        <ion-icon name="person-outline"></ion-icon>
        <h3>연락처가 없습니다</h3>
        <p>새로운 고객사 연락처를 추가해주세요</p>
      </div>

      <!-- FAB to Add -->
      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button (click)="openAddModal()">
          <ion-icon name="add-outline"></ion-icon>
        </ion-fab-button>
      </ion-fab>

      <!-- Modal for Add/Edit -->
      <ion-modal
        #contactModal
        [isOpen]="showModal"
        (ionModalDidDismiss)="showModal = false"
      >
        <ng-template>
          <ion-header>
            <ion-toolbar>
              <ion-title>{{ isEditing ? '연락처 수정' : '연락처 추가' }}</ion-title>
              <ion-buttons slot="end">
                <ion-button (click)="closeModal()">
                  <ion-icon name="close-outline"></ion-icon>
                </ion-button>
              </ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content class="ion-padding">
            <form [formGroup]="contactForm" (ngSubmit)="saveContact()">
              <ion-item>
                <ion-label position="stacked">고객사명 *</ion-label>
                <ion-input
                  formControlName="customerName"
                  placeholder="고객사명"
                ></ion-input>
              </ion-item>

              <ion-item>
                <ion-label position="stacked">고객 코드</ion-label>
                <ion-input
                  formControlName="customerCode"
                  placeholder="고객 코드"
                  readonly
                ></ion-input>
              </ion-item>

              <ion-item>
                <ion-label position="stacked">담당자명 *</ion-label>
                <ion-input
                  formControlName="contactName"
                  placeholder="담당자명"
                ></ion-input>
              </ion-item>

              <ion-item>
                <ion-label position="stacked">부서</ion-label>
                <ion-input
                  formControlName="department"
                  placeholder="부서"
                ></ion-input>
              </ion-item>

              <ion-item>
                <ion-label position="stacked">전화 *</ion-label>
                <ion-input
                  formControlName="phone"
                  placeholder="010-1234-5678"
                ></ion-input>
              </ion-item>

              <ion-item>
                <ion-label position="stacked">이메일 *</ion-label>
                <ion-input
                  type="email"
                  formControlName="email"
                  placeholder="example@company.com"
                ></ion-input>
              </ion-item>

              <ion-item>
                <ion-label position="stacked">주소</ion-label>
                <ion-input
                  formControlName="address"
                  placeholder="주소"
                ></ion-input>
              </ion-item>

              <ion-item>
                <ion-label position="stacked">용도 *</ion-label>
                <ion-select formControlName="businessType">
                  <ion-select-option value="receiver">수신처</ion-select-option>
                  <ion-select-option value="pickup">픽업처</ion-select-option>
                  <ion-select-option value="both">겸용</ion-select-option>
                </ion-select>
              </ion-item>

              <ion-item>
                <ion-label position="stacked">메모</ion-label>
                <ion-input
                  formControlName="memo"
                  placeholder="메모"
                ></ion-input>
              </ion-item>

              <div class="modal-actions">
                <ion-button expand="block" (click)="closeModal()" fill="outline">
                  취소
                </ion-button>
                <ion-button
                  expand="block"
                  (click)="saveContact()"
                  [disabled]="!contactForm.valid || isSaving"
                >
                  <ion-spinner *ngIf="isSaving" slot="start"></ion-spinner>
                  저장
                </ion-button>
              </div>
            </form>
          </ion-content>
        </ng-template>
      </ion-modal>

      <!-- Error Alert -->
      <ion-alert
        *ngIf="errorMessage"
        [isOpen]="!!errorMessage"
        header="오류"
        [message]="errorMessage"
        [buttons]="[{ text: '확인', handler: () => errorMessage = null }]"
      ></ion-alert>
    </ion-content>
  `,
  styles: [`
    ion-searchbar {
      --background: #f1f5f9;
      --border-radius: 12px;
      --box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    }

    .filter-tabs {
      display: flex;
      gap: 8px;
      margin: 16px 0;
      overflow-x: auto;
    }

    .filter-tabs button {
      padding: 8px 16px;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      background: white;
      cursor: pointer;
      white-space: nowrap;
      font-size: 13px;
      transition: all 0.2s;
    }

    .filter-tabs button.active {
      background: #3b82f6;
      color: white;
      border-color: #3b82f6;
    }

    .loading-container {
      display: flex;
      justify-content: center;
      padding: 48px;
    }

    .contacts-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .contact-card {
      background: white;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      border-left: 4px solid #3b82f6;
    }

    .contact-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .contact-info h3 {
      margin: 0;
      font-size: 16px;
      color: #0f172a;
    }

    .contact-person {
      margin: 4px 0 0;
      font-size: 13px;
      color: #64748b;
    }

    ion-badge {
      font-size: 11px;
      padding: 4px 8px;
    }

    .contact-details {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 12px;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
    }

    .detail-row .label {
      color: #64748b;
      font-weight: 500;
    }

    .detail-row .value {
      color: #0f172a;
      text-align: right;
      flex: 1;
      margin-left: 12px;
    }

    .contact-actions {
      display: flex;
      gap: 8px;
    }

    .contact-actions ion-button {
      flex: 1;
    }

    .load-more {
      margin-top: 16px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 64px 24px;
      text-align: center;
      color: #94a3b8;
    }

    .empty-state ion-icon {
      font-size: 48px;
      color: #cbd5e1;
      margin-bottom: 16px;
    }

    .empty-state h3 {
      margin: 0;
      color: #475569;
      font-size: 18px;
    }

    .empty-state p {
      margin: 8px 0 0;
      font-size: 14px;
    }

    .modal-actions {
      display: flex;
      gap: 8px;
      margin-top: 24px;
    }

    .modal-actions ion-button {
      flex: 1;
    }
  `],
})
export class CustomerContactPage implements OnInit {
  contactForm!: FormGroup;
  contacts: CustomerContact[] = [];
  searchTerm = '';
  activeFilter: 'all' | 'receiver' | 'pickup' | 'both' = 'all';
  isLoading = false;
  isSaving = false;
  isEditing = false;
  showModal = false;
  hasMore = false;
  errorMessage: string | null = null;

  private page = 1;
  private apiUrl = `${environment.apiUrl}/settings/customer-contact`;

  constructor(
    private http: HttpClient,
    private fb: FormBuilder,
    private toastCtrl: ToastController
  ) {
    addIcons({ addOutline, createOutline, trashOutline, closeOutline, checkmarkOutline });
    this.initForm();
  }

  ngOnInit() {
    this.loadContacts();
  }

  private initForm() {
    this.contactForm = this.fb.group({
      customerCode: ['', Validators.required],
      customerName: ['', Validators.required],
      contactName: ['', Validators.required],
      department: [''],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9\-]{10,20}$/)]],
      email: ['', [Validators.required, Validators.email]],
      address: [''],
      businessType: ['both', Validators.required],
      memo: [''],
    });
  }

  async loadContacts() {
    this.isLoading = true;
    this.page = 1;
    try {
      const params = new URLSearchParams();
      if (this.searchTerm) params.set('search', this.searchTerm);
      if (this.activeFilter !== 'all') params.set('businessType', this.activeFilter);
      params.set('page', '1');
      params.set('limit', '20');

      const response = await firstValueFrom(
        this.http.get<PaginatedResponse<CustomerContact>>(
          `${this.apiUrl}?${params}`
        )
      );

      this.contacts = response.data;
      this.hasMore = response.hasMore;
    } catch (error: any) {
      this.errorMessage = error?.error?.message || '연락처를 로드할 수 없습니다.';
    } finally {
      this.isLoading = false;
    }
  }

  async loadMore() {
    this.isLoading = true;
    try {
      const params = new URLSearchParams();
      if (this.searchTerm) params.set('search', this.searchTerm);
      if (this.activeFilter !== 'all') params.set('businessType', this.activeFilter);
      params.set('page', (this.page + 1).toString());
      params.set('limit', '20');

      const response = await firstValueFrom(
        this.http.get<PaginatedResponse<CustomerContact>>(
          `${this.apiUrl}?${params}`
        )
      );

      this.contacts = [...this.contacts, ...response.data];
      this.page++;
      this.hasMore = response.hasMore;
    } catch (error: any) {
      this.errorMessage = error?.error?.message || '추가 로드 실패';
    } finally {
      this.isLoading = false;
    }
  }

  onSearch() {
    this.loadContacts();
  }

  openAddModal() {
    this.isEditing = false;
    this.initForm();
    this.showModal = true;
  }

  editContact(contact: CustomerContact) {
    this.isEditing = true;
    this.contactForm.patchValue(contact);
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  async saveContact() {
    if (!this.contactForm.valid) return;

    this.isSaving = true;
    try {
      const data = this.contactForm.value;
      const method = this.isEditing ? 'PUT' : 'POST';
      const url = this.isEditing
        ? `${this.apiUrl}/${data.id}`
        : this.apiUrl;

      await firstValueFrom(
        method === 'POST'
          ? this.http.post(url, data)
          : this.http.put(url, data)
      );

      const message = this.isEditing ? '연락처가 수정되었습니다.' : '연락처가 추가되었습니다.';
      const toast = await this.toastCtrl.create({
        message,
        duration: 2000,
        color: 'success',
      });
      await toast.present();

      this.closeModal();
      this.loadContacts();
    } catch (error: any) {
      this.errorMessage = error?.error?.message || '저장 실패';
    } finally {
      this.isSaving = false;
    }
  }

  async deleteContact(id: string) {
    const confirmed = confirm('정말 삭제하시겠습니까?');
    if (!confirmed) return;

    try {
      await firstValueFrom(this.http.delete(`${this.apiUrl}/${id}`));

      const toast = await this.toastCtrl.create({
        message: '연락처가 삭제되었습니다.',
        duration: 2000,
        color: 'success',
      });
      await toast.present();

      this.loadContacts();
    } catch (error: any) {
      this.errorMessage = error?.error?.message || '삭제 실패';
    }
  }

  formatBusinessType(type: string): string {
    const map: Record<string, string> = {
      receiver: '수신처',
      pickup: '픽업처',
      both: '겸용',
    };
    return map[type] || type;
  }

  getBusinessTypeColor(type: string): string {
    const map: Record<string, string> = {
      receiver: 'primary',
      pickup: 'warning',
      both: 'success',
    };
    return map[type] || 'medium';
  }

  truncate(text: string, length: number): string {
    return text && text.length > length ? text.substring(0, length) + '...' : text;
  }
}
