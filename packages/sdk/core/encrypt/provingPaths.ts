import type { EncryptableItem } from '../types.js';
import {
  assertZkPackable,
  zkPack,
  zkProve,
  zkProveWithWorker,
  type ZkBuilderAndCrsGenerator,
  type ZkProveWorkerFunction,
} from './zkPackProveVerify.js';

/**
 * One place a proof can be made, as the steps an encrypt reports, in order: `InitTfhe`,
 * `FetchKeys`, `Pack`, `Prove`. (`Verify` is the same wherever the proof came from.)
 *
 * There are two: {@link workerProvingPath} and {@link mainThreadProvingPath}. Each owns everything
 * that is specific to it, so neither contains a branch on the other. The caller picks one, reports
 * the steps, and runs the main-thread one from the start when the worker fails.
 *
 * A path is for one encrypt: it keeps what one step produced for the next.
 */
export type ProvingPath = {
  /** The `InitTfhe` step. Resolves with whether TFHE was started now (false: it already was). */
  initTfhe(): Promise<{ tfheInitializationExecuted: boolean }>;
  /** The `FetchKeys` step. Resolves with whether each key had to be downloaded. */
  fetchKeys(): Promise<{ fheKeyFetchedFromCoFHE: boolean; crsFetchedFromCoFHE: boolean }>;
  /** The `Pack` step: get the inputs ready for a proof, rejecting any that cannot be packed. */
  pack(): void;
  /** The `Prove` step. Resolves with the serialized proven ciphertext list. */
  prove(metadata: Uint8Array): Promise<Uint8Array>;
};

/** Runs a path's steps one after the other, with nothing reported in between. */
export async function proveFromTheStart(path: ProvingPath, metadata: Uint8Array): Promise<Uint8Array> {
  await path.initTfhe();
  await path.fetchKeys();
  path.pack();
  return path.prove(metadata);
}

/** The FHE key and the CRS as they are stored: hex strings. */
type KeysHex = { fheKey: string; crs: string };

/** What a path needs from the calling thread to get TFHE and the keys ready there. */
export type CallingThreadSetup = {
  /** Starts TFHE on the calling thread. Resolves false when it was already started. */
  initTfhe: () => Promise<boolean>;
  /** Reads the keys from the key store, downloading and validating them when they are missing. */
  fetchKeys: () => Promise<KeysHex & { fheKeyFetchedFromCoFHE: boolean; crsFetchedFromCoFHE: boolean }>;
};

/**
 * The `InitTfhe` and `FetchKeys` steps done on the calling thread, which is how both paths do
 * them today: TFHE is started here and the keys are read, validated and kept here, then given to
 * whoever proves. Kept in one place so that a path that later prepares differently replaces
 * exactly these two steps.
 */
function prepareOnCallingThread(setup: CallingThreadSetup) {
  let keys: KeysHex | undefined;
  return {
    initTfhe: async () => ({ tfheInitializationExecuted: await setup.initTfhe() }),
    fetchKeys: async () => {
      const { fheKey, crs, fheKeyFetchedFromCoFHE, crsFetchedFromCoFHE } = await setup.fetchKeys();
      keys = { fheKey, crs };
      return { fheKeyFetchedFromCoFHE, crsFetchedFromCoFHE };
    },
    /** The keys `fetchKeys` produced. */
    keys: (): KeysHex => {
      if (!keys) throw new Error('ProvingPath: fetchKeys() has to run before pack() and prove()');
      return keys;
    },
  };
}

/**
 * The proof is made in a Web Worker, which leaves the page responsive.
 *
 * The worker does the heavy work itself from the hex strings: it deserializes the key and the
 * CRS, packs the items and proves. This thread only makes the checks packing would make, so a bad
 * input fails here and not inside the worker.
 */
export function workerProvingPath(params: {
  items: EncryptableItem[];
  setup: CallingThreadSetup;
  zkProveWorkerFn: ZkProveWorkerFunction;
}): ProvingPath {
  const { initTfhe, fetchKeys, keys } = prepareOnCallingThread(params.setup);

  return {
    initTfhe,
    fetchKeys,
    pack: () => assertZkPackable(params.items),
    prove: (metadata) => zkProveWithWorker(params.zkProveWorkerFn, keys().fheKey, keys().crs, params.items, metadata),
  };
}

/**
 * The proof is made on the calling thread: when workers are off or unavailable, and as the
 * fallback when the worker fails.
 *
 * Packing and proving here are synchronous and heavy (the CRS alone is several megabytes), so in
 * a browser they freeze the page while they run. That is why none of it is shared with the worker
 * path.
 */
export function mainThreadProvingPath(params: {
  items: EncryptableItem[];
  setup: CallingThreadSetup;
  zkBuilderAndCrsGenerator: ZkBuilderAndCrsGenerator;
  /** Runs once before proving, e.g. to start tfhe's thread pool. */
  beforeProve?: () => Promise<void>;
}): ProvingPath {
  const { initTfhe, fetchKeys, keys } = prepareOnCallingThread(params.setup);
  let packed:
    | { zkBuilder: ReturnType<typeof zkPack>; zkCrs: ReturnType<ZkBuilderAndCrsGenerator>['zkCrs'] }
    | undefined;

  return {
    initTfhe,
    fetchKeys,
    pack: () => {
      const { zkBuilder, zkCrs } = params.zkBuilderAndCrsGenerator(keys().fheKey, keys().crs);
      packed = { zkBuilder: zkPack(params.items, zkBuilder), zkCrs };
    },
    prove: async (metadata) => {
      if (!packed) throw new Error('ProvingPath: pack() has to run before prove()');
      await params.beforeProve?.();
      return zkProve(packed.zkBuilder, packed.zkCrs, metadata);
    },
  };
}
