/**
 * @fileoverview Idle Callback Utilities
 * @description Schedule non-critical tasks during browser idle time
 *
 * Uses requestIdleCallback when available, falls back to setTimeout
 * for browsers without support (Safari, older browsers).
 *
 * Complexity:
 * - Cyclomatic Complexity: 7
 * - Cognitive Complexity: 8
 */

/**
 * Schedule non-critical tasks during browser idle time
 * Falls back to setTimeout for browsers without requestIdleCallback support
 *
 * @param task - Function to execute during idle time
 * @param options - Configuration options
 * @param options.timeout - Maximum wait time in ms (default: 2000)
 * @returns Handle that can be used to cancel the task
 *
 * @example
 * ```typescript
 * const handle = scheduleIdleTask(() => {
 *   console.log('Running during idle time');
 * }, { timeout: 3000 });
 * ```
 */
export function scheduleIdleTask(task: () => void, options: { timeout?: number } = {}): number {
  const { timeout = 2000 } = options;

  if (window.requestIdleCallback) {
    return window.requestIdleCallback(task, { timeout });
  }

  // Fallback for Safari and older browsers
  return window.setTimeout(task, 100);
}

/**
 * Cancel a scheduled idle task
 *
 * @param id - Handle returned by scheduleIdleTask
 *
 * @example
 * ```typescript
 * const handle = scheduleIdleTask(task);
 * cancelIdleTask(handle);
 * ```
 */
export function cancelIdleTask(id: number): void {
  if (window.cancelIdleCallback) {
    window.cancelIdleCallback(id);
  } else {
    window.clearTimeout(id);
  }
}

/**
 * Run multiple tasks during idle periods
 *
 * @param tasks - Array of functions to execute
 * @param options - Configuration options
 * @param options.timeout - Maximum wait time per task in ms (default: 2000)
 * @param options.priority - Task priority ('low' doubles timeout, default: 'normal')
 * @returns Promise that resolves when all tasks complete
 *
 * @example
 * ```typescript
 * await runIdleTasks([
 *   () => console.log('Task 1'),
 *   () => console.log('Task 2'),
 * ], { priority: 'low' });
 * ```
 */
export async function runIdleTasks(
  tasks: Array<() => void | Promise<void>>,
  options: { timeout?: number; priority?: 'low' | 'normal' } = {},
): Promise<void> {
  const { timeout = 2000, priority = 'normal' } = options;
  const effectiveTimeout = priority === 'low' ? timeout * 2 : timeout;

  for (const task of tasks) {
    await new Promise<void>((resolve) => {
      scheduleIdleTask(
        async () => {
          await task();
          resolve();
        },
        { timeout: effectiveTimeout },
      );
    });
  }
}
