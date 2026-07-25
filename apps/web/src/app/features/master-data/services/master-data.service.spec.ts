// apps/web/src/app/features/master-data/services/master-data.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { MasterDataService } from './master-data.service';

describe('MasterDataService', () => {
  let service: MasterDataService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MasterDataService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // Note: no interceptors are registered here (matches auth.service.spec.ts convention).
  // In the real app, the global apiResponseInterceptor (main.ts) already strips the
  // {success,data} envelope before a subscriber sees the body, so what we flush below
  // is the already-unwrapped shape a real HttpClient consumer receives — NOT the raw
  // wire response. Do not add a manual .data.data unwrap in the service to match this.
  it('resolves partner list with paginated shape', async () => {
    const promise = service.getPartners({ page: 1 });
    const req = http.expectOne(r => r.url.includes('/master-data/partners'));
    req.flush({ data: [{ id: 'p1', code: 'P-0001' }], totalCount: 1 });
    const result = await promise;
    expect(result.data[0].code).toBe('P-0001');
    expect(result.totalCount).toBe(1);
  });

  it('posts partner with nested storage contract', async () => {
    const dto = {
      name: '테스트', storageContract: { contractType: 'PALLET_DAILY', palletDailyRate: '1500', startDate: '2026-07-01' },
    };
    const promise = service.createPartner(dto as any);
    const req = http.expectOne(r => r.method === 'POST' && r.url.includes('/master-data/partners'));
    expect(req.request.body.storageContract.contractType).toBe('PALLET_DAILY');
    req.flush({ id: 'p1' });
    await promise;
  });

  it('patches partner without code or storageContract in the body', async () => {
    const dto = { name: '수정됨', phone: '010-1111-2222' };
    const promise = service.updatePartner('p1', dto);
    const req = http.expectOne(r => r.method === 'PATCH' && r.url.includes('/master-data/partners/p1'));
    expect(req.request.body).toEqual(dto);
    expect(req.request.body.code).toBeUndefined();
    expect(req.request.body.storageContract).toBeUndefined();
    req.flush({ id: 'p1', code: 'P-0001', name: '수정됨' });
    const result = await promise;
    expect(result.name).toBe('수정됨');
  });

  it('commits partner import batch with defaultStorageContract merged into body', async () => {
    const batch = { defaultStorageContract: { contractType: 'PALLET_DAILY' as const, palletDailyRate: '1500', startDate: '2026-07-01' } };
    const promise = service.importCommit('partners', [{ name: 'A' }], batch);
    const req = http.expectOne(r => r.method === 'POST' && r.url.includes('/master-data/import/partners/commit'));
    expect(req.request.body.defaultStorageContract.contractType).toBe('PALLET_DAILY');
    expect(req.request.body.rows).toEqual([{ name: 'A' }]);
    req.flush({ created: 1, failed: [] });
    const result = await promise;
    expect(result.created).toBe(1);
  });
});
