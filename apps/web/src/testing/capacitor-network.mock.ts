/**
 * Mock for @capacitor/network
 * Provides testable mock for network status in unit tests
 */

export interface ConnectionStatus {
  connected: boolean;
  connectionType: 'wifi' | 'cellular' | 'none' | 'unknown';
}

export interface NetworkStatusChangeCallback {
  (status: ConnectionStatus): void;
}

export interface PluginListenerHandle {
  remove: () => Promise<void>;
}

// Mock network state
let mockConnected = true;
let mockConnectionType: ConnectionStatus['connectionType'] = 'wifi';
const listeners: NetworkStatusChangeCallback[] = [];

// Mock Network object
export const Network = {
  getStatus: async (): Promise<ConnectionStatus> => ({
    connected: mockConnected,
    connectionType: mockConnectionType,
  }),

  addListener: (
    eventName: 'networkStatusChange',
    callback: NetworkStatusChangeCallback
  ): PluginListenerHandle => {
    listeners.push(callback);
    return {
      remove: async () => {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      },
    };
  },

  removeAllListeners: async (): Promise<void> => {
    listeners.length = 0;
  },
};

// Test helpers for controlling network state
export const __configureNetworkMock = {
  setConnected: (connected: boolean) => {
    mockConnected = connected;
  },

  setConnectionType: (type: ConnectionStatus['connectionType']) => {
    mockConnectionType = type;
  },

  simulateStatusChange: (status: Partial<ConnectionStatus>) => {
    if (status.connected !== undefined) {
      mockConnected = status.connected;
    }
    if (status.connectionType) {
      mockConnectionType = status.connectionType;
    }
    // Notify all listeners
    listeners.forEach((callback) =>
      callback({
        connected: mockConnected,
        connectionType: mockConnectionType,
      })
    );
  },

  goOnline: () => {
    mockConnected = true;
    mockConnectionType = 'wifi';
    listeners.forEach((callback) =>
      callback({ connected: true, connectionType: 'wifi' })
    );
  },

  goOffline: () => {
    mockConnected = false;
    mockConnectionType = 'none';
    listeners.forEach((callback) =>
      callback({ connected: false, connectionType: 'none' })
    );
  },

  reset: () => {
    mockConnected = true;
    mockConnectionType = 'wifi';
    listeners.length = 0;
  },

  getListenerCount: () => listeners.length,
};
