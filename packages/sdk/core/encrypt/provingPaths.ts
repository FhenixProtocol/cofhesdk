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
 * One place a proof can be made, as the two steps an encrypt reports: `Pack`, then `Prove`.
 *
 * There are two: {@link workerProvingPath} and {@link mainThreadProvingPath}. Each owns everything
 * that is specific to it, so neither contains a branch on the other. The caller picks one, and
 * falls back to the main-thread one when the worker fails.
 */
export type ProvingPath = {
  /** The `Pack` step: get the inputs ready for a proof, rejecting any that cannot be packed. */
  pack(): void;
  /** The `Prove` step. Call after `pack`. Resolves with the serialized proven ciphertext list. */
  prove(metadata: Uint8Array): Promise<Uint8Array>;
};

/** What every path proves from: the keys as stored (hex), and the values to encrypt. */
export type ProvingInputs = {
  fheKey: string;
  crs: string;
  items: EncryptableItem[];
};

/**
 * The proof is made in a Web Worker, which leaves the page responsive.
 *
 * The worker does all the heavy work itself from the hex strings: it deserializes the key and the
 * CRS, packs the items and proves. This thread only makes the checks packing would make, so a bad
 * input fails here and not inside the worker.
 */
export function workerProvingPath(inputs: ProvingInputs, zkProveWorkerFn: ZkProveWorkerFunction): ProvingPath {
  return {
    pack: () => assertZkPackable(inputs.items),
    prove: (metadata) => zkProveWithWorker(zkProveWorkerFn, inputs.fheKey, inputs.crs, inputs.items, metadata),
  };
}

/**
 * The proof is made on the calling thread: when workers are off or unavailable, and as the
 * fallback when the worker fails.
 *
 * Everything here is synchronous and heavy (the CRS alone is several megabytes), so in a browser
 * it freezes the page while it runs. That is why none of it is shared with the worker path.
 */
export function mainThreadProvingPath(
  inputs: ProvingInputs,
  deps: {
    zkBuilderAndCrsGenerator: ZkBuilderAndCrsGenerator;
    /** Runs once before proving, e.g. to start tfhe's thread pool. */
    beforeProve?: () => Promise<void>;
  }
): ProvingPath {
  let packed:
    | { zkBuilder: ReturnType<typeof zkPack>; zkCrs: ReturnType<ZkBuilderAndCrsGenerator>['zkCrs'] }
    | undefined;

  return {
    pack: () => {
      const { zkBuilder, zkCrs } = deps.zkBuilderAndCrsGenerator(inputs.fheKey, inputs.crs);
      packed = { zkBuilder: zkPack(inputs.items, zkBuilder), zkCrs };
    },
    prove: async (metadata) => {
      if (!packed) throw new Error('mainThreadProvingPath: prove() called before pack()');
      await deps.beforeProve?.();
      return zkProve(packed.zkBuilder, packed.zkCrs, metadata);
    },
  };
}
