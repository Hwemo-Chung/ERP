/**
 * Mock for @capacitor/preferences
 * This file provides a testable mock of Capacitor Preferences
 */

export interface GetResult {
  value: string | null;
}

export interface SetOptions {
  key: string;
  value: string;
}

export interface GetOptions {
  key: string;
}

export interface RemoveOptions {
  key: string;
}

// Mock storage
let mockStorage: Map<string, string> = new Map();

// Configurable mock functions - can be overridden in tests
let getMock = async (options: GetOptions): Promise<GetResult> => {
  return { value: mockStorage.get(options.key) ?? null };
};

let setMock = async (options: SetOptions): Promise<void> => {
  mockStorage.set(options.key, options.value);
};

let removeMock = async (options: RemoveOptions): Promise<void> => {
  mockStorage.delete(options.key);
};

export const Preferences = {
  get: (options: GetOptions) => getMock(options),
  set: (options: SetOptions) => setMock(options),
  remove: (options: RemoveOptions) => removeMock(options),
  clear: async () => { mockStorage.clear(); },
  keys: async () => ({ keys: Array.from(mockStorage.keys()) }),
  migrate: async () => ({ migrated: [] }),
  removeOld: async () => {},
};

// Helper functions for test configuration
export const __configureMock = {
  setGetMock: (fn: typeof getMock) => { getMock = fn; },
  setSetMock: (fn: typeof setMock) => { setMock = fn; },
  setRemoveMock: (fn: typeof removeMock) => { removeMock = fn; },
  resetStorage: () => { mockStorage.clear(); },
  resetMocks: () => {
    getMock = async (options: GetOptions) => ({ value: mockStorage.get(options.key) ?? null });
    setMock = async (options: SetOptions) => { mockStorage.set(options.key, options.value); };
    removeMock = async (options: RemoveOptions) => { mockStorage.delete(options.key); };
    mockStorage.clear();
  },
};
