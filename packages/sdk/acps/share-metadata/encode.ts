import { concatHex, isHex, numberToHex, padHex, size, type Address, type Hex } from 'viem';
import { ARGS_CODE, ARG_TAG, ENTRY_KIND, LAYOUT_VERSION, BYTE_WIDTH } from './layout';
import type { ShareLabel, ShareLabelReadArg, StoredValueLabel } from './schema';

/** An unsigned big-endian integer in exactly that many bytes. Throws when the value does not fit. */
const uint = (value: number | bigint, width: number): Hex => numberToHex(value, { size: width });

/** The byte-string fields of the blob: the width each must have, and how an error names it. */
const BYTES_FIELD = {
  contract: { width: BYTE_WIDTH.address, name: 'a contract address' },
  selector: { width: BYTE_WIDTH.selector, name: 'a selector' },
  viewCallArgument: { width: BYTE_WIDTH.word, name: 'a view call argument' },
} as const;

/** A byte string for that field, checked to be exactly as wide as the field. */
const bytesField = (field: keyof typeof BYTES_FIELD, value: Hex): Hex => {
  const { width, name } = BYTES_FIELD[field];
  if (!isHex(value, { strict: true }) || size(value) !== width) {
    throw new Error(`share metadata: ${name} must be ${width} bytes`);
  }
  return value.toLowerCase() as Hex;
};

/**
 * A list of distinct items in order of first use. `insert` adds an item unless an equal one is
 * already listed; `positionOf` looks an item up and throws when it was never inserted.
 */
const listOf = <T>(keyOf: (item: T) => string, what: string) => {
  const items: T[] = [];
  const positions = new Map<string, number>();
  const insert = (item: T): void => {
    const key = keyOf(item);
    if (positions.has(key)) return;
    positions.set(key, items.length);
    items.push(item);
  };
  const positionOf = (item: T): number => {
    const position = positions.get(keyOf(item));
    if (position === undefined) throw new Error(`share metadata: ${what} ${keyOf(item)} was not collected`);
    return position;
  };
  return { items, insert, positionOf };
};

type Transaction = { block: bigint; txIndex: number };

const keyOfContract = (contract: Address): string => contract.toLowerCase();
const keyOfSelector = (selector: Hex): string => selector.toLowerCase();
const keyOfTransaction = ({ block, txIndex }: Transaction): string => `${block}:${txIndex}`;

const transactionOf = ({ block, txIndex }: Transaction): Transaction => ({ block, txIndex });

const encodeArg = (arg: ShareLabelReadArg): Hex => {
  if (arg.type === 'issuer') return uint(ARG_TAG.issuer, BYTE_WIDTH.argTag);
  return concatHex([uint(ARG_TAG.word, BYTE_WIDTH.argTag), bytesField('viewCallArgument', arg.value)]);
};

/** The issuer's address as a 32-byte word: the value `ARGS_CODE.issuer` and `ARG_TAG.issuer` stand for. */
const issuerWordOf = (issuer: Address | undefined): Hex | undefined =>
  issuer == null ? undefined : (padHex(issuer, { size: BYTE_WIDTH.word }).toLowerCase() as Hex);

/** A literal argument that is the issuer's address becomes "the issuer": one byte, and no address in the blob. */
const asIssuer = (arg: ShareLabelReadArg, issuerWord: Hex | undefined): ShareLabelReadArg =>
  arg.type === 'word' && issuerWord != null && arg.value.toLowerCase() === issuerWord ? { type: 'issuer' } : arg;

/**
 * The two common shapes take one byte: no arguments, or the share issuer alone, both with the
 * ctHash as the first return word. Anything else is spelled out.
 */
const encodeArgs = ({ args: given, returnWord }: StoredValueLabel, issuerWord: Hex | undefined): Hex => {
  const args = given.map((arg) => asIssuer(arg, issuerWord));
  if (returnWord === 0 && args.length === 0) return uint(ARGS_CODE.none, BYTE_WIDTH.argsCode);
  if (returnWord === 0 && args.length === 1 && args[0].type === 'issuer') {
    return uint(ARGS_CODE.issuer, BYTE_WIDTH.argsCode);
  }
  return concatHex([
    uint(ARGS_CODE.explicit, BYTE_WIDTH.argsCode),
    uint(returnWord, BYTE_WIDTH.returnWord),
    uint(args.length, BYTE_WIDTH.count),
    ...args.map(encodeArg),
  ]);
};

/**
 * Encodes the labels of a share into a version 3 blob: one label per ctHash, in the order of
 * `acp.handles`. The contracts, selectors and transactions the labels name are listed once each,
 * in order of first use; function and event selectors share one list. Throws on a value that does
 * not fit its field (more than 255 contracts, a block past uint32, ...). Given the share `issuer`, a
 * stored-value argument equal to their address is stored as "the issuer" instead of the address.
 */
export const encodeShareMetadata = (labels: readonly ShareLabel[], { issuer }: { issuer?: Address } = {}): Hex => {
  const issuerWord = issuerWordOf(issuer);

  // First pass: collect what the labels name, so each list is complete before any entry points into it.
  const contracts = listOf(keyOfContract, 'contract');
  const selectors = listOf(keyOfSelector, 'selector');
  const transactions = listOf(keyOfTransaction, 'transaction');
  for (const label of labels) {
    if (label.kind === 'unlabelled') continue;
    contracts.insert(label.contract);
    selectors.insert(label.selector);
    if (label.kind === 'event') transactions.insert(transactionOf(label));
  }

  // Second pass: one entry per label, pointing into the lists by position.
  const entries = labels.map((label): Hex => {
    switch (label.kind) {
      case 'stored':
        return concatHex([
          uint(ENTRY_KIND.stored, BYTE_WIDTH.kind),
          uint(contracts.positionOf(label.contract), BYTE_WIDTH.index),
          uint(selectors.positionOf(label.selector), BYTE_WIDTH.index),
          uint(label.block, BYTE_WIDTH.block),
          encodeArgs(label, issuerWord),
        ]);
      case 'event':
        return concatHex([
          uint(ENTRY_KIND.event, BYTE_WIDTH.kind),
          uint(contracts.positionOf(label.contract), BYTE_WIDTH.index),
          uint(transactions.positionOf(transactionOf(label)), BYTE_WIDTH.index),
          uint(label.logIndex, BYTE_WIDTH.logIndex),
          uint(selectors.positionOf(label.selector), BYTE_WIDTH.index),
        ]);
      case 'unlabelled':
        return uint(ENTRY_KIND.unlabelled, BYTE_WIDTH.kind);
    }
  });

  return concatHex([
    uint(LAYOUT_VERSION, BYTE_WIDTH.version),
    uint(contracts.items.length, BYTE_WIDTH.count),
    ...contracts.items.map((contract) => bytesField('contract', contract)),
    uint(selectors.items.length, BYTE_WIDTH.count),
    ...selectors.items.map((selector) => bytesField('selector', selector)),
    uint(transactions.items.length, BYTE_WIDTH.count),
    ...transactions.items.map((tx) =>
      concatHex([uint(tx.block, BYTE_WIDTH.block), uint(tx.txIndex, BYTE_WIDTH.txIndex)])
    ),
    ...entries,
  ]);
};
