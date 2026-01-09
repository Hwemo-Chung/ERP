import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStateMachine } from './order-state-machine';
import { OrderStatus } from '@prisma/client';
import { SyncOperationType, BatchSyncItemDto } from './dto/batch-sync.dto';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: jest.Mocked<PrismaService>;
  let stateMachine: jest.Mocked<OrderStateMachine>;

  const mockOrder = {
    id: 'order-123',
    orderNo: 'ORD-2024-001',
    customerName: 'Test Customer',
    customerPhone: '010-1234-5678',
    address: { city: 'Seoul', detail: '123 Street' },
    vendor: 'VENDOR_A',
    branchId: 'branch-001',
    installerId: 'installer-001',
    partnerId: null,
    status: OrderStatus.UNASSIGNED,
    appointmentDate: new Date('2024-12-15'),
    promisedDate: new Date('2024-12-15'),
    remarks: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    branch: { id: 'branch-001', code: 'BR01', name: 'Seoul Branch' },
    partner: null,
    installer: { id: 'installer-001', name: 'Test Installer', phone: '010-0000-0000' },
    lines: [{ id: 'line-1', itemCode: 'ITEM001', itemName: 'Test Item', quantity: 1, weight: 10 }],
    statusHistory: [],
    appointments: [],
    wastePickups: [],
    attachments: [],
    _count: { attachments: 0 },
  };

  const mockTx = {
    order: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    orderStatusHistory: {
      create: jest.fn(),
    },
    appointment: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: {
            order: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              update: jest.fn(),
            },
            auditLog: {
              create: jest.fn(),
            },
            executeTransaction: jest.fn(),
          },
        },
        {
          provide: OrderStateMachine,
          useValue: {
            validateTransition: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    stateMachine = module.get(OrderStateMachine) as jest.Mocked<OrderStateMachine>;
  });

  describe('findAll', () => {
    it('should return paginated orders', async () => {
      const orders = [mockOrder];
      (prisma.order.findMany as jest.Mock).mockResolvedValue(orders);
      (prisma.order.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll({ limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.hasMore).toBe(false);
      expect(result.pagination.totalCount).toBe(1);
    });

    it('should filter by branch code', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.order.count as jest.Mock).mockResolvedValue(0);

      await service.findAll({ branchCode: 'BR01' });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            branch: { code: 'BR01' },
          }),
        }),
      );
    });

    it('should filter by status', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.order.count as jest.Mock).mockResolvedValue(0);

      await service.findAll({ status: OrderStatus.ASSIGNED });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: OrderStatus.ASSIGNED,
          }),
        }),
      );
    });

    it('should filter by date range', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.order.count as jest.Mock).mockResolvedValue(0);

      await service.findAll({
        appointmentDateFrom: '2024-12-01',
        appointmentDateTo: '2024-12-31',
      });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            appointmentDate: {
              gte: new Date('2024-12-01'),
              lte: new Date('2024-12-31'),
            },
          }),
        }),
      );
    });

    it('should handle cursor-based pagination', async () => {
      const moreOrders = [...Array(21)].map((_, i) => ({ ...mockOrder, id: `order-${i}` }));
      (prisma.order.findMany as jest.Mock).mockResolvedValue(moreOrders);
      (prisma.order.count as jest.Mock).mockResolvedValue(50);

      const result = await service.findAll({ limit: 20 });

      expect(result.data).toHaveLength(20);
      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.nextCursor).toBe('order-19');
    });
  });

  describe('findOne', () => {
    it('should return order by id', async () => {
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(mockOrder);

      const result = await service.findOne('order-123');

      expect(result).toEqual(mockOrder);
      expect(prisma.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-123', deletedAt: null },
        }),
      );
    });

    it('should throw NotFoundException if order not found', async () => {
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create order with audit log', async () => {
      const createDto = {
        orderNo: 'ORD-2024-002',
        customerName: 'New Customer',
        customerPhone: '010-5555-5555',
        address: { city: 'Busan', detail: '456 Avenue' },
        vendor: 'VENDOR_B',
        branchId: 'branch-002',
        appointmentDate: '2024-12-20',
        lines: [{ itemCode: 'ITEM002', itemName: 'New Item', quantity: 2, weight: 5 }],
      };

      mockTx.order.create.mockResolvedValue({ ...mockOrder, ...createDto });
      mockTx.auditLog.create.mockResolvedValue({});

      (prisma.executeTransaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      const result = await service.create(createDto as any, 'user-123');

      expect(mockTx.order.create).toHaveBeenCalled();
      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tableName: 'orders',
            action: 'CREATE',
            actor: 'user-123',
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('should update order successfully', async () => {
      const updateDto = { remarks: 'Updated remarks' };
      const updatedOrder = { ...mockOrder, remarks: 'Updated remarks', version: 2 };

      mockTx.order.findFirst.mockResolvedValue(mockOrder);
      mockTx.order.update.mockResolvedValue(updatedOrder);
      mockTx.auditLog.create.mockResolvedValue({});

      (prisma.executeTransaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      const result = await service.update('order-123', updateDto, 'user-123');

      expect(result.remarks).toBe('Updated remarks');
      expect(mockTx.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            version: { increment: 1 },
          }),
        }),
      );
    });

    it('should throw ConflictException on version mismatch', async () => {
      const updateDto = { remarks: 'Test', expectedVersion: 1 };
      const existingOrder = { ...mockOrder, version: 2 };

      mockTx.order.findFirst.mockResolvedValue(existingOrder);

      (prisma.executeTransaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      await expect(service.update('order-123', updateDto, 'user-123')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException if order not found', async () => {
      mockTx.order.findFirst.mockResolvedValue(null);

      (prisma.executeTransaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      await expect(service.update('non-existent', {}, 'user-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should validate state transition when status changes', async () => {
      const updateDto = { status: OrderStatus.ASSIGNED, installerId: 'installer-002' };

      mockTx.order.findFirst.mockResolvedValue(mockOrder);
      mockTx.order.update.mockResolvedValue({ ...mockOrder, status: OrderStatus.ASSIGNED });
      mockTx.orderStatusHistory.create.mockResolvedValue({});
      mockTx.auditLog.create.mockResolvedValue({});

      stateMachine.validateTransition.mockReturnValue({ valid: true });

      (prisma.executeTransaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      await service.update('order-123', updateDto, 'user-123');

      expect(stateMachine.validateTransition).toHaveBeenCalledWith(
        OrderStatus.UNASSIGNED,
        OrderStatus.ASSIGNED,
        expect.any(Object),
      );
      expect(mockTx.orderStatusHistory.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException on invalid state transition', async () => {
      const updateDto = { status: OrderStatus.COMPLETED };

      mockTx.order.findFirst.mockResolvedValue(mockOrder);
      stateMachine.validateTransition.mockReturnValue({
        valid: false,
        error: 'Invalid transition',
        errorCode: 'E2001',
      });

      (prisma.executeTransaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      await expect(service.update('order-123', updateDto, 'user-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should log appointment change', async () => {
      const updateDto = {
        appointmentDate: '2024-12-25',
        appointmentChangeReason: 'Customer request',
      };

      mockTx.order.findFirst.mockResolvedValue(mockOrder);
      mockTx.order.update.mockResolvedValue({
        ...mockOrder,
        appointmentDate: new Date('2024-12-25'),
      });
      mockTx.appointment.create.mockResolvedValue({});
      mockTx.auditLog.create.mockResolvedValue({});

      (prisma.executeTransaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      await service.update('order-123', updateDto, 'user-123');

      expect(mockTx.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: 'order-123',
            reason: 'Customer request',
          }),
        }),
      );
    });
  });

  describe('bulkStatusUpdate', () => {
    it('should update multiple orders', async () => {
      const bulkDto = {
        orderIds: ['order-1', 'order-2', 'order-3'],
        status: OrderStatus.ASSIGNED,
        installerId: 'installer-001',
      };

      // Mock update calls
      mockTx.order.findFirst.mockResolvedValue(mockOrder);
      mockTx.order.update.mockResolvedValue({ ...mockOrder, status: OrderStatus.ASSIGNED });
      mockTx.orderStatusHistory.create.mockResolvedValue({});
      mockTx.auditLog.create.mockResolvedValue({});
      stateMachine.validateTransition.mockReturnValue({ valid: true });

      (prisma.executeTransaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      const result = await service.bulkStatusUpdate(bulkDto as any, 'user-123');

      expect(result.totalProcessed).toBe(3);
      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(0);
    });

    it('should handle partial failures', async () => {
      const bulkDto = {
        orderIds: ['order-1', 'order-2'],
        status: OrderStatus.ASSIGNED,
      };

      let callCount = 0;
      (prisma.executeTransaction as jest.Mock).mockImplementation(async (callback) => {
        callCount++;
        if (callCount === 1) {
          mockTx.order.findFirst.mockResolvedValue(mockOrder);
          mockTx.order.update.mockResolvedValue({ ...mockOrder, status: OrderStatus.ASSIGNED });
          mockTx.orderStatusHistory.create.mockResolvedValue({});
          mockTx.auditLog.create.mockResolvedValue({});
          stateMachine.validateTransition.mockReturnValue({ valid: true });
          return callback(mockTx);
        } else {
          throw new Error('Database error');
        }
      });

      const result = await service.bulkStatusUpdate(bulkDto as any, 'user-123');

      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);
      expect(result.results.find((r) => !r.success)?.error).toBe('Database error');
    });
  });

  describe('remove', () => {
    it('should soft delete order', async () => {
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.order.update as jest.Mock).mockResolvedValue({ ...mockOrder, deletedAt: new Date() });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      await service.remove('order-123', 'user-123');

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-123' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'DELETE',
          }),
        }),
      );
    });
  });

  describe('splitOrder', () => {
    const mockParentOrder = {
      ...mockOrder,
      id: 'parent-order-123',
      orderNo: 'ORD-2024-PARENT',
      version: 1,
      status: OrderStatus.UNASSIGNED,
      lines: [
        {
          id: 'line-1',
          itemCode: 'ITEM001',
          itemName: 'Refrigerator',
          quantity: 10,
          weight: 50,
        },
        {
          id: 'line-2',
          itemCode: 'ITEM002',
          itemName: 'Washing Machine',
          quantity: 5,
          weight: 30,
        },
      ],
      branch: { id: 'branch-001', code: 'BR01', name: 'Seoul Branch' },
      partner: null,
    };

    const mockSplitDto = {
      orderId: 'parent-order-123',
      version: 1,
      splits: [
        {
          lineId: 'line-1',
          assignments: [
            { installerId: 'installer-001', installerName: 'John Doe', quantity: 6 },
            { installerId: 'installer-002', installerName: 'Jane Smith', quantity: 4 },
          ],
        },
        {
          lineId: 'line-2',
          assignments: [{ installerId: 'installer-001', installerName: 'John Doe', quantity: 5 }],
        },
      ],
    };

    beforeEach(() => {
      // Reset mocks
      mockTx.order.create.mockClear();
      mockTx.order.findFirst.mockClear();
      mockTx.order.update.mockClear();
      mockTx.orderStatusHistory.create.mockClear();
      (prisma as any).executeTransaction.mockClear();

      // Mock transaction execution
      (prisma as any).executeTransaction.mockImplementation(async (callback: any) => {
        const result = await callback(mockTx);
        return result;
      });
    });

    it('should split order successfully with multiple assignments', async () => {
      mockTx.order.findFirst.mockResolvedValue(mockParentOrder);
      mockTx.order.create.mockImplementation(async (data: any) => ({
        id: `child-${Math.random()}`,
        orderNo: data.data.orderNo,
        ...data.data,
        lines: [data.data.lines.create],
        branch: mockParentOrder.branch,
        partner: null,
        installer: null,
      }));
      mockTx.order.update.mockResolvedValue({
        ...mockParentOrder,
        status: OrderStatus.CANCELLED,
        version: 2,
      });
      mockTx.orderStatusHistory.create.mockResolvedValue({});
      (mockTx as any).splitOrder = { create: jest.fn().mockResolvedValue({}) };
      mockTx.auditLog.create.mockResolvedValue({});

      const result = await service.splitOrder('parent-order-123', mockSplitDto, 'user-123');

      expect(result.success).toBe(true);
      expect(result.childOrders).toHaveLength(3); // 2 assignments for line-1, 1 for line-2
      expect(mockTx.order.create).toHaveBeenCalledTimes(3);
      expect(mockTx.order.update).toHaveBeenCalledWith({
        where: { id: 'parent-order-123' },
        data: expect.objectContaining({
          status: OrderStatus.CANCELLED,
          version: { increment: 1 },
        }),
      });
    });

    it('should throw NotFoundException when parent order not found', async () => {
      mockTx.order.findFirst.mockResolvedValue(null);

      await expect(service.splitOrder('invalid-order', mockSplitDto, 'user-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException on version mismatch', async () => {
      mockTx.order.findFirst.mockResolvedValue({ ...mockParentOrder, version: 2 });

      await expect(
        service.splitOrder('parent-order-123', mockSplitDto, 'user-123'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when order status is not allowed for split', async () => {
      mockTx.order.findFirst.mockResolvedValue({
        ...mockParentOrder,
        status: OrderStatus.COMPLETED, // Not allowed
      });

      await expect(
        service.splitOrder('parent-order-123', mockSplitDto, 'user-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when line ID not found', async () => {
      mockTx.order.findFirst.mockResolvedValue(mockParentOrder);

      const invalidDto = {
        ...mockSplitDto,
        splits: [
          {
            lineId: 'non-existent-line',
            assignments: [{ installerId: 'inst-1', installerName: 'Test', quantity: 10 }],
          },
        ],
      };

      await expect(service.splitOrder('parent-order-123', invalidDto, 'user-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when quantities do not match', async () => {
      mockTx.order.findFirst.mockResolvedValue(mockParentOrder);

      const invalidDto = {
        ...mockSplitDto,
        splits: [
          {
            lineId: 'line-1',
            assignments: [
              { installerId: 'installer-001', installerName: 'John Doe', quantity: 6 },
              { installerId: 'installer-002', installerName: 'Jane Smith', quantity: 3 }, // Total 9, but line has 10
            ],
          },
        ],
      };

      await expect(service.splitOrder('parent-order-123', invalidDto, 'user-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create child orders with inherited metadata', async () => {
      mockTx.order.findFirst.mockResolvedValue(mockParentOrder);

      const createdOrders: any[] = [];
      mockTx.order.create.mockImplementation(async (data: any) => {
        const childOrder = {
          id: `child-${createdOrders.length}`,
          orderNo: data.data.orderNo,
          customerName: data.data.customerName,
          customerPhone: data.data.customerPhone,
          address: data.data.address,
          vendor: data.data.vendor,
          branchId: data.data.branchId,
          installerId: data.data.installerId,
          status: data.data.status,
          lines: [data.data.lines.create],
          branch: mockParentOrder.branch,
          partner: null,
          installer: null,
        };
        createdOrders.push(childOrder);
        return childOrder;
      });

      mockTx.order.update.mockResolvedValue({
        ...mockParentOrder,
        status: OrderStatus.CANCELLED,
      });
      mockTx.orderStatusHistory.create.mockResolvedValue({});
      (mockTx as any).splitOrder = { create: jest.fn().mockResolvedValue({}) };
      mockTx.auditLog.create.mockResolvedValue({});

      await service.splitOrder('parent-order-123', mockSplitDto, 'user-123');

      // Verify child orders inherit parent metadata
      expect(createdOrders[0].customerName).toBe(mockParentOrder.customerName);
      expect(createdOrders[0].customerPhone).toBe(mockParentOrder.customerPhone);
      expect(createdOrders[0].vendor).toBe(mockParentOrder.vendor);
      expect(createdOrders[0].branchId).toBe(mockParentOrder.branchId);
    });

    it('should assign installers to child orders when provided', async () => {
      mockTx.order.findFirst.mockResolvedValue(mockParentOrder);

      let childOrderCount = 0;
      mockTx.order.create.mockImplementation(async (data: any) => {
        childOrderCount++;
        return {
          id: `child-${childOrderCount}`,
          orderNo: data.data.orderNo,
          installerId: data.data.installerId,
          status: data.data.status,
          lines: [data.data.lines.create],
          branch: mockParentOrder.branch,
          partner: null,
          installer: null,
        };
      });

      mockTx.order.update.mockResolvedValue({
        ...mockParentOrder,
        status: OrderStatus.CANCELLED,
      });
      mockTx.orderStatusHistory.create.mockResolvedValue({});
      (mockTx as any).splitOrder = { create: jest.fn().mockResolvedValue({}) };
      mockTx.auditLog.create.mockResolvedValue({});

      const result = await service.splitOrder('parent-order-123', mockSplitDto, 'user-123');

      // Verify assigned status for orders with installers
      expect(mockTx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            installerId: 'installer-001',
            status: OrderStatus.ASSIGNED,
          }),
        }),
      );

      // Verify status history created for assigned orders
      expect(mockTx.orderStatusHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            previousStatus: OrderStatus.UNASSIGNED,
            newStatus: OrderStatus.ASSIGNED,
          }),
        }),
      );
    });

    it('should create split_orders records linking parent and children', async () => {
      mockTx.order.findFirst.mockResolvedValue(mockParentOrder);
      mockTx.order.create.mockImplementation(async (data: any) => ({
        id: `child-${Math.random()}`,
        orderNo: data.data.orderNo,
        ...data.data,
        lines: [data.data.lines.create],
      }));
      mockTx.order.update.mockResolvedValue({
        ...mockParentOrder,
        status: OrderStatus.CANCELLED,
      });
      mockTx.orderStatusHistory.create.mockResolvedValue({});

      const mockSplitOrderCreate = jest.fn().mockResolvedValue({});
      (mockTx as any).splitOrder = { create: mockSplitOrderCreate };
      mockTx.auditLog.create.mockResolvedValue({});

      await service.splitOrder('parent-order-123', mockSplitDto, 'user-123');

      // Should create 3 split records (2 for line-1, 1 for line-2)
      expect(mockSplitOrderCreate).toHaveBeenCalledTimes(3);
      expect(mockSplitOrderCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            parentOrderId: 'parent-order-123',
            createdBy: 'user-123',
          }),
        }),
      );
    });

    it('should create audit log with split details', async () => {
      mockTx.order.findFirst.mockResolvedValue(mockParentOrder);
      mockTx.order.create.mockImplementation(async (data: any) => ({
        id: `child-${Math.random()}`,
        orderNo: data.data.orderNo,
        lines: [],
      }));
      mockTx.order.update.mockResolvedValue({
        ...mockParentOrder,
        status: OrderStatus.CANCELLED,
      });
      mockTx.orderStatusHistory.create.mockResolvedValue({});
      (mockTx as any).splitOrder = { create: jest.fn().mockResolvedValue({}) };
      mockTx.auditLog.create.mockResolvedValue({});

      await service.splitOrder('parent-order-123', mockSplitDto, 'user-123');

      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tableName: 'orders',
            recordId: 'parent-order-123',
            action: 'SPLIT',
            actor: 'user-123',
            diff: expect.any(Object),
          }),
        }),
      );
    });

    it('should handle split with unassigned installers', async () => {
      const dtoWithUnassigned = {
        orderId: 'parent-order-123',
        version: 1,
        splits: [
          {
            lineId: 'line-1',
            assignments: [
              { installerName: 'Unassigned', quantity: 10 }, // No installerId
            ],
          },
        ],
      };

      mockTx.order.findFirst.mockResolvedValue(mockParentOrder);
      mockTx.order.create.mockImplementation(async (data: any) => ({
        id: 'child-unassigned',
        installerId: null,
        status: OrderStatus.UNASSIGNED,
        lines: [],
      }));
      mockTx.order.update.mockResolvedValue({
        ...mockParentOrder,
        status: OrderStatus.CANCELLED,
      });
      mockTx.orderStatusHistory.create.mockResolvedValue({});
      (mockTx as any).splitOrder = { create: jest.fn().mockResolvedValue({}) };
      mockTx.auditLog.create.mockResolvedValue({});

      await service.splitOrder('parent-order-123', dtoWithUnassigned, 'user-123');

      expect(mockTx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            installerId: null,
            status: OrderStatus.UNASSIGNED,
          }),
        }),
      );
    });
  });
  describe('addEvent', () => {
    it('should add event to order successfully', async () => {
      const eventDto = {
        eventType: 'REMARK' as any,
        note: '고객이 확장형 거실 설치를 요청함',
      };

      const mockEvent = {
        id: 'event-001',
        eventType: 'REMARK',
        note: '고객이 확장형 거실 설치를 요청함',
      };

      const mockOrderWithEvents = {
        ...mockOrder,
        events: [],
      };

      (prisma.executeTransaction as jest.Mock).mockImplementationOnce(
        async (callback: (tx: any) => Promise<any>) => {
          const mockTxLocal = {
            order: {
              findUnique: jest.fn().mockResolvedValueOnce(mockOrderWithEvents),
            },
            orderEvent: {
              create: jest.fn().mockResolvedValueOnce(mockEvent),
            },
            auditLog: {
              create: jest.fn().mockResolvedValueOnce({}),
            },
          };
          return callback(mockTxLocal);
        },
      );

      const result = await service.addEvent('order-123', eventDto, 'user-123');

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('order-123');
    });

    it('should throw NotFoundException when order not found', async () => {
      const eventDto = {
        eventType: 'REMARK' as any,
        note: 'Test note',
      };

      (prisma.executeTransaction as jest.Mock).mockImplementationOnce(
        async (callback: (tx: any) => Promise<any>) => {
          const mockTxLocal = {
            order: {
              findUnique: jest.fn().mockResolvedValueOnce(null),
            },
          };
          return callback(mockTxLocal);
        },
      );

      await expect(service.addEvent('nonexistent-id', eventDto, 'user-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException on version mismatch', async () => {
      const eventDto = {
        eventType: 'REMARK' as any,
        note: 'Test note',
        expectedVersion: 5,
      };

      (prisma.executeTransaction as jest.Mock).mockImplementationOnce(
        async (callback: (tx: any) => Promise<any>) => {
          const mockTxLocal = {
            order: {
              findUnique: jest.fn().mockResolvedValueOnce({
                ...mockOrder,
                version: 1,
                events: [],
              }),
            },
          };
          return callback(mockTxLocal);
        },
      );

      await expect(service.addEvent('order-123', eventDto, 'user-123')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException for invalid status', async () => {
      const eventDto = {
        eventType: 'REMARK' as any,
        note: 'Test note',
      };

      (prisma.executeTransaction as jest.Mock).mockImplementationOnce(
        async (callback: (tx: any) => Promise<any>) => {
          const mockTxLocal = {
            order: {
              findUnique: jest.fn().mockResolvedValueOnce({
                ...mockOrder,
                status: OrderStatus.CANCELLED,
                events: [],
              }),
            },
          };
          return callback(mockTxLocal);
        },
      );

      await expect(service.addEvent('order-123', eventDto, 'user-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should accept events for valid statuses', async () => {
      const eventDto = {
        eventType: 'ISSUE' as any,
        note: 'Test issue',
      };

      const mockEvent = {
        id: 'event-001',
        eventType: 'ISSUE',
        note: 'Test issue',
      };

      const validStatuses = [OrderStatus.UNASSIGNED, OrderStatus.ASSIGNED, OrderStatus.CONFIRMED];

      for (const status of validStatuses) {
        (prisma.executeTransaction as jest.Mock).mockImplementationOnce(
          async (callback: (tx: any) => Promise<any>) => {
            const mockTxLocal = {
              order: {
                findUnique: jest.fn().mockResolvedValueOnce({
                  ...mockOrder,
                  status,
                  events: [],
                }),
              },
              orderEvent: {
                create: jest.fn().mockResolvedValueOnce(mockEvent),
              },
              auditLog: {
                create: jest.fn().mockResolvedValueOnce({}),
              },
            };
            return callback(mockTxLocal);
          },
        );

        const result = await service.addEvent('order-123', eventDto, 'user-123');
        expect(result.success).toBe(true);
      }
    });

    it('should include created event in response', async () => {
      const eventDto = {
        eventType: 'NOTE' as any,
        note: 'Installation notes',
      };

      const mockEvent = {
        id: 'event-001',
        orderId: 'order-123',
        eventType: 'NOTE',
        note: 'Installation notes',
        createdBy: 'user-123',
        createdAt: new Date(),
        user: {
          id: 'user-123',
          username: 'installer01',
          fullName: 'Kim Installation',
        },
      };

      (prisma.executeTransaction as jest.Mock).mockImplementationOnce(
        async (callback: (tx: any) => Promise<any>) => {
          const mockTxLocal = {
            order: {
              findUnique: jest.fn().mockResolvedValueOnce({
                ...mockOrder,
                events: [],
              }),
            },
            orderEvent: {
              create: jest.fn().mockResolvedValueOnce(mockEvent),
            },
            auditLog: {
              create: jest.fn().mockResolvedValueOnce({}),
            },
          };
          return callback(mockTxLocal);
        },
      );

      const result = await service.addEvent('order-123', eventDto, 'user-123');

      expect(result.event).toBeDefined();
      expect(result.event.eventType).toBe('NOTE');
      expect(result.event.note).toBe('Installation notes');
      expect(result.totalEvents).toBe(1);
    });
  });

  describe('cancelOrder', () => {
    it('should cancel order successfully', async () => {
      const cancelDto = {
        reason: 'CUSTOMER_REQUEST' as any,
        note: '고객이 취소 요청',
      };

      const mockCancellationRecord = {
        id: 'cancel-001',
        orderId: 'order-123',
        reason: 'CUSTOMER_REQUEST',
        note: '고객이 취소 요청',
        cancelledBy: 'user-123',
        cancelledAt: new Date(),
        user: {
          id: 'user-123',
          username: 'manager01',
          fullName: 'Kim Manager',
        },
      };

      const mockUpdatedOrder = {
        ...mockOrder,
        status: OrderStatus.CANCELLED,
        version: 2,
      };

      (prisma.executeTransaction as jest.Mock).mockImplementationOnce(
        async (callback: (tx: any) => Promise<any>) => {
          const mockTxLocal = {
            cancellationRecord: {
              findUnique: jest.fn().mockResolvedValueOnce(null),
              create: jest.fn().mockResolvedValueOnce(mockCancellationRecord),
            },
            order: {
              findUnique: jest.fn().mockResolvedValueOnce(mockOrder),
              update: jest.fn().mockResolvedValueOnce(mockUpdatedOrder),
            },
            orderStatusHistory: {
              create: jest.fn().mockResolvedValueOnce({}),
            },
            auditLog: {
              create: jest.fn().mockResolvedValueOnce({}),
            },
          };

          return callback(mockTxLocal);
        },
      );

      const result = await service.cancelOrder('order-123', cancelDto, 'user-123');

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('order-123');
      expect(result.newStatus).toBe(OrderStatus.CANCELLED);
      expect(result.cancellationRecord.reason).toBe('CUSTOMER_REQUEST');
    });

    it('should throw NotFoundException when order not found', async () => {
      const cancelDto = {
        reason: 'CUSTOMER_REQUEST' as any,
        note: 'Test cancellation',
      };

      (prisma.executeTransaction as jest.Mock).mockImplementationOnce(
        async (callback: (tx: any) => Promise<any>) => {
          const mockTxLocal = {
            cancellationRecord: {
              findUnique: jest.fn().mockResolvedValueOnce(null),
            },
            order: {
              findUnique: jest.fn().mockResolvedValueOnce(null),
            },
          };
          return callback(mockTxLocal);
        },
      );

      await expect(service.cancelOrder('nonexistent-id', cancelDto, 'user-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if order already cancelled', async () => {
      const cancelDto = {
        reason: 'CUSTOMER_REQUEST' as any,
        note: 'Test cancellation',
      };

      const mockCancellationRecord = {
        id: 'cancel-001',
        orderId: 'order-123',
        reason: 'OUT_OF_STOCK',
        cancelledAt: new Date(),
      };

      (prisma.executeTransaction as jest.Mock).mockImplementationOnce(
        async (callback: (tx: any) => Promise<any>) => {
          const mockTxLocal = {
            cancellationRecord: {
              findUnique: jest.fn().mockResolvedValueOnce(mockCancellationRecord),
            },
          };
          return callback(mockTxLocal);
        },
      );

      await expect(service.cancelOrder('order-123', cancelDto, 'user-123')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException for invalid status', async () => {
      const cancelDto = {
        reason: 'CUSTOMER_REQUEST' as any,
        note: 'Test cancellation',
      };

      (prisma.executeTransaction as jest.Mock).mockImplementationOnce(
        async (callback: (tx: any) => Promise<any>) => {
          const mockTxLocal = {
            cancellationRecord: {
              findUnique: jest.fn().mockResolvedValueOnce(null),
            },
            order: {
              findUnique: jest.fn().mockResolvedValueOnce({
                ...mockOrder,
                status: OrderStatus.COMPLETED, // Cannot cancel completed order
              }),
            },
          };
          return callback(mockTxLocal);
        },
      );

      await expect(service.cancelOrder('order-123', cancelDto, 'user-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should accept orders with various valid statuses', async () => {
      const cancelDto = {
        reason: 'OUT_OF_STOCK' as any,
        note: 'Out of stock',
      };

      const mockCancellationRecord = {
        id: 'cancel-001',
        orderId: 'order-123',
        reason: 'OUT_OF_STOCK',
        note: 'Out of stock',
        cancelledBy: 'user-123',
        cancelledAt: new Date(),
        user: {
          id: 'user-123',
          username: 'manager01',
          fullName: 'Kim Manager',
        },
      };

      const validStatuses = [OrderStatus.UNASSIGNED, OrderStatus.ASSIGNED, OrderStatus.CONFIRMED];

      for (const status of validStatuses) {
        (prisma.executeTransaction as jest.Mock).mockImplementationOnce(
          async (callback: (tx: any) => Promise<any>) => {
            const mockTxLocal = {
              cancellationRecord: {
                findUnique: jest.fn().mockResolvedValueOnce(null),
                create: jest.fn().mockResolvedValueOnce(mockCancellationRecord),
              },
              order: {
                findUnique: jest.fn().mockResolvedValueOnce({
                  ...mockOrder,
                  status,
                }),
                update: jest.fn().mockResolvedValueOnce({
                  ...mockOrder,
                  status: OrderStatus.CANCELLED,
                  version: 2,
                }),
              },
              orderStatusHistory: {
                create: jest.fn().mockResolvedValueOnce({}),
              },
              auditLog: {
                create: jest.fn().mockResolvedValueOnce({}),
              },
            };
            return callback(mockTxLocal);
          },
        );

        const result = await service.cancelOrder('order-123', cancelDto, 'user-123');
        expect(result.success).toBe(true);
        expect(result.newStatus).toBe(OrderStatus.CANCELLED);
      }
    });

    it('should create order status history', async () => {
      const cancelDto = {
        reason: 'PAYMENT_FAILED' as any,
        note: 'Payment processing failed',
      };

      let statusHistoryCreated = false;

      const mockCancellationRecord = {
        id: 'cancel-001',
        orderId: 'order-123',
        reason: 'PAYMENT_FAILED',
        note: 'Payment processing failed',
        cancelledBy: 'user-123',
        cancelledAt: new Date(),
        user: {
          id: 'user-123',
          username: 'manager01',
          fullName: 'Kim Manager',
        },
      };

      (prisma.executeTransaction as jest.Mock).mockImplementationOnce(
        async (callback: (tx: any) => Promise<any>) => {
          const mockTxLocal = {
            cancellationRecord: {
              findUnique: jest.fn().mockResolvedValueOnce(null),
              create: jest.fn().mockResolvedValueOnce(mockCancellationRecord),
            },
            order: {
              findUnique: jest.fn().mockResolvedValueOnce(mockOrder),
              update: jest.fn().mockResolvedValueOnce({
                ...mockOrder,
                status: OrderStatus.CANCELLED,
                version: 2,
              }),
            },
            orderStatusHistory: {
              create: jest.fn().mockImplementationOnce(() => {
                statusHistoryCreated = true;
                return {};
              }),
            },
            auditLog: {
              create: jest.fn().mockResolvedValueOnce({}),
            },
          };
          return callback(mockTxLocal);
        },
      );

      const result = await service.cancelOrder('order-123', cancelDto, 'user-123');

      expect(result.success).toBe(true);
      expect(statusHistoryCreated).toBe(true);
    });

    it('should include cancellation reason in response', async () => {
      const cancelDto = {
        reason: 'DUPLICATE_ORDER' as any,
        note: 'Duplicate entry in system',
      };

      const mockCancellationRecord = {
        id: 'cancel-002',
        orderId: 'order-456',
        reason: 'DUPLICATE_ORDER',
        note: 'Duplicate entry in system',
        cancelledBy: 'user-123',
        cancelledAt: new Date(),
        user: {
          id: 'user-123',
          username: 'manager01',
          fullName: 'Kim Manager',
        },
      };

      (prisma.executeTransaction as jest.Mock).mockImplementationOnce(
        async (callback: (tx: any) => Promise<any>) => {
          const mockTxLocal = {
            cancellationRecord: {
              findUnique: jest.fn().mockResolvedValueOnce(null),
              create: jest.fn().mockResolvedValueOnce(mockCancellationRecord),
            },
            order: {
              findUnique: jest.fn().mockResolvedValueOnce(mockOrder),
              update: jest.fn().mockResolvedValueOnce({
                ...mockOrder,
                status: OrderStatus.CANCELLED,
                version: 2,
              }),
            },
            orderStatusHistory: {
              create: jest.fn().mockResolvedValueOnce({}),
            },
            auditLog: {
              create: jest.fn().mockResolvedValueOnce({}),
            },
          };
          return callback(mockTxLocal);
        },
      );

      const result = await service.cancelOrder('order-123', cancelDto, 'user-123');

      expect(result.cancellationRecord.reason).toBe('DUPLICATE_ORDER');
      expect(result.cancellationRecord.note).toBe('Duplicate entry in system');
    });
  });

  describe('revertOrder', () => {
    it('should revert cancelled order successfully', async () => {
      const revertDto = {
        reason: '고객이 재주문을 요청하여 취소 철회',
      };

      const mockCancellationRecord = {
        id: 'cancel-001',
        orderId: 'order-123',
        reason: 'CUSTOMER_REQUEST',
        previousStatus: OrderStatus.ASSIGNED,
      };

      const mockOrderWithCancellation = {
        ...mockOrder,
        status: OrderStatus.CANCELLED,
        cancellationRecord: mockCancellationRecord,
      };

      const mockUpdatedOrder = {
        ...mockOrder,
        status: OrderStatus.ASSIGNED,
        version: 2,
      };

      (prisma.executeTransaction as jest.Mock).mockImplementationOnce(
        async (callback: (tx: any) => Promise<any>) => {
          const mockTxLocal = {
            order: {
              findUnique: jest.fn().mockResolvedValueOnce(mockOrderWithCancellation),
              update: jest.fn().mockResolvedValueOnce(mockUpdatedOrder),
            },
            cancellationRecord: {
              delete: jest.fn().mockResolvedValueOnce({}),
            },
            orderStatusHistory: {
              create: jest.fn().mockResolvedValueOnce({}),
            },
            auditLog: {
              create: jest.fn().mockResolvedValueOnce({}),
            },
          };
          return callback(mockTxLocal);
        },
      );

      const result = await service.revertOrder('order-123', revertDto, 'user-123');

      expect(result.success).toBe(true);
      expect(result.previousStatus).toBe(OrderStatus.CANCELLED);
      expect(result.newStatus).toBe(OrderStatus.ASSIGNED);
    });

    it('should throw NotFoundException when order not found', async () => {
      const revertDto = {
        reason: 'Revert cancellation',
      };

      (prisma.executeTransaction as jest.Mock).mockImplementationOnce(
        async (callback: (tx: any) => Promise<any>) => {
          const mockTxLocal = {
            order: {
              findUnique: jest.fn().mockResolvedValueOnce(null),
            },
          };
          return callback(mockTxLocal);
        },
      );

      await expect(service.revertOrder('nonexistent-id', revertDto, 'user-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if order is not cancelled', async () => {
      const revertDto = {
        reason: 'Revert cancellation',
      };

      (prisma.executeTransaction as jest.Mock).mockImplementationOnce(
        async (callback: (tx: any) => Promise<any>) => {
          const mockTxLocal = {
            order: {
              findUnique: jest.fn().mockResolvedValueOnce({
                ...mockOrder,
                status: OrderStatus.COMPLETED, // Not cancelled
              }),
            },
          };
          return callback(mockTxLocal);
        },
      );

      await expect(service.revertOrder('order-123', revertDto, 'user-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should use target status if provided', async () => {
      const revertDto = {
        targetStatus: OrderStatus.CONFIRMED as any,
        reason: 'Revert to confirmed status',
      };

      const mockCancellationRecord = {
        id: 'cancel-001',
        orderId: 'order-123',
        reason: 'CUSTOMER_REQUEST',
        previousStatus: OrderStatus.ASSIGNED,
      };

      const mockOrderWithCancellation = {
        ...mockOrder,
        status: OrderStatus.CANCELLED,
        cancellationRecord: mockCancellationRecord,
      };

      (prisma.executeTransaction as jest.Mock).mockImplementationOnce(
        async (callback: (tx: any) => Promise<any>) => {
          const mockTxLocal = {
            order: {
              findUnique: jest.fn().mockResolvedValueOnce(mockOrderWithCancellation),
              update: jest.fn().mockResolvedValueOnce({
                ...mockOrder,
                status: OrderStatus.CONFIRMED,
                version: 2,
              }),
            },
            cancellationRecord: {
              delete: jest.fn().mockResolvedValueOnce({}),
            },
            orderStatusHistory: {
              create: jest.fn().mockResolvedValueOnce({}),
            },
            auditLog: {
              create: jest.fn().mockResolvedValueOnce({}),
            },
          };
          return callback(mockTxLocal);
        },
      );

      const result = await service.revertOrder('order-123', revertDto, 'user-123');

      expect(result.newStatus).toBe(OrderStatus.CONFIRMED);
    });

    it('should delete cancellation record on successful revert', async () => {
      const revertDto = {
        reason: 'Customer changed mind',
      };

      let cancellationDeleted = false;

      const mockCancellationRecord = {
        id: 'cancel-001',
        orderId: 'order-123',
        reason: 'OUT_OF_STOCK',
        previousStatus: OrderStatus.ASSIGNED,
      };

      (prisma.executeTransaction as jest.Mock).mockImplementationOnce(
        async (callback: (tx: any) => Promise<any>) => {
          const mockTxLocal = {
            order: {
              findUnique: jest.fn().mockResolvedValueOnce({
                ...mockOrder,
                status: OrderStatus.CANCELLED,
                cancellationRecord: mockCancellationRecord,
              }),
              update: jest.fn().mockResolvedValueOnce({
                ...mockOrder,
                status: OrderStatus.ASSIGNED,
                version: 2,
              }),
            },
            cancellationRecord: {
              delete: jest.fn().mockImplementationOnce(() => {
                cancellationDeleted = true;
                return {};
              }),
            },
            orderStatusHistory: {
              create: jest.fn().mockResolvedValueOnce({}),
            },
            auditLog: {
              create: jest.fn().mockResolvedValueOnce({}),
            },
          };
          return callback(mockTxLocal);
        },
      );

      const result = await service.revertOrder('order-123', revertDto, 'user-123');

      expect(result.success).toBe(true);
      expect(cancellationDeleted).toBe(true);
    });
  });

  describe('reassignOrder', () => {
    it('should reassign order to new installer successfully', async () => {
      const reassignDto = {
        newInstallerId: 'installer-002',
        reason: '기존 설치자 휴가로 인한 긴급 재배정',
      };

      const mockNewInstaller = {
        id: 'installer-002',
        name: 'Lee Installer',
        phone: '010-9999-8888',
      };

      const mockOrderWithInstaller = {
        ...mockOrder,
        status: OrderStatus.ASSIGNED,
        installer: {
          id: 'installer-001',
          name: 'Kim Installer',
          phone: '010-1111-2222',
        },
        branch: {
          id: 'branch-001',
          code: 'BR01',
          name: 'Seoul Branch',
        },
        partner: null,
      };

      (prisma.executeTransaction as jest.Mock).mockImplementationOnce(
        async (callback: (tx: any) => Promise<any>) => {
          const mockTxLocal = {
            order: {
              findUnique: jest.fn().mockResolvedValueOnce(mockOrderWithInstaller),
              update: jest.fn().mockResolvedValueOnce({
                ...mockOrderWithInstaller,
                installerId: 'installer-002',
                version: 2,
              }),
            },
            installer: {
              findUnique: jest.fn().mockResolvedValueOnce(mockNewInstaller),
            },
            orderStatusHistory: {
              create: jest.fn().mockResolvedValueOnce({}),
            },
            auditLog: {
              create: jest.fn().mockResolvedValueOnce({}),
            },
          };
          return callback(mockTxLocal);
        },
      );

      const result = await service.reassignOrder('order-123', reassignDto, 'user-123');

      expect(result.success).toBe(true);
      expect(result.newAssignment.installer.id).toBe('installer-002');
      expect(result.previousAssignment.installer?.id).toBe('installer-001');
    });

    it('should throw NotFoundException when order not found', async () => {
      const reassignDto = {
        newInstallerId: 'installer-002',
        reason: 'Test reassignment',
      };

      (prisma.executeTransaction as jest.Mock).mockImplementationOnce(
        async (callback: (tx: any) => Promise<any>) => {
          const mockTxLocal = {
            order: {
              findUnique: jest.fn().mockResolvedValueOnce(null),
            },
          };
          return callback(mockTxLocal);
        },
      );

      await expect(
        service.reassignOrder('nonexistent-id', reassignDto, 'user-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when new installer not found', async () => {
      const reassignDto = {
        newInstallerId: 'nonexistent-installer',
        reason: 'Test reassignment',
      };

      (prisma.executeTransaction as jest.Mock).mockImplementationOnce(
        async (callback: (tx: any) => Promise<any>) => {
          const mockTxLocal = {
            order: {
              findUnique: jest.fn().mockResolvedValueOnce({
                ...mockOrder,
                status: OrderStatus.ASSIGNED,
              }),
            },
            installer: {
              findUnique: jest.fn().mockResolvedValueOnce(null),
            },
          };
          return callback(mockTxLocal);
        },
      );

      await expect(service.reassignOrder('order-123', reassignDto, 'user-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for invalid status', async () => {
      const reassignDto = {
        newInstallerId: 'installer-002',
        reason: 'Test reassignment',
      };

      (prisma.executeTransaction as jest.Mock).mockImplementationOnce(
        async (callback: (tx: any) => Promise<any>) => {
          const mockTxLocal = {
            order: {
              findUnique: jest.fn().mockResolvedValueOnce({
                ...mockOrder,
                status: OrderStatus.COMPLETED, // Cannot reassign completed orders
              }),
            },
          };
          return callback(mockTxLocal);
        },
      );

      await expect(service.reassignOrder('order-123', reassignDto, 'user-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reassign with new branch when provided', async () => {
      const reassignDto = {
        newInstallerId: 'installer-002',
        newBranchId: 'branch-002',
        reason: '지점 변경 및 설치자 재배정',
      };

      const mockNewInstaller = {
        id: 'installer-002',
        name: 'Lee Installer',
        phone: '010-9999-8888',
      };

      const mockNewBranch = {
        id: 'branch-002',
        code: 'BR02',
        name: 'Busan Branch',
      };

      (prisma.executeTransaction as jest.Mock).mockImplementationOnce(
        async (callback: (tx: any) => Promise<any>) => {
          const mockTxLocal = {
            order: {
              findUnique: jest.fn().mockResolvedValueOnce({
                ...mockOrder,
                status: OrderStatus.ASSIGNED,
                installer: {
                  id: 'installer-001',
                  name: 'Kim Installer',
                  phone: '010-1111-2222',
                },
                branch: {
                  id: 'branch-001',
                  code: 'BR01',
                  name: 'Seoul Branch',
                },
                partner: null,
              }),
              update: jest.fn().mockResolvedValueOnce({
                ...mockOrder,
                installerId: 'installer-002',
                branchId: 'branch-002',
                version: 2,
              }),
            },
            installer: {
              findUnique: jest.fn().mockResolvedValueOnce(mockNewInstaller),
            },
            branch: {
              findUnique: jest.fn().mockResolvedValueOnce(mockNewBranch),
            },
            orderStatusHistory: {
              create: jest.fn().mockResolvedValueOnce({}),
            },
            auditLog: {
              create: jest.fn().mockResolvedValueOnce({}),
            },
          };
          return callback(mockTxLocal);
        },
      );

      const result = await service.reassignOrder('order-123', reassignDto, 'user-123');

      expect(result.success).toBe(true);
      expect(result.newAssignment.branch?.id).toBe('branch-002');
    });

    it('should create order status history with REASSIGN reason', async () => {
      const reassignDto = {
        newInstallerId: 'installer-002',
        reason: 'Installer vacation',
      };

      let statusHistoryCreated = false;

      const mockNewInstaller = {
        id: 'installer-002',
        name: 'Lee Installer',
        phone: '010-9999-8888',
      };

      (prisma.executeTransaction as jest.Mock).mockImplementationOnce(
        async (callback: (tx: any) => Promise<any>) => {
          const mockTxLocal = {
            order: {
              findUnique: jest.fn().mockResolvedValueOnce({
                ...mockOrder,
                status: OrderStatus.ASSIGNED,
                installer: {
                  id: 'installer-001',
                  name: 'Kim Installer',
                  phone: '010-1111-2222',
                },
                branch: {
                  id: 'branch-001',
                  code: 'BR01',
                  name: 'Seoul Branch',
                },
                partner: null,
              }),
              update: jest.fn().mockResolvedValueOnce({
                ...mockOrder,
                installerId: 'installer-002',
                version: 2,
              }),
            },
            installer: {
              findUnique: jest.fn().mockResolvedValueOnce(mockNewInstaller),
            },
            orderStatusHistory: {
              create: jest.fn().mockImplementationOnce(() => {
                statusHistoryCreated = true;
                return {};
              }),
            },
            auditLog: {
              create: jest.fn().mockResolvedValueOnce({}),
            },
          };
          return callback(mockTxLocal);
        },
      );

      const result = await service.reassignOrder('order-123', reassignDto, 'user-123');

      expect(result.success).toBe(true);
      expect(statusHistoryCreated).toBe(true);
    });
  });

  describe('processBatchSync', () => {
    const mockOrderForSync = {
      id: 'order-sync-123',
      orderNo: 'ORD-2024-SYNC',
      customerName: 'Sync Customer',
      status: OrderStatus.UNASSIGNED,
      version: 1,
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should process batch sync items and return aggregated results', async () => {
      const items: BatchSyncItemDto[] = [
        {
          type: SyncOperationType.UPDATE,
          entityId: 'order-001',
          payload: { status: OrderStatus.COMPLETED },
          clientTimestamp: Date.now(),
          expectedVersion: 1,
        },
        {
          type: SyncOperationType.UPDATE,
          entityId: 'order-002',
          payload: { status: OrderStatus.DISPATCHED },
          clientTimestamp: Date.now(),
          expectedVersion: 1,
        },
      ];

      // Mock successful updates
      mockTx.order.findFirst.mockResolvedValue(mockOrder);
      mockTx.order.update.mockResolvedValue({ ...mockOrder, status: OrderStatus.COMPLETED });
      mockTx.auditLog.create.mockResolvedValue({});
      stateMachine.validateTransition.mockReturnValue({ valid: true });

      (prisma.executeTransaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      const result = await service.processBatchSync(items, 'user-123');

      expect(result.totalProcessed).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.results).toHaveLength(2);
    });

    it('should return partial success when some items fail', async () => {
      const items: BatchSyncItemDto[] = [
        {
          type: SyncOperationType.UPDATE,
          entityId: 'order-001',
          payload: { status: OrderStatus.COMPLETED },
          clientTimestamp: Date.now(),
          expectedVersion: 1,
        },
        {
          type: SyncOperationType.UPDATE,
          entityId: 'order-nonexistent',
          payload: { status: OrderStatus.COMPLETED },
          clientTimestamp: Date.now(),
          expectedVersion: 1,
        },
      ];

      let callCount = 0;
      (prisma.executeTransaction as jest.Mock).mockImplementation(async (callback) => {
        callCount++;
        if (callCount === 1) {
          mockTx.order.findFirst.mockResolvedValue(mockOrder);
          mockTx.order.update.mockResolvedValue({ ...mockOrder, status: OrderStatus.COMPLETED });
          mockTx.auditLog.create.mockResolvedValue({});
          stateMachine.validateTransition.mockReturnValue({ valid: true });
          return callback(mockTx);
        } else {
          mockTx.order.findFirst.mockResolvedValue(null);
          return callback(mockTx);
        }
      });

      const result = await service.processBatchSync(items, 'user-123');

      expect(result.totalProcessed).toBe(2);
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].error).toBe('E2001');
    });

    it('should return E2006 error with serverState on version conflict', async () => {
      const items: BatchSyncItemDto[] = [
        {
          type: SyncOperationType.UPDATE,
          entityId: 'order-001',
          payload: { status: OrderStatus.COMPLETED },
          clientTimestamp: Date.now(),
          expectedVersion: 1, // Client expects version 1
        },
      ];

      const serverOrder = { ...mockOrder, version: 3 }; // Server has version 3

      (prisma.executeTransaction as jest.Mock).mockImplementation(async (callback) => {
        mockTx.order.findFirst.mockResolvedValue(serverOrder);
        return callback(mockTx);
      });

      const result = await service.processBatchSync(items, 'user-123');

      expect(result.failureCount).toBe(1);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toBe('E2006');
      expect(result.results[0].serverState).toBeDefined();
    });

    it('should handle DELETE operations', async () => {
      const items: BatchSyncItemDto[] = [
        {
          type: SyncOperationType.DELETE,
          entityId: 'order-to-delete',
          payload: {},
          clientTimestamp: Date.now(),
        },
      ];

      (prisma.order.findFirst as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.order.update as jest.Mock).mockResolvedValue({ ...mockOrder, deletedAt: new Date() });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.processBatchSync(items, 'user-123');

      expect(result.totalProcessed).toBe(1);
      expect(result.successCount).toBe(1);
      expect(result.results[0].entityId).toBe('order-to-delete');
    });

    it('should handle empty items array', async () => {
      const items: BatchSyncItemDto[] = [];

      const result = await service.processBatchSync(items, 'user-123');

      expect(result.totalProcessed).toBe(0);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(result.results).toHaveLength(0);
    });

    it('should continue processing after individual item failure', async () => {
      const items: BatchSyncItemDto[] = [
        {
          type: SyncOperationType.UPDATE,
          entityId: 'order-001',
          payload: { status: OrderStatus.COMPLETED },
          clientTimestamp: Date.now(),
          expectedVersion: 1,
        },
        {
          type: SyncOperationType.UPDATE,
          entityId: 'order-fail',
          payload: { status: OrderStatus.COMPLETED },
          clientTimestamp: Date.now(),
          expectedVersion: 1,
        },
        {
          type: SyncOperationType.UPDATE,
          entityId: 'order-003',
          payload: { status: OrderStatus.COMPLETED },
          clientTimestamp: Date.now(),
          expectedVersion: 1,
        },
      ];

      let callCount = 0;
      (prisma.executeTransaction as jest.Mock).mockImplementation(async (callback) => {
        callCount++;
        if (callCount === 2) {
          // Fail on second item
          throw new Error('Database connection error');
        }
        mockTx.order.findFirst.mockResolvedValue(mockOrder);
        mockTx.order.update.mockResolvedValue({ ...mockOrder, status: OrderStatus.COMPLETED });
        mockTx.auditLog.create.mockResolvedValue({});
        stateMachine.validateTransition.mockReturnValue({ valid: true });
        return callback(mockTx);
      });

      const result = await service.processBatchSync(items, 'user-123');

      // Should have processed all 3 items
      expect(result.totalProcessed).toBe(3);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);

      // First and third should succeed
      expect(result.results[0].success).toBe(true);
      expect(result.results[2].success).toBe(true);

      // Second should fail
      expect(result.results[1].success).toBe(false);
    });

    it('should handle CREATE operations', async () => {
      const items: BatchSyncItemDto[] = [
        {
          type: SyncOperationType.CREATE,
          entityId: 'temp-client-id',
          payload: {
            orderNo: 'ORD-2024-NEW',
            customerName: 'New Customer',
            customerPhone: '010-1234-5678',
            address: { city: 'Seoul', detail: '123 Street' },
            vendor: 'VENDOR_A',
            branchId: 'branch-001',
            appointmentDate: '2024-12-20',
            lines: [{ itemCode: 'ITEM001', itemName: 'Test', quantity: 1, weight: 10 }],
          },
          clientTimestamp: Date.now(),
        },
      ];

      const createdOrder = {
        id: 'new-server-uuid',
        orderNo: 'ORD-2024-NEW',
        customerName: 'New Customer',
      };

      mockTx.order.create.mockResolvedValue(createdOrder);
      mockTx.auditLog.create.mockResolvedValue({});

      (prisma.executeTransaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      const result = await service.processBatchSync(items, 'user-123');

      expect(result.totalProcessed).toBe(1);
      expect(result.successCount).toBe(1);
      // CREATE returns new server ID, not client's temp ID
      expect(result.results[0].entityId).toBe('new-server-uuid');
    });
  });
});
