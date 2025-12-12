import { TestBed, fakeAsync, tick, flush } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { SyncQueueService, SyncOperation } from './sync-queue.service';
import { environment } from '@env/environment';
import { db, __configureDexieMock } from '@app/core/db/database';

describe('SyncQueueService', () => {
  let service: SyncQueueService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    // Reset mock database
    __configureDexieMock.resetAll();

    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SyncQueueService],
    }).compileComponents();

    service = TestBed.inject(SyncQueueService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    __configureDexieMock.resetAll();
  });

  describe('enqueue', () => {
    it('should add operation to queue with default values', async () => {
      const operation: Partial<SyncOperation> & Pick<SyncOperation, 'method' | 'url' | 'body' | 'timestamp'> = {
        method: 'POST',
        url: '/orders/complete',
        body: { orderId: '123' },
        timestamp: Date.now(),
      };

      await service.enqueue(operation);

      const queueItems = await db.syncQueue.toArray();
      expect(queueItems.length).toBe(1);
      expect(queueItems[0]).toEqual(jasmine.objectContaining({
        type: 'note',
        method: 'POST',
        url: '/orders/complete',
        body: { orderId: '123' },
        priority: 5,
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      }));
    });

    it('should add operation to queue with custom values', async () => {
      const operation: Partial<SyncOperation> & Pick<SyncOperation, 'method' | 'url' | 'body' | 'timestamp'> = {
        type: 'completion',
        method: 'POST',
        url: '/orders/complete',
        body: { orderId: '123' },
        priority: 10,
        timestamp: Date.now(),
        retryCount: 1,
        maxRetries: 5,
        status: 'pending',
      };

      await service.enqueue(operation);

      const queueItems = await db.syncQueue.toArray();
      expect(queueItems.length).toBe(1);
      expect(queueItems[0]).toEqual(jasmine.objectContaining({
        type: 'completion',
        method: 'POST',
        priority: 10,
        retryCount: 1,
        maxRetries: 5,
      }));
    });

    it('should increment pending count after enqueue', async () => {
      const operation: Partial<SyncOperation> & Pick<SyncOperation, 'method' | 'url' | 'body' | 'timestamp'> = {
        method: 'POST',
        url: '/orders/complete',
        body: { orderId: '123' },
        timestamp: Date.now(),
      };

      expect(service.pendingCount()).toBe(0);
      await service.enqueue(operation);

      expect(service.pendingCount()).toBe(1);
    });
  });

  describe('processQueue', () => {
    it('should prevent concurrent execution', fakeAsync(() => {
      // Setup: Add an operation to the queue
      db.syncQueue.add({
        type: 'completion',
        method: 'POST',
        url: '/orders/complete',
        body: { orderId: '123' },
        priority: 5,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      });

      tick();

      // Start first processing
      service.processQueue();
      tick();

      expect(service.isSyncing()).toBeTrue();

      // Try to start second processing (should be prevented)
      service.processQueue();

      // Complete first processing
      const req = httpMock.expectOne(`${environment.apiUrl}/orders/complete`);
      req.flush({});

      flush();

      expect(service.isSyncing()).toBeFalse();
    }));

    it('should process operations in order and delete on success', fakeAsync(() => {
      db.syncQueue.add({
        type: 'completion',
        method: 'POST',
        url: '/orders/1/complete',
        body: { orderId: '1' },
        priority: 5,
        timestamp: 1000,
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      });

      tick();

      db.syncQueue.add({
        type: 'status_change',
        method: 'PATCH',
        url: '/orders/2/status',
        body: { status: 'CONFIRMED' },
        priority: 5,
        timestamp: 2000,
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      });

      tick();

      service.processQueue();
      tick();

      // First request
      const req1 = httpMock.expectOne(`${environment.apiUrl}/orders/1/complete`);
      req1.flush({});

      tick();

      // Second request
      const req2 = httpMock.expectOne(`${environment.apiUrl}/orders/2/status`);
      req2.flush({});

      flush();

      let queueItems: any[];
      db.syncQueue.toArray().then((result) => { queueItems = result; });
      tick();

      expect(queueItems!.length).toBe(0);
    }));

    it('should set isSyncing to false after completion', fakeAsync(() => {
      db.syncQueue.add({
        type: 'completion',
        method: 'POST',
        url: '/orders/complete',
        body: { orderId: '123' },
        priority: 5,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      });

      tick();

      service.processQueue();
      tick();

      expect(service.isSyncing()).toBeTrue();

      const req = httpMock.expectOne(`${environment.apiUrl}/orders/complete`);
      req.flush({});

      flush();

      expect(service.isSyncing()).toBeFalse();
    }));
  });

  describe('executeOperation', () => {
    it('should execute POST request', fakeAsync(() => {
      db.syncQueue.add({
        type: 'completion',
        method: 'POST',
        url: '/orders/complete',
        body: { orderId: '123' },
        priority: 5,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      });

      tick(); // Allow IndexedDB mock to complete

      service.processQueue();
      tick(); // Allow processQueue to start HTTP request

      const req = httpMock.expectOne(`${environment.apiUrl}/orders/complete`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ orderId: '123' });
      req.flush({});

      flush(); // Complete all pending async operations
    }));

    it('should execute PUT request', fakeAsync(() => {
      db.syncQueue.add({
        type: 'note',
        method: 'PUT',
        url: '/orders/1',
        body: { note: 'Updated note' },
        priority: 5,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      });

      tick();

      service.processQueue();
      tick();

      const req = httpMock.expectOne(`${environment.apiUrl}/orders/1`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ note: 'Updated note' });
      req.flush({});

      flush();
    }));

    it('should execute PATCH request', fakeAsync(() => {
      db.syncQueue.add({
        type: 'status_change',
        method: 'PATCH',
        url: '/orders/1/status',
        body: { status: 'CONFIRMED' },
        priority: 5,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      });

      tick();

      service.processQueue();
      tick();

      const req = httpMock.expectOne(`${environment.apiUrl}/orders/1/status`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ status: 'CONFIRMED' });
      req.flush({});

      flush();
    }));

    it('should execute DELETE request', fakeAsync(() => {
      db.syncQueue.add({
        type: 'note',
        method: 'DELETE',
        url: '/orders/1/attachments/123',
        body: null,
        priority: 5,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      });

      tick();

      service.processQueue();
      tick();

      const req = httpMock.expectOne(`${environment.apiUrl}/orders/1/attachments/123`);
      expect(req.request.method).toBe('DELETE');
      req.flush({});

      flush();
    }));

    it('should handle absolute URLs', fakeAsync(() => {
      db.syncQueue.add({
        type: 'completion',
        method: 'POST',
        url: 'https://external-api.com/webhook',
        body: { data: 'test' },
        priority: 5,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      });

      tick();

      service.processQueue();
      tick();

      const req = httpMock.expectOne('https://external-api.com/webhook');
      expect(req.request.method).toBe('POST');
      req.flush({});

      flush();
    }));
  });

  describe('retry logic', () => {
    it('should increment retry count on failure', fakeAsync(() => {
      let id: number;
      db.syncQueue.add({
        type: 'completion',
        method: 'POST',
        url: '/orders/complete',
        body: { orderId: '123' },
        priority: 5,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      }).then((result) => { id = result as number; });

      tick();

      service.processQueue();
      tick();

      const req = httpMock.expectOne(`${environment.apiUrl}/orders/complete`);
      req.flush({ message: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });

      flush();

      let updated: any;
      db.syncQueue.get(id!).then((result) => { updated = result; });
      tick();

      expect(updated?.retryCount).toBe(1);
    }));

    it('should abandon operation after max retries', fakeAsync(() => {
      let id: number;
      db.syncQueue.add({
        type: 'completion',
        method: 'POST',
        url: '/orders/complete',
        body: { orderId: '123' },
        priority: 5,
        timestamp: Date.now(),
        retryCount: 2, // Already retried twice
        maxRetries: 3,
        status: 'pending',
      }).then((result) => { id = result as number; });

      tick();

      spyOn(console, 'error');

      service.processQueue();
      tick();

      const req = httpMock.expectOne(`${environment.apiUrl}/orders/complete`);
      req.flush({ message: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });

      flush();

      let deleted: any;
      db.syncQueue.get(id!).then((result) => { deleted = result; });
      tick();

      expect(deleted).toBeUndefined();
      expect(console.error).toHaveBeenCalledWith('Max retries reached for sync operation:', jasmine.any(Object));
    }));

    it('should continue processing other operations after one fails', fakeAsync(() => {
      db.syncQueue.add({
        type: 'completion',
        method: 'POST',
        url: '/orders/1/complete',
        body: { orderId: '1' },
        priority: 5,
        timestamp: 1000,
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      });

      tick();

      db.syncQueue.add({
        type: 'status_change',
        method: 'PATCH',
        url: '/orders/2/status',
        body: { status: 'CONFIRMED' },
        priority: 5,
        timestamp: 2000,
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      });

      tick();

      service.processQueue();
      tick();

      // First request fails
      const req1 = httpMock.expectOne(`${environment.apiUrl}/orders/1/complete`);
      req1.flush({ message: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });

      tick();

      // Second request succeeds
      const req2 = httpMock.expectOne(`${environment.apiUrl}/orders/2/status`);
      req2.flush({});

      flush();

      let queueItems: any[];
      db.syncQueue.toArray().then((result) => { queueItems = result; });
      tick();

      // First operation should still be in queue with incremented retry count
      expect(queueItems!.length).toBe(1);
      expect(queueItems![0].retryCount).toBe(1);
    }));
  });

  describe('clearQueue', () => {
    it('should clear all queue entries and reset pending count', async () => {
      await db.syncQueue.add({
        type: 'completion',
        method: 'POST',
        url: '/orders/complete',
        body: { orderId: '123' },
        priority: 5,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      });

      await service.clearQueue();

      const queueItems = await db.syncQueue.toArray();
      expect(queueItems.length).toBe(0);
      expect(service.pendingCount()).toBe(0);
    });
  });

  describe('signals', () => {
    it('should expose readonly pendingCount signal', () => {
      const count = service.pendingCount();
      expect(typeof count).toBe('number');
    });

    it('should expose readonly isSyncing signal', () => {
      const syncing = service.isSyncing();
      expect(typeof syncing).toBe('boolean');
      expect(syncing).toBeFalse();
    });
  });
});
