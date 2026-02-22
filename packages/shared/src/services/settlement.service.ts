import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { ENVIRONMENT_CONFIG } from '../tokens/environment.token';

export interface SettlementPeriod {
  id: string;
  branchId: string;
  periodStart: string;
  periodEnd: string;
  status: 'OPEN' | 'LOCKED';
  lockedBy?: string;
  lockedAt?: string;
  orderCount?: number;
}

export interface SettlementHistory {
  data: SettlementPeriod[];
  totalCount: number;
}

@Injectable({ providedIn: 'root' })
export class SettlementService {
  private readonly http = inject(HttpClient);
  private readonly env = inject(ENVIRONMENT_CONFIG);
  private get baseUrl(): string {
    return `${this.env.apiUrl}/settlement`;
  }

  getCurrentPeriod(): Observable<SettlementPeriod> {
    return this.http.get<SettlementPeriod>(`${this.baseUrl}/current`);
  }

  getHistory(limit = 20, cursor?: string): Observable<SettlementHistory> {
    const params: Record<string, string> = { limit: String(limit) };
    if (cursor) params['cursor'] = cursor;
    return this.http.get<SettlementHistory>(`${this.baseUrl}/history`, { params });
  }

  lockPeriod(periodId: string): Promise<SettlementPeriod> {
    return firstValueFrom(this.http.post<SettlementPeriod>(`${this.baseUrl}/${periodId}/lock`, {}));
  }

  unlockPeriod(periodId: string): Promise<SettlementPeriod> {
    return firstValueFrom(
      this.http.post<SettlementPeriod>(`${this.baseUrl}/${periodId}/unlock`, {}),
    );
  }

  getPeriodById(periodId: string): Observable<SettlementPeriod> {
    return this.http.get<SettlementPeriod>(`${this.baseUrl}/${periodId}`);
  }
}
