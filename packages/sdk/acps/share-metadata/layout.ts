/**
 * Byte layout of a share metadata blob, version 3. Integers are big-endian; sizes in bytes.
 *
 *   blob         = version (1)
 *                | contract count (1)    | contracts (20 each)
 *                | selector count (1)    | selectors (4 each)       function selectors, and event
 *                                                                   selectors (first 4 bytes of topic0)
 *                | transaction count (1) | transactions (6 each: block 4, tx index 2)
 *                | entries, one per ctHash, in the order of acp.handles
 *
 *   stored value = 0x00 | contract (1) | selector (1) | block (4) | args                  8 bytes or more
 *   event value  = 0x01 | contract (1) | transaction (1) | log index (2) | selector (1)   6 bytes
 *   unlabelled   = 0xff                                                                   1 byte
 *
 *   args         = 0x00                                   no arguments, return word 0
 *                | 0x01                                   one argument, the share issuer, return word 0
 *                | 0xff | return word (1) | count (1) | argument, count times
 *   argument     = 0x00 | word (32)                       a literal ABI word
 *                | 0x01                                   the share issuer
 *
 * Contracts, selectors and transactions are listed once; entries refer to them by position.
 * The log index is block-wide, as RPC nodes return it.
 */

export const LAYOUT_VERSION = 0x03;

export const ENTRY_KIND = {
  stored: 0x00,
  event: 0x01,
  unlabelled: 0xff,
} as const;

/** The args byte of a stored-value entry: the two common shapes in one byte, or an explicit list. */
export const ARGS_CODE = {
  none: 0x00,
  issuer: 0x01,
  explicit: 0xff,
} as const;

export const ARG_TAG = {
  word: 0x00,
  issuer: 0x01,
} as const;

/** Field widths in bytes. */
export const WIDTH = {
  version: 1,
  /** Length of a list, and a position in it: at most 255 of each per share. */
  count: 1,
  index: 1,
  address: 20,
  selector: 4,
  /** uint32: 4.29 billion blocks. */
  block: 4,
  /** uint16: the position of a transaction within its block. */
  txIndex: 2,
  /** uint16: the block-wide position of a log (a busy block passes 255 logs). */
  logIndex: 2,
  kind: 1,
  argsCode: 1,
  returnWord: 1,
  argTag: 1,
  word: 32,
} as const;
