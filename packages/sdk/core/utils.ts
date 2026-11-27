import { type Account, type Chain, type PublicClient, type Transport, type WalletClient } from 'viem';
import { CofheError, CofheErrorCode } from './error.js';
import { FheTypes } from './types.js';

export const toHexString = (bytes: Uint8Array) =>
  bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');

// Char code -> hex digit value, 255 for anything that is not a hex digit.
const HEX_DIGIT = new Uint8Array(128).fill(255);
for (let digit = 0; digit < 16; digit++) {
  HEX_DIGIT[digit.toString(16).charCodeAt(0)] = digit;
  HEX_DIGIT[digit.toString(16).toUpperCase().charCodeAt(0)] = digit;
}

const hexDigitOrThrow = (hexString: string, index: number): number => {
  const code = hexString.charCodeAt(index);
  const digit = code < 128 ? HEX_DIGIT[code] : 255;
  // Decoding a non-hex pair to 0 would silently turn a malformed string into zero bytes.
  // The value is omitted on purpose: callers may pass private keys or sensitive payloads.
  if (digit === 255) throw new Error('Invalid hex string: contains non-hexadecimal characters');
  return digit;
};

/**
 * Decodes a hex string, with or without a `0x` prefix, into bytes. An odd number of digits is
 * read as if it had a leading zero.
 *
 * One pass straight into the result: the FHE key and the CRS are megabytes of hex, where
 * building an intermediate array of digit pairs costs far more than the decoding itself.
 */
export const fromHexString = (hexString: string): Uint8Array => {
  const start = hexString.startsWith('0x') ? 2 : 0;
  const digits = hexString.length - start;
  const bytes = new Uint8Array((digits + 1) >> 1);

  let index = start;
  let byte = 0;
  // An odd length means the first byte has only its low digit.
  if (digits % 2 === 1) bytes[byte++] = hexDigitOrThrow(hexString, index++);
  for (; index < hexString.length; index += 2) {
    bytes[byte++] = (hexDigitOrThrow(hexString, index) << 4) | hexDigitOrThrow(hexString, index + 1);
  }
  return bytes;
};

export const toBigIntOrThrow = (value: bigint | string): bigint => {
  if (typeof value === 'bigint') {
    return value;
  }

  // BigInt('') and BigInt('   ') are 0n, which would silently encrypt a missing value as zero
  if (typeof value === 'string' && value.trim() === '') {
    throw new Error('Invalid input: Unable to convert to bigint');
  }

  try {
    return BigInt(value);
  } catch (error) {
    throw new Error('Invalid input: Unable to convert to bigint');
  }
};

export const validateBigIntInRange = (value: bigint, max: bigint, min: bigint = 0n): void => {
  if (typeof value !== 'bigint') {
    throw new Error('Value must be of type bigint');
  }

  if (value > max || value < min) {
    throw new Error(`Value out of range: ${max} - ${min}, try a different uint type`);
  }
};

// Helper function to convert hex string to bytes
export const hexToBytes = (hex: string): Uint8Array => fromHexString(hex);

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getPublicClientChainID(publicClient: PublicClient) {
  let chainId: number | null = null;
  try {
    chainId = publicClient.chain?.id ?? (await publicClient.getChainId());
  } catch (e) {
    throw new CofheError({
      code: CofheErrorCode.PublicWalletGetChainIdFailed,
      message: 'getting chain ID from public client failed',
      cause: e instanceof Error ? e : undefined,
    });
  }
  if (chainId === null) {
    throw new CofheError({
      code: CofheErrorCode.PublicWalletGetChainIdFailed,
      message: 'chain ID from public client is null',
    });
  }
  return chainId;
}

/** A viem wallet client with its `account` set, the only kind `connect` accepts. */
export type WalletClientWithAccount = WalletClient<Transport, Chain | undefined, Account>;

export const hasAccount = (walletClient: WalletClient): walletClient is WalletClientWithAccount =>
  walletClient.account != null;

/**
 * Returns the wallet client narrowed to one with an `account`, or throws `WalletClientAccountMissing`.
 * The SDK signs ACPs and sends transactions as that account, so a client without one cannot be used.
 */
export function requireWalletClientAccount(walletClient: WalletClient): WalletClientWithAccount {
  if (!hasAccount(walletClient)) {
    throw new CofheError({
      code: CofheErrorCode.WalletClientAccountMissing,
      message: 'wallet client has no account',
      hint: 'Create the wallet client with `account` set, e.g. createWalletClient({ account, chain, transport }).',
    });
  }
  return walletClient;
}

/**
 * Converts FheTypes enum to string representation for serialization
 * Used when passing data to Web Workers or other serialization contexts
 */
export function fheTypeToString(utype: FheTypes): string {
  switch (utype) {
    case FheTypes.Bool:
      return 'bool';
    case FheTypes.Uint4:
      return 'uint4';
    case FheTypes.Uint8:
      return 'uint8';
    case FheTypes.Uint16:
      return 'uint16';
    case FheTypes.Uint32:
      return 'uint32';
    case FheTypes.Uint64:
      return 'uint64';
    case FheTypes.Uint128:
      return 'uint128';
    case FheTypes.Uint160:
      return 'uint160';
    case FheTypes.Uint256:
      return 'uint256';
    case FheTypes.Uint512:
      return 'uint512';
    case FheTypes.Uint1024:
      return 'uint1024';
    case FheTypes.Uint2048:
      return 'uint2048';
    case FheTypes.Uint2:
      return 'uint2';
    case FheTypes.Uint6:
      return 'uint6';
    case FheTypes.Uint10:
      return 'uint10';
    default:
      throw new Error(`Unknown FheType: ${utype}`);
  }
}
