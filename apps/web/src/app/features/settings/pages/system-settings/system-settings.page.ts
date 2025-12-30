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
  IonToggle,
  IonBadge,
  IonSegment,
  IonSegmentButton,
  ToastController,
  AlertController,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { createOutline, trashOutline, closeOutline, checkmarkOutline, lockOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { SystemUser, SystemSettings, UserRole } from './system-settings.models';
import { AuthService } from '@app/core/services/auth.service';

@Component({
  selector: 'app-system-settings',
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
    IonToggle,
    IonBadge,
    IonSegment,
    IonSegmentButton,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/settings"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ 'SETTINGS.SYSTEM.TITLE' | translate }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Tab Selection -->
      <ion-segment [(ngModel)]="activeTab" (ionChange)="onTabChange()" class="tab-segment">
        <ion-segment-button value="system">{{ 'SETTINGS.SYSTEM.TAB.SYSTEM' | translate }}</ion-segment-button>
        <ion-segment-button value="users">{{ 'SETTINGS.SYSTEM.TAB.USERS' | translate }}</ion-segment-button>
        <ion-segment-button value="roles">{{ 'SETTINGS.SYSTEM.TAB.ROLES' | translate }}</ion-segment-button>
      </ion-segment>

      <!-- System Settings Tab -->
      <div *ngIf="activeTab === 'system'" class="settings-section">
        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ 'SETTINGS.SYSTEM.SECTION.SYSTEM' | translate }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <form [formGroup]="systemForm" (ngSubmit)="saveSystemSettings()">
              <ion-item>
                <ion-label position="stacked">{{ 'SETTINGS.SYSTEM.NOTIFICATION_FREQUENCY' | translate }}</ion-label>
                <ion-select formControlName="notificationFrequency">
                  <ion-select-option value="instant">{{ 'SETTINGS.SYSTEM.FREQUENCY.INSTANT' | translate }}</ion-select-option>
                  <ion-select-option value="batch">{{ 'SETTINGS.SYSTEM.FREQUENCY.BATCH' | translate }}</ion-select-option>
                  <ion-select-option value="off">{{ 'SETTINGS.SYSTEM.FREQUENCY.OFF' | translate }}</ion-select-option>
                </ion-select>
              </ion-item>

              <ion-item *ngIf="systemForm.get('notificationFrequency')?.value === 'batch'">
                <ion-label position="stacked">{{ 'SETTINGS.SYSTEM.BATCH_SCHEDULE_HOUR' | translate }}</ion-label>
                <ion-input
                  type="number"
                  formControlName="batchScheduleHour"
                  min="0"
                  max="23"
                  [placeholder]="'SETTINGS.SYSTEM.BATCH_HOUR_PLACEHOLDER' | translate"
                ></ion-input>
              </ion-item>

              <ion-item>
                <ion-label>{{ 'SETTINGS.SYSTEM.AUTO_LOCK_SETTLEMENT' | translate }}</ion-label>
                <ion-toggle formControlName="autoLockSettlement"></ion-toggle>
              </ion-item>

              <ion-item *ngIf="systemForm.get('autoLockSettlement')?.value">
                <ion-label position="stacked">{{ 'SETTINGS.SYSTEM.AUTO_LOCK_DAY' | translate }}</ion-label>
                <ion-select formControlName="autoLockDay">
                  <ion-select-option value="0">{{ 'COMMON.WEEKDAY.SUNDAY' | translate }}</ion-select-option>
                  <ion-select-option value="1">{{ 'COMMON.WEEKDAY.MONDAY' | translate }}</ion-select-option>
                  <ion-select-option value="2">{{ 'COMMON.WEEKDAY.TUESDAY' | translate }}</ion-select-option>
                  <ion-select-option value="3">{{ 'COMMON.WEEKDAY.WEDNESDAY' | translate }}</ion-select-option>
                  <ion-select-option value="4">{{ 'COMMON.WEEKDAY.THURSDAY' | translate }}</ion-select-option>
                  <ion-select-option value="5">{{ 'COMMON.WEEKDAY.FRIDAY' | translate }}</ion-select-option>
                  <ion-select-option value="6">{{ 'COMMON.WEEKDAY.SATURDAY' | translate }}</ion-select-option>
                </ion-select>
              </ion-item>

              <ion-item *ngIf="systemForm.get('autoLockSettlement')?.value">
                <ion-label position="stacked">{{ 'SETTINGS.SYSTEM.AUTO_LOCK_TIME' | translate }}</ion-label>
                <ion-input
                  type="time"
                  formControlName="autoLockTime"
                ></ion-input>
              </ion-item>

              <ion-item>
                <ion-label>{{ 'SETTINGS.SYSTEM.MAINTENANCE_MODE' | translate }}</ion-label>
                <ion-toggle formControlName="maintenanceMode"></ion-toggle>
              </ion-item>

              <ion-item *ngIf="systemForm.get('maintenanceMode')?.value">
                <ion-label position="stacked">{{ 'SETTINGS.SYSTEM.MAINTENANCE_MESSAGE' | translate }}</ion-label>
                <ion-input
                  formControlName="maintenanceMessage"
                  [placeholder]="'SETTINGS.SYSTEM.MAINTENANCE_MESSAGE_PLACEHOLDER' | translate"
                ></ion-input>
              </ion-item>

              <div class="form-actions">
                <ion-button expand="block" (click)="resetSystemForm()">
                  {{ 'COMMON.BUTTON.RESET' | translate }}
                </ion-button>
                <ion-button expand="block" (click)="saveSystemSettings()" [disabled]="isSaving">
                  <ion-spinner *ngIf="isSaving" slot="start"></ion-spinner>
                  {{ 'COMMON.BUTTON.SAVE' | translate }}
                </ion-button>
              </div>
            </form>
          </ion-card-content>
        </ion-card>
      </div>

      <!-- Users Tab -->
      <div *ngIf="activeTab === 'users'" class="settings-section">
        <div class="section-actions">
          <ion-button expand="block" (click)="openAddUserModal()">
            <ion-icon slot="start" name="add-outline"></ion-icon>
            {{ 'SETTINGS.SYSTEM.USER.ADD' | translate }}
          </ion-button>
        </div>

        <div *ngIf="isLoading" class="loading-container">
          <ion-spinner></ion-spinner>
        </div>

        <div *ngIf="!isLoading && users.length > 0" class="users-list">
          <ion-card *ngFor="let user of users" class="user-card">
            <ion-card-content>
              <div class="user-header">
                <div class="user-info">
                  <h3>{{ user.name }}</h3>
                  <p class="user-email">{{ user.email }}</p>
                </div>
                <ion-badge [color]="getRoleColor(user.role)">
                  {{ formatRole(user.role) }}
                </ion-badge>
              </div>
              <div class="user-details">
                <p *ngIf="user.branchName">
                  <strong>{{ 'SETTINGS.SYSTEM.USER.BRANCH' | translate }}:</strong> {{ user.branchName }}
                </p>
                <p>
                  <strong>{{ 'SETTINGS.SYSTEM.USER.STATUS' | translate }}:</strong>
                  <ion-badge [color]="user.isActive ? 'success' : 'danger'">
                    {{ user.isActive ? ('SETTINGS.SYSTEM.USER.ACTIVE' | translate) : ('SETTINGS.SYSTEM.USER.INACTIVE' | translate) }}
                  </ion-badge>
                </p>
                <p *ngIf="user.lastLogin">
                  <strong>{{ 'SETTINGS.SYSTEM.USER.LAST_LOGIN' | translate }}:</strong> {{ user.lastLogin | date: 'yyyy.MM.dd HH:mm' }}
                </p>
              </div>
              <div class="user-actions">
                <ion-button size="small" fill="outline" (click)="editUser(user)">
                  <ion-icon slot="start" name="create-outline"></ion-icon>
                  {{ 'COMMON.BUTTON.EDIT' | translate }}
                </ion-button>
                <ion-button
                  size="small"
                  fill="outline"
                  [color]="user.isActive ? 'warning' : 'success'"
                  (click)="toggleUserStatus(user)"
                >
                  <ion-icon slot="start" [name]="user.isActive ? 'lock-outline' : 'checkmark-outline'"></ion-icon>
                  {{ user.isActive ? ('SETTINGS.SYSTEM.USER.DEACTIVATE' | translate) : ('SETTINGS.SYSTEM.USER.ACTIVATE' | translate) }}
                </ion-button>
              </div>
            </ion-card-content>
          </ion-card>
        </div>

        <div *ngIf="!isLoading && users.length === 0" class="empty-state">
          <ion-icon name="people-outline"></ion-icon>
          <h3>{{ 'SETTINGS.SYSTEM.USER.EMPTY' | translate }}</h3>
        </div>

        <!-- User Modal -->
        <ion-modal
          #userModal
          [isOpen]="showUserModal"
          (ionModalDidDismiss)="showUserModal = false"
        >
          <ng-template>
            <ion-header>
              <ion-toolbar>
                <ion-title>{{ isEditingUser ? ('SETTINGS.SYSTEM.USER.EDIT_TITLE' | translate) : ('SETTINGS.SYSTEM.USER.ADD_TITLE' | translate) }}</ion-title>
                <ion-buttons slot="end">
                  <ion-button (click)="closeUserModal()">
                    <ion-icon name="close-outline"></ion-icon>
                  </ion-button>
                </ion-buttons>
              </ion-toolbar>
            </ion-header>
            <ion-content class="ion-padding">
              <form [formGroup]="userForm" (ngSubmit)="saveUser()">
                <ion-item>
                  <ion-label position="stacked">{{ 'SETTINGS.SYSTEM.USER.NAME' | translate }} *</ion-label>
                  <ion-input formControlName="name" [placeholder]="'SETTINGS.SYSTEM.USER.NAME' | translate"></ion-input>
                </ion-item>

                <ion-item>
                  <ion-label position="stacked">{{ 'SETTINGS.SYSTEM.USER.EMAIL' | translate }} *</ion-label>
                  <ion-input
                    type="email"
                    formControlName="email"
                    placeholder="user@company.com"
                    [readonly]="isEditingUser"
                  ></ion-input>
                </ion-item>

                <ion-item>
                  <ion-label position="stacked">{{ 'SETTINGS.SYSTEM.USER.ROLE' | translate }} *</ion-label>
                  <ion-select formControlName="role">
                    <ion-select-option value="HQ_ADMIN">{{ 'SETTINGS.SYSTEM.ROLE.HQ_ADMIN' | translate }}</ion-select-option>
                    <ion-select-option value="BRANCH_MANAGER">{{ 'SETTINGS.SYSTEM.ROLE.BRANCH_MANAGER' | translate }}</ion-select-option>
                    <ion-select-option value="INSTALLER">{{ 'SETTINGS.SYSTEM.ROLE.INSTALLER' | translate }}</ion-select-option>
                  </ion-select>
                </ion-item>

                <ion-item *ngIf="userForm.get('role')?.value === 'BRANCH_MANAGER'">
                  <ion-label position="stacked">{{ 'SETTINGS.SYSTEM.USER.BRANCH' | translate }}</ion-label>
                  <ion-input formControlName="branchCode" [placeholder]="'SETTINGS.SYSTEM.USER.BRANCH_CODE' | translate"></ion-input>
                </ion-item>

                <div class="modal-actions">
                  <ion-button expand="block" (click)="closeUserModal()" fill="outline">
                    {{ 'COMMON.BUTTON.CANCEL' | translate }}
                  </ion-button>
                  <ion-button
                    expand="block"
                    (click)="saveUser()"
                    [disabled]="!userForm.valid || isSaving"
                  >
                    <ion-spinner *ngIf="isSaving" slot="start"></ion-spinner>
                    {{ 'COMMON.BUTTON.SAVE' | translate }}
                  </ion-button>
                </div>
              </form>
            </ion-content>
          </ng-template>
        </ion-modal>
      </div>

      <!-- Roles Tab -->
      <div *ngIf="activeTab === 'roles'" class="settings-section">
        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ 'SETTINGS.SYSTEM.ROLES_POLICY' | translate }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <div class="roles-info">
              <div class="role-item">
                <h4>{{ 'SETTINGS.SYSTEM.ROLE.HQ_ADMIN' | translate }}</h4>
                <p>{{ 'SETTINGS.SYSTEM.ROLE.HQ_ADMIN_DESC' | translate }}</p>
              </div>
              <div class="role-item">
                <h4>{{ 'SETTINGS.SYSTEM.ROLE.BRANCH_MANAGER' | translate }}</h4>
                <p>{{ 'SETTINGS.SYSTEM.ROLE.BRANCH_MANAGER_DESC' | translate }}</p>
              </div>
              <div class="role-item">
                <h4>{{ 'SETTINGS.SYSTEM.ROLE.INSTALLER' | translate }}</h4>
                <p>{{ 'SETTINGS.SYSTEM.ROLE.INSTALLER_DESC' | translate }}</p>
              </div>
            </div>
          </ion-card-content>
        </ion-card>
      </div>

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
    .tab-segment {
      margin-bottom: 16px;
    }

    .settings-section {
      animation: slideIn 0.3s ease-in-out;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .section-actions {
      margin-bottom: 16px;
    }

    .form-actions {
      display: flex;
      gap: 8px;
      margin-top: 24px;
    }

    .form-actions ion-button {
      flex: 1;
    }

    .loading-container {
      display: flex;
      justify-content: center;
      padding: 48px;
    }

    .users-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .user-card {
      margin-bottom: 0;
    }

    .user-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .user-info h3 {
      margin: 0;
      font-size: 16px;
      color: #0f172a;
    }

    .user-email {
      margin: 4px 0 0;
      font-size: 13px;
      color: #64748b;
    }

    ion-badge {
      font-size: 11px;
      padding: 4px 8px;
    }

    .user-details {
      margin-bottom: 12px;
      font-size: 13px;
      color: #475569;
    }

    .user-details p {
      margin: 6px 0;
    }

    .user-details strong {
      color: #0f172a;
      font-weight: 600;
    }

    .user-actions {
      display: flex;
      gap: 8px;
    }

    .user-actions ion-button {
      flex: 1;
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

    .roles-info {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .role-item {
      padding: 12px;
      background: #f8fafc;
      border-left: 4px solid #3b82f6;
      border-radius: 6px;
    }

    .role-item h4 {
      margin: 0 0 6px;
      font-size: 14px;
      color: #0f172a;
    }

    .role-item p {
      margin: 0;
      font-size: 13px;
      color: #64748b;
      line-height: 1.4;
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
export class SystemSettingsPage implements OnInit {
  private readonly translate = inject(TranslateService);
  
  systemForm!: FormGroup;
  userForm!: FormGroup;

  activeTab: 'system' | 'users' | 'roles' = 'system';
  users: SystemUser[] = [];
  isLoading = false;
  isSaving = false;
  isEditingUser = false;
  showUserModal = false;
  errorMessage: string | null = null;

  private apiUrl = `${environment.apiUrl}/settings`;

  constructor(
    private http: HttpClient,
    private fb: FormBuilder,
    private authService: AuthService,
    private toastCtrl: ToastController
  ) {
    addIcons({ createOutline, trashOutline, closeOutline, checkmarkOutline, lockOutline });
    this.initForms();
  }

  ngOnInit() {
    this.checkAdminAccess();
    this.loadSystemSettings();
    this.loadUsers();
  }

  private initForms() {
    this.systemForm = this.fb.group({
      notificationFrequency: ['instant', Validators.required],
      batchScheduleHour: [9, Validators.required],
      autoLockSettlement: [true],
      autoLockDay: [5],
      autoLockTime: ['18:00'],
      maintenanceMode: [false],
      maintenanceMessage: [''],
    });

    this.userForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      role: ['INSTALLER', Validators.required],
      branchCode: [''],
    });
  }

  private checkAdminAccess() {
    const user = this.authService.user();
    if (!user || !user.roles.includes('HQ_ADMIN')) {
      this.errorMessage = this.translate.instant('SETTINGS.SYSTEM.ERROR.ADMIN_ONLY');
    }
  }

  async loadSystemSettings() {
    try {
      const settings = await firstValueFrom(
        this.http.get<SystemSettings>(`${this.apiUrl}/system`)
      );
      this.systemForm.patchValue(settings);
    } catch (error) {
      console.error('Failed to load system settings');
    }
  }

  async loadUsers() {
    this.isLoading = true;
    try {
      const response = await firstValueFrom(
        this.http.get<SystemUser[]>(`${this.apiUrl}/users`)
      );
      this.users = response;
    } catch (error: any) {
      this.errorMessage = error?.error?.message || this.translate.instant('SETTINGS.SYSTEM.ERROR.LOAD_USERS_FAILED');
    } finally {
      this.isLoading = false;
    }
  }

  async saveSystemSettings() {
    if (!this.systemForm.valid) return;

    this.isSaving = true;
    // TranslateService 참조 캡처 (async 핸들러 내 this 문제 방지)
    const translateService = this.translate;
    const toastController = this.toastCtrl;
    
    try {
      await firstValueFrom(
        this.http.put(`${this.apiUrl}/system`, this.systemForm.value)
      );

      const toast = await toastController.create({
        message: translateService.instant('SETTINGS.SYSTEM.SUCCESS.SAVED'),
        duration: 2000,
        color: 'success',
      });
      await toast.present();
    } catch (error: any) {
      this.errorMessage = error?.error?.message || translateService.instant('SETTINGS.SYSTEM.ERROR.SAVE_FAILED');
    } finally {
      this.isSaving = false;
    }
  }

  resetSystemForm() {
    this.loadSystemSettings();
  }

  openAddUserModal() {
    this.isEditingUser = false;
    this.userForm.reset({ role: 'INSTALLER' });
    this.showUserModal = true;
  }

  editUser(user: SystemUser) {
    this.isEditingUser = true;
    this.userForm.patchValue(user);
    this.showUserModal = true;
  }

  closeUserModal() {
    this.showUserModal = false;
  }

  async saveUser() {
    if (!this.userForm.valid) return;

    this.isSaving = true;
    // TranslateService 참조 캡처 (async 핸들러 내 this 문제 방지)
    const translateService = this.translate;
    const toastController = this.toastCtrl;
    
    try {
      const data = this.userForm.value;
      await firstValueFrom(
        this.isEditingUser
          ? this.http.put(`${this.apiUrl}/users/${data.email}`, data)
          : this.http.post(`${this.apiUrl}/users`, data)
      );

      const message = this.isEditingUser 
        ? translateService.instant('SETTINGS.SYSTEM.SUCCESS.USER_UPDATED')
        : translateService.instant('SETTINGS.SYSTEM.SUCCESS.USER_CREATED');
      const toast = await toastController.create({
        message,
        duration: 2000,
        color: 'success',
      });
      await toast.present();

      this.closeUserModal();
      this.loadUsers();
    } catch (error: any) {
      this.errorMessage = error?.error?.message || translateService.instant('SETTINGS.SYSTEM.ERROR.SAVE_FAILED');
    } finally {
      this.isSaving = false;
    }
  }

  async toggleUserStatus(user: SystemUser) {
    // TranslateService 참조 캡처 (async 핸들러 내 this 문제 방지)
    const translateService = this.translate;
    const toastController = this.toastCtrl;
    
    try {
      await firstValueFrom(
        this.http.patch(`${this.apiUrl}/users/${user.id}/status`, {
          isActive: !user.isActive,
        })
      );

      const message = user.isActive 
        ? translateService.instant('SETTINGS.SYSTEM.SUCCESS.USER_DEACTIVATED')
        : translateService.instant('SETTINGS.SYSTEM.SUCCESS.USER_ACTIVATED');
      const toast = await toastController.create({
        message,
        duration: 2000,
        color: 'success',
      });
      await toast.present();

      this.loadUsers();
    } catch (error: any) {
      this.errorMessage = error?.error?.message || translateService.instant('SETTINGS.SYSTEM.ERROR.STATUS_CHANGE_FAILED');
    }
  }

  onTabChange() {
    if (this.activeTab === 'users') {
      this.loadUsers();
    }
  }

  formatRole(role: UserRole): string {
    const key = `SETTINGS.SYSTEM.ROLE.${role}`;
    return this.translate.instant(key);
  }

  getRoleColor(role: UserRole): string {
    const map: Record<UserRole, string> = {
      HQ_ADMIN: 'danger',
      BRANCH_MANAGER: 'warning',
      INSTALLER: 'success',
    };
    return map[role] || 'medium';
  }
}
