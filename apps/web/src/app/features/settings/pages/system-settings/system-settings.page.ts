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
  IonToggle,
  IonBadge,
  IonSegment,
  IonSegmentButton,
  ToastController,
  AlertController,
} from '@ionic/angular/standalone';
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
        <ion-title>시스템 설정</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Tab Selection -->
      <ion-segment [(ngModel)]="activeTab" (ionChange)="onTabChange()" class="tab-segment">
        <ion-segment-button value="system">시스템</ion-segment-button>
        <ion-segment-button value="users">사용자</ion-segment-button>
        <ion-segment-button value="roles">권한</ion-segment-button>
      </ion-segment>

      <!-- System Settings Tab -->
      <div *ngIf="activeTab === 'system'" class="settings-section">
        <ion-card>
          <ion-card-header>
            <ion-card-title>시스템 설정</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <form [formGroup]="systemForm" (ngSubmit)="saveSystemSettings()">
              <ion-item>
                <ion-label position="stacked">알림 빈도</ion-label>
                <ion-select formControlName="notificationFrequency">
                  <ion-select-option value="instant">즉시</ion-select-option>
                  <ion-select-option value="batch">일괄</ion-select-option>
                  <ion-select-option value="off">비활성화</ion-select-option>
                </ion-select>
              </ion-item>

              <ion-item *ngIf="systemForm.get('notificationFrequency')?.value === 'batch'">
                <ion-label position="stacked">일괄 발송 시간</ion-label>
                <ion-input
                  type="number"
                  formControlName="batchScheduleHour"
                  min="0"
                  max="23"
                  placeholder="시간 (0-23)"
                ></ion-input>
              </ion-item>

              <ion-item>
                <ion-label>자동 정산 마감</ion-label>
                <ion-toggle formControlName="autoLockSettlement"></ion-toggle>
              </ion-item>

              <ion-item *ngIf="systemForm.get('autoLockSettlement')?.value">
                <ion-label position="stacked">마감 요일</ion-label>
                <ion-select formControlName="autoLockDay">
                  <ion-select-option value="0">일요일</ion-select-option>
                  <ion-select-option value="1">월요일</ion-select-option>
                  <ion-select-option value="2">화요일</ion-select-option>
                  <ion-select-option value="3">수요일</ion-select-option>
                  <ion-select-option value="4">목요일</ion-select-option>
                  <ion-select-option value="5">금요일</ion-select-option>
                  <ion-select-option value="6">토요일</ion-select-option>
                </ion-select>
              </ion-item>

              <ion-item *ngIf="systemForm.get('autoLockSettlement')?.value">
                <ion-label position="stacked">마감 시간</ion-label>
                <ion-input
                  type="time"
                  formControlName="autoLockTime"
                ></ion-input>
              </ion-item>

              <ion-item>
                <ion-label>유지보수 모드</ion-label>
                <ion-toggle formControlName="maintenanceMode"></ion-toggle>
              </ion-item>

              <ion-item *ngIf="systemForm.get('maintenanceMode')?.value">
                <ion-label position="stacked">유지보수 메시지</ion-label>
                <ion-input
                  formControlName="maintenanceMessage"
                  placeholder="유지보수 중입니다. 잠시 후 다시 시도해주세요."
                ></ion-input>
              </ion-item>

              <div class="form-actions">
                <ion-button expand="block" (click)="resetSystemForm()">
                  초기화
                </ion-button>
                <ion-button expand="block" (click)="saveSystemSettings()" [disabled]="isSaving">
                  <ion-spinner *ngIf="isSaving" slot="start"></ion-spinner>
                  저장
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
            사용자 추가
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
                  <strong>지사:</strong> {{ user.branchName }}
                </p>
                <p>
                  <strong>상태:</strong>
                  <ion-badge [color]="user.isActive ? 'success' : 'danger'">
                    {{ user.isActive ? '활성화' : '비활성화' }}
                  </ion-badge>
                </p>
                <p *ngIf="user.lastLogin">
                  <strong>마지막 로그인:</strong> {{ user.lastLogin | date: 'yyyy.MM.dd HH:mm' }}
                </p>
              </div>
              <div class="user-actions">
                <ion-button size="small" fill="outline" (click)="editUser(user)">
                  <ion-icon slot="start" name="create-outline"></ion-icon>
                  수정
                </ion-button>
                <ion-button
                  size="small"
                  fill="outline"
                  [color]="user.isActive ? 'warning' : 'success'"
                  (click)="toggleUserStatus(user)"
                >
                  <ion-icon slot="start" [name]="user.isActive ? 'lock-outline' : 'checkmark-outline'"></ion-icon>
                  {{ user.isActive ? '비활성화' : '활성화' }}
                </ion-button>
              </div>
            </ion-card-content>
          </ion-card>
        </div>

        <div *ngIf="!isLoading && users.length === 0" class="empty-state">
          <ion-icon name="people-outline"></ion-icon>
          <h3>사용자가 없습니다</h3>
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
                <ion-title>{{ isEditingUser ? '사용자 수정' : '사용자 추가' }}</ion-title>
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
                  <ion-label position="stacked">이름 *</ion-label>
                  <ion-input formControlName="name" placeholder="사용자명"></ion-input>
                </ion-item>

                <ion-item>
                  <ion-label position="stacked">이메일 *</ion-label>
                  <ion-input
                    type="email"
                    formControlName="email"
                    placeholder="user@company.com"
                    [readonly]="isEditingUser"
                  ></ion-input>
                </ion-item>

                <ion-item>
                  <ion-label position="stacked">역할 *</ion-label>
                  <ion-select formControlName="role">
                    <ion-select-option value="HQ_ADMIN">HQ 관리자</ion-select-option>
                    <ion-select-option value="BRANCH_MANAGER">지사 관리자</ion-select-option>
                    <ion-select-option value="INSTALLER">기사</ion-select-option>
                  </ion-select>
                </ion-item>

                <ion-item *ngIf="userForm.get('role')?.value === 'BRANCH_MANAGER'">
                  <ion-label position="stacked">지사</ion-label>
                  <ion-input formControlName="branchCode" placeholder="지사 코드"></ion-input>
                </ion-item>

                <div class="modal-actions">
                  <ion-button expand="block" (click)="closeUserModal()" fill="outline">
                    취소
                  </ion-button>
                  <ion-button
                    expand="block"
                    (click)="saveUser()"
                    [disabled]="!userForm.valid || isSaving"
                  >
                    <ion-spinner *ngIf="isSaving" slot="start"></ion-spinner>
                    저장
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
            <ion-card-title>권한 정책</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <div class="roles-info">
              <div class="role-item">
                <h4>HQ 관리자</h4>
                <p>전체 시스템 관리, 사용자 관리, 정산 관리, 리포트 조회</p>
              </div>
              <div class="role-item">
                <h4>지사 관리자</h4>
                <p>지사별 배정/완료 관리, 지사 리포트, 정산 조회</p>
              </div>
              <div class="role-item">
                <h4>기사</h4>
                <p>배정된 주문 수령, 완료 처리, 개인 리포트 조회</p>
              </div>
            </div>
          </ion-card-content>
        </ion-card>
      </div>

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
      this.errorMessage = 'HQ 관리자만 접근할 수 있습니다.';
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
      this.errorMessage = error?.error?.message || '사용자를 로드할 수 없습니다.';
    } finally {
      this.isLoading = false;
    }
  }

  async saveSystemSettings() {
    if (!this.systemForm.valid) return;

    this.isSaving = true;
    try {
      await firstValueFrom(
        this.http.put(`${this.apiUrl}/system`, this.systemForm.value)
      );

      const toast = await this.toastCtrl.create({
        message: '시스템 설정이 저장되었습니다.',
        duration: 2000,
        color: 'success',
      });
      await toast.present();
    } catch (error: any) {
      this.errorMessage = error?.error?.message || '저장 실패';
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
    try {
      const data = this.userForm.value;
      await firstValueFrom(
        this.isEditingUser
          ? this.http.put(`${this.apiUrl}/users/${data.email}`, data)
          : this.http.post(`${this.apiUrl}/users`, data)
      );

      const toast = await this.toastCtrl.create({
        message: this.isEditingUser ? '사용자가 수정되었습니다.' : '사용자가 추가되었습니다.',
        duration: 2000,
        color: 'success',
      });
      await toast.present();

      this.closeUserModal();
      this.loadUsers();
    } catch (error: any) {
      this.errorMessage = error?.error?.message || '저장 실패';
    } finally {
      this.isSaving = false;
    }
  }

  async toggleUserStatus(user: SystemUser) {
    try {
      await firstValueFrom(
        this.http.patch(`${this.apiUrl}/users/${user.id}/status`, {
          isActive: !user.isActive,
        })
      );

      const toast = await this.toastCtrl.create({
        message: user.isActive ? '사용자가 비활성화되었습니다.' : '사용자가 활성화되었습니다.',
        duration: 2000,
        color: 'success',
      });
      await toast.present();

      this.loadUsers();
    } catch (error: any) {
      this.errorMessage = error?.error?.message || '상태 변경 실패';
    }
  }

  onTabChange() {
    if (this.activeTab === 'users') {
      this.loadUsers();
    }
  }

  formatRole(role: UserRole): string {
    const map: Record<UserRole, string> = {
      HQ_ADMIN: 'HQ 관리자',
      BRANCH_MANAGER: '지사 관리자',
      INSTALLER: '기사',
    };
    return map[role] || role;
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
