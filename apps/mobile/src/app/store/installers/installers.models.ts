/**
 * Installer-related models for state management
 */

export interface Installer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  branchId: string;
  branchCode: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
  assignedOrderCount?: number;
  completedOrderCount?: number;
  failedOrderCount?: number;
  lastActive?: number;
  createdAt: number;
  updatedAt: number;
}

export interface InstallersState {
  installers: Installer[];
  selectedInstallerIds: string[];
  filters: {
    branchCode?: string;
    status?: Installer['status'][];
  };
  isLoading: boolean;
  error: string | null;
  lastSyncTime?: number;
}
