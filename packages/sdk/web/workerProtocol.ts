/**
 * The messages between the page and the proving worker. Private to the SDK: only its own worker
 * speaks this, so it can change with any release.
 */
import type { KeysTarget } from '../core/encrypt/zkPackProveVerify.js';
import type { TfheThreadsSetting } from '../core/types.js';

/** The worker's own IndexedDB database, where it keeps the keys it fetched. */
export const WORKER_KEYS_DB_NAME = 'cofhesdk-proving-worker';

/** An item to encrypt, in a form that survives `postMessage` (bigints as strings). */
export type WorkerItem = { utype: string; data: any };

type WithThreads = {
  /**
   * From `config.tfheThreads`. The worker applies it the first time it starts tfhe:
   * `initThreadPool` can only run once per wasm instance, so later values have no effect.
   */
  tfheThreads?: TfheThreadsSetting;
};

export type WorkerRequest = { id: string } & WithThreads &
  (
    | { type: 'initTfhe' }
    | { type: 'fetchKeys'; target: KeysTarget }
    | { type: 'zkProve'; target: KeysTarget; items: WorkerItem[]; metadata: Uint8Array }
  );

/** A request without the id the manager assigns. */
export type WorkerCall = WorkerRequest extends infer R ? (R extends { id: string } ? Omit<R, 'id'> : never) : never;

export type WorkerResults = {
  initTfhe: { tfheInitializationExecuted: boolean };
  fetchKeys: { fheKeyFetchedFromCoFHE: boolean; crsFetchedFromCoFHE: boolean };
  zkProve: Uint8Array;
};

export type WorkerResponse =
  | { id: 'init'; type: 'ready' }
  | { id: string; type: 'success'; result: WorkerResults[keyof WorkerResults] }
  | { id: string; type: 'error'; error: string };
