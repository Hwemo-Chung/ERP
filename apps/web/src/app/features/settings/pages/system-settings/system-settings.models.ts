/**
 * System Settings Models
 * 시스템 설정 및 사용자 관리 데이터 모델
 */

export type UserRole = 'HQ_ADMIN' | 'BRANCH_MANAGER' | 'INSTALLER';

export interface SystemUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  branchCode?: string;
  branchName?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SystemSettings {
  notificationFrequency: 'instant' | 'batch' | 'off';
  batchScheduleHour: number;
  autoLockSettlement: boolean;
  autoLockDay: number;
  autoLockTime: string;
  maintenanceMode: boolean;
  maintenanceMessage?: string;
}

export interface RolePermission {
  role: UserRole;
  permissions: string[];
}
