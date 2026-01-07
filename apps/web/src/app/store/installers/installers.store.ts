/**
 * NgRx SignalStore for Installers
 * Manages metadata: installer list with caching
 */

import {
  Injectable,
  computed,
  inject,
} from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { firstValueFrom } from 'rxjs';

import { Installer, InstallersState } from './installers.models';
import { db } from '@app/core/db/database';
import { getErrorMessage } from '../../core/utils/error.util';

const initialState: InstallersState = {
  installers: [],
  selectedInstallerIds: [],
  filters: {},
  isLoading: false,
  error: null,
  lastSyncTime: undefined,
};

/**
 * Installers SignalStore - metadata cache with 1-day TTL
 */
@Injectable({ providedIn: 'root' })
export class InstallersStore extends signalStore(
  withState<InstallersState>(initialState),

  withComputed(({ installers, filters }) => ({
    // Filtered installers by branch & status
    filteredInstallers: computed(() => {
      let filtered = installers();

      const f = filters();
      if (f.branchCode) {
        filtered = filtered.filter((i) => i.branchCode === f.branchCode);
      }
      if (f.status?.length) {
        filtered = filtered.filter((i) => f.status!.includes(i.status));
      }

      return filtered;
    }),

    // Active installers only
    activeInstallers: computed(() =>
      installers().filter((i) => i.status === 'ACTIVE')
    ),
  })),

  withMethods((store, http = inject(HttpClient)) => ({
    /**
     * Load installers from API or cache
     * Cache expires after 1 day (per SDD 10.2 - metadata caching)
     */
    async loadInstallers(branchCode?: string, forceRefresh = false): Promise<void> {
      // Check cache first
      if (!forceRefresh) {
        const cached = await db.metadata.get('installers');
        if (cached && Date.now() - cached.updatedAt < 24 * 60 * 60 * 1000) {
          patchState(store, { installers: cached.data as Installer[] });
          return;
        }
      }

      patchState(store, { isLoading: true, error: null });

      try {
        const params = branchCode ? `?branchCode=${branchCode}` : '';
        const response = await firstValueFrom(
          http.get<Installer[]>(`${environment.apiUrl}/metadata/installers${params}`)
        );

        // Cache for 1 day
        await db.metadata.put({
          key: 'installers',
          data: response,
          updatedAt: Date.now(),
        });

        patchState(store, {
          installers: response,
          isLoading: false,
          lastSyncTime: Date.now(),
        });
      } catch (error: unknown) {
        const errorMessage = getErrorMessage(error) || 'Failed to load installers';
        patchState(store, {
          error: errorMessage,
          isLoading: false,
        });

        // Fall back to cache if it exists
        const cached = await db.metadata.get('installers');
        if (cached?.data) {
          patchState(store, { installers: cached.data as Installer[] });
        }
      }
    },

    /**
     * Set filters
     */
    setFilters(filters: InstallersState['filters']): void {
      patchState(store, { filters });
    },

    /**
     * Clear filters
     */
    clearFilters(): void {
      patchState(store, { filters: {} });
    },

    /**
     * Get installer by ID
     */
    getInstaller(id: string): Installer | undefined {
      return store.installers().find((i) => i.id === id);
    },

    /**
     * Get active installers for a branch
     */
    getActiveByBranch(branchCode: string): Installer[] {
      return store
        .installers()
        .filter((i) => i.branchCode === branchCode && i.status === 'ACTIVE');
    },
  }))
) {}
