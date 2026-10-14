import { getAddress, hexToBigInt, hexToNumber, size, sliceHex, type Hex } from 'viem';
import { APP_KEY_TAG, ARGS_CODE, ARG_TAG, ENTRY_KIND, LAYOUT_VERSION, BYTE_WIDTH } from './layout';
import type { ShareLabel, ShareLabelReadArg } from './schema.js';

/** Sequential reads over a blob. Each take throws when the blob ends before the field does. */
type Reader = {
  take: (width: number) => Hex;
  takeNumber: (width: number) => number;
  done: () => boolean;
  remaining: () => number;
};

const readerOf = (blob: Hex): Reader => {
  let offset = 0;
  const take = (width: number): Hex => {
    if (offset + width > size(blob)) throw new Error('share metadata: the blob ends in the middle of a field');
    offset += width;
    return sliceHex(blob, offset - width, offset);
  };
  return {
    take,
    takeNumber: (width) => hexToNumber(take(width)),
    done: () => offset === size(blob),
    remaining: () => size(blob) - offset,
  };
};

/** A counted list: its length in one byte, then that many items. */
const takeList = <T>(reader: Reader, takeItem: () => T): T[] =>
  Array.from({ length: reader.takeNumber(BYTE_WIDTH.count) }, takeItem);

/** The item an entry points to. Throws when the position is outside the list. */
const takeFrom = <T>(reader: Reader, list: readonly T[], what: string): T => {
  const position = reader.takeNumber(BYTE_WIDTH.index);
  if (position >= list.length) {
    throw new Error(`share metadata: ${what} ${position} is outside the ${what} list`);
  }
  return list[position];
};

const decodeArg = (reader: Reader): ShareLabelReadArg => {
  const tag = reader.takeNumber(BYTE_WIDTH.argTag);
  if (tag === ARG_TAG.issuer) return { type: 'issuer' };
  if (tag === ARG_TAG.word) return { type: 'word', value: reader.take(BYTE_WIDTH.word) };
  throw new Error(`share metadata: unknown argument tag ${tag}`);
};

const decodeArgs = (reader: Reader): { args: ShareLabelReadArg[]; returnWord: number } => {
  const code = reader.takeNumber(BYTE_WIDTH.argsCode);
  if (code === ARGS_CODE.none) return { args: [], returnWord: 0 };
  if (code === ARGS_CODE.issuer) return { args: [{ type: 'issuer' }], returnWord: 0 };
  if (code !== ARGS_CODE.explicit) throw new Error(`share metadata: unknown args code ${code}`);
  const returnWord = reader.takeNumber(BYTE_WIDTH.returnWord);
  return { args: takeList(reader, () => decodeArg(reader)), returnWord };
};

/** The optional app key that closes the blob: nothing, or the tag byte and 32 bytes. */
const takeAppKey = (reader: Reader): Hex | undefined => {
  if (reader.done()) return undefined;
  const isKey =
    reader.remaining() === BYTE_WIDTH.count + BYTE_WIDTH.word && reader.takeNumber(BYTE_WIDTH.count) === APP_KEY_TAG;
  if (!isKey) throw new Error('share metadata: the blob has more entries than the share has ctHashes');
  return reader.take(BYTE_WIDTH.word);
};

/** The two things a blob holds: one label per ctHash, and the app key when the share names an app. */
export type DecodedShareMetadata = { labels: ShareLabel[]; appKey: Hex | undefined };

/**
 * Decodes a version 3 blob: one label per ctHash, in the order of `acp.handles`, and the app key
 * when there is one. The exact inverse of `encodeShareMetadata`. Throws on another version, an
 * unknown kind, code or tag, a position outside its list, and unless the blob holds exactly one
 * entry per ctHash.
 */
export const decodeShareMetadataFull = (blob: Hex, handles: readonly Hex[]): DecodedShareMetadata => {
  const reader = readerOf(blob);
  const version = reader.takeNumber(BYTE_WIDTH.version);
  if (version !== LAYOUT_VERSION) throw new Error(`share metadata: unsupported version ${version}`);

  const contracts = takeList(reader, () => getAddress(reader.take(BYTE_WIDTH.address)));
  const selectors = takeList(reader, () => reader.take(BYTE_WIDTH.selector));
  const transactions = takeList(reader, () => ({
    block: hexToBigInt(reader.take(BYTE_WIDTH.block)),
    txIndex: reader.takeNumber(BYTE_WIDTH.txIndex),
  }));

  const labels = handles.map((): ShareLabel => {
    const kind = reader.takeNumber(BYTE_WIDTH.kind);
    switch (kind) {
      case ENTRY_KIND.stored: {
        const contract = takeFrom(reader, contracts, 'contract');
        const selector = takeFrom(reader, selectors, 'selector');
        const block = hexToBigInt(reader.take(BYTE_WIDTH.block));
        return { kind: 'stored', contract, selector, ...decodeArgs(reader), block };
      }
      case ENTRY_KIND.event: {
        const contract = takeFrom(reader, contracts, 'contract');
        const { block, txIndex } = takeFrom(reader, transactions, 'transaction');
        const logIndex = reader.takeNumber(BYTE_WIDTH.logIndex);
        const selector = takeFrom(reader, selectors, 'selector');
        return { kind: 'event', contract, block, txIndex, logIndex, selector };
      }
      case ENTRY_KIND.unlabelled:
        return { kind: 'unlabelled' };
      default:
        throw new Error(`share metadata: unknown entry kind ${kind}`);
    }
  });
  const appKey = takeAppKey(reader);
  if (!reader.done()) throw new Error('share metadata: the blob has more entries than the share has ctHashes');
  return { labels, appKey };
};

/** The labels of a blob, one per ctHash in the order of `acp.handles` (see `decodeShareMetadataFull`). */
export const decodeShareMetadata = (blob: Hex, handles: readonly Hex[]): ShareLabel[] =>
  decodeShareMetadataFull(blob, handles).labels;

/** The app key a share was posted with, or undefined: for a share without metadata, or without a key. */
export const decodeShareAppKey = (metadata: Hex | undefined, handles: readonly Hex[]): Hex | undefined =>
  metadata == null || metadata === '0x' ? undefined : decodeShareMetadataFull(metadata, handles).appKey;
