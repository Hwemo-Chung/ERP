export type InstallerStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';

export interface Installer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  branchId: string;
  branchCode: string;
  status: InstallerStatus;
  assignedOrderCount?: number;
  completedOrderCount?: number;
  failedOrderCount?: number;
  lastActive?: number;
  createdAt: number;
  updatedAt: number;
}

export interface InstallerFilters {
  branchCode?: string;
  status?: InstallerStatus[];
}

export interface InstallersState {
  installers: Installer[];
  selectedInstallerIds: string[];
  filters: InstallerFilters;
  isLoading: boolean;
  error: string | null;
  lastSyncTime?: number;
}
