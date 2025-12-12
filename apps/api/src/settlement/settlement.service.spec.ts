import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SettlementService } from './settlement.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettlementStatus } from '@prisma/client';

describe('SettlementService', () => {
  let service: SettlementService;
  let prisma: jest.Mocked<PrismaService>;

  const mockPeriod = {
    id: 'period-123',
    branchId: 'branch-001',
    periodStart: new Date('2024-12-09'),
    periodEnd: new Date('2024-12-15'),
    status: SettlementStatus.OPEN,
    lockedBy: null,
    lockedAt: null,
    unlockedBy: null,
    unlockedAt: null,
  };

  const mockLockedPeriod = {
    ...mockPeriod,
    id: 'period-456',
    status: SettlementStatus.LOCKED,
    lockedBy: 'user-123',
    lockedAt: new Date('2024-12-16'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementService,
        {
          provide: PrismaService,
          useValue: {
            settlementPeriod: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            order: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<SettlementService>(SettlementService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  describe('getCurrentPeriod', () => {
    it('should return the most recent period for a branch', async () => {
      (prisma.settlementPeriod.findFirst as jest.Mock).mockResolvedValue(mockPeriod);

      const result = await service.getCurrentPeriod('branch-001');

      expect(result).toEqual(
        expect.objectContaining({
          id: 'period-123',
          branchId: 'branch-001',
          status: SettlementStatus.OPEN,
        }),
      );
      expect(prisma.settlementPeriod.findFirst).toHaveBeenCalledWith({
        where: { branchId: 'branch-001' },
        orderBy: { periodStart: 'desc' },
      });
    });

    it('should return null if no period exists', async () => {
      (prisma.settlementPeriod.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getCurrentPeriod('branch-001');

      expect(result).toBeNull();
    });
  });

  describe('getPeriodById', () => {
    it('should return period by id', async () => {
      (prisma.settlementPeriod.findUnique as jest.Mock).mockResolvedValue(mockPeriod);

      const result = await service.getPeriodById('period-123');

      expect(result.id).toBe('period-123');
    });

    it('should throw NotFoundException if period not found', async () => {
      (prisma.settlementPeriod.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getPeriodById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPeriodHistory', () => {
    it('should return paginated period history', async () => {
      const periods = [mockPeriod, { ...mockPeriod, id: 'period-124' }];
      (prisma.settlementPeriod.findMany as jest.Mock).mockResolvedValue(periods);
      (prisma.settlementPeriod.count as jest.Mock).mockResolvedValue(2);

      const result = await service.getPeriodHistory('branch-001', 20);

      expect(result.data).toHaveLength(2);
      expect(result.totalCount).toBe(2);
    });

    it('should support cursor-based pagination', async () => {
      (prisma.settlementPeriod.findMany as jest.Mock).mockResolvedValue([mockPeriod]);
      (prisma.settlementPeriod.count as jest.Mock).mockResolvedValue(10);

      await service.getPeriodHistory('branch-001', 20, 'cursor-id');

      expect(prisma.settlementPeriod.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'cursor-id' },
          skip: 1,
        }),
      );
    });
  });

  describe('lockPeriod', () => {
    it('should lock an open period', async () => {
      (prisma.settlementPeriod.findUnique as jest.Mock).mockResolvedValue(mockPeriod);
      (prisma.settlementPeriod.update as jest.Mock).mockResolvedValue({
        ...mockPeriod,
        status: SettlementStatus.LOCKED,
        lockedBy: 'user-123',
        lockedAt: expect.any(Date),
      });

      const result = await service.lockPeriod('period-123', 'user-123');

      expect(result.status).toBe(SettlementStatus.LOCKED);
      expect(prisma.settlementPeriod.update).toHaveBeenCalledWith({
        where: { id: 'period-123' },
        data: {
          status: SettlementStatus.LOCKED,
          lockedBy: 'user-123',
          lockedAt: expect.any(Date),
        },
      });
    });

    it('should throw NotFoundException if period not found', async () => {
      (prisma.settlementPeriod.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.lockPeriod('non-existent', 'user-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if already locked', async () => {
      (prisma.settlementPeriod.findUnique as jest.Mock).mockResolvedValue(mockLockedPeriod);

      await expect(service.lockPeriod('period-456', 'user-123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('unlockPeriod', () => {
    it('should unlock a locked period', async () => {
      (prisma.settlementPeriod.findUnique as jest.Mock).mockResolvedValue(mockLockedPeriod);
      (prisma.settlementPeriod.update as jest.Mock).mockResolvedValue({
        ...mockLockedPeriod,
        status: SettlementStatus.OPEN,
        unlockedBy: 'admin-123',
        unlockedAt: expect.any(Date),
      });

      const result = await service.unlockPeriod('period-456', 'admin-123');

      expect(result.status).toBe(SettlementStatus.OPEN);
      expect(prisma.settlementPeriod.update).toHaveBeenCalledWith({
        where: { id: 'period-456' },
        data: {
          status: SettlementStatus.OPEN,
          unlockedBy: 'admin-123',
          unlockedAt: expect.any(Date),
        },
      });
    });

    it('should throw NotFoundException if period not found', async () => {
      (prisma.settlementPeriod.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.unlockPeriod('non-existent', 'admin-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if already unlocked', async () => {
      (prisma.settlementPeriod.findUnique as jest.Mock).mockResolvedValue(mockPeriod);

      await expect(service.unlockPeriod('period-123', 'admin-123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('isOrderLocked', () => {
    const mockOrder = {
      branchId: 'branch-001',
      appointmentDate: new Date('2024-12-12'),
    };

    it('should return true if order belongs to locked period', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.settlementPeriod.findFirst as jest.Mock).mockResolvedValue(mockLockedPeriod);

      const result = await service.isOrderLocked('order-123');

      expect(result).toBe(true);
      expect(prisma.settlementPeriod.findFirst).toHaveBeenCalledWith({
        where: {
          branchId: 'branch-001',
          status: SettlementStatus.LOCKED,
          periodStart: { lte: mockOrder.appointmentDate },
          periodEnd: { gte: mockOrder.appointmentDate },
        },
      });
    });

    it('should return false if order does not belong to any locked period', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.settlementPeriod.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.isOrderLocked('order-123');

      expect(result).toBe(false);
    });

    it('should throw NotFoundException if order not found', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.isOrderLocked('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getOrCreatePeriod', () => {
    const periodStart = new Date('2024-12-16');
    const periodEnd = new Date('2024-12-22');

    it('should return existing period if found', async () => {
      (prisma.settlementPeriod.findFirst as jest.Mock).mockResolvedValue(mockPeriod);

      const result = await service.getOrCreatePeriod('branch-001', periodStart, periodEnd);

      expect(result.id).toBe('period-123');
      expect(prisma.settlementPeriod.create).not.toHaveBeenCalled();
    });

    it('should create new period if not found', async () => {
      const newPeriod = {
        id: 'period-new',
        branchId: 'branch-001',
        periodStart,
        periodEnd,
        status: SettlementStatus.OPEN,
        lockedBy: null,
        lockedAt: null,
        unlockedBy: null,
        unlockedAt: null,
      };

      (prisma.settlementPeriod.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.settlementPeriod.create as jest.Mock).mockResolvedValue(newPeriod);

      const result = await service.getOrCreatePeriod('branch-001', periodStart, periodEnd);

      expect(result.id).toBe('period-new');
      expect(prisma.settlementPeriod.create).toHaveBeenCalledWith({
        data: {
          branchId: 'branch-001',
          periodStart,
          periodEnd,
          status: SettlementStatus.OPEN,
        },
      });
    });
  });

  describe('getLockedPeriods', () => {
    it('should return all locked periods for a branch', async () => {
      const lockedPeriods = [mockLockedPeriod, { ...mockLockedPeriod, id: 'period-789' }];
      (prisma.settlementPeriod.findMany as jest.Mock).mockResolvedValue(lockedPeriods);

      const result = await service.getLockedPeriods('branch-001');

      expect(result).toHaveLength(2);
      expect(result.every((p) => p.status === SettlementStatus.LOCKED)).toBe(true);
      expect(prisma.settlementPeriod.findMany).toHaveBeenCalledWith({
        where: {
          branchId: 'branch-001',
          status: SettlementStatus.LOCKED,
        },
        orderBy: { periodStart: 'desc' },
      });
    });

    it('should return empty array if no locked periods', async () => {
      (prisma.settlementPeriod.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getLockedPeriods('branch-001');

      expect(result).toEqual([]);
    });
  });
});
