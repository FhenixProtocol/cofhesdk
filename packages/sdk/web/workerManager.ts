/**
 * Manager of the proving worker: its lifecycle, and matching each request with its response.
 */

import type { KeysTarget, TfheThreadsSetting } from '@/core';
import type { WorkerCall, WorkerItem, WorkerRequest, WorkerResponse, WorkerResults } from './workerProtocol.js';

// Declare Worker type for environments where it's not available
declare const Worker: any;

const INIT_TFHE_TIMEOUT_MS = 30_000;
/** A first use downloads the CRS, several megabytes. */
const FETCH_KEYS_TIMEOUT_MS = 120_000;
const PROVE_TIMEOUT_MS = 30_000;

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

class ProvingWorkerManager {
  private worker: (typeof Worker extends new (...args: any[]) => infer W ? W : any) | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private requestCounter = 0;
  private workerReady = false;
  private initializationPromise: Promise<void> | null = null;
  /** Fails the start that is in flight, if any: set while a worker is being started. */
  private rejectInitialization: ((error: Error) => void) | null = null;

  /**
   * Initialize the worker
   */
  private async initializeWorker(): Promise<void> {
    if (this.worker && this.workerReady) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    const initialization: Promise<void> = new Promise<void>((resolve, reject) => {
      this.rejectInitialization = reject;
      try {
        // Check if Worker is supported
        if (typeof Worker === 'undefined') {
          reject(new Error('Web Workers not supported'));
          return;
        }

        // Create worker
        // Note: In production, this will try to load the worker from the same directory
        // The bundler should handle this Worker instantiation
        try {
          this.worker = new Worker(new URL('./zkProve.worker.js', import.meta.url), { type: 'module' }) as any;
        } catch (error) {
          // If Worker creation fails, reject immediately
          reject(new Error(`Failed to create worker: ${error}`));
          return;
        }

        // Set up message handler
        (this.worker as any).onmessage = (event: any) => {
          const response = event.data as WorkerResponse;

          // Handle ready signal
          if (response.type === 'ready') {
            this.workerReady = true;
            resolve();
            return;
          }

          const pending = this.pendingRequests.get(response.id);
          if (!pending) {
            console.warn('[Worker Manager] Received response for unknown request:', response.id);
            return;
          }

          clearTimeout(pending.timeoutId);
          this.pendingRequests.delete(response.id);

          if (response.type === 'success') {
            pending.resolve(response.result);
          } else if (response.type === 'error') {
            pending.reject(new Error(response.error || 'Worker error'));
          } else {
            pending.reject(new Error('Invalid response from worker'));
          }
        };

        // Set up error handler
        (this.worker as any).onerror = (error: any) => {
          console.error('[Worker Manager] Worker error event:', error);
          console.error('[Worker Manager] Error message:', error.message);
          console.error('[Worker Manager] Error filename:', error.filename);
          console.error('[Worker Manager] Error lineno:', error.lineno);

          // Reject initialization if not ready yet
          if (!this.workerReady) {
            reject(new Error(`Worker failed to initialize: ${error.message || 'Unknown error'}`));
          }

          // Reject all pending requests
          this.pendingRequests.forEach(({ reject, timeoutId }) => {
            clearTimeout(timeoutId);
            reject(new Error('Worker encountered an error'));
          });
          this.pendingRequests.clear();
        };

        // Timeout if worker doesn't signal ready within 5 seconds
        setTimeout(() => {
          if (!this.workerReady) {
            reject(new Error('Worker initialization timeout'));
          }
        }, 5000);
      } catch (error) {
        reject(error);
      }
    }).catch((error) => {
      // A failed start is not cached: drop this worker so the next request starts a fresh one
      // instead of every later proof falling back to the main thread.
      if (this.initializationPromise === initialization) this.discardWorker();
      throw error;
    });

    this.initializationPromise = initialization;
    return initialization;
  }

  private discardWorker(): void {
    (this.worker as any)?.terminate();
    this.worker = null;
    this.workerReady = false;
    this.initializationPromise = null;
  }

  /** Sends one request to the worker, starting it first if needed, and resolves with its result. */
  private async call<T extends WorkerCall['type']>(
    request: Extract<WorkerCall, { type: T }>,
    timeoutMs: number
  ): Promise<WorkerResults[T]> {
    await this.initializeWorker();

    const id = `${request.type}-${Date.now()}-${this.requestCounter++}`;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Worker request timeout (${timeoutMs / 1000}s)`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeoutId });

      (this.worker as any).postMessage({ ...request, id } as WorkerRequest);
    });
  }

  /** Starts TFHE in the worker. */
  initTfhe(tfheThreads?: TfheThreadsSetting): Promise<WorkerResults['initTfhe']> {
    return this.call({ type: 'initTfhe', tfheThreads }, INIT_TFHE_TIMEOUT_MS);
  }

  /** Makes sure the worker holds the keys for `target`; it downloads them when it has none stored. */
  fetchKeys(target: KeysTarget, tfheThreads?: TfheThreadsSetting): Promise<WorkerResults['fetchKeys']> {
    return this.call({ type: 'fetchKeys', target, tfheThreads }, FETCH_KEYS_TIMEOUT_MS);
  }

  /** Packs the items and proves them in the worker, with the keys for `target`. */
  prove(
    target: KeysTarget,
    items: WorkerItem[],
    metadata: Uint8Array,
    tfheThreads?: TfheThreadsSetting
  ): Promise<Uint8Array> {
    return this.call({ type: 'zkProve', target, items, metadata, tfheThreads }, PROVE_TIMEOUT_MS);
  }

  /**
   * Terminate the worker and clean up
   */
  terminate(): void {
    // A request that is still waiting for the worker to start is not in `pendingRequests` yet.
    // Without this it would hang until the start timeout instead of failing now.
    this.rejectInitialization?.(new Error('Worker terminated'));
    this.rejectInitialization = null;

    this.discardWorker();

    // Reject all pending requests
    this.pendingRequests.forEach(({ reject, timeoutId }) => {
      clearTimeout(timeoutId);
      reject(new Error('Worker terminated'));
    });
    this.pendingRequests.clear();
  }

  /**
   * Check if worker is available
   */
  isAvailable(): boolean {
    return typeof Worker !== 'undefined';
  }
}

// Singleton instance
let workerManager: ProvingWorkerManager | null = null;

/**
 * Get the worker manager instance
 */
export function getWorkerManager(): ProvingWorkerManager {
  if (!workerManager) {
    workerManager = new ProvingWorkerManager();
  }
  return workerManager;
}

/**
 * Terminate the worker
 */
export function terminateWorker(): void {
  if (workerManager) {
    workerManager.terminate();
    workerManager = null;
  }
}

/**
 * Check if workers are available
 */
export function areWorkersAvailable(): boolean {
  return typeof Worker !== 'undefined';
}
