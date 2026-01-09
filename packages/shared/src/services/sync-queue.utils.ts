export enum SyncOperationStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CONFLICT = 'CONFLICT',
  FAILED = 'FAILED',
}

export interface ConflictData {
  entityType: 'order' | 'completion';
  entityId: string;
  serverVersion: number;
  localVersion: number;
  serverData: Record<string, unknown>;
  localData: Record<string, unknown>;
  timestamp: number;
}

export interface SyncOperation {
  id?: number;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  body: unknown;
  timestamp: number;
  retryCount?: number;
  status?: SyncOperationStatus;
  entityType?: 'order' | 'completion';
  entityId?: string;
  conflictData?: ConflictData;
}

export interface SyncConfig {
  maxRetries: number;
  backoffMs: number[];
  batchSize: number;
  retryIntervalMs: number;
}

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  maxRetries: 5,
  backoffMs: [1000, 5000, 15000, 60000, 300000],
  batchSize: 20,
  retryIntervalMs: 30000,
};

export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function buildFullUrl(baseUrl: string, path: string): string {
  return path.startsWith('http') ? path : `${baseUrl}${path}`;
}

export function createConflictData(
  httpError: { error?: { currentState?: Record<string, unknown>; currentVersion?: number } },
  operation: SyncOperation,
): ConflictData {
  const serverData = httpError.error?.currentState || {};
  return {
    entityType: operation.entityType || 'order',
    entityId: operation.entityId || '',
    serverVersion: httpError.error?.currentVersion || 0,
    localVersion: ((operation.body as Record<string, unknown>)?.['version'] as number) || 0,
    serverData,
    localData: operation.body as Record<string, unknown>,
    timestamp: Date.now(),
  };
}

export function shouldRetry(retryCount: number, maxRetries: number): boolean {
  return retryCount < maxRetries;
}

export function getBackoffDelay(retryCount: number, backoffMs: number[]): number {
  return backoffMs[Math.min(retryCount, backoffMs.length - 1)];
}
