// apps/web/src/app/shared/services/bulk-operation.service.spec.ts
// FR-18: Bulk Operation Service Unit Tests
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/standalone';
import { BulkOperationService, BulkOperationConfig } from './bulk-operation.service';
import { BulkOperationResult } from '../components/bulk-operation-result/bulk-operation-result.component';

describe('BulkOperationService - FR-18', () => {
  let service: BulkOperationService;
  let modalCtrl: jasmine.SpyObj<ModalController>;

  interface TestItem {
    id: string;
    name: string;
  }

  const mockItems: TestItem[] = [
    { id: '1', name: 'Item 1' },
    { id: '2', name: 'Item 2' },
    { id: '3', name: 'Item 3' },
  ];

  const baseConfig: Omit<BulkOperationConfig<TestItem, void>, 'operation'> = {
    items: mockItems,
    operationName: 'Test Operation',
    getItemId: (item) => item.id,
    getItemLabel: (item) => item.name,
  };

  beforeEach(() => {
    const modalSpy = jasmine.createSpyObj('ModalController', ['create']);

    TestBed.configureTestingModule({
      providers: [
        BulkOperationService,
        { provide: ModalController, useValue: modalSpy },
      ],
    });

    service = TestBed.inject(BulkOperationService);
    modalCtrl = TestBed.inject(ModalController) as jasmine.SpyObj<ModalController>;
  });

  describe('Sequential execution (concurrency = 1)', () => {
    it('should execute all operations successfully', async () => {
      const operation = jasmine.createSpy('operation').and.returnValue(Promise.resolve());

      const result = await service.execute({
        ...baseConfig,
        operation,
        concurrency: 1,
      });

      expect(operation).toHaveBeenCalledTimes(3);
      expect(result.totalCount).toBe(3);
      expect(result.successCount).toBe(3);
      expect(result.failedCount).toBe(0);
      expect(result.operation).toBe('Test Operation');
      expect(result.items.every(item => item.success)).toBeTrue();
    });

    it('should handle partial failures with continueOnError=true', async () => {
      let callCount = 0;
      const operation = jasmine.createSpy('operation').and.callFake(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.reject(new Error('Operation failed'));
        }
        return Promise.resolve();
      });

      const result = await service.execute({
        ...baseConfig,
        operation,
        continueOnError: true,
      });

      expect(operation).toHaveBeenCalledTimes(3);
      expect(result.totalCount).toBe(3);
      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(1);
      
      const failedItem = result.items.find(item => item.id === '2');
      expect(failedItem?.success).toBeFalse();
      expect(failedItem?.error).toBe('Operation failed');
    });

    it('should stop on first error when continueOnError=false', async () => {
      let callCount = 0;
      const operation = jasmine.createSpy('operation').and.callFake(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.reject(new Error('Operation failed'));
        }
        return Promise.resolve();
      });

      const result = await service.execute({
        ...baseConfig,
        operation,
        continueOnError: false,
      });

      expect(operation).toHaveBeenCalledTimes(2);
      expect(result.totalCount).toBe(3);
      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(1);
    });

    it('should update progress signal during execution', fakeAsync(() => {
      const operation = jasmine.createSpy('operation').and.returnValue(Promise.resolve());
      const progressValues: number[] = [];

      // Monitor progress signal
      const unsubscribe = (service as any).progress.subscribe((value: number) => {
        progressValues.push(value);
      });

      service.execute({
        ...baseConfig,
        operation,
      });

      tick();

      expect(progressValues).toContain(0);
      expect(progressValues).toContain(33);
      expect(progressValues).toContain(67);
      expect(progressValues).toContain(100);
    }));

    it('should update currentItem signal during execution', fakeAsync(() => {
      const operation = jasmine.createSpy('operation').and.returnValue(Promise.resolve());

      expect(service.currentItem()).toBeNull();

      service.execute({
        ...baseConfig,
        operation,
      });

      tick();

      // After completion, currentItem should be reset to null
      expect(service.currentItem()).toBeNull();
    }));

    it('should set isProcessing flag during execution', fakeAsync(() => {
      const operation = jasmine.createSpy('operation').and.returnValue(
        new Promise(resolve => setTimeout(resolve, 100))
      );

      expect(service.isProcessing()).toBeFalse();

      service.execute({
        ...baseConfig,
        operation,
      });

      tick();

      expect(service.isProcessing()).toBeTrue();

      tick(300);

      expect(service.isProcessing()).toBeFalse();
    }));

    it('should reset state even if operation throws', fakeAsync(() => {
      const operation = jasmine.createSpy('operation').and.returnValue(
        Promise.reject(new Error('Test error'))
      );

      service.execute({
        ...baseConfig,
        operation,
        continueOnError: false,
      });

      tick();

      expect(service.isProcessing()).toBeFalse();
      expect(service.currentItem()).toBeNull();
    }));
  });

  describe('Parallel execution (concurrency > 1)', () => {
    it('should execute operations in parallel batches', async () => {
      const operation = jasmine.createSpy('operation').and.returnValue(Promise.resolve());

      const result = await service.execute({
        ...baseConfig,
        operation,
        concurrency: 2,
      });

      expect(operation).toHaveBeenCalledTimes(3);
      expect(result.successCount).toBe(3);
      expect(result.failedCount).toBe(0);
    });

    it('should handle partial failures in parallel mode', async () => {
      let callCount = 0;
      const operation = jasmine.createSpy('operation').and.callFake((item: TestItem) => {
        callCount++;
        if (item.id === '2') {
          return Promise.reject(new Error('Parallel operation failed'));
        }
        return Promise.resolve();
      });

      const result = await service.execute({
        ...baseConfig,
        operation,
        concurrency: 2,
      });

      expect(operation).toHaveBeenCalledTimes(3);
      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(1);
      
      const failedItem = result.items.find(item => item.id === '2');
      expect(failedItem?.success).toBeFalse();
      expect(failedItem?.error).toBe('Parallel operation failed');
    });

    it('should process items in batches', async () => {
      const operation = jasmine.createSpy('operation').and.returnValue(Promise.resolve());
      const items = Array.from({ length: 10 }, (_, i) => ({
        id: `${i}`,
        name: `Item ${i}`,
      }));

      const result = await service.execute({
        items,
        operationName: 'Batch Test',
        operation,
        getItemId: (item) => item.id,
        getItemLabel: (item) => item.name,
        concurrency: 3,
      });

      expect(operation).toHaveBeenCalledTimes(10);
      expect(result.successCount).toBe(10);
    });

    it('should update progress correctly in parallel mode', fakeAsync(() => {
      const operation = jasmine.createSpy('operation').and.returnValue(Promise.resolve());

      service.execute({
        ...baseConfig,
        operation,
        concurrency: 2,
      });

      tick();

      // Progress should reach 100% at the end
      expect(service.progress()).toBe(100);
    }));
  });

  describe('Result aggregation', () => {
    it('should correctly aggregate success and failure counts', async () => {
      let callCount = 0;
      const operation = jasmine.createSpy('operation').and.callFake(() => {
        callCount++;
        if (callCount % 2 === 0) {
          return Promise.reject(new Error('Even item failed'));
        }
        return Promise.resolve();
      });

      const items = Array.from({ length: 6 }, (_, i) => ({
        id: `${i}`,
        name: `Item ${i}`,
      }));

      const result = await service.execute({
        items,
        operationName: 'Aggregate Test',
        operation,
        getItemId: (item) => item.id,
        getItemLabel: (item) => item.name,
      });

      expect(result.totalCount).toBe(6);
      expect(result.successCount).toBe(3);
      expect(result.failedCount).toBe(3);
    });

    it('should include all items in result with correct status', async () => {
      const operation = jasmine.createSpy('operation').and.callFake((item: TestItem) => {
        if (item.id === '2') {
          return Promise.reject(new Error('Specific failure'));
        }
        return Promise.resolve();
      });

      const result = await service.execute({
        ...baseConfig,
        operation,
      });

      expect(result.items.length).toBe(3);
      expect(result.items[0]).toEqual({
        id: '1',
        label: 'Item 1',
        success: true,
      });
      expect(result.items[1]).toEqual({
        id: '2',
        label: 'Item 2',
        success: false,
        error: 'Specific failure',
      });
      expect(result.items[2]).toEqual({
        id: '3',
        label: 'Item 3',
        success: true,
      });
    });

    it('should handle unknown error types', async () => {
      const operation = jasmine.createSpy('operation').and.callFake(() => {
        // eslint-disable-next-line prefer-promise-reject-errors
        return Promise.reject('String error');
      });

      const result = await service.execute({
        ...baseConfig,
        operation,
        continueOnError: false,
      });

      const failedItem = result.items[0];
      expect(failedItem.error).toBe('알 수 없는 오류');
    });
  });

  describe('showResultDialog', () => {
    it('should open modal with result data', async () => {
      const mockModal = {
        present: jasmine.createSpy('present').and.returnValue(Promise.resolve()),
        onDidDismiss: jasmine.createSpy('onDidDismiss').and.returnValue(
          Promise.resolve({ data: 'close' })
        ),
      };

      modalCtrl.create.and.returnValue(Promise.resolve(mockModal as any));

      const result: BulkOperationResult = {
        operation: 'Test',
        totalCount: 3,
        successCount: 2,
        failedCount: 1,
        items: [],
      };

      await service.showResultDialog(result);

      expect(modalCtrl.create).toHaveBeenCalledWith(
        jasmine.objectContaining({
          componentProps: { result },
          cssClass: 'bulk-operation-result-modal',
        })
      );

      expect(mockModal.present).toHaveBeenCalled();
    });

    it('should return user action from dialog', async () => {
      const mockModal = {
        present: jasmine.createSpy('present').and.returnValue(Promise.resolve()),
        onDidDismiss: jasmine.createSpy('onDidDismiss').and.returnValue(
          Promise.resolve({ data: 'retry' })
        ),
      };

      modalCtrl.create.and.returnValue(Promise.resolve(mockModal as any));

      const result: BulkOperationResult = {
        operation: 'Test',
        totalCount: 3,
        successCount: 2,
        failedCount: 1,
        items: [],
      };

      const action = await service.showResultDialog(result);

      expect(action).toBe('retry');
    });

    it('should default to close if no data returned', async () => {
      const mockModal = {
        present: jasmine.createSpy('present').and.returnValue(Promise.resolve()),
        onDidDismiss: jasmine.createSpy('onDidDismiss').and.returnValue(
          Promise.resolve({})
        ),
      };

      modalCtrl.create.and.returnValue(Promise.resolve(mockModal as any));

      const result: BulkOperationResult = {
        operation: 'Test',
        totalCount: 3,
        successCount: 3,
        failedCount: 0,
        items: [],
      };

      const action = await service.showResultDialog(result);

      expect(action).toBe('close');
    });
  });

  describe('retryFailed', () => {
    it('should re-execute failed items only', async () => {
      const operation = jasmine.createSpy('operation').and.returnValue(Promise.resolve());
      const failedItems = [
        { id: '2', name: 'Item 2' },
        { id: '4', name: 'Item 4' },
      ];

      const result = await service.retryFailed(failedItems, {
        operationName: 'Retry Test',
        operation,
        getItemId: (item) => item.id,
        getItemLabel: (item) => item.name,
      });

      expect(operation).toHaveBeenCalledTimes(2);
      expect(result.totalCount).toBe(2);
      expect(result.successCount).toBe(2);
    });

    it('should preserve operation config during retry', async () => {
      const operation = jasmine.createSpy('operation').and.returnValue(Promise.resolve());

      await service.retryFailed([mockItems[1]], {
        operationName: 'Custom Retry',
        operation,
        getItemId: (item) => item.id,
        getItemLabel: (item) => item.name,
        concurrency: 3,
        continueOnError: false,
      });

      // Should have used the same operation function
      expect(operation).toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty items array', async () => {
      const operation = jasmine.createSpy('operation').and.returnValue(Promise.resolve());

      const result = await service.execute({
        items: [],
        operationName: 'Empty Test',
        operation,
        getItemId: (item) => item.id,
        getItemLabel: (item) => item.name,
      });

      expect(operation).not.toHaveBeenCalled();
      expect(result.totalCount).toBe(0);
      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(result.items.length).toBe(0);
    });

    it('should handle single item execution', async () => {
      const operation = jasmine.createSpy('operation').and.returnValue(Promise.resolve());

      const result = await service.execute({
        items: [mockItems[0]],
        operationName: 'Single Item',
        operation,
        getItemId: (item) => item.id,
        getItemLabel: (item) => item.name,
      });

      expect(operation).toHaveBeenCalledTimes(1);
      expect(result.totalCount).toBe(1);
      expect(result.successCount).toBe(1);
    });

    it('should handle all items failing', async () => {
      const operation = jasmine.createSpy('operation').and.returnValue(
        Promise.reject(new Error('All failed'))
      );

      const result = await service.execute({
        ...baseConfig,
        operation,
      });

      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(3);
      expect(result.items.every(item => !item.success)).toBeTrue();
    });

    it('should handle concurrency larger than items count', async () => {
      const operation = jasmine.createSpy('operation').and.returnValue(Promise.resolve());

      const result = await service.execute({
        ...baseConfig,
        operation,
        concurrency: 10,
      });

      expect(operation).toHaveBeenCalledTimes(3);
      expect(result.successCount).toBe(3);
    });
  });

  describe('Integration scenarios', () => {
    it('should support complex retry workflow', async () => {
      // First attempt: 2 items fail
      let attempt = 0;
      const operation = jasmine.createSpy('operation').and.callFake((item: TestItem) => {
        attempt++;
        if (attempt <= 2 && (item.id === '2' || item.id === '3')) {
          return Promise.reject(new Error('First attempt failed'));
        }
        return Promise.resolve();
      });

      const firstResult = await service.execute({
        ...baseConfig,
        operation,
      });

      expect(firstResult.failedCount).toBe(2);

      // Retry failed items
      const failedItems = firstResult.items
        .filter(item => !item.success)
        .map(item => mockItems.find(mi => mi.id === item.id)!);

      const retryResult = await service.retryFailed(failedItems, {
        operationName: 'Retry Test',
        operation,
        getItemId: (item) => item.id,
        getItemLabel: (item) => item.name,
      });

      // All should succeed on retry
      expect(retryResult.successCount).toBe(2);
      expect(retryResult.failedCount).toBe(0);
    });

    it('should handle timeout errors gracefully', fakeAsync(() => {
      const operation = jasmine.createSpy('operation').and.callFake(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 1000);
        });
      });

      let result: BulkOperationResult | undefined;
      service.execute({
        items: [mockItems[0]],
        operationName: 'Timeout Test',
        operation,
        getItemId: (item) => item.id,
        getItemLabel: (item) => item.name,
        continueOnError: false,
      }).then(r => {
        result = r;
      });

      tick(1100);

      expect(result?.failedCount).toBe(1);
      expect(result?.items[0].error).toBe('Timeout');
    }));
  });
});
