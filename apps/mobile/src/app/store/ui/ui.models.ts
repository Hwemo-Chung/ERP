/**
 * UI State models - Loading states, modals, toasts, errors
 */

export enum ModalType {
  ORDER_ASSIGN = 'ORDER_ASSIGN',
  ORDER_COMPLETE = 'ORDER_COMPLETE',
  ORDER_CANCEL = 'ORDER_CANCEL',
  WASTE_PICKUP = 'WASTE_PICKUP',
  SERIAL_INPUT = 'SERIAL_INPUT',
  CONFLICT_RESOLVER = 'CONFLICT_RESOLVER',
}

export interface UIState {
  // Global loading indicator
  isLoading: boolean;
  loadingMessage?: string;

  // Toast notifications
  toastMessage?: string;
  toastColor?: 'success' | 'danger' | 'warning' | 'info';
  toastDuration?: number;

  // Modal state
  activeModal?: {
    type: ModalType;
    data?: unknown;
  };

  // Error banner
  globalError?: string;
  errorDetails?: unknown;

  // App update notification
  updateAvailable?: boolean;

  // Settlement lock status
  settlementLocked?: boolean;
  settlementLockedUntil?: number;
}
