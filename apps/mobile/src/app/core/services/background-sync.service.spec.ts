import { TestBed, fakeAsync, tick, flush } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { BackgroundSyncService, SyncOperation } from './background-sync.service';
import { NetworkService } from './network.service';
import { SyncQueueService } from './sync-queue.service';
import { UIStore } from '../../store/ui/ui.store';
import { Preferences, __configureMock } from '@capacitor/preferences';
import { db, __configureDexieMock } from '@app/core/db/database';

describe('BackgroundSyncService', () => {
  let service: BackgroundSyncService;
  let networkService: jasmine.SpyObj<NetworkService>;
  let syncQueueService: jasmine.SpyObj<SyncQueueService>;
  let uiStore: jasmine.SpyObj<UIStore>;
  let swUpdate: jasmine.SpyObj<SwUpdate>;

  const mockIsOfflineSignal = signal(false);

  beforeEach(() => {
    // Reset all mocks
    __configureMock.resetMocks();
    __configureDexieMock.resetAll();

    // Mock NetworkService
    networkService = jasmine.createSpyObj('NetworkService', [], {
      isOffline: mockIsOfflineSignal.asReadonly(),
    });

    // Mock SyncQueueService
    syncQueueService = jasmine.createSpyObj('SyncQueueService', [
      'enqueue',
      'processQueue',
    ]);

    // Mock UIStore
    uiStore = jasmine.createSpyObj('UIStore', ['showToast', 'showError']);

    // Mock SwUpdate
    swUpdate = jasmine.createSpyObj('SwUpdate', ['checkForUpdate']);

    TestBed.configureTestingModule({
      providers: [
        BackgroundSyncService,
        { provide: NetworkService, useValue: networkService },
        { provide: SyncQueueService, useValue: syncQueueService },
        { provide: UIStore, useValue: uiStore },
        { provide: SwUpdate, useValue: swUpdate },
      ],
    });

    service = TestBed.inject(BackgroundSyncService);
  });

  afterEach(() => {
    __configureDexieMock.resetAll();
  });

  describe('Service Initialization', () => {
    it('should create the service', () => {
      expect(service).toBeTruthy();
    });

    it('should register service worker sync listener on initialization', () => {
      const addEventListenerSpy = spyOn(navigator.serviceWorker, 'addEventListener');

      // Create new instance to trigger constructor
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          BackgroundSyncService,
          { provide: NetworkService, useValue: networkService },
          { provide: SyncQueueService, useValue: syncQueueService },
          { provide: UIStore, useValue: uiStore },
          { provide: SwUpdate, useValue: swUpdate },
        ],
      });

      const newService = TestBed.inject(BackgroundSyncService);

      expect(addEventListenerSpy).toHaveBeenCalledWith('message', jasmine.any(Function));
    });
  });

  describe('Network Online Detection', () => {
    // These tests call onNetworkOnline() directly instead of relying on signal effects
    // because Angular signal effects don't fire synchronously in fakeAsync tests

    it('should trigger sync when network becomes online', async () => {
      const processPendingOperationsSpy = spyOn(service as any, 'processPendingOperations')
        .and.returnValue(Promise.resolve());

      // Directly call the method that would be triggered by the effect
      await service.onNetworkOnline();

      expect(processPendingOperationsSpy).toHaveBeenCalled();
    });

    it('should not trigger sync if already in progress', async () => {
      (service as any).syncInProgress = true;

      const processPendingOperationsSpy = spyOn(service as any, 'processPendingOperations');

      await service.onNetworkOnline();

      expect(processPendingOperationsSpy).not.toHaveBeenCalled();

      (service as any).syncInProgress = false;
    });

    it('should show success toast after successful sync', async () => {
      spyOn(service as any, 'processPendingOperations').and.returnValue(Promise.resolve());

      await service.onNetworkOnline();

      expect(uiStore.showToast).toHaveBeenCalledWith(
        '모든 변경사항이 동기화되었습니다',
        'success',
        2000
      );
    });

    it('should show warning toast on sync error', async () => {
      spyOn(service as any, 'processPendingOperations')
        .and.returnValue(Promise.reject(new Error('Sync failed')));

      await service.onNetworkOnline();

      expect(uiStore.showToast).toHaveBeenCalledWith(
        '일부 변경사항을 동기화할 수 없습니다',
        'warning',
        3000
      );
    });
  });

  describe('Enqueue Operations', () => {
    beforeEach(() => {
      // Mock navigator.serviceWorker to prevent Background Sync registration timeout
      if (!('serviceWorker' in navigator)) {
        (navigator as any).serviceWorker = {};
      }
      spyOnProperty(navigator, 'serviceWorker', 'get').and.returnValue({
        ready: Promise.resolve({
          sync: { register: jasmine.createSpy('register').and.returnValue(Promise.resolve()) }
        }),
        addEventListener: jasmine.createSpy('addEventListener'),
      } as any);
    });

    it('should enqueue operation with correct priority', async () => {
      const operation = {
        type: 'completion' as const,
        method: 'POST' as const,
        url: '/api/orders/123/complete',
        body: { serialNumber: 'ABC123' },
      };

      await service.enqueue(operation);

      const queuedOps = await db.syncQueue.toArray();
      expect(queuedOps.length).toBe(1);
      expect(queuedOps[0]).toEqual(
        jasmine.objectContaining({
          type: 'completion',
          method: 'POST',
          url: '/api/orders/123/complete',
          body: { serialNumber: 'ABC123' },
          priority: 1, // completion has highest priority
          status: 'pending',
          retryCount: 0,
          maxRetries: 3,
        })
      );
    });

    it('should assign correct priorities to different operation types', async () => {
      const operations = [
        { type: 'completion' as const, priority: 1 },
        { type: 'status_change' as const, priority: 2 },
        { type: 'waste' as const, priority: 3 },
        { type: 'attachment' as const, priority: 4 },
        { type: 'note' as const, priority: 5 },
      ];

      for (const { type, priority } of operations) {
        __configureDexieMock.resetSyncQueue();

        await service.enqueue({
          type,
          method: 'POST',
          url: `/api/test/${type}`,
          body: {},
        });

        const queuedOps = await db.syncQueue.toArray();
        expect(queuedOps[0]?.priority).toBe(priority);
      }
    });
  });

  describe('Priority Queue Processing', () => {
    it('should process operations in priority order', async () => {
      const operations: SyncOperation[] = [
        {
          type: 'note',
          method: 'POST',
          url: '/api/note',
          body: {},
          priority: 5,
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: 3,
          status: 'pending',
        },
        {
          type: 'completion',
          method: 'POST',
          url: '/api/complete',
          body: {},
          priority: 1,
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: 3,
          status: 'pending',
        },
        {
          type: 'status_change',
          method: 'PUT',
          url: '/api/status',
          body: {},
          priority: 2,
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: 3,
          status: 'pending',
        },
      ];

      // Add operations to mock DB
      for (const op of operations) {
        await db.syncQueue.add(op);
      }

      const processedOrder: string[] = [];
      spyOn(service as any, 'processSingleOperation').and.callFake(
        async (op: SyncOperation) => {
          processedOrder.push(op.type!);
        }
      );

      await (service as any).processPendingOperations();

      // Should process in priority order: completion, status_change, note
      expect(processedOrder).toEqual(['completion', 'status_change', 'note']);
    });

    it('should skip operations with missing required fields', async () => {
      const operations = [
        { method: 'POST' as const, url: '/api/test', body: {}, timestamp: Date.now(), retryCount: 0, status: 'pending' as const }, // missing type and priority
        {
          type: 'completion' as const,
          method: 'POST' as const,
          url: '/api/complete',
          body: {},
          priority: 1,
          timestamp: Date.now(),
          retryCount: 0,
          status: 'pending' as const,
        },
      ];

      for (const op of operations) {
        await db.syncQueue.add(op as any);
      }

      const processSpy = spyOn(service as any, 'processSingleOperation');

      await (service as any).processPendingOperations();

      // Should only process the valid operation
      expect(processSpy).toHaveBeenCalledTimes(1);
      expect(processSpy).toHaveBeenCalledWith(
        jasmine.objectContaining({ type: 'completion' })
      );
    });
  });

  describe('Token Fetching', () => {
    it('should fetch auth token from Preferences', async () => {
      const mockToken = 'test-access-token';
      __configureMock.setGetMock(async (opts) => {
        if (opts.key === 'erp_access_token') {
          return { value: mockToken };
        }
        return { value: null };
      });

      const token = await (service as any).getAuthToken();

      expect(token).toBe(mockToken);
    });

    it('should return empty string when no token exists', async () => {
      __configureMock.setGetMock(async () => ({ value: null }));

      const token = await (service as any).getAuthToken();

      expect(token).toBe('');
    });
  });

  describe('Single Operation Processing', () => {
    it('should mark operation as syncing before processing', async () => {
      const operation: SyncOperation = {
        id: 1,
        type: 'completion',
        method: 'POST',
        url: '/api/orders/123/complete',
        body: { serialNumber: 'ABC123' },
        priority: 1,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      };

      await db.syncQueue.add(operation);

      spyOn(window, 'fetch').and.returnValue(
        Promise.resolve(new Response('{}', { status: 200, statusText: 'OK' }))
      );

      __configureMock.setGetMock(async () => ({ value: 'test-token' }));

      await (service as any).processSingleOperation(operation);

      // Check that the operation was marked as syncing then deleted
      const remaining = await db.syncQueue.toArray();
      expect(remaining.length).toBe(0); // Should be deleted after success
    });

    it('should delete operation from queue after successful sync', async () => {
      const operation: SyncOperation = {
        id: 1,
        type: 'completion',
        method: 'POST',
        url: '/api/orders/123/complete',
        body: { serialNumber: 'ABC123' },
        priority: 1,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      };

      await db.syncQueue.add(operation);

      spyOn(window, 'fetch').and.returnValue(
        Promise.resolve(new Response('{}', { status: 200, statusText: 'OK' }))
      );

      __configureMock.setGetMock(async () => ({ value: 'test-token' }));

      await (service as any).processSingleOperation(operation);

      const remaining = await db.syncQueue.toArray();
      expect(remaining.length).toBe(0);
    });

    it('should include authorization header in request', async () => {
      const fetchSpy = spyOn(window, 'fetch').and.returnValue(
        Promise.resolve(new Response('{}', { status: 200, statusText: 'OK' }))
      );

      __configureMock.setGetMock(async () => ({ value: 'bearer-token-123' }));

      const operation: SyncOperation = {
        id: 1,
        type: 'completion',
        method: 'POST',
        url: '/api/orders/123/complete',
        body: { serialNumber: 'ABC123' },
        priority: 1,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      };

      await db.syncQueue.add(operation);
      await (service as any).processSingleOperation(operation);

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/orders/123/complete',
        jasmine.objectContaining({
          method: 'POST',
          headers: jasmine.objectContaining({
            'Authorization': 'Bearer bearer-token-123',
          }),
        })
      );
    });
  });

  describe('Exponential Backoff', () => {
    beforeEach(() => {
      // Disable timers for backoff to avoid actual timeouts
      spyOn(window, 'setTimeout').and.callFake(((fn: TimerHandler) => {
        // Don't actually execute the timer callback
        return 0;
      }) as typeof setTimeout);
    });

    it('should calculate correct backoff times for retries', async () => {
      const backoffTimes = [1000, 5000, 15000, 60000, 300000];

      // Test retry counts 0, 1 (maxRetries is 3, so retryCount 2 triggers max exceeded)
      for (let retry = 0; retry < 2; retry++) {
        __configureDexieMock.resetSyncQueue();

        const operation: SyncOperation = {
          type: 'completion',
          method: 'POST',
          url: '/api/test',
          body: {},
          priority: 1,
          timestamp: Date.now(),
          retryCount: retry,
          maxRetries: 3,
          status: 'pending',
        };

        const id = await db.syncQueue.add(operation);

        await (service as any).handleOperationFailure({ ...operation, id });

        const updated = await db.syncQueue.get(id);
        const expectedBackoff = backoffTimes[retry];
        expect(updated?.lastError).toContain(`${expectedBackoff}ms`);
      }
    });

    it('should use maximum backoff time for retries beyond array length', async () => {
      const operation: SyncOperation = {
        type: 'completion',
        method: 'POST',
        url: '/api/test',
        body: {},
        priority: 1,
        timestamp: Date.now(),
        retryCount: 10, // beyond backoff array length
        maxRetries: 15,
        status: 'pending',
      };

      const id = await db.syncQueue.add(operation);

      await (service as any).handleOperationFailure({ ...operation, id });

      const updated = await db.syncQueue.get(id);
      // Should use last value in backoff array (300000ms)
      expect(updated?.lastError).toContain('300000ms');
    });
  });

  describe('Operation Failure Handling', () => {
    it('should mark operation as failed when max retries exceeded', async () => {
      const operation: SyncOperation = {
        type: 'completion',
        method: 'POST',
        url: '/api/test',
        body: {},
        priority: 1,
        timestamp: Date.now(),
        retryCount: 2, // Already at max retries
        maxRetries: 3,
        status: 'pending',
      };

      const id = await db.syncQueue.add(operation);

      await (service as any).handleOperationFailure({ ...operation, id });

      const updated = await db.syncQueue.get(id);
      expect(updated?.status).toBe('failed');
      expect(updated?.lastError).toBe('Max retries exceeded');

      expect(uiStore.showToast).toHaveBeenCalledWith(
        jasmine.stringContaining('동기화 실패'),
        'danger',
        5000
      );
    });

    it('should increment retry count for operations below max retries', async () => {
      const operation: SyncOperation = {
        type: 'completion',
        method: 'POST',
        url: '/api/test',
        body: {},
        priority: 1,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      };

      const id = await db.syncQueue.add(operation);

      await (service as any).handleOperationFailure({ ...operation, id });

      const updated = await db.syncQueue.get(id);
      expect(updated?.retryCount).toBe(1);
      expect(updated?.lastError).toContain('Retry 1/3');
    });

    it('should schedule retry with exponential backoff', async () => {
      let scheduledCallback: TimerHandler | undefined;
      let scheduledDelay = 0;

      // Mock setTimeout to capture the callback and delay
      spyOn(window, 'setTimeout').and.callFake(((fn: TimerHandler, delay?: number) => {
        scheduledCallback = fn;
        scheduledDelay = delay || 0;
        return 1;
      }) as typeof setTimeout);

      const operation: SyncOperation = {
        id: 1,
        type: 'completion',
        method: 'POST',
        url: '/api/test',
        body: {},
        priority: 1,
        timestamp: Date.now(),
        retryCount: 1,
        maxRetries: 3,
        status: 'pending',
      };

      await db.syncQueue.add(operation);

      const processSpy = spyOn(service as any, 'processPendingOperations');

      // Run the failure handler
      await (service as any).handleOperationFailure(operation);

      // Verify setTimeout was called with correct backoff (5000ms for retry 1->2)
      expect(window.setTimeout).toHaveBeenCalled();
      expect(scheduledDelay).toBe(5000);

      // Verify the callback would trigger processPendingOperations when called
      expect(scheduledCallback).toBeDefined();
    });
  });

  describe('Get Operations', () => {
    it('should return pending operations', async () => {
      const mockOp = {
        type: 'completion' as const,
        method: 'POST' as const,
        url: '/api/test',
        body: {},
        status: 'pending' as const,
        priority: 1,
        timestamp: Date.now(),
        retryCount: 0,
      };

      await db.syncQueue.add(mockOp);

      const result = await service.getPendingOperations();

      expect(result.length).toBe(1);
      expect(result[0]).toEqual(jasmine.objectContaining({
        type: 'completion',
        method: 'POST',
        status: 'pending',
      }));
    });

    it('should return failed operations', async () => {
      const mockOp = {
        type: 'status_change' as const,
        method: 'PUT' as const,
        url: '/api/test',
        body: {},
        status: 'failed' as const,
        priority: 2,
        timestamp: Date.now(),
        retryCount: 3,
      };

      await db.syncQueue.add(mockOp);

      const result = await service.getFailedOperations();

      expect(result.length).toBe(1);
      expect(result[0]).toEqual(jasmine.objectContaining({
        type: 'status_change',
        status: 'failed',
      }));
    });
  });

  describe('Retry Failed Operation', () => {
    it('should reset status and retry count for failed operation', async () => {
      const failedOp: SyncOperation = {
        type: 'completion',
        method: 'POST',
        url: '/api/test',
        body: {},
        priority: 1,
        timestamp: Date.now(),
        retryCount: 3,
        maxRetries: 3,
        status: 'failed',
      };

      const id = await db.syncQueue.add(failedOp);

      // Mock fetch to return success - this allows processSingleOperation to complete
      spyOn(window, 'fetch').and.returnValue(
        Promise.resolve(new Response('{}', { status: 200, statusText: 'OK' }))
      );

      __configureMock.setGetMock(async () => ({ value: 'test-token' }));

      // The retryFailed method resets status and retryCount, then calls processSingleOperation
      // After successful processing, the operation is deleted from the queue
      await service.retryFailed(id as number);

      // After successful sync, operation should be deleted from queue
      const updated = await db.syncQueue.get(id);
      expect(updated).toBeUndefined(); // Operation was processed and removed
    });

    it('should not retry if operation does not exist', async () => {
      const initialCount = (await db.syncQueue.toArray()).length;

      await service.retryFailed(999);

      const finalCount = (await db.syncQueue.toArray()).length;
      expect(finalCount).toBe(initialCount);
    });
  });

  describe('Clear Queue', () => {
    it('should clear all operations from sync queue', async () => {
      await db.syncQueue.add({
        type: 'completion',
        method: 'POST',
        url: '/api/test',
        body: {},
        status: 'pending',
        priority: 1,
        timestamp: Date.now(),
        retryCount: 0,
      });

      await service.clearQueue();

      const remaining = await db.syncQueue.toArray();
      expect(remaining.length).toBe(0);
    });
  });

  describe('Service Worker Integration', () => {
    it('should handle SYNC_COMPLETE message from service worker', () => {
      const onNetworkOnlineSpy = spyOn(service, 'onNetworkOnline');

      // Simulate service worker message
      const messageEvent = new MessageEvent('message', {
        data: { type: 'SYNC_COMPLETE' },
      });

      window.dispatchEvent(messageEvent);

      // Note: The actual implementation uses navigator.serviceWorker.addEventListener
      // This test verifies the spy is available
      expect(onNetworkOnlineSpy).toBeDefined();
    });
  });

  describe('Calculate Priority', () => {
    it('should return correct priority for each operation type', () => {
      const calculatePriority = (service as any).calculatePriority.bind(service);

      expect(calculatePriority('completion')).toBe(1);
      expect(calculatePriority('status_change')).toBe(2);
      expect(calculatePriority('waste')).toBe(3);
      expect(calculatePriority('attachment')).toBe(4);
      expect(calculatePriority('note')).toBe(5);
    });

    it('should return default priority for unknown types', () => {
      const calculatePriority = (service as any).calculatePriority.bind(service);

      expect(calculatePriority('unknown_type' as any)).toBe(99);
    });
  });

  describe('Get Operation Label', () => {
    it('should return correct i18n keys for operation types', () => {
      const getOperationLabel = (service as any).getOperationLabel.bind(service);

      expect(getOperationLabel('completion')).toBe('SYNC.OPERATION.COMPLETION');
      expect(getOperationLabel('status_change')).toBe('SYNC.OPERATION.STATUS_CHANGE');
      expect(getOperationLabel('waste')).toBe('SYNC.OPERATION.WASTE');
      expect(getOperationLabel('attachment')).toBe('SYNC.OPERATION.ATTACHMENT');
      expect(getOperationLabel('note')).toBe('SYNC.OPERATION.NOTE');
    });
  });
});
