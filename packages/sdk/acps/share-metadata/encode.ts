import { concatHex, isHex, numberToHex, size, type Address, type Hex } from 'viem';
import { ARGS_CODE, ARG_TAG, ENTRY_KIND, LAYOUT_VERSION, WIDTH } from './layout.js';
import type { ShareLabel, ShareLabelReadArg, StoredValueLabel } from './schema.js';

/** An unsigned big-endian integer in exactly that many bytes. Throws when the value does not fit. */
const uint = (value: number | bigint, width: number): Hex => numberToHex(value, { size: width });

/** A byte string that must already be exactly that many bytes. */
const bytes = (value: Hex, width: number, what: string): Hex => {
  if (!isHex(value, { strict: true }) || size(value) !== width) {
    throw new Error(`share metadata: ${what} must be ${width} bytes`);
  }
  return value.toLowerCase() as Hex;
};

/**
 * A list of distinct items in order of first use. `positionOf` adds an item the first time it is
 * asked for and returns its position from then on.
 */
const listOf = <T>(keyOf: (item: T) => string) => {
  const items: T[] = [];
  const positions = new Map<string, number>();
  const positionOf = (item: T): number => {
    const key = keyOf(item);
    const known = positions.get(key);
    if (known !== undefined) return known;
    positions.set(key, items.length);
    items.push(item);
    return items.length - 1;
  };
  return { items, positionOf };
};

const encodeArg = (arg: ShareLabelReadArg): Hex => {
  if (arg.type === 'issuer') return uint(ARG_TAG.issuer, WIDTH.argTag);
  return concatHex([uint(ARG_TAG.word, WIDTH.argTag), bytes(arg.value, WIDTH.word, 'a read argument')]);
};

/**
 * The two common shapes take one byte: no arguments, or the share issuer alone, both with the
 * ctHash as the first return word. Anything else is spelled out.
 */
const encodeArgs = ({ args, returnWord }: StoredValueLabel): Hex => {
  if (returnWord === 0 && args.length === 0) return uint(ARGS_CODE.none, WIDTH.argsCode);
  if (returnWord === 0 && args.length === 1 && args[0].type === 'issuer') {
    return uint(ARGS_CODE.issuer, WIDTH.argsCode);
  }
  return concatHex([
    uint(ARGS_CODE.explicit, WIDTH.argsCode),
    uint(returnWord, WIDTH.returnWord),
    uint(args.length, WIDTH.count),
    ...args.map(encodeArg),
  ]);
};

/**
 * Encodes the labels of a share into a version 3 blob: one label per ctHash, in the order of
 * `acp.handles`. The contracts, selectors and transactions the labels name are listed once each,
 * in order of first use; function and event selectors share one list. Throws on a value that does
 * not fit its field (more than 255 contracts, a block past uint32, ...).
 */
export const encodeShareMetadata = (labels: readonly ShareLabel[]): Hex => {
  const contracts = listOf<Address>((contract) => contract.toLowerCase());
  const selectors = listOf<Hex>((selector) => selector.toLowerCase());
  const transactions = listOf<{ block: bigint; txIndex: number }>((tx) => `${tx.block}:${tx.txIndex}`);
  const position = (index: number): Hex => uint(index, WIDTH.index);

  const entries = labels.map((label): Hex => {
    switch (label.kind) {
      case 'stored':
        return concatHex([
          uint(ENTRY_KIND.stored, WIDTH.kind),
          position(contracts.positionOf(label.contract)),
          position(selectors.positionOf(label.selector)),
          uint(label.block, WIDTH.block),
          encodeArgs(label),
        ]);
      case 'event':
        return concatHex([
          uint(ENTRY_KIND.event, WIDTH.kind),
          position(contracts.positionOf(label.contract)),
          position(transactions.positionOf({ block: label.block, txIndex: label.txIndex })),
          uint(label.logIndex, WIDTH.logIndex),
          position(selectors.positionOf(label.selector)),
        ]);
      case 'unlabelled':
        return uint(ENTRY_KIND.unlabelled, WIDTH.kind);
    }
  });

  return concatHex([
    uint(LAYOUT_VERSION, WIDTH.version),
    uint(contracts.items.length, WIDTH.count),
    ...contracts.items.map((contract) => bytes(contract, WIDTH.address, 'a contract address')),
    uint(selectors.items.length, WIDTH.count),
    ...selectors.items.map((selector) => bytes(selector, WIDTH.selector, 'a selector')),
    uint(transactions.items.length, WIDTH.count),
    ...transactions.items.map((tx) => concatHex([uint(tx.block, WIDTH.block), uint(tx.txIndex, WIDTH.txIndex)])),
    ...entries,
  ]);
};
