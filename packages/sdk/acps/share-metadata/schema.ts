import type { Address, Hex } from 'viem';

/**
 * A label says where one ctHash of a SNAPSHOT share came from, as something the recipient can
 * check against the chain. It speaks of contracts, selectors and positions in the chain only:
 * it does not know what a token, a balance or a transfer is. A reader that recognises a selector
 * can present the value accordingly (see `describeShareMetadata`). A share carries one label per
 * ctHash, in the order of `acp.handles`, so the ctHashes themselves are never repeated.
 */

/** One argument of a stored-value read: the share issuer, or a literal 32-byte ABI word. */
export type ShareLabelReadArg = { type: 'issuer' } | { type: 'word'; value: Hex };

/** A stored value: what a view function of a contract returned at a block. */
export type StoredValueLabel = {
  kind: 'stored';
  contract: Address;
  /** 4-byte selector of the view function. */
  selector: Hex;
  /** Static ABI types only: each argument is one 32-byte word. */
  args: ShareLabelReadArg[];
  /** Which 32-byte word of the return data is the ctHash (0 for a single return value). */
  returnWord: number;
  /** Block the value was read at (on Arbitrum: the L2 block number). */
  block: bigint;
};

/** An event value: a value carried by one event (log) that a contract emitted. */
export type EventValueLabel = {
  kind: 'event';
  contract: Address;
  /** Block of the log (on Arbitrum: the L2 block number). */
  block: bigint;
  /** Index of the log's transaction within its block. */
  txIndex: number;
  /** Block-wide index of the log, as RPC nodes return it. */
  logIndex: number;
  /** First 4 bytes of the log's topic0: the event selector. */
  selector: Hex;
};

/** The issuer chose not to say where the ctHash came from. */
export type UnlabelledLabel = {
  kind: 'unlabelled';
};

export type ShareLabel = StoredValueLabel | EventValueLabel | UnlabelledLabel;
