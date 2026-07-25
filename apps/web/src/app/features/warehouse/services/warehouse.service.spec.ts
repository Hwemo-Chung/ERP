// apps/web/src/app/features/warehouse/services/warehouse.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { WarehouseService } from './warehouse.service';

describe('WarehouseService', () => {
  let service: WarehouseService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(WarehouseService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // Note: no interceptors registered here (matches master-data.service.spec.ts convention).
  // The global apiResponseInterceptor already strips the {success,data} envelope before a
  // subscriber sees the body in the real app — what we flush below is that already-unwrapped
  // shape. Do not add a manual .data.data unwrap in the service to match this.

  it('passes filter params through on getTransactions', async () => {
    const promise = service.getTransactions({ partnerId: 'p1', dateFrom: '2026-07-01', dateTo: '2026-07-31', page: 2 });
    const req = http.expectOne(
      (r) => r.method === 'GET' && r.url.includes('/warehouse/transactions'),
    );
    expect(req.request.params.get('partnerId')).toBe('p1');
    expect(req.request.params.get('dateFrom')).toBe('2026-07-01');
    expect(req.request.params.get('dateTo')).toBe('2026-07-31');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.has('productId')).toBe(false);
    req.flush({ data: [{ id: 't1', type: 'INBOUND' }], totalCount: 1 });
    const result = await promise;
    expect(result.data[0].id).toBe('t1');
    expect(result.totalCount).toBe(1);
  });

  it('posts createTransaction with the CreateTransactionDto shape', async () => {
    const dto = {
      type: 'INBOUND' as const, partnerId: 'p1', productId: 'prod1',
      quantity: 10, transactionDate: '2026-07-25',
    };
    const promise = service.createTransaction(dto);
    const req = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/warehouse/transactions'));
    expect(req.request.body).toEqual(dto);
    req.flush({ id: 't1', ...dto });
    const result = await promise;
    expect(result.id).toBe('t1');
  });

  it('posts importCommit with rows wrapped in a { rows } body', async () => {
    const rows = [{ type: 'OUTBOUND', partnerId: 'p1', productId: 'prod1', quantity: 5, transactionDate: '2026-07-25' }];
    const promise = service.importCommit(rows);
    const req = http.expectOne((r) => r.method === 'POST' && r.url.includes('/warehouse/transactions/import/commit'));
    expect(req.request.body).toEqual({ rows });
    req.flush({ created: 1, failed: [] });
    const result = await promise;
    expect(result.created).toBe(1);
  });
});
