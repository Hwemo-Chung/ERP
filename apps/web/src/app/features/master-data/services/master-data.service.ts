// apps/web/src/app/features/master-data/services/master-data.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

// ponytail: 백엔드 DTO와 수동 동기화 — packages/shared로 옮길 시점은 세 번째 소비자 등장 때
export interface PartnerRow {
  id: string; code: string; name: string;
  businessRegistrationNo?: string; representativeName?: string;
  businessType?: string; businessCategory?: string; address?: string;
  contactName?: string; phone?: string; email?: string;
  defaultTransportRate?: string;
  storageContracts?: StorageContractRow[];
}
export interface StorageContractRow {
  contractType: 'PALLET_DAILY' | 'AREA_MONTHLY' | 'AREA_YEARLY';
  palletDailyRate?: string; areaPyeong?: string; areaRate?: string;
  startDate: string; endDate?: string;
}
export interface ProductRow {
  id: string; code: string; name: string; categoryId: string; partnerId: string;
  unitPrice: string; costPrice: string; transportRate?: string;
  palletThreshold?: string; maxUnitsPerPallet?: number;
}
export interface CategoryNode {
  id: string; code: string; name: string; depth: number; children: CategoryNode[];
}
export interface RateCardRow {
  id: string; vehicleType: string; tonnage?: string;
  containerSize?: string; specialEquipment?: string; rate: string;
}
export interface ImportInvalidRow {
  rowIndex: number; errors: string[]; raw: object;
}
export interface ImportParseResult {
  validRows: object[]; invalidRows: ImportInvalidRow[]; extractedCategories: string[];
}
export interface ImportCommitResult {
  created: number; failed: { row: object; error: string }[];
}

type Paged<T> = { data: T[]; totalCount: number };

// ponytail: HttpClient's { params } serializes `undefined` values as the literal string
// "undefined" instead of omitting the key — strip them so optional query filters
// (search/page/partnerId) don't reach the backend as garbage.
function toParams(q: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(q).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)]),
  );
}

// ponytail: no manual response unwrap — the global apiResponseInterceptor
// (apps/web/src/app/core/interceptors/api-response.interceptor.ts, wired in main.ts)
// already strips the {success,data} envelope for every HttpClient call. Matches the
// established convention in auth.service.ts / settlement.service.ts: type the HTTP
// call to the shape the backend controller returns and consume it directly.
@Injectable({ providedIn: 'root' })
export class MasterDataService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/master-data`;

  getPartners(q: { search?: string; page?: number }): Promise<Paged<PartnerRow>> {
    return firstValueFrom(this.http.get<Paged<PartnerRow>>(`${this.base}/partners`, { params: toParams(q) }));
  }
  createPartner(dto: Omit<PartnerRow, 'id'> & { storageContract: StorageContractRow }): Promise<PartnerRow> {
    return firstValueFrom(this.http.post<PartnerRow>(`${this.base}/partners`, dto));
  }
  updatePartner(id: string, dto: Partial<PartnerRow>): Promise<PartnerRow> {
    return firstValueFrom(this.http.patch<PartnerRow>(`${this.base}/partners/${id}`, dto));
  }

  getProducts(q: { partnerId?: string; search?: string; page?: number }): Promise<Paged<ProductRow>> {
    return firstValueFrom(this.http.get<Paged<ProductRow>>(`${this.base}/products`, { params: toParams(q) }));
  }
  createProduct(dto: Omit<ProductRow, 'id'>): Promise<ProductRow> {
    return firstValueFrom(this.http.post<ProductRow>(`${this.base}/products`, dto));
  }
  updateProduct(id: string, dto: Partial<ProductRow>): Promise<ProductRow> {
    return firstValueFrom(this.http.patch<ProductRow>(`${this.base}/products/${id}`, dto));
  }

  getCategoryTree(): Promise<CategoryNode[]> {
    return firstValueFrom(this.http.get<CategoryNode[]>(`${this.base}/categories/tree`));
  }
  createCategory(dto: { name: string; parentId?: string }): Promise<CategoryNode> {
    return firstValueFrom(this.http.post<CategoryNode>(`${this.base}/categories`, dto));
  }
  renameCategory(id: string, name: string): Promise<CategoryNode> {
    return firstValueFrom(this.http.patch<CategoryNode>(`${this.base}/categories/${id}/rename`, { name }));
  }
  deactivateCategory(id: string): Promise<CategoryNode> {
    return firstValueFrom(this.http.patch<CategoryNode>(`${this.base}/categories/${id}/deactivate`, {}));
  }

  getRateCards(): Promise<RateCardRow[]> {
    return firstValueFrom(this.http.get<RateCardRow[]>(`${this.base}/rate-cards`));
  }
  createRateCard(dto: Omit<RateCardRow, 'id'>): Promise<RateCardRow> {
    return firstValueFrom(this.http.post<RateCardRow>(`${this.base}/rate-cards`, dto));
  }
  updateRateCard(id: string, dto: Partial<RateCardRow>): Promise<RateCardRow> {
    return firstValueFrom(this.http.patch<RateCardRow>(`${this.base}/rate-cards/${id}`, dto));
  }
  deactivateRateCard(id: string): Promise<RateCardRow> {
    return firstValueFrom(this.http.patch<RateCardRow>(`${this.base}/rate-cards/${id}/deactivate`, {}));
  }

  getPalletThreshold(): Promise<{ value: number }> {
    return firstValueFrom(this.http.get<{ value: number }>(`${this.base}/settings/pallet-threshold`));
  }
  setPalletThreshold(value: number): Promise<{ value: number }> {
    return firstValueFrom(this.http.put<{ value: number }>(`${this.base}/settings/pallet-threshold`, { value }));
  }

  importParse(kind: 'partners' | 'products', file: File, mapping: Record<string, string>): Promise<ImportParseResult> {
    const form = new FormData();
    form.append('file', file);
    form.append('mapping', JSON.stringify(mapping));
    return firstValueFrom(this.http.post<ImportParseResult>(`${this.base}/import/${kind}/parse`, form));
  }
  importCommit(
    kind: 'partners',
    rows: object[],
    batch: { defaultStorageContract: StorageContractRow },
  ): Promise<ImportCommitResult>;
  importCommit(
    kind: 'products',
    rows: object[],
    batch: { defaultPartnerId: string },
  ): Promise<ImportCommitResult>;
  importCommit(kind: 'partners' | 'products', rows: object[], batch: object): Promise<ImportCommitResult> {
    return firstValueFrom(
      this.http.post<ImportCommitResult>(`${this.base}/import/${kind}/commit`, { rows, ...batch }),
    );
  }
}
