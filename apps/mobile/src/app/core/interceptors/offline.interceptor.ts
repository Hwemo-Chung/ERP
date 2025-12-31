import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { of } from 'rxjs';
import { NetworkService } from '../services/network.service';
import { SyncQueueService } from '../services/sync-queue.service';

// Endpoints that support offline mode
const OFFLINE_ENDPOINTS = [
  { pattern: /\/orders$/, methods: ['GET'] },
  { pattern: /\/orders\/\w+$/, methods: ['GET', 'PATCH'] },
  { pattern: /\/metadata/, methods: ['GET'] },
];

export const offlineInterceptor: HttpInterceptorFn = (req, next) => {
  // Skip interceptor for static assets (i18n, images, etc.)
  if (req.url.includes('/assets/')) {
    return next(req);
  }

  const networkService = inject(NetworkService);
  const syncQueue = inject(SyncQueueService);

  // If online, proceed normally
  if (!networkService.isOffline()) {
    return next(req);
  }

  // Check if this endpoint supports offline mode
  const offlineConfig = OFFLINE_ENDPOINTS.find(
    (endpoint) => endpoint.pattern.test(req.url) && endpoint.methods.includes(req.method)
  );

  if (!offlineConfig) {
    // Return error for unsupported offline operations
    return of(new HttpResponse({
      status: 503,
      statusText: 'Offline',
      body: { message: 'This operation is not available offline' },
    }));
  }

  // For write operations, queue for sync
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    syncQueue.enqueue({
      method: req.method as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      url: req.url,
      body: req.body,
    });

    // Return optimistic success response
    return of(new HttpResponse({
      status: 202,
      statusText: 'Queued',
      body: { message: 'Operation queued for sync', offline: true },
    }));
  }

  // For read operations, return from local cache (handled by service)
  return next(req);
};
