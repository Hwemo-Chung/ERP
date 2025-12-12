/**
 * Settlement Service
 * Handles settlement period management API calls
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';

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
  private readonly baseUrl = `${environment.apiUrl}/settlement`;

  /**
   * Get current settlement period
   */
  getCurrentPeriod(): Observable<SettlementPeriod> {
    return this.http.get<SettlementPeriod>(`${this.baseUrl}/current`);
  }

  /**
   * Get settlement period history
   */
  getHistory(limit = 20, cursor?: string): Observable<SettlementHistory> {
    const params: Record<string, string> = { limit: String(limit) };
    if (cursor) params['cursor'] = cursor;
    return this.http.get<SettlementHistory>(`${this.baseUrl}/history`, { params });
  }

  /**
   * Lock a settlement period
   */
  lockPeriod(periodId: string): Promise<SettlementPeriod> {
    return firstValueFrom(
      this.http.post<SettlementPeriod>(`${this.baseUrl}/${periodId}/lock`, {})
    );
  }

  /**
   * Request unlock (HQ_ADMIN only)
   */
  unlockPeriod(periodId: string): Promise<SettlementPeriod> {
    return firstValueFrom(
      this.http.post<SettlementPeriod>(`${this.baseUrl}/${periodId}/unlock`, {})
    );
  }

  /**
   * Get period by ID
   */
  getPeriodById(periodId: string): Observable<SettlementPeriod> {
    return this.http.get<SettlementPeriod>(`${this.baseUrl}/${periodId}`);
  }
}
