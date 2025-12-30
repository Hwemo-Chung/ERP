import { Component, OnInit, inject } from '@angular/core';
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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
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
    TranslateModule,
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
        <ion-title>{{ 'SETTINGS.CUSTOMER_CONTACT.TITLE' | translate }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Search Bar -->
      <ion-searchbar
        [(ngModel)]="searchTerm"
        (ionInput)="onSearch()"
        [placeholder]="'SETTINGS.CUSTOMER_CONTACT.SEARCH_PLACEHOLDER' | translate"
        class="search-bar"
      ></ion-searchbar>

      <!-- Filter Tabs -->
      <div class="filter-tabs">
        <button
          [class.active]="activeFilter === 'all'"
          (click)="activeFilter = 'all'; loadContacts()"
        >
          {{ 'SETTINGS.CUSTOMER_CONTACT.FILTER.ALL' | translate }}
        </button>
        <button
          [class.active]="activeFilter === 'receiver'"
          (click)="activeFilter = 'receiver'; loadContacts()"
        >
          {{ 'SETTINGS.CUSTOMER_CONTACT.TYPE.RECEIVER' | translate }}
        </button>
        <button
          [class.active]="activeFilter === 'pickup'"
          (click)="activeFilter = 'pickup'; loadContacts()"
        >
          {{ 'SETTINGS.CUSTOMER_CONTACT.TYPE.PICKUP' | translate }}
        </button>
        <button
          [class.active]="activeFilter === 'both'"
          (click)="activeFilter = 'both'; loadContacts()"
        >
          {{ 'SETTINGS.CUSTOMER_CONTACT.TYPE.BOTH' | translate }}
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
              <p class="contact-person">{{ 'SETTINGS.CUSTOMER_CONTACT.CONTACT_PERSON' | translate }}: {{ contact.contactName }}</p>
            </div>
            <ion-badge [color]="getBusinessTypeColor(contact.businessType)">
              {{ formatBusinessType(contact.businessType) }}
            </ion-badge>
          </div>
          <div class="contact-details">
            <div class="detail-row">
              <span class="label">{{ 'SETTINGS.CUSTOMER_CONTACT.FIELD.DEPARTMENT' | translate }}</span>
              <span class="value">{{ contact.department }}</span>
            </div>
            <div class="detail-row">
              <span class="label">{{ 'SETTINGS.CUSTOMER_CONTACT.FIELD.PHONE' | translate }}</span>
              <span class="value">{{ contact.phone }}</span>
            </div>
            <div class="detail-row">
              <span class="label">{{ 'SETTINGS.CUSTOMER_CONTACT.FIELD.EMAIL' | translate }}</span>
              <span class="value">{{ contact.email }}</span>
            </div>
            <div class="detail-row">
              <span class="label">{{ 'SETTINGS.CUSTOMER_CONTACT.FIELD.ADDRESS' | translate }}</span>
              <span class="value">{{ truncate(contact.address, 30) }}</span>
            </div>
          </div>
          <div class="contact-actions">
            <ion-button size="small" fill="outline" (click)="editContact(contact)">
              <ion-icon slot="start" name="create-outline"></ion-icon>
              {{ 'COMMON.BUTTON.EDIT' | translate }}
            </ion-button>
            <ion-button
              size="small"
              fill="outline"
              color="danger"
              (click)="deleteContact(contact.id)"
            >
              <ion-icon slot="start" name="trash-outline"></ion-icon>
              {{ 'COMMON.BUTTON.DELETE' | translate }}
            </ion-button>
          </div>
        </div>

        <!-- Load More -->
        <div *ngIf="hasMore" class="load-more">
          <ion-button expand="block" fill="outline" (click)="loadMore()" [disabled]="isLoading">
            {{ 'COMMON.BUTTON.LOAD_MORE' | translate }}
          </ion-button>
        </div>
      </div>

      <!-- Empty State -->
      <div *ngIf="!isLoading && contacts.length === 0" class="empty-state">
        <ion-icon name="person-outline"></ion-icon>
        <h3>{{ 'SETTINGS.CUSTOMER_CONTACT.EMPTY.TITLE' | translate }}</h3>
        <p>{{ 'SETTINGS.CUSTOMER_CONTACT.EMPTY.DESCRIPTION' | translate }}</p>
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
              <ion-title>{{ isEditing ? ('SETTINGS.CUSTOMER_CONTACT.MODAL.EDIT_TITLE' | translate) : ('SETTINGS.CUSTOMER_CONTACT.MODAL.ADD_TITLE' | translate) }}</ion-title>
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
                <ion-label position="stacked">{{ 'SETTINGS.CUSTOMER_CONTACT.FIELD.CUSTOMER_NAME' | translate }} *</ion-label>
                <ion-input
                  formControlName="customerName"
                  [placeholder]="'SETTINGS.CUSTOMER_CONTACT.FIELD.CUSTOMER_NAME' | translate"
                ></ion-input>
              </ion-item>

              <ion-item>
                <ion-label position="stacked">{{ 'SETTINGS.CUSTOMER_CONTACT.FIELD.CUSTOMER_CODE' | translate }}</ion-label>
                <ion-input
                  formControlName="customerCode"
                  [placeholder]="'SETTINGS.CUSTOMER_CONTACT.FIELD.CUSTOMER_CODE' | translate"
                  readonly
                ></ion-input>
              </ion-item>

              <ion-item>
                <ion-label position="stacked">{{ 'SETTINGS.CUSTOMER_CONTACT.FIELD.CONTACT_NAME' | translate }} *</ion-label>
                <ion-input
                  formControlName="contactName"
                  [placeholder]="'SETTINGS.CUSTOMER_CONTACT.FIELD.CONTACT_NAME' | translate"
                ></ion-input>
              </ion-item>

              <ion-item>
                <ion-label position="stacked">{{ 'SETTINGS.CUSTOMER_CONTACT.FIELD.DEPARTMENT' | translate }}</ion-label>
                <ion-input
                  formControlName="department"
                  [placeholder]="'SETTINGS.CUSTOMER_CONTACT.FIELD.DEPARTMENT' | translate"
                ></ion-input>
              </ion-item>

              <ion-item>
                <ion-label position="stacked">{{ 'SETTINGS.CUSTOMER_CONTACT.FIELD.PHONE' | translate }} *</ion-label>
                <ion-input
                  formControlName="phone"
                  placeholder="010-1234-5678"
                ></ion-input>
              </ion-item>

              <ion-item>
                <ion-label position="stacked">{{ 'SETTINGS.CUSTOMER_CONTACT.FIELD.EMAIL' | translate }} *</ion-label>
                <ion-input
                  type="email"
                  formControlName="email"
                  placeholder="example@company.com"
                ></ion-input>
              </ion-item>

              <ion-item>
                <ion-label position="stacked">{{ 'SETTINGS.CUSTOMER_CONTACT.FIELD.ADDRESS' | translate }}</ion-label>
                <ion-input
                  formControlName="address"
                  [placeholder]="'SETTINGS.CUSTOMER_CONTACT.FIELD.ADDRESS' | translate"
                ></ion-input>
              </ion-item>

              <ion-item>
                <ion-label position="stacked">{{ 'SETTINGS.CUSTOMER_CONTACT.FIELD.BUSINESS_TYPE' | translate }} *</ion-label>
                <ion-select formControlName="businessType">
                  <ion-select-option value="receiver">{{ 'SETTINGS.CUSTOMER_CONTACT.TYPE.RECEIVER' | translate }}</ion-select-option>
                  <ion-select-option value="pickup">{{ 'SETTINGS.CUSTOMER_CONTACT.TYPE.PICKUP' | translate }}</ion-select-option>
                  <ion-select-option value="both">{{ 'SETTINGS.CUSTOMER_CONTACT.TYPE.BOTH' | translate }}</ion-select-option>
                </ion-select>
              </ion-item>

              <ion-item>
                <ion-label position="stacked">{{ 'SETTINGS.CUSTOMER_CONTACT.FIELD.MEMO' | translate }}</ion-label>
                <ion-input
                  formControlName="memo"
                  [placeholder]="'SETTINGS.CUSTOMER_CONTACT.FIELD.MEMO' | translate"
                ></ion-input>
              </ion-item>

              <div class="modal-actions">
                <ion-button expand="block" (click)="closeModal()" fill="outline">
                  {{ 'COMMON.BUTTON.CANCEL' | translate }}
                </ion-button>
                <ion-button
                  expand="block"
                  (click)="saveContact()"
                  [disabled]="!contactForm.valid || isSaving"
                >
                  <ion-spinner *ngIf="isSaving" slot="start"></ion-spinner>
                  {{ 'COMMON.BUTTON.SAVE' | translate }}
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
        [header]="'COMMON.ERROR.TITLE' | translate"
        [message]="errorMessage"
        [buttons]="[{ text: ('COMMON.BUTTON.CONFIRM' | translate), handler: () => errorMessage = null }]"
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
  private readonly translate = inject(TranslateService);
  
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
      this.errorMessage = error?.error?.message || this.translate.instant('SETTINGS.CUSTOMER_CONTACT.ERROR.LOAD_FAILED');
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
      this.errorMessage = error?.error?.message || this.translate.instant('SETTINGS.CUSTOMER_CONTACT.ERROR.LOAD_MORE_FAILED');
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
    // TranslateService 참조 캡처 (async 핸들러 내 this 문제 방지)
    const translateService = this.translate;
    const toastController = this.toastCtrl;
    
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

      const message = this.isEditing 
        ? translateService.instant('SETTINGS.CUSTOMER_CONTACT.SUCCESS.UPDATED')
        : translateService.instant('SETTINGS.CUSTOMER_CONTACT.SUCCESS.CREATED');
      const toast = await toastController.create({
        message,
        duration: 2000,
        color: 'success',
      });
      await toast.present();

      this.closeModal();
      this.loadContacts();
    } catch (error: any) {
      this.errorMessage = error?.error?.message || translateService.instant('SETTINGS.CUSTOMER_CONTACT.ERROR.SAVE_FAILED');
    } finally {
      this.isSaving = false;
    }
  }

  async deleteContact(id: string) {
    const confirmed = confirm(this.translate.instant('SETTINGS.CUSTOMER_CONTACT.CONFIRM.DELETE'));
    if (!confirmed) return;

    // TranslateService 참조 캡처
    const translateService = this.translate;
    const toastController = this.toastCtrl;
    
    try {
      await firstValueFrom(this.http.delete(`${this.apiUrl}/${id}`));

      const toast = await toastController.create({
        message: translateService.instant('SETTINGS.CUSTOMER_CONTACT.SUCCESS.DELETED'),
        duration: 2000,
        color: 'success',
      });
      await toast.present();

      this.loadContacts();
    } catch (error: any) {
      this.errorMessage = error?.error?.message || translateService.instant('SETTINGS.CUSTOMER_CONTACT.ERROR.DELETE_FAILED');
    }
  }

  formatBusinessType(type: string): string {
    const key = `SETTINGS.CUSTOMER_CONTACT.TYPE.${type.toUpperCase()}`;
    return this.translate.instant(key);
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
