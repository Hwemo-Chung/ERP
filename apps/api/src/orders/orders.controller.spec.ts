import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { AttachmentsService } from './attachments.service';
import { BatchSyncDto, SyncOperationType } from './dto/batch-sync.dto';
import { OrderStatus } from '@prisma/client';

describe('OrdersController', () => {
  let controller: OrdersController;
  let ordersService: jest.Mocked<OrdersService>;

  const mockUser = {
    sub: 'user-123',
    username: 'testuser',
    roles: ['INSTALLER'],
    branchCode: 'BR01',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: {
            processBatchSync: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            bulkStatusUpdate: jest.fn(),
            remove: jest.fn(),
            splitOrder: jest.fn(),
            addEvent: jest.fn(),
            cancelOrder: jest.fn(),
            revertOrder: jest.fn(),
            reassignOrder: jest.fn(),
            getStats: jest.fn(),
          },
        },
        {
          provide: AttachmentsService,
          useValue: {
            uploadAttachment: jest.fn(),
            getAttachments: jest.fn(),
            getAttachment: jest.fn(),
            deleteAttachment: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    ordersService = module.get(OrdersService) as jest.Mocked<OrdersService>;
  });

  describe('batchSync', () => {
    describe('successful batch processing', () => {
      it('should process batch sync items and return 200 OK with results', async () => {
        // Arrange
        const batchSyncDto: BatchSyncDto = {
          items: [
            {
              type: SyncOperationType.UPDATE,
              entityId: 'order-001',
              payload: { status: OrderStatus.COMPLETED, remarks: 'Installed' },
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
          ],
        };

        const expectedResult = {
          totalProcessed: 2,
          successCount: 2,
          failureCount: 0,
          results: [
            { entityId: 'order-001', success: true },
            { entityId: 'order-002', success: true },
          ],
        };

        ordersService.processBatchSync.mockResolvedValue(expectedResult);

        // Act
        const result = await controller.batchSync(batchSyncDto, mockUser as any);

        // Assert
        expect(result).toEqual(expectedResult);
        expect(ordersService.processBatchSync).toHaveBeenCalledWith(
          batchSyncDto.items,
          mockUser.sub,
        );
      });
    });

    describe('partial failure handling', () => {
      it('should return individual results when some items fail', async () => {
        // Arrange
        const batchSyncDto: BatchSyncDto = {
          items: [
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
          ],
        };

        const expectedResult = {
          totalProcessed: 3,
          successCount: 2,
          failureCount: 1,
          results: [
            { entityId: 'order-001', success: true },
            {
              entityId: 'order-002',
              success: false,
              error: 'E2001',
              message: 'Order not found',
            },
            { entityId: 'order-003', success: true },
          ],
        };

        ordersService.processBatchSync.mockResolvedValue(expectedResult);

        // Act
        const result = await controller.batchSync(batchSyncDto, mockUser as any);

        // Assert
        expect(result.totalProcessed).toBe(3);
        expect(result.successCount).toBe(2);
        expect(result.failureCount).toBe(1);
        expect(result.results).toHaveLength(3);

        const failedItem = result.results.find((r) => !r.success);
        expect(failedItem).toBeDefined();
        expect(failedItem?.entityId).toBe('order-002');
        expect(failedItem?.error).toBe('E2001');
      });
    });

    describe('version conflict handling', () => {
      it('should return E2006 error code with serverState on version conflict', async () => {
        // Arrange
        const batchSyncDto: BatchSyncDto = {
          items: [
            {
              type: SyncOperationType.UPDATE,
              entityId: 'order-001',
              payload: { status: OrderStatus.COMPLETED },
              clientTimestamp: Date.now(),
              expectedVersion: 1, // Client has version 1
            },
          ],
        };

        const serverOrder = {
          id: 'order-001',
          orderNo: 'ORD-2024-001',
          status: OrderStatus.DISPATCHED,
          version: 3, // Server has version 3
        };

        const expectedResult = {
          totalProcessed: 1,
          successCount: 0,
          failureCount: 1,
          results: [
            {
              entityId: 'order-001',
              success: false,
              error: 'E2006',
              message: 'Version conflict - order was modified by another user',
              serverState: serverOrder,
            },
          ],
        };

        ordersService.processBatchSync.mockResolvedValue(expectedResult);

        // Act
        const result = await controller.batchSync(batchSyncDto, mockUser as any);

        // Assert
        expect(result.failureCount).toBe(1);

        const conflictItem = result.results[0];
        expect(conflictItem.success).toBe(false);
        expect(conflictItem.error).toBe('E2006');
        expect(conflictItem.serverState).toBeDefined();
        expect((conflictItem.serverState as any).version).toBe(3);
      });
    });

    describe('empty batch handling', () => {
      it('should handle empty items array gracefully', async () => {
        // Arrange
        const batchSyncDto: BatchSyncDto = {
          items: [],
        };

        const expectedResult = {
          totalProcessed: 0,
          successCount: 0,
          failureCount: 0,
          results: [],
        };

        ordersService.processBatchSync.mockResolvedValue(expectedResult);

        // Act
        const result = await controller.batchSync(batchSyncDto, mockUser as any);

        // Assert
        expect(result.totalProcessed).toBe(0);
        expect(result.results).toHaveLength(0);
      });
    });

    describe('mixed operation types', () => {
      it('should process CREATE, UPDATE, and DELETE operations together', async () => {
        // Arrange
        const batchSyncDto: BatchSyncDto = {
          items: [
            {
              type: SyncOperationType.CREATE,
              entityId: 'temp-uuid-001',
              payload: {
                orderNo: 'ORD-2024-NEW',
                customerName: 'Test Customer',
                status: OrderStatus.UNASSIGNED,
              },
              clientTimestamp: Date.now(),
            },
            {
              type: SyncOperationType.UPDATE,
              entityId: 'order-002',
              payload: { status: OrderStatus.COMPLETED },
              clientTimestamp: Date.now(),
              expectedVersion: 1,
            },
            {
              type: SyncOperationType.DELETE,
              entityId: 'order-003',
              payload: {},
              clientTimestamp: Date.now(),
            },
          ],
        };

        const expectedResult = {
          totalProcessed: 3,
          successCount: 3,
          failureCount: 0,
          results: [
            { entityId: 'new-order-uuid', success: true }, // CREATE returns new ID
            { entityId: 'order-002', success: true },
            { entityId: 'order-003', success: true },
          ],
        };

        ordersService.processBatchSync.mockResolvedValue(expectedResult);

        // Act
        const result = await controller.batchSync(batchSyncDto, mockUser as any);

        // Assert
        expect(result.successCount).toBe(3);
        expect(ordersService.processBatchSync).toHaveBeenCalled();
      });
    });
  });
});
