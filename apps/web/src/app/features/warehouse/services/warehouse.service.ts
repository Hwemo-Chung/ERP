// apps/web/src/app/features/warehouse/services/warehouse.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

// ponytail: no manual response unwrap — the global apiResponseInterceptor
// (apps/web/src/app/core/interceptors/api-response.interceptor.ts, wired in main.ts)
// already strips the {success,data} envelope for every HttpClient call. Matches
// master-data.service.ts / auth.service.ts: type the HTTP call to the shape the
// backend controller returns and consume it directly.
export interface TransactionRow {
  id: string;
  type: 'INBOUND' | 'OUTBOUND';
  partnerId: string;
  productId: string;
  quantity: number;
  transactionDate: string;
  vehicleRateId?: string;
  product?: { code: string; name: string };
  vehicleRate?: { vehicleType: string } | null;
}

export interface CreateTransactionDto {
  type: 'INBOUND' | 'OUTBOUND';
  partnerId: string;
  productId: string;
  quantity: number;
  transactionDate: string;
  vehicleRateId?: string;
}

export interface ImportInvalidRow {
  rowIndex: number;
  errors: string[];
  raw: object;
}
export interface ImportParseResult {
  validRows: object[];
  invalidRows: ImportInvalidRow[];
}
export interface ImportCommitResult {
  created: number;
  failed: { row: object; error: string }[];
}

type Paged<T> = { data: T[]; totalCount: number };

// ponytail: same undefined-stripping helper as master-data.service.ts — HttpClient's
// { params } serializes `undefined` as the literal string "undefined" otherwise.
function toParams(q: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(q).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)]),
  );
}

@Injectable({ providedIn: 'root' })
export class WarehouseService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/warehouse/transactions`;

  createTransaction(dto: CreateTransactionDto): Promise<TransactionRow> {
    return firstValueFrom(this.http.post<TransactionRow>(this.base, dto));
  }

  getTransactions(q: {
    partnerId?: string; productId?: string; dateFrom?: string; dateTo?: string;
    page?: number; pageSize?: number;
  }): Promise<Paged<TransactionRow>> {
    return firstValueFrom(this.http.get<Paged<TransactionRow>>(this.base, { params: toParams(q) }));
  }

  importParse(file: File, mapping: Record<string, string>): Promise<ImportParseResult> {
    const form = new FormData();
    form.append('file', file);
    form.append('mapping', JSON.stringify(mapping));
    return firstValueFrom(this.http.post<ImportParseResult>(`${this.base}/import/parse`, form));
  }

  importCommit(rows: object[]): Promise<ImportCommitResult> {
    return firstValueFrom(this.http.post<ImportCommitResult>(`${this.base}/import/commit`, { rows }));
  }

  // ponytail: blob-download mirrors SettlementFeesService.downloadStatement's pattern
  // (createObjectURL -> anchor click -> revokeObjectURL). partnerId is optional here —
  // the server force-scopes it to the caller's own partnerId for PARTNER_COORDINATOR
  // regardless of what's sent (transactions.controller.ts downloadShipmentList), so a
  // partner-portal caller can omit it; HQ_ADMIN/WAREHOUSE_STAFF callers must pass one
  // (server 400s E4001 otherwise).
  downloadShipmentList(q: { partnerId?: string; dateFrom?: string; dateTo?: string }): void {
    this.http
      .get(`${this.base}/shipment-list/download`, { params: toParams(q), responseType: 'blob' })
      .subscribe((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `shipment-list-${q.partnerId ?? 'export'}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      });
  }
}
