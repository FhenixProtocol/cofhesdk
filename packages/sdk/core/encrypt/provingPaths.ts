import type { EncryptableItem } from '../types.js';
import {
  assertZkPackable,
  zkPack,
  zkProve,
  type KeysTarget,
  type ProvingWorker,
  type ZkBuilderAndCrsGenerator,
} from './zkPackProveVerify.js';

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
  /** Starts TFHE on the calling thread. Resolves false when it was already started. */
  initTfhe: () => Promise<boolean>;
  /** Reads the keys from the key store, downloading and validating them when they are missing. */
  fetchKeys: () => Promise<KeysHex & { fheKeyFetchedFromCoFHE: boolean; crsFetchedFromCoFHE: boolean }>;
  zkBuilderAndCrsGenerator: ZkBuilderAndCrsGenerator;
  /** Runs once before proving, e.g. to start tfhe's thread pool. */
  beforeProve?: () => Promise<void>;
}): ProvingPath {
  let keys: KeysHex | undefined;
  let packed:
    | { zkBuilder: ReturnType<typeof zkPack>; zkCrs: ReturnType<ZkBuilderAndCrsGenerator>['zkCrs'] }
    | undefined;

  return {
    initTfhe: async () => ({ tfheInitializationExecuted: await params.initTfhe() }),
    fetchKeys: async () => {
      const { fheKey, crs, fheKeyFetchedFromCoFHE, crsFetchedFromCoFHE } = await params.fetchKeys();
      keys = { fheKey, crs };
      return { fheKeyFetchedFromCoFHE, crsFetchedFromCoFHE };
    },
    pack: () => {
      if (!keys) throw new Error('ProvingPath: fetchKeys() has to run before pack()');
      const { zkBuilder, zkCrs } = params.zkBuilderAndCrsGenerator(keys.fheKey, keys.crs);
      packed = { zkBuilder: zkPack(params.items, zkBuilder), zkCrs };
    },
    prove: async (metadata) => {
      if (!packed) throw new Error('ProvingPath: pack() has to run before prove()');
      await params.beforeProve?.();
      return zkProve(packed.zkBuilder, packed.zkCrs, metadata);
    },
  };
}
