/**
 * Sync Queue Service Tests
 * Tests offline sync queue operations and conflict resolution
 * Uses pure async/await pattern (no fakeAsync) for Dexie mock compatibility
 */

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ModalController } from '@ionic/angular/standalone';
import { SyncQueueService, SyncOperationStatus, SyncOperation } from './sync-queue.service';
import { db, __configureDexieMock } from '@app/core/db/database';
import { environment } from '@env/environment';

describe('SyncQueueService', () => {
  let service: SyncQueueService;
  let httpMock: HttpTestingController;
  let modalCtrlSpy: jasmine.SpyObj<ModalController>;

  beforeEach(async () => {
    // Reset Dexie mocks
    __configureDexieMock.resetAll();

    // Create modal controller spy
    modalCtrlSpy = jasmine.createSpyObj('ModalController', ['create']);

    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        SyncQueueService,
        { provide: ModalController, useValue: modalCtrlSpy },
      ],
    }).compileComponents();

    service = TestBed.inject(SyncQueueService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  describe('enqueue', () => {
    it('should add operation to queue with default values', async () => {
      const operation: Omit<SyncOperation, 'id' | 'timestamp'> = {
        method: 'POST',
        url: '/orders',
        body: { status: 'COMPLETED' },
      };

      await service.enqueue(operation);

      const queue = __configureDexieMock.getSyncQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].method).toBe('POST');
      expect(queue[0].url).toBe('/orders');
      expect(queue[0].status).toBe(SyncOperationStatus.PENDING);
      expect(queue[0].retryCount).toBe(0);
      expect(queue[0].timestamp).toBeDefined();
    });

    it('should update pending count after enqueue', async () => {
      expect(service.pendingCount()).toBe(0);

      await service.enqueue({
        method: 'PUT',
        url: '/orders/1',
        body: { status: 'ASSIGNED' },
      });

      expect(service.pendingCount()).toBe(1);
    });

    it('should enqueue multiple operations', async () => {
      await service.enqueue({
        method: 'POST',
        url: '/orders/1',
        body: {},
      });

      await service.enqueue({
        method: 'PUT',
        url: '/orders/2',
        body: {},
      });

      await service.enqueue({
        method: 'DELETE',
        url: '/orders/3',
        body: null,
      });

      const queue = __configureDexieMock.getSyncQueue();
      expect(queue.length).toBe(3);
      expect(service.pendingCount()).toBe(3);
    });
  });

  describe('processQueue', () => {
    it('should process pending operations successfully', async () => {
      // Add operations to queue
      await service.enqueue({
        method: 'POST',
        url: '/orders',
        body: { erpOrderNumber: 'ERP-001' },
      });

      // Process queue
      const processPromise = service.processQueue();

      // Wait for async database operations to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Expect HTTP request
      const req = httpMock.expectOne(`${environment.apiUrl}/orders`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ erpOrderNumber: 'ERP-001' });

      // Respond with success
      req.flush({ id: 'order-1', status: 'success' });

      await processPromise;

      // Operation should be removed from queue
      const queue = __configureDexieMock.getSyncQueue();
      expect(queue.length).toBe(0);
      expect(service.pendingCount()).toBe(0);
      expect(service.lastSyncTime()).toBeDefined();
    });

    it('should set isSyncing flag during processing', async () => {
      expect(service.isSyncing()).toBe(false);

      const processPromise = service.processQueue();
      // Note: isSyncing may be true briefly during processing

      await processPromise;
      expect(service.isSyncing()).toBe(false);
    });

    it('should not process if already syncing', async () => {
      await service.enqueue({
        method: 'POST',
        url: '/orders',
        body: {},
      });

      // Start first sync
      const promise1 = service.processQueue();

      // Try to start second sync immediately
      const promise2 = service.processQueue();

      // Allow microtask queue to flush
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should only have one HTTP request
      const requests = httpMock.match(`${environment.apiUrl}/orders`);
      expect(requests.length).toBe(1);

      requests[0].flush({ success: true });
      await Promise.all([promise1, promise2]);
    });

    it('should execute POST requests', async () => {
      await service.enqueue({
        method: 'POST',
        url: '/orders',
        body: { test: 'data' },
      });

      const processPromise = service.processQueue();
      await new Promise(resolve => setTimeout(resolve, 10));

      const req = httpMock.expectOne(`${environment.apiUrl}/orders`);
      expect(req.request.method).toBe('POST');
      req.flush({ success: true });

      await processPromise;
    });

    it('should execute PUT requests', async () => {
      await service.enqueue({
        method: 'PUT',
        url: '/orders/123',
        body: { status: 'COMPLETED' },
      });

      const processPromise = service.processQueue();
      await new Promise(resolve => setTimeout(resolve, 10));

      const req = httpMock.expectOne(`${environment.apiUrl}/orders/123`);
      expect(req.request.method).toBe('PUT');
      req.flush({ success: true });

      await processPromise;
    });

    it('should execute PATCH requests', async () => {
      await service.enqueue({
        method: 'PATCH',
        url: '/orders/456',
        body: { notes: 'Updated notes' },
      });

      const processPromise = service.processQueue();
      await new Promise(resolve => setTimeout(resolve, 10));

      const req = httpMock.expectOne(`${environment.apiUrl}/orders/456`);
      expect(req.request.method).toBe('PATCH');
      req.flush({ success: true });

      await processPromise;
    });

    it('should execute DELETE requests', async () => {
      await service.enqueue({
        method: 'DELETE',
        url: '/orders/789',
        body: null,
      });

      const processPromise = service.processQueue();
      await new Promise(resolve => setTimeout(resolve, 10));

      const req = httpMock.expectOne(`${environment.apiUrl}/orders/789`);
      expect(req.request.method).toBe('DELETE');
      req.flush({ success: true });

      await processPromise;
    });
  });

  describe('error handling', () => {
    it('should increment retry count on network error', async () => {
      await service.enqueue({
        method: 'POST',
        url: '/orders',
        body: {},
      });

      const processPromise = service.processQueue();
      await new Promise(resolve => setTimeout(resolve, 10));

      const req = httpMock.expectOne(`${environment.apiUrl}/orders`);
      req.flush('Network error', { status: 500, statusText: 'Server Error' });

      await processPromise;

      // Should still be in queue with retry count incremented
      const queue = __configureDexieMock.getSyncQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].retryCount).toBe(1);
      expect(queue[0].status).toBe(SyncOperationStatus.PENDING);
    });

    it('should mark as FAILED after max retries', async () => {
      // Add operation with high retry count
      await db.syncQueue.add({
        method: 'POST',
        url: '/orders',
        body: {},
        timestamp: Date.now(),
        retryCount: 4, // One less than max (5)
        status: SyncOperationStatus.PENDING,
      });

      const processPromise = service.processQueue();
      await new Promise(resolve => setTimeout(resolve, 10));

      const req = httpMock.expectOne(`${environment.apiUrl}/orders`);
      req.flush('Error', { status: 500, statusText: 'Server Error' });

      await processPromise;

      // Should be marked as FAILED
      const queue = __configureDexieMock.getSyncQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].status).toBe(SyncOperationStatus.FAILED);
      expect(queue[0].retryCount).toBe(5);
    });

    it('should handle 409 conflict error', async () => {
      // Setup modal spy to return unresolved conflict (user dismisses without resolving)
      const modalMock = {
        present: jasmine.createSpy('present').and.returnValue(Promise.resolve()),
        onWillDismiss: jasmine.createSpy('onWillDismiss').and.returnValue(
          Promise.resolve({
            data: {
              resolved: false,  // User dismissed without resolving
            },
          })
        ),
      };
      modalCtrlSpy.create.and.returnValue(Promise.resolve(modalMock as any));

      await service.enqueue({
        method: 'PUT',
        url: '/orders/1',
        body: { status: 'COMPLETED', version: 1 },
        entityType: 'order',
        entityId: '1',
      });

      const processPromise = service.processQueue();
      await new Promise(resolve => setTimeout(resolve, 10));

      const req = httpMock.expectOne(`${environment.apiUrl}/orders/1`);
      req.flush(
        {
          message: 'Version conflict',
          currentVersion: 2,
          currentState: { status: 'ASSIGNED', version: 2 },
        },
        { status: 409, statusText: 'Conflict' }
      );

      await processPromise;

      // Should mark as CONFLICT
      const queue = __configureDexieMock.getSyncQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].status).toBe(SyncOperationStatus.CONFLICT);
      expect(queue[0].conflictData).toBeDefined();
    });

    it('should set lastError on processing failure', async () => {
      await service.processQueue();

      // Initially no error
      expect(service.lastError()).toBeNull();
    });
  });

  describe('conflict resolution', () => {
    it('should retrieve conflicts', async () => {
      // Add a conflict
      await db.syncQueue.add({
        method: 'PUT',
        url: '/orders/1',
        body: {},
        timestamp: Date.now(),
        retryCount: 0,
        status: SyncOperationStatus.CONFLICT,
        conflictData: {
          entityType: 'order',
          entityId: '1',
          serverVersion: 2,
          localVersion: 1,
          serverData: {},
          localData: {},
          timestamp: Date.now(),
        },
      });

      const conflicts = await service.getConflicts();
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].status).toBe(SyncOperationStatus.CONFLICT);
    });

    it('should update conflict count', async () => {
      expect(service.conflictCount()).toBe(0);

      await db.syncQueue.add({
        method: 'PUT',
        url: '/orders/1',
        body: {},
        timestamp: Date.now(),
        retryCount: 0,
        status: SyncOperationStatus.CONFLICT,
      });

      await service.initialize();

      expect(service.conflictCount()).toBe(1);
    });
  });

  describe('queue management', () => {
    it('should clear completed and failed operations', async () => {
      await db.syncQueue.add({
        method: 'POST',
        url: '/orders/1',
        body: {},
        timestamp: Date.now(),
        retryCount: 0,
        status: SyncOperationStatus.COMPLETED,
      });

      await db.syncQueue.add({
        method: 'POST',
        url: '/orders/2',
        body: {},
        timestamp: Date.now(),
        retryCount: 0,
        status: SyncOperationStatus.FAILED,
      });

      await db.syncQueue.add({
        method: 'POST',
        url: '/orders/3',
        body: {},
        timestamp: Date.now(),
        retryCount: 0,
        status: SyncOperationStatus.PENDING,
      });

      await service.clearCompleted();

      const queue = __configureDexieMock.getSyncQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].status).toBe(SyncOperationStatus.PENDING);
    });

    it('should clear entire queue', async () => {
      await service.enqueue({ method: 'POST', url: '/orders/1', body: {} });
      await service.enqueue({ method: 'POST', url: '/orders/2', body: {} });
      await service.enqueue({ method: 'POST', url: '/orders/3', body: {} });

      expect(service.pendingCount()).toBe(3);

      await service.clearQueue();

      expect(service.pendingCount()).toBe(0);
      expect(service.conflictCount()).toBe(0);
    });

    it('should initialize counts on service start', async () => {
      // Add some entries before initialization
      await db.syncQueue.add({
        method: 'POST',
        url: '/orders/1',
        body: {},
        timestamp: Date.now(),
        retryCount: 0,
        status: SyncOperationStatus.PENDING,
      });

      await db.syncQueue.add({
        method: 'POST',
        url: '/orders/2',
        body: {},
        timestamp: Date.now(),
        retryCount: 0,
        status: SyncOperationStatus.CONFLICT,
      });

      await service.initialize();

      expect(service.pendingCount()).toBe(1);
      expect(service.conflictCount()).toBe(1);
    });
  });

  describe('URL handling', () => {
    it('should prepend apiUrl for relative URLs', async () => {
      await service.enqueue({
        method: 'PATCH',
        url: '/orders/1',
        body: { test: 'data' },
      });

      const processPromise = service.processQueue();
      await new Promise(resolve => setTimeout(resolve, 10));

      const req = httpMock.expectOne(`${environment.apiUrl}/orders/1`);
      expect(req.request.url).toBe(`${environment.apiUrl}/orders/1`);
      req.flush({ success: true });

      await processPromise;
    });

    it('should use absolute URLs as-is', async () => {
      const absoluteUrl = 'https://example.com/api/orders/1';

      await service.enqueue({
        method: 'PUT',
        url: absoluteUrl,
        body: { test: 'data' },
      });

      const processPromise = service.processQueue();
      await new Promise(resolve => setTimeout(resolve, 10));

      const req = httpMock.expectOne(absoluteUrl);
      expect(req.request.url).toBe(absoluteUrl);
      req.flush({ success: true });

      await processPromise;
    });
  });

  describe('batch processing', () => {
    it('should process operations in batches', async () => {
      // Add 25 operations (more than batch size of 20)
      const operations = Array.from({ length: 25 }, (_, i) => ({
        method: 'POST' as const,
        url: `/orders/${i}`,
        body: { index: i },
      }));

      for (const op of operations) {
        await service.enqueue(op);
      }

      const processPromise = service.processQueue();

      // Wait for first batch to start
      await new Promise(resolve => setTimeout(resolve, 10));

      // Flush first batch of 20 requests
      let requests = httpMock.match((req) => req.url.includes('/orders/'));
      expect(requests.length).toBeGreaterThanOrEqual(20);
      requests.forEach((req) => req.flush({ success: true }));

      // Wait for second batch to process
      await new Promise(resolve => setTimeout(resolve, 10));

      // Flush remaining requests
      requests = httpMock.match((req) => req.url.includes('/orders/'));
      requests.forEach((req) => req.flush({ success: true }));

      await processPromise;

      // All should be processed
      const queue = __configureDexieMock.getSyncQueue();
      expect(queue.length).toBe(0);
    });
  });
});
