// apps/web/src/app/features/settlement-fees/services/settlement-fees.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { SettlementFeesService } from './settlement-fees.service';

describe('SettlementFeesService', () => {
  let service: SettlementFeesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SettlementFeesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // Note: no interceptors registered here (matches warehouse.service.spec.ts convention).
  // The global apiResponseInterceptor already strips the {success,data} envelope before a
  // subscriber sees the body in the real app — what we flush below is that already-unwrapped
  // shape. Do not add a manual .data.data unwrap in the service to match this.

  it('posts preview with a { yearMonth } body', async () => {
    const promise = service.preview('2026-07');
    const req = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/settlement-fees/preview'));
    expect(req.request.body).toEqual({ yearMonth: '2026-07' });
    req.flush({
      partners: [{ partnerId: 'p1', transportTotal: '10000', storageTotal: '5000', errors: [] }],
    });
    const result = await promise;
    expect(result.partners[0].partnerId).toBe('p1');
    expect(result.partners[0].errors).toEqual([]);
  });

  it('passes partnerId and yearMonth as query params on getStatement', async () => {
    const promise = service.getStatement('p1', '2026-07');
    const req = http.expectOne((r) => r.method === 'GET' && r.url.includes('/settlement-fees/statement'));
    expect(req.request.params.get('partnerId')).toBe('p1');
    expect(req.request.params.get('yearMonth')).toBe('2026-07');
    req.flush({
      partnerId: 'p1',
      yearMonth: '2026-07',
      transport: { count: 0, total: '0', records: [] },
      storage: { total: '0', records: [] },
      grandTotal: '0',
    });
    const result = await promise;
    expect(result.partnerId).toBe('p1');
    expect(result.grandTotal).toBe('0');
  });

  it('propagates the E4109 error body from close to the caller', async () => {
    const promise = service.close('2026-07');
    const req = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/settlement-fees/close'));
    expect(req.request.body).toEqual({ yearMonth: '2026-07' });
    req.flush(
      { code: 'E4109', message: 'E4109: unresolved calculation errors', errors: [{ transactionId: 't1', code: 'E4108', message: 'E4108: no transport rate configured' }] },
      { status: 400, statusText: 'Bad Request' },
    );
    let caught: any;
    try {
      await promise;
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(HttpErrorResponse);
    expect(caught.error.code).toBe('E4109');
    expect(caught.error.errors[0].code).toBe('E4108');
  });
});
