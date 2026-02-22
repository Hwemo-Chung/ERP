/**
 * UI SignalStore - Global UI state management
 * Toast notifications, modals, loading states, errors
 */

import { Injectable } from '@angular/core';
import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';

import { UIState, ModalType } from './ui.models';

const initialState: UIState = {
  isLoading: false,
};

/**
 * UI Store for global UI state
 */
@Injectable({ providedIn: 'root' })
export class UIStore extends signalStore(
  withState<UIState>(initialState),

  withMethods((store) => ({
    /**
     * Show loading indicator
     */
    showLoading(message?: string): void {
      patchState(store, {
        isLoading: true,
        loadingMessage: message,
      });
    },

    /**
     * Hide loading indicator
     */
    hideLoading(): void {
      patchState(store, {
        isLoading: false,
        loadingMessage: undefined,
      });
    },

    /**
     * Show toast notification
     */
    showToast(message: string, color: UIState['toastColor'] = 'info', duration = 2000): void {
      patchState(store, {
        toastMessage: message,
        toastColor: color,
        toastDuration: duration,
      });

      // Auto-hide after duration
      if (duration > 0) {
        setTimeout(() => this.clearToast(), duration);
      }
    },

    /**
     * Clear toast
     */
    clearToast(): void {
      patchState(store, {
        toastMessage: undefined,
        toastColor: undefined,
        toastDuration: undefined,
      });
    },

    /**
     * Show modal
     */
    openModal(type: ModalType, data?: unknown): void {
      patchState(store, {
        activeModal: { type, data },
      });
    },

    /**
     * Close modal
     */
    closeModal(): void {
      patchState(store, {
        activeModal: undefined,
      });
    },

    /**
     * Show global error
     */
    showError(message: string, details?: unknown): void {
      patchState(store, {
        globalError: message,
        errorDetails: details,
      });

      // Auto-clear after 5s
      setTimeout(() => this.clearError(), 5000);
    },

    /**
     * Clear error
     */
    clearError(): void {
      patchState(store, {
        globalError: undefined,
        errorDetails: undefined,
      });
    },

    /**
     * Notify app update available
     */
    notifyUpdateAvailable(): void {
      patchState(store, { updateAvailable: true });
    },

    /**
     * Clear update notification
     */
    clearUpdateNotification(): void {
      patchState(store, { updateAvailable: false });
    },

    /**
     * Set settlement lock status
     */
    setSettlementLocked(locked: boolean, unlocksAt?: number): void {
      patchState(store, {
        settlementLocked: locked,
        settlementLockedUntil: unlocksAt,
      });
    },
  })),
) {}
