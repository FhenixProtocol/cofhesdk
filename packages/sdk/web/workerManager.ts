/**
 * Worker Manager for ZK Proof Generation
 * Manages worker lifecycle and request/response handling
 */

import type { ZkProveWorkerRequest, ZkProveWorkerResponse } from '@/core';

// Declare Worker type for environments where it's not available
declare const Worker: any;

interface PendingRequest {
  resolve: (value: Uint8Array) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

class ZkProveWorkerManager {
  private worker: (typeof Worker extends new (...args: any[]) => infer W ? W : any) | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private requestCounter = 0;
  private workerReady = false;
  private initializationPromise: Promise<void> | null = null;

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

    this.initializationPromise = new Promise((resolve, reject) => {
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
          this.worker = new Worker(
            new URL('./zkProve.worker.js', import.meta.url),
            { type: 'module' }
          ) as any;
        } catch (error) {
          // If Worker creation fails, reject immediately
          reject(new Error(`Failed to create worker: ${error}`));
          return;
        }

        // Set up message handler
        (this.worker as any).onmessage = (event: any) => {
          const { id, type, result, error } = event.data as ZkProveWorkerResponse;

          // Handle ready signal
          if (type === 'ready') {
            this.workerReady = true;
            resolve();
            return;
          }

          // Handle proof responses
          const pending = this.pendingRequests.get(id);
          if (!pending) {
            console.warn('[Worker Manager] Received response for unknown request:', id);
            return;
          }

          // Clear timeout
          clearTimeout(pending.timeoutId);
          this.pendingRequests.delete(id);

          if (type === 'success' && result) {
            pending.resolve(new Uint8Array(result));
          } else if (type === 'error') {
            pending.reject(new Error(error || 'Worker error'));
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
    });

    return this.initializationPromise;
  }

  /**
   * Submit a proof generation request to the worker
   */
  async submitProof(
    fheKeyHex: string,
    crsHex: string,
    items: Array<{ utype: string; data: any }>,
    metadata: Uint8Array
  ): Promise<Uint8Array> {
    // Initialize worker if needed
    await this.initializeWorker();

    // Generate unique request ID
    const id = `zkprove-${Date.now()}-${this.requestCounter++}`;

    return new Promise((resolve, reject) => {
      // Set up timeout (30 seconds)
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Worker request timeout (30s)'));
      }, 30000);

      // Store pending request
      this.pendingRequests.set(id, { resolve, reject, timeoutId });

      // Send message to worker
      const message: ZkProveWorkerRequest = {
        id,
        type: 'zkProve',
        fheKeyHex,
        crsHex,
        items,
        metadata: Array.from(metadata),
      };

      (this.worker as any).postMessage(message);
    });
  }

  /**
   * Terminate the worker and clean up
   */
  terminate(): void {
    if (this.worker) {
      (this.worker as any).terminate();
      this.worker = null;
      this.workerReady = false;
      this.initializationPromise = null;
    }

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
let workerManager: ZkProveWorkerManager | null = null;

/**
 * Get the worker manager instance
 */
export function getWorkerManager(): ZkProveWorkerManager {
  if (!workerManager) {
    workerManager = new ZkProveWorkerManager();
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

