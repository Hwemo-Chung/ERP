/**
 * CompletionService Unit Tests
 * Tests serial number capture, waste pickup, and order completion logic
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CompletionService } from './completion.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStateMachine } from '../orders/order-state-machine';
import { OrderStatus } from '@prisma/client';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

describe('CompletionService', () => {
  let service: CompletionService;
  let prismaService: any;
  let stateMachine: any;

  const mockUserId = 'user-123';
  const mockOrderId = 'order-456';
  const mockBranchId = 'branch-789';

  beforeEach(async () => {
    // Create mocked PrismaService
    const mockPrismaService = {
      executeTransaction: jest.fn(),
      order: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      serialNumber: {
        create: jest.fn(),
      },
      wastePickup: {
        upsert: jest.fn(),
      },
      orderStatusHistory: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    // Create mocked OrderStateMachine
    const mockStateMachine = {
      validateTransition: jest.fn(),
      canTransition: jest.fn(),
      getAvailableTransitions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompletionService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: OrderStateMachine,
          useValue: mockStateMachine,
        },
      ],
    }).compile();

    service = module.get<CompletionService>(CompletionService);
    prismaService = module.get(PrismaService);
    stateMachine = module.get(OrderStateMachine);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Mock private methods
  beforeEach(() => {
    // Mock isSettlementLocked to always return false (not locked)
    jest.spyOn(service as any, 'isSettlementLocked').mockResolvedValue(false);
    
    // Mock stateMachine validateTransition to return valid by default
    stateMachine.validateTransition.mockReturnValue({
      valid: true,
    });
  });

  describe('completeOrder', () => {
    const mockOrder = {
      id: mockOrderId,
      orderNo: 'ORD-2025-001',
      status: OrderStatus.DISPATCHED,
      branchId: mockBranchId,
      appointmentDate: new Date('2025-12-12'),
      version: 1,
      lines: [
        {
          id: 'line-1',
          itemName: 'Air Conditioner',
          serialNumbers: [],
        },
      ],
    };

    const completeOrderDto = {
      status: OrderStatus.COMPLETED.toString(),
      lines: [
        {
          lineId: 'line-1',
          serialNumber: 'SN123456789',
        },
      ],
      waste: [
        { code: 'P01', quantity: 2 },
        { code: 'P15', quantity: 1 },
      ],
      notes: 'Installation completed successfully',
    };

    it('should complete order successfully with serial numbers and waste', async () => {
      const mockSerialNumber = {
        id: 'serial-1',
        orderLineId: 'line-1',
        serial: 'SN123456789',
        recordedBy: mockUserId,
        recordedAt: new Date(),
      };

      const mockWastePickup = {
        id: 'waste-1',
        orderId: mockOrderId,
        code: 'P01',
        quantity: 2,
        collectedAt: new Date(),
        collectedBy: mockUserId,
      };

      const mockUpdatedOrder = {
        ...mockOrder,
        status: OrderStatus.COMPLETED,
        version: 2,
        branch: { code: 'BR01', name: 'Main Branch' },
        wastePickups: [mockWastePickup],
      };

      // Mock transaction
      prismaService.executeTransaction.mockImplementation(async (fn: any) => {
        const mockTx = {
          order: {
            findFirst: jest.fn().mockResolvedValue(mockOrder),
            update: jest.fn().mockResolvedValue(mockUpdatedOrder),
          },
          serialNumber: {
            create: jest.fn().mockResolvedValue(mockSerialNumber),
          },
          wastePickup: {
            upsert: jest.fn().mockResolvedValue(mockWastePickup),
          },
          orderStatusHistory: {
            create: jest.fn().mockResolvedValue({}),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        };

        return fn(mockTx as any);
      });

      // Mock state machine validation
      stateMachine.validateTransition.mockReturnValue({ valid: true });

      // Execute
      const result = await service.completeOrder(
        mockOrderId,
        completeOrderDto,
        mockUserId,
      );

      // Assertions
      expect(result).toEqual({
        id: mockOrderId,
        orderNumber: 'ORD-2025-001',
        status: OrderStatus.COMPLETED,
        version: 2,
        serials: [
          {
            lineId: 'line-1',
            serialNumber: 'SN123456789',
            id: 'serial-1',
          },
        ],
        wasteCount: 1,
      });

      expect(stateMachine.validateTransition).toHaveBeenCalledWith(
        OrderStatus.DISPATCHED,
        OrderStatus.COMPLETED,
        expect.objectContaining({
          serialsCaptured: true,
          wastePickupLogged: true,
        }),
      );
    });

    it('should throw NotFoundException when order does not exist', async () => {
      prismaService.executeTransaction.mockImplementation(async (fn: any) => {
        const mockTx = {
          order: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
        };

        return fn(mockTx as any);
      });

      await expect(
        service.completeOrder(mockOrderId, completeOrderDto, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException with E2002 when settlement is locked', async () => {
      // Mock settlement locked
      jest.spyOn(service as any, 'isSettlementLocked').mockResolvedValueOnce(true);
      
      // Create order from previous week to trigger settlement lock
      const lastWeekDate = new Date();
      lastWeekDate.setDate(lastWeekDate.getDate() - 10);

      const oldOrder = {
        ...mockOrder,
        appointmentDate: lastWeekDate,
      };

      prismaService.executeTransaction.mockImplementation(async (fn: any) => {
        const mockTx = {
          order: {
            findFirst: jest.fn().mockResolvedValue(oldOrder),
          },
        };

        return fn(mockTx as any);
      });

      await expect(
        service.completeOrder(mockOrderId, completeOrderDto, mockUserId),
      ).rejects.toThrow(ConflictException);

      // Check the error response structure
      try {
        // Re-mock for second call
        jest.spyOn(service as any, 'isSettlementLocked').mockResolvedValueOnce(true);
        await service.completeOrder(mockOrderId, completeOrderDto, mockUserId);
        fail('Should have thrown ConflictException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ConflictException);
        expect(error.response?.code).toBe('E2002');
        expect(error.response?.message).toContain('정산이 마감되어');
      }
    });

    it('should throw BadRequestException when state transition is invalid', async () => {
      prismaService.executeTransaction.mockImplementation(async (fn: any) => {
        const mockTx = {
          order: {
            findFirst: jest.fn().mockResolvedValue(mockOrder),
          },
        };

        return fn(mockTx as any);
      });

      stateMachine.validateTransition.mockReturnValue({
        valid: false,
        error: 'Invalid transition',
        errorCode: 'E2001',
        details: { from: OrderStatus.DISPATCHED, to: OrderStatus.COMPLETED },
      });

      await expect(
        service.completeOrder(mockOrderId, completeOrderDto, mockUserId),
      ).rejects.toThrow(BadRequestException);

      // Check the error response structure
      try {
        await service.completeOrder(mockOrderId, completeOrderDto, mockUserId);
      } catch (error: any) {
        expect(error.response.code).toBe('E2001');
        expect(error.response.message).toBe('Invalid transition');
      }
    });

    it('should throw BadRequestException when order line is not found', async () => {
      const dtoWithInvalidLine = {
        ...completeOrderDto,
        lines: [
          {
            lineId: 'non-existent-line',
            serialNumber: 'SN123456789',
          },
        ],
      };

      prismaService.executeTransaction.mockImplementation(async (fn: any) => {
        const mockTx = {
          order: {
            findFirst: jest.fn().mockResolvedValue(mockOrder),
          },
        };

        return fn(mockTx as any);
      });

      stateMachine.validateTransition.mockReturnValue({ valid: true });

      await expect(
        service.completeOrder(mockOrderId, dtoWithInvalidLine, mockUserId),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.completeOrder(mockOrderId, dtoWithInvalidLine, mockUserId),
      ).rejects.toThrow(/주문 라인을 찾을 수 없습니다/);
    });

    it('should complete order without waste pickup', async () => {
      const dtoWithoutWaste = {
        status: OrderStatus.COMPLETED.toString(),
        lines: [{ lineId: 'line-1', serialNumber: 'SN123456789' }],
      };

      const mockSerialNumber = {
        id: 'serial-1',
        orderLineId: 'line-1',
        serial: 'SN123456789',
        recordedBy: mockUserId,
        recordedAt: new Date(),
      };

      const mockUpdatedOrder = {
        ...mockOrder,
        status: OrderStatus.COMPLETED,
        version: 2,
        branch: { code: 'BR01', name: 'Main Branch' },
        wastePickups: [],
      };

      prismaService.executeTransaction.mockImplementation(async (fn: any) => {
        const mockTx = {
          order: {
            findFirst: jest.fn().mockResolvedValue(mockOrder),
            update: jest.fn().mockResolvedValue(mockUpdatedOrder),
          },
          serialNumber: {
            create: jest.fn().mockResolvedValue(mockSerialNumber),
          },
          orderStatusHistory: {
            create: jest.fn().mockResolvedValue({}),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        };

        return fn(mockTx as any);
      });

      stateMachine.validateTransition.mockReturnValue({ valid: true });

      const result = await service.completeOrder(
        mockOrderId,
        dtoWithoutWaste,
        mockUserId,
      );

      expect(result.wasteCount).toBe(0);
      expect(stateMachine.validateTransition).toHaveBeenCalledWith(
        OrderStatus.DISPATCHED,
        OrderStatus.COMPLETED,
        {
          serialsCaptured: true,
          wastePickupLogged: undefined,
        },
      );
    });

    it('should increment order version for optimistic locking', async () => {
      const mockSerialNumber = {
        id: 'serial-1',
        orderLineId: 'line-1',
        serial: 'SN123456789',
        recordedBy: mockUserId,
        recordedAt: new Date(),
      };

      const mockUpdatedOrder = {
        ...mockOrder,
        status: OrderStatus.COMPLETED,
        version: 2, // version incremented
        branch: { code: 'BR01', name: 'Main Branch' },
        wastePickups: [],
      };

      let updateCallData: any;

      prismaService.executeTransaction.mockImplementation(async (fn: any) => {
        const mockTx = {
          order: {
            findFirst: jest.fn().mockResolvedValue(mockOrder),
            update: jest.fn().mockImplementation((args) => {
              updateCallData = args;
              return Promise.resolve(mockUpdatedOrder);
            }),
          },
          serialNumber: {
            create: jest.fn().mockResolvedValue(mockSerialNumber),
          },
          orderStatusHistory: {
            create: jest.fn().mockResolvedValue({}),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        };

        return fn(mockTx as any);
      });

      stateMachine.validateTransition.mockReturnValue({ valid: true });

      const result = await service.completeOrder(
        mockOrderId,
        {
          status: OrderStatus.COMPLETED.toString(),
          lines: [{ lineId: 'line-1', serialNumber: 'SN123456789' }],
        },
        mockUserId,
      );

      expect(updateCallData.data.version).toEqual({ increment: 1 });
      expect(result.version).toBe(2);
    });

    it('should create audit log for completion', async () => {
      const mockSerialNumber = {
        id: 'serial-1',
        orderLineId: 'line-1',
        serial: 'SN123456789',
        recordedBy: mockUserId,
        recordedAt: new Date(),
      };

      const mockUpdatedOrder = {
        ...mockOrder,
        status: OrderStatus.COMPLETED,
        version: 2,
        branch: { code: 'BR01', name: 'Main Branch' },
        wastePickups: [],
      };

      let auditLogData: any;

      prismaService.executeTransaction.mockImplementation(async (fn: any) => {
        const mockTx = {
          order: {
            findFirst: jest.fn().mockResolvedValue(mockOrder),
            update: jest.fn().mockResolvedValue(mockUpdatedOrder),
          },
          serialNumber: {
            create: jest.fn().mockResolvedValue(mockSerialNumber),
          },
          orderStatusHistory: {
            create: jest.fn().mockResolvedValue({}),
          },
          auditLog: {
            create: jest.fn().mockImplementation((args) => {
              auditLogData = args;
              return Promise.resolve({});
            }),
          },
        };

        return fn(mockTx as any);
      });

      stateMachine.validateTransition.mockReturnValue({ valid: true });

      await service.completeOrder(
        mockOrderId,
        {
          status: OrderStatus.COMPLETED.toString(),
          lines: [{ lineId: 'line-1', serialNumber: 'SN123456789' }],
          notes: 'Test completion',
        },
        mockUserId,
      );

      expect(auditLogData.data).toMatchObject({
        tableName: 'orders',
        recordId: mockOrderId,
        action: 'COMPLETE',
        actor: mockUserId,
      });
      expect(auditLogData.data.diff).toBeDefined();
      expect(auditLogData.data.diff.notes).toBe('Test completion');
    });
  });

  describe('logWastePickup', () => {
    const mockOrder = {
      id: mockOrderId,
      orderNo: 'ORD-2025-001',
      status: OrderStatus.DISPATCHED,
      branchId: mockBranchId,
      appointmentDate: new Date('2025-12-12'),
      deletedAt: null,
    };

    const wastePickupDto = {
      entries: [
        { code: 'P01', quantity: 2 },
        { code: 'P15', quantity: 3 },
      ],
      notes: 'Waste collected',
    };

    it('should log waste pickup successfully', async () => {
      const mockWastePickups = [
        {
          id: 'waste-1',
          orderId: mockOrderId,
          code: 'P01',
          quantity: 2,
          collectedAt: new Date(),
          collectedBy: mockUserId,
        },
        {
          id: 'waste-2',
          orderId: mockOrderId,
          code: 'P15',
          quantity: 3,
          collectedAt: new Date(),
          collectedBy: mockUserId,
        },
      ];

      prismaService.order.findFirst.mockResolvedValue(mockOrder as any);
      prismaService.wastePickup.upsert
        .mockResolvedValueOnce(mockWastePickups[0] as any)
        .mockResolvedValueOnce(mockWastePickups[1] as any);
      prismaService.auditLog.create.mockResolvedValue({} as any);

      const result = await service.logWastePickup(
        mockOrderId,
        wastePickupDto,
        mockUserId,
      );

      expect(result).toEqual({
        orderId: mockOrderId,
        wasteCount: 2,
        entries: [
          { code: 'P01', quantity: 2 },
          { code: 'P15', quantity: 3 },
        ],
      });

      expect(prismaService.wastePickup.upsert).toHaveBeenCalledTimes(2);
      expect(prismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tableName: 'waste_pickups',
            recordId: mockOrderId,
            action: 'CREATE',
            actor: mockUserId,
          }),
        }),
      );
    });

    it('should throw NotFoundException when order does not exist', async () => {
      prismaService.order.findFirst.mockResolvedValue(null);

      await expect(
        service.logWastePickup(mockOrderId, wastePickupDto, mockUserId),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.logWastePickup(mockOrderId, wastePickupDto, mockUserId),
      ).rejects.toThrow(/주문을 찾을 수 없습니다/);
    });

    it('should throw ConflictException with E2002 when settlement is locked', async () => {
      // Mock settlement locked for this specific test
      jest.spyOn(service as any, 'isSettlementLocked').mockResolvedValueOnce(true);
      
      const lastWeekDate = new Date();
      lastWeekDate.setDate(lastWeekDate.getDate() - 10);

      const oldOrder = {
        ...mockOrder,
        appointmentDate: lastWeekDate,
      };

      prismaService.order.findFirst.mockResolvedValue(oldOrder as any);

      await expect(
        service.logWastePickup(mockOrderId, wastePickupDto, mockUserId),
      ).rejects.toThrow(ConflictException);

      // Check the error response structure
      try {
        // Re-mock for second call
        jest.spyOn(service as any, 'isSettlementLocked').mockResolvedValueOnce(true);
        await service.logWastePickup(mockOrderId, wastePickupDto, mockUserId);
        fail('Should have thrown ConflictException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ConflictException);
        expect(error.response?.code).toBe('E2002');
      }
    });

    it('should throw BadRequestException for invalid waste code', async () => {
      const invalidDto = {
        entries: [
          { code: 'P00', quantity: 2 }, // Invalid: P00 not in range
        ],
      };

      prismaService.order.findFirst.mockResolvedValue(mockOrder as any);

      await expect(
        service.logWastePickup(mockOrderId, invalidDto, mockUserId),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.logWastePickup(mockOrderId, invalidDto, mockUserId),
      ).rejects.toThrow(/유효하지 않은 폐기 코드/);
    });

    it('should throw BadRequestException for waste code above P21', async () => {
      const invalidDto = {
        entries: [
          { code: 'P22', quantity: 2 }, // Invalid: P22 > P21
        ],
      };

      prismaService.order.findFirst.mockResolvedValue(mockOrder as any);

      await expect(
        service.logWastePickup(mockOrderId, invalidDto, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept all valid waste codes from P01 to P21', async () => {
      const validCodes = Array.from({ length: 21 }, (_, i) => {
        const num = i + 1;
        return `P${num.toString().padStart(2, '0')}`;
      });

      const validDto = {
        entries: validCodes.map((code, idx) => ({
          code,
          quantity: idx + 1,
        })),
      };

      prismaService.order.findFirst.mockResolvedValue(mockOrder as any);
      prismaService.wastePickup.upsert.mockResolvedValue({
        id: 'waste-id',
        orderId: mockOrderId,
        code: 'P01',
        quantity: 1,
        collectedAt: new Date(),
        collectedBy: mockUserId,
      } as any);
      prismaService.auditLog.create.mockResolvedValue({} as any);

      const result = await service.logWastePickup(
        mockOrderId,
        validDto,
        mockUserId,
      );

      expect(result.wasteCount).toBe(21);
      expect(prismaService.wastePickup.upsert).toHaveBeenCalledTimes(21);
    });

    it('should upsert waste entries (update existing)', async () => {
      const singleEntryDto = {
        entries: [{ code: 'P01', quantity: 5 }],
      };

      prismaService.order.findFirst.mockResolvedValue(mockOrder as any);
      prismaService.wastePickup.upsert.mockResolvedValue({
        id: 'waste-1',
        orderId: mockOrderId,
        code: 'P01',
        quantity: 5,
        collectedAt: new Date(),
        collectedBy: mockUserId,
      } as any);
      prismaService.auditLog.create.mockResolvedValue({} as any);

      await service.logWastePickup(mockOrderId, singleEntryDto, mockUserId);

      expect(prismaService.wastePickup.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            orderId_code: {
              orderId: mockOrderId,
              code: 'P01',
            },
          },
          create: expect.objectContaining({
            orderId: mockOrderId,
            code: 'P01',
            quantity: 5,
            collectedBy: mockUserId,
          }),
          update: expect.objectContaining({
            quantity: 5,
            collectedBy: mockUserId,
          }),
        }),
      );
    });

    it('should use custom date when provided in waste entry', async () => {
      const customDate = '2025-12-10T10:00:00Z';
      const dtoWithDate = {
        entries: [{ code: 'P01', quantity: 2, date: customDate }],
      };

      prismaService.order.findFirst.mockResolvedValue(mockOrder as any);
      prismaService.wastePickup.upsert.mockResolvedValue({
        id: 'waste-1',
        orderId: mockOrderId,
        code: 'P01',
        quantity: 2,
        collectedAt: new Date(customDate),
        collectedBy: mockUserId,
      } as any);
      prismaService.auditLog.create.mockResolvedValue({} as any);

      await service.logWastePickup(mockOrderId, dtoWithDate, mockUserId);

      expect(prismaService.wastePickup.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            collectedAt: new Date(customDate),
          }),
          update: expect.objectContaining({
            collectedAt: new Date(customDate),
          }),
        }),
      );
    });
  });

  describe('getCompletionDetails', () => {
    const mockOrderId = 'order-123';

    it('should return completion details with serials and waste', async () => {
      const mockOrder = {
        id: mockOrderId,
        orderNo: 'ORD-2025-001',
        status: OrderStatus.COMPLETED,
        deletedAt: null,
        lines: [
          {
            id: 'line-1',
            itemName: 'Air Conditioner',
            serialNumbers: [
              {
                serial: 'SN123456789',
                recordedAt: new Date('2025-12-12T10:00:00Z'),
              },
              {
                serial: 'SN987654321',
                recordedAt: new Date('2025-12-12T11:00:00Z'),
              },
            ],
          },
          {
            id: 'line-2',
            itemName: 'Refrigerator',
            serialNumbers: [
              {
                serial: 'SN555666777',
                recordedAt: new Date('2025-12-12T09:00:00Z'),
              },
            ],
          },
        ],
        wastePickups: [
          {
            code: 'P01',
            quantity: 2,
            collectedAt: new Date('2025-12-12T12:00:00Z'),
          },
          {
            code: 'P15',
            quantity: 1,
            collectedAt: new Date('2025-12-12T12:00:00Z'),
          },
        ],
      };

      prismaService.order.findFirst.mockResolvedValue(mockOrder as any);

      const result = await service.getCompletionDetails(mockOrderId);

      expect(result).toEqual({
        id: mockOrderId,
        orderNumber: 'ORD-2025-001',
        status: OrderStatus.COMPLETED,
        serials: expect.arrayContaining([
          expect.objectContaining({
            lineId: 'line-1',
            itemName: 'Air Conditioner',
            serialNumber: 'SN123456789',
          }),
          expect.objectContaining({
            lineId: 'line-1',
            itemName: 'Air Conditioner',
            serialNumber: 'SN987654321',
          }),
          expect.objectContaining({
            lineId: 'line-2',
            itemName: 'Refrigerator',
            serialNumber: 'SN555666777',
          }),
        ]),
        waste: expect.arrayContaining([
          expect.objectContaining({ code: 'P01', quantity: 2 }),
          expect.objectContaining({ code: 'P15', quantity: 1 }),
        ]),
      });

      expect(result.serials).toHaveLength(3);
      expect(result.waste).toHaveLength(2);
    });

    it('should sort serials by recordedAt in descending order (newest first)', async () => {
      const mockOrder = {
        id: mockOrderId,
        orderNo: 'ORD-2025-001',
        status: OrderStatus.COMPLETED,
        deletedAt: null,
        lines: [
          {
            id: 'line-1',
            itemName: 'Product',
            serialNumbers: [
              {
                serial: 'SN-OLD',
                recordedAt: new Date('2025-12-12T08:00:00Z'),
              },
              {
                serial: 'SN-NEW',
                recordedAt: new Date('2025-12-12T12:00:00Z'),
              },
              {
                serial: 'SN-MID',
                recordedAt: new Date('2025-12-12T10:00:00Z'),
              },
            ],
          },
        ],
        wastePickups: [],
      };

      prismaService.order.findFirst.mockResolvedValue(mockOrder as any);

      const result = await service.getCompletionDetails(mockOrderId);

      expect(result.serials[0].serialNumber).toBe('SN-NEW');
      expect(result.serials[1].serialNumber).toBe('SN-MID');
      expect(result.serials[2].serialNumber).toBe('SN-OLD');
    });

    it('should throw NotFoundException when order does not exist', async () => {
      prismaService.order.findFirst.mockResolvedValue(null);

      await expect(service.getCompletionDetails(mockOrderId)).rejects.toThrow(
        NotFoundException,
      );

      await expect(service.getCompletionDetails(mockOrderId)).rejects.toThrow(
        /주문을 찾을 수 없습니다/,
      );
    });

    it('should return empty arrays when no serials or waste exist', async () => {
      const mockOrder = {
        id: mockOrderId,
        orderNo: 'ORD-2025-001',
        status: OrderStatus.ASSIGNED,
        deletedAt: null,
        lines: [
          {
            id: 'line-1',
            itemName: 'Product',
            serialNumbers: [],
          },
        ],
        wastePickups: [],
      };

      prismaService.order.findFirst.mockResolvedValue(mockOrder as any);

      const result = await service.getCompletionDetails(mockOrderId);

      expect(result.serials).toEqual([]);
      expect(result.waste).toEqual([]);
    });
  });

  describe('Settlement Lock Logic', () => {
    it('should allow completion for orders in current week', async () => {
      const today = new Date();
      const mockOrder = {
        id: mockOrderId,
        orderNo: 'ORD-2025-001',
        status: OrderStatus.DISPATCHED,
        branchId: mockBranchId,
        appointmentDate: today,
        version: 1,
        lines: [
          {
            id: 'line-1',
            itemName: 'Product',
            serialNumbers: [],
          },
        ],
      };

      const mockSerialNumber = {
        id: 'serial-1',
        orderLineId: 'line-1',
        serial: 'SN123456789',
        recordedBy: mockUserId,
        recordedAt: new Date(),
      };

      const mockUpdatedOrder = {
        ...mockOrder,
        status: OrderStatus.COMPLETED,
        version: 2,
        branch: { code: 'BR01', name: 'Main Branch' },
        wastePickups: [],
      };

      prismaService.executeTransaction.mockImplementation(async (fn: any) => {
        const mockTx = {
          order: {
            findFirst: jest.fn().mockResolvedValue(mockOrder),
            update: jest.fn().mockResolvedValue(mockUpdatedOrder),
          },
          serialNumber: {
            create: jest.fn().mockResolvedValue(mockSerialNumber),
          },
          orderStatusHistory: {
            create: jest.fn().mockResolvedValue({}),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({}),
          },
        };

        return fn(mockTx as any);
      });

      stateMachine.validateTransition.mockReturnValue({ valid: true });

      const result = await service.completeOrder(
        mockOrderId,
        {
          status: OrderStatus.COMPLETED.toString(),
          lines: [{ lineId: 'line-1', serialNumber: 'SN123456789' }],
        },
        mockUserId,
      );

      expect(result).toBeDefined();
      expect(result.status).toBe(OrderStatus.COMPLETED);
    });

    it('should block completion for orders from previous week', async () => {
      // Mock settlement locked for orders from previous week
      jest.spyOn(service as any, 'isSettlementLocked').mockResolvedValueOnce(true);
      
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);

      const mockOrder = {
        id: mockOrderId,
        orderNo: 'ORD-2025-001',
        status: OrderStatus.DISPATCHED,
        branchId: mockBranchId,
        appointmentDate: lastWeek,
        version: 1,
        lines: [
          {
            id: 'line-1',
            itemName: 'Product',
            serialNumbers: [],
          },
        ],
      };

      prismaService.executeTransaction.mockImplementation(async (fn: any) => {
        const mockTx = {
          order: {
            findFirst: jest.fn().mockResolvedValue(mockOrder),
          },
        };

        return fn(mockTx as any);
      });

      await expect(
        service.completeOrder(
          mockOrderId,
          {
            status: OrderStatus.COMPLETED.toString(),
            lines: [{ lineId: 'line-1', serialNumber: 'SN123456789' }],
          },
          mockUserId,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });
});
