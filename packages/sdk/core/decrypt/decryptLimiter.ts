import { decryptAbortedError } from './submitRetry.js';

/** Runs a threshold-network call when a slot is free; see `createDecryptLimiter`. */
export type DecryptLimiter = <T>(task: () => Promise<T>, operationLabel: string, signal?: AbortSignal) => Promise<T>;

/**
 * One limiter per client: at most `max` decrypts talk to the threshold network at a time, the
 * rest wait their turn in call order. A call whose `signal` fires while it waits leaves the queue
 * and rejects with `Aborted` without ever starting. `Infinity` disables the cap.
 */
export function createDecryptLimiter(max: number): DecryptLimiter {
  let active = 0;
  const waiting: Array<() => void> = [];
  return async (task, operationLabel, signal) => {
    if (signal?.aborted) throw decryptAbortedError(operationLabel, signal);
    if (active >= max) {
      await new Promise<void>((resume, reject) => {
        const onAbort = () => {
          const index = waiting.indexOf(start);
          if (index >= 0) waiting.splice(index, 1);
          reject(decryptAbortedError(operationLabel, signal!));
        };
        const start = () => {
          signal?.removeEventListener('abort', onAbort);
          resume();
        };
        signal?.addEventListener('abort', onAbort, { once: true });
        waiting.push(start);
      });
    }
    active += 1;
    try {
      return await task();
    } finally {
      active -= 1;
      waiting.shift()?.();
    }
  };
}
