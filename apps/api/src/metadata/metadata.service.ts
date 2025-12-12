import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, Role } from '@prisma/client';

export interface MetadataCache {
  branches: any[];
  wasteTypes: any[];
  orderStatuses: any[];
  roles: any[];
  lastUpdated: Date;
}

@Injectable()
export class MetadataService implements OnModuleInit {
  private readonly logger = new Logger(MetadataService.name);
  private cache: MetadataCache | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.refreshCache();
  }

  /**
   * Get all metadata for offline bootstrap
   */
  async getAll() {
    if (!this.cache || this.isCacheExpired()) {
      await this.refreshCache();
    }
    return this.cache;
  }

  /**
   * Get branches list with optional filtering
   */
  async getBranches(filters?: { region?: string }) {
    const where: Record<string, unknown> = {};

    if (filters?.region) {
      where.region = filters.region;
    }

    return this.prisma.branch.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        region: true,
      },
    });
  }

  /**
   * Get installers list with optional filtering
   */
  async getInstallers(filters?: { branchCode?: string; isActive?: boolean }) {
    const where: Record<string, unknown> = {};

    if (filters?.branchCode) {
      where.branch = {
        code: filters.branchCode,
      };
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    return this.prisma.installer.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        phone: true,
        skillTags: true,
        capacityPerDay: true,
        isActive: true,
        branch: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        partner: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Get waste codes list
   */
  async getWasteTypes() {
    return this.prisma.wasteCode.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        descriptionKo: true,
        descriptionEn: true,
      },
    });
  }

  /**
   * Get order status metadata with descriptions
   */
  getOrderStatuses() {
    return Object.values(OrderStatus).map((status) => ({
      value: status,
      label: this.getStatusLabel(status),
      description: this.getStatusDescription(status),
      color: this.getStatusColor(status),
      category: this.getStatusCategory(status),
    }));
  }

  /**
   * Get roles with permissions info
   */
  getRoles() {
    return Object.values(Role).map((role) => ({
      value: role,
      label: this.getRoleLabel(role),
      permissions: this.getRolePermissions(role),
    }));
  }

  /**
   * Refresh metadata cache
   */
  async refreshCache() {
    this.logger.log('Refreshing metadata cache...');

    const [branches, wasteTypes] = await Promise.all([
      this.getBranches(),
      this.getWasteTypes(),
    ]);

    this.cache = {
      branches,
      wasteTypes,
      orderStatuses: this.getOrderStatuses(),
      roles: this.getRoles(),
      lastUpdated: new Date(),
    };

    this.logger.log('Metadata cache refreshed');
  }

  private isCacheExpired(): boolean {
    if (!this.cache?.lastUpdated) return true;
    return Date.now() - this.cache.lastUpdated.getTime() > this.CACHE_TTL_MS;
  }

  private getStatusLabel(status: OrderStatus): string {
    const labels: Record<OrderStatus, string> = {
      [OrderStatus.UNASSIGNED]: 'Unassigned',
      [OrderStatus.ASSIGNED]: 'Assigned',
      [OrderStatus.CONFIRMED]: 'Confirmed',
      [OrderStatus.RELEASED]: 'Released',
      [OrderStatus.DISPATCHED]: 'Dispatched',
      [OrderStatus.COMPLETED]: 'Completed',
      [OrderStatus.PARTIAL]: 'Partial',
      [OrderStatus.POSTPONED]: 'Postponed',
      [OrderStatus.ABSENT]: 'Absent',
      [OrderStatus.REQUEST_CANCEL]: 'Cancel Requested',
      [OrderStatus.CANCELLED]: 'Cancelled',
      [OrderStatus.COLLECTED]: 'Collected',
    };
    return labels[status] || status;
  }

  private getStatusDescription(status: OrderStatus): string {
    const descriptions: Record<OrderStatus, string> = {
      [OrderStatus.UNASSIGNED]: 'Order imported, no installer assigned',
      [OrderStatus.ASSIGNED]: 'Installer assigned by coordinator',
      [OrderStatus.CONFIRMED]: 'Installer confirmed the assignment',
      [OrderStatus.RELEASED]: 'Ready for dispatch',
      [OrderStatus.DISPATCHED]: 'Installer en route to customer',
      [OrderStatus.COMPLETED]: 'Work completed, pending pickup',
      [OrderStatus.PARTIAL]: 'Partial completion',
      [OrderStatus.POSTPONED]: 'Customer requested postponement',
      [OrderStatus.ABSENT]: 'Customer was absent',
      [OrderStatus.REQUEST_CANCEL]: 'Cancel request pending approval',
      [OrderStatus.CANCELLED]: 'Order cancelled',
      [OrderStatus.COLLECTED]: 'Waste collected, order closed',
    };
    return descriptions[status] || '';
  }

  private getStatusColor(status: OrderStatus): string {
    const colors: Record<OrderStatus, string> = {
      [OrderStatus.UNASSIGNED]: '#9e9e9e',
      [OrderStatus.ASSIGNED]: '#2196f3',
      [OrderStatus.CONFIRMED]: '#03a9f4',
      [OrderStatus.RELEASED]: '#00bcd4',
      [OrderStatus.DISPATCHED]: '#009688',
      [OrderStatus.COMPLETED]: '#4caf50',
      [OrderStatus.PARTIAL]: '#cddc39',
      [OrderStatus.POSTPONED]: '#ff9800',
      [OrderStatus.ABSENT]: '#ff5722',
      [OrderStatus.REQUEST_CANCEL]: '#f44336',
      [OrderStatus.CANCELLED]: '#795548',
      [OrderStatus.COLLECTED]: '#8bc34a',
    };
    return colors[status] || '#000000';
  }

  private getStatusCategory(status: OrderStatus): string {
    const doneStatuses: OrderStatus[] = [OrderStatus.COMPLETED, OrderStatus.COLLECTED, OrderStatus.PARTIAL];
    const cancelledStatuses: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.REQUEST_CANCEL];
    const exceptionStatuses: OrderStatus[] = [OrderStatus.POSTPONED, OrderStatus.ABSENT];

    if (doneStatuses.includes(status)) {
      return 'done';
    }
    if (cancelledStatuses.includes(status)) {
      return 'cancelled';
    }
    if (exceptionStatuses.includes(status)) {
      return 'exception';
    }
    return 'active';
  }

  private getRoleLabel(role: Role): string {
    const labels: Record<Role, string> = {
      [Role.HQ_ADMIN]: 'HQ Administrator',
      [Role.BRANCH_MANAGER]: 'Branch Manager',
      [Role.PARTNER_COORDINATOR]: 'Partner Coordinator',
      [Role.INSTALLER]: 'Installer',
    };
    return labels[role] || role;
  }

  private getRolePermissions(role: Role): string[] {
    const permissions: Record<Role, string[]> = {
      [Role.HQ_ADMIN]: [
        'users:manage',
        'branches:manage',
        'orders:all',
        'reports:all',
        'settings:manage',
      ],
      [Role.BRANCH_MANAGER]: [
        'users:read',
        'orders:branch',
        'reports:branch',
        'export:branch',
      ],
      [Role.PARTNER_COORDINATOR]: [
        'orders:partner',
        'orders:assign',
        'installers:manage',
      ],
      [Role.INSTALLER]: [
        'orders:own',
        'orders:update_status',
        'waste:capture',
      ],
    };
    return permissions[role] || [];
  }
}
