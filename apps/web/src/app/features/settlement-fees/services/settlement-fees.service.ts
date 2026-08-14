// apps/web/src/app/features/settlement-fees/services/settlement-fees.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

// ponytail: no manual response unwrap — the global apiResponseInterceptor
// (apps/web/src/app/core/interceptors/api-response.interceptor.ts, wired in main.ts)
// already strips the {success,data} envelope for every HttpClient call. Matches
// master-data.service.ts / warehouse.service.ts: type the HTTP call to the shape
// the backend controller returns and consume it directly.

export interface CalcError {
  transactionId?: string;
  code: string;
  message: string;
}

export interface PartnerPreviewResult {
  partnerId: string;
  transportTotal: string;
  storageTotal: string;
  errors: CalcError[];
}

export interface PreviewResponse {
  partners: PartnerPreviewResult[];
}

export interface CloseResponse {
  yearMonth: string;
  partners: PartnerPreviewResult[];
}

// ponytail: mirrors apps/api/src/settlement-fees/transport-fee.ts / storage-fee.ts
// detail shapes — duplicated here (not moved to packages/shared) per the two-consumer
// convention already established in master-data.service.ts.
export interface TransportFeeDetail {
  rateSource: 'VEHICLE' | 'PRODUCT' | 'PARTNER_DEFAULT';
  appliedRate: string;
  vehicleRateMode: 'REPLACE' | 'ADD';
  baseRate?: string;
  vehicleRate?: string;
  formula: string;
}
export interface PalletDailyDetail {
  contractType: 'PALLET_DAILY';
  palletDailyRate: string;
  totalPalletDays: number;
  perProduct: Record<string, { palletDays: number; threshold: number }>;
  skippedProducts: string[];
  negativeStockProducts: string[];
  formula: string;
}
export interface AreaFeeDetail {
  contractType: 'AREA_MONTHLY' | 'AREA_YEARLY';
  areaPyeong: string;
  areaRate: string;
  period: string;
  areaBillingMode: 'FULL_MONTH' | 'DAILY_PRORATED';
  coveredDays?: number;
  daysInMonth?: number;
  formula: string;
}

export interface SettlementRecordRow {
  id: string;
  transactionId: string | null;
  partnerId: string;
  periodYearMonth: string;
  feeType: 'TRANSPORT' | 'STORAGE';
  amount: string;
  calculationDetail: TransportFeeDetail | PalletDailyDetail | AreaFeeDetail;
  transaction?: {
    id: string;
    quantity: number;
    transactionDate: string;
    product?: { code: string; name: string };
  };
}

export interface StatementResponse {
  partnerId: string;
  yearMonth: string;
  transport: { count: number; total: string; records: SettlementRecordRow[] };
  storage: { total: string; records: SettlementRecordRow[] };
  grandTotal: string;
}
export interface SettlementInvoiceRow {
  id: string;
  invoiceNo: string;
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED';
  subtotalAmount: string;
  vatAmount: string;
  totalAmount: string;
}

@Injectable({ providedIn: 'root' })
export class SettlementFeesService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/settlement-fees`;

  preview(yearMonth: string): Promise<PreviewResponse> {
    return firstValueFrom(this.http.post<PreviewResponse>(`${this.base}/preview`, { yearMonth }));
  }

  close(yearMonth: string): Promise<CloseResponse> {
    return firstValueFrom(this.http.post<CloseResponse>(`${this.base}/close`, { yearMonth }));
  }

  getBreakdown(transactionId: string): Promise<SettlementRecordRow | null> {
    return firstValueFrom(
      this.http.get<SettlementRecordRow | null>(`${this.base}/breakdown/${transactionId}`),
    );
  }

  getStatement(partnerId: string, yearMonth: string): Promise<StatementResponse> {
    return firstValueFrom(
      this.http.get<StatementResponse>(`${this.base}/statement`, {
        params: { partnerId, yearMonth },
      }),
    );
  }

  getInvoice(partnerId: string, yearMonth: string): Promise<SettlementInvoiceRow | null> {
    return firstValueFrom(
      this.http.get<SettlementInvoiceRow | null>(`${this.base}/invoice`, {
        params: { partnerId, yearMonth },
      }),
    );
  }

  changeInvoiceStatus(
    id: string,
    status: 'ISSUED' | 'PAID' | 'CANCELLED',
    cancelReason?: string,
  ): Promise<SettlementInvoiceRow> {
    return firstValueFrom(
      this.http.post<SettlementInvoiceRow>(`${this.base}/invoice/${id}/status`, {
        status,
        ...(cancelReason ? { cancelReason } : {}),
      }),
    );
  }

  downloadInvoice(id: string): void {
    this.http.get(`${this.base}/invoice/${id}/pdf`, { responseType: 'blob' }).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `settlement-invoice-${id}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    });
  }

  downloadStatement(partnerId: string, yearMonth: string): void {
    this.http
      .get(`${this.base}/statement/download`, {
        params: { partnerId, yearMonth },
        responseType: 'blob',
      })
      .subscribe((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `statement-${partnerId}-${yearMonth}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      });
  }
}
