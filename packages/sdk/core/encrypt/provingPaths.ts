import type { CofheConfig } from '../config.js';
import { CofheError, CofheErrorCode } from '../error.js';
import type { FheKeyDeserializer } from '../fetchKeys.js';
import { fetchKeys } from '../fetchKeysForConfig.js';
import type { KeysStorage } from '../keyStore.js';
import type { EncryptableItem, TfheInitializer } from '../types.js';
import {
  assertZkPackable,
  zkPack,
  zkProve,
  type KeysTarget,
  type ProvingWorker,
  type ZkBuilderAndCrsGenerator,
} from './zkPackProveVerify.js';

/** Reads the keys a proving worker stored, as hex: what it holds for that chain and zone. */
export type WorkerStoredKeysReader = (
  chainId: number,
  securityZone: number
) => Promise<{ fheKey?: string; crs?: string }>;

/**
 * What the calling thread needs to make the proof by itself. Always there: it is the only path
 * in Node, and what a web client falls back to when the worker path is off or fails.
 */
export type MainThreadProving = {
  /** Loads TFHE on the calling thread. Platform-specific: web uses "tfhe", node uses "node-tfhe". */
  initTfhe?: TfheInitializer | undefined;
  tfhePublicKeyDeserializer: FheKeyDeserializer;
  compactPkeCrsDeserializer: FheKeyDeserializer;
  zkBuilderAndCrsGenerator: ZkBuilderAndCrsGenerator;
  /**
   * Runs right before the proof is generated on the calling thread. For setup that only pays off
   * when that thread does the proving (web starts tfhe's rayon thread pool here).
   */
  beforeProve?: (() => Promise<void>) | undefined;
};

/** A worker that makes the proof by itself. Used when `config.useWorkers` is on. */
export type WorkerProving = {
  instance: ProvingWorker;
  /** Reads the keys that worker stored, for when the calling thread has to prove after all. */
  readStoredKeys?: WorkerStoredKeysReader | undefined;
};

/** The two ways to make the proof: on the calling thread, and (optionally) in a worker. */
export type ProvingParams = {
  mainThread: MainThreadProving;
  worker?: WorkerProving | undefined;
};

/**
 * One place a proof can be made, as the steps an encrypt reports, in order: `InitTfhe`,
 * `FetchKeys`, `Pack`, `Prove`. (`Verify` is the same wherever the proof came from.)
 *
 * There are two: {@link workerProvingPath} and {@link mainThreadProvingPath}. Each owns everything
 * that is specific to it, so neither contains a branch on the other, and neither does any of the
 * other's work. The caller picks one, reports the steps, and switches to the main-thread one when
 * the worker fails.
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

export type ProvingStep = keyof ProvingPath;

/**
 * Runs, with nothing reported, the steps that come before `step`. For a path that takes over
 * part-way through an encrypt and has done none of the earlier steps itself.
 */
export async function catchUpTo(path: ProvingPath, step: ProvingStep): Promise<void> {
  if (step === 'initTfhe') return;
  await path.initTfhe();
  if (step === 'fetchKeys') return;
  await path.fetchKeys();
  if (step === 'pack') return;
  path.pack();
}

/**
 * The proof is made in a worker, which leaves the page responsive.
 *
 * The worker does everything heavy by itself: it runs its own TFHE, it fetches, validates and
 * stores the keys, and it packs and proves. The calling thread never starts TFHE and never
 * handles the keys. All it does is the checks packing would make, so a bad input fails here and
 * not inside the worker.
 */
export function workerProvingPath(params: {
  items: EncryptableItem[];
  /** Which keys to prove with. Read when first needed, so a missing URL fails a step, not the setup. */
  target: () => KeysTarget;
  worker: ProvingWorker;
}): ProvingPath {
  const { items, target, worker } = params;

  return {
    initTfhe: () => worker.initTfhe(),
    fetchKeys: () => worker.fetchKeys(target()),
    pack: () => assertZkPackable(items),
    prove: (metadata) => worker.prove(target(), items, metadata),
  };
}

/** The FHE key and the CRS as the calling thread stores them: hex strings. */
type KeysHex = { fheKey: string; crs: string };

/** The name and message of the innermost `cause` of an error, for a serialisable error context. */
function describeRootCause(error: unknown): { name: string; message: string } | undefined {
  let current: unknown = error;
  while (current instanceof Error && current.cause instanceof Error) current = current.cause;
  return current instanceof Error ? { name: current.name, message: current.message } : undefined;
}

/**
 * The proof is made on the calling thread: when workers are off or unavailable, and as the
 * fallback when the worker fails.
 *
 * TFHE runs here, the keys are read, validated and kept here, and packing and proving happen
 * here. All of it is synchronous and heavy (the CRS alone is several megabytes), so in a browser
 * it freezes the page while it runs. That is why none of it is shared with the worker path.
 */
export function mainThreadProvingPath(params: {
  items: EncryptableItem[];
  /** Which keys to prove with. Read when first needed, so a missing chain fails a step, not the setup. */
  keysFor: () => { config: CofheConfig; chainId: number; securityZone: number };
  /** The platform's TFHE: how to start it, validate keys with it and build a proof with it. */
  parts: MainThreadProving;
  /** Where the calling thread keeps the keys. Without one, they are downloaded for every encrypt. */
  keysStorage?: KeysStorage | undefined;
  /** Reads the keys a proving worker stored, when there is such a worker. See `adoptKeysStoredByWorker`. */
  readWorkerStoredKeys?: WorkerStoredKeysReader | undefined;
}): ProvingPath {
  const { items, keysFor, parts, keysStorage, readWorkerStoredKeys } = params;

  let keys: KeysHex | undefined;
  let packed:
    | { zkBuilder: ReturnType<typeof zkPack>; zkCrs: ReturnType<ZkBuilderAndCrsGenerator>['zkCrs'] }
    | undefined;

  /** Starts TFHE on the calling thread. Resolves false when it was already started, or there is nothing to start. */
  const initTfhe = async (): Promise<boolean> => {
    const { initTfhe } = parts;
    if (!initTfhe) return false;

    try {
      return await initTfhe();
    } catch (error) {
      throw CofheError.fromError(error, {
        code: CofheErrorCode.InitTfheFailed,
        message: `Failed to initialize TFHE`,
        context: {
          initTfhe,
        },
      });
    }
  };

  /**
   * A worker that proves by itself keeps the keys in a store of its own. When this thread has to
   * prove after all and has no keys, it takes them from there, so a fallback does not download
   * megabytes the browser already holds. They are validated like any stored key afterwards.
   */
  const adoptKeysStoredByWorker = async (chainId: number, securityZone: number): Promise<void> => {
    if (!keysStorage || !readWorkerStoredKeys) return;
    if (keysStorage.getFheKey(chainId, securityZone) && keysStorage.getCrs(chainId, securityZone)) return;

    // Best effort: without them the keys are simply downloaded.
    const stored = await readWorkerStoredKeys(chainId, securityZone).catch(() => undefined);
    if (stored?.fheKey && !keysStorage.getFheKey(chainId, securityZone)) {
      keysStorage.setFheKey(chainId, securityZone, stored.fheKey);
    }
    if (stored?.crs && !keysStorage.getCrs(chainId, securityZone)) {
      keysStorage.setCrs(chainId, securityZone, stored.crs);
    }
  };

  /**
   * The FHE key and the CRS: from the key store when it holds valid ones, else downloaded from
   * CoFHE, validated and stored.
   */
  const fetchFheKeyAndCrs = async (): Promise<
    KeysHex & { fheKeyFetchedFromCoFHE: boolean; crsFetchedFromCoFHE: boolean }
  > => {
    const { config, chainId, securityZone } = keysFor();

    try {
      await keysStorage?.rehydrateKeysStore();
    } catch (error) {
      // A storage that cannot be read no longer ends up here: the keys store gives it up and keeps
      // the keys in memory (see `guardStorage` in keyStore.ts). What still ends up here is a stored
      // value of the wrong shape, which `merge` rejects. The context names the original error, not
      // the wrappers around it, so the failure can be told apart in error tracking.
      throw CofheError.fromError(error, {
        code: CofheErrorCode.RehydrateKeysStoreFailed,
        message: `Failed to rehydrate keys store`,
        context: {
          storage: keysStorage?.storageStatus() ?? 'memory',
          storageError: describeRootCause(error),
        },
      });
    }

    await adoptKeysStoredByWorker(chainId, securityZone);

    let fheKey: string | undefined;
    let fheKeyFetchedFromCoFHE: boolean = false;
    let crs: string | undefined;
    let crsFetchedFromCoFHE: boolean = false;

    try {
      [[fheKey, fheKeyFetchedFromCoFHE], [crs, crsFetchedFromCoFHE]] = await fetchKeys(
        config,
        chainId,
        securityZone,
        parts.tfhePublicKeyDeserializer,
        parts.compactPkeCrsDeserializer,
        keysStorage
      );
    } catch (error) {
      throw CofheError.fromError(error, {
        code: CofheErrorCode.FetchKeysFailed,
        message: `Failed to fetch FHE key and CRS`,
        context: {
          config,
          chainId,
          securityZone,
          compactPkeCrsDeserializer: parts.compactPkeCrsDeserializer,
          tfhePublicKeyDeserializer: parts.tfhePublicKeyDeserializer,
        },
      });
    }

    if (!fheKey) {
      throw new CofheError({
        code: CofheErrorCode.MissingFheKey,
        message: `FHE key not found`,
        context: {
          chainId,
          securityZone,
        },
      });
    }

    if (!crs) {
      throw new CofheError({
        code: CofheErrorCode.MissingCrs,
        message: `CRS not found for chainId <${chainId}>`,
        context: {
          chainId,
        },
      });
    }

    return { fheKey, fheKeyFetchedFromCoFHE, crs, crsFetchedFromCoFHE };
  };

  return {
    initTfhe: async () => ({ tfheInitializationExecuted: await initTfhe() }),
    fetchKeys: async () => {
      const { fheKey, crs, fheKeyFetchedFromCoFHE, crsFetchedFromCoFHE } = await fetchFheKeyAndCrs();
      keys = { fheKey, crs };
      return { fheKeyFetchedFromCoFHE, crsFetchedFromCoFHE };
    },
    pack: () => {
      if (!keys) throw new Error('ProvingPath: fetchKeys() has to run before pack()');
      const { zkBuilder, zkCrs } = parts.zkBuilderAndCrsGenerator(keys.fheKey, keys.crs);
      packed = { zkBuilder: zkPack(items, zkBuilder), zkCrs };
    },
    prove: async (metadata) => {
      if (!packed) throw new Error('ProvingPath: pack() has to run before prove()');
      await parts.beforeProve?.();
      return zkProve(packed.zkBuilder, packed.zkCrs, metadata);
    },
  };
}
