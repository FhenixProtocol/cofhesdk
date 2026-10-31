import { type PublicClient, type WalletClient } from 'viem';
import { CofheError, CofheErrorCode } from './error.js';
import { FheTypes } from './types.js';

export const toHexString = (bytes: Uint8Array) =>
  bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');

const HEX_BODY_REGEX = /^[0-9a-fA-F]*$/;

export const fromHexString = (hexString: string): Uint8Array => {
  // Strip `0x` before padding: padding first turns `0x123` into `00x123`, which no
  // longer matches the prefix and decodes to garbage bytes.
  const body = hexString.replace(/^0x/, '');

  // `parseInt` maps a non-hex pair to NaN, which `Uint8Array` stores as 0. Without this check a
  // malformed hex string silently becomes zero bytes instead of failing.
  if (!HEX_BODY_REGEX.test(body)) {
    // The value is omitted on purpose: callers may pass private keys or sensitive payloads.
    throw new Error('Invalid hex string: contains non-hexadecimal characters');
  }

  const padded = body.length % 2 === 1 ? `0${body}` : body;
  const arr = padded.match(/.{1,2}/g);
  if (!arr) return new Uint8Array();
  return new Uint8Array(arr.map((byte) => parseInt(byte, 16)));
};

export const toBigIntOrThrow = (value: bigint | string): bigint => {
  if (typeof value === 'bigint') {
    return value;
  }

  // BigInt('') and BigInt('   ') are 0n, which would silently encrypt a missing value as zero
  if (value.trim() === '') {
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

export async function getWalletClientAccount(walletClient: WalletClient) {
  let address: `0x${string}` | undefined;
  try {
    address = walletClient.account?.address;
    if (!address) {
      address = (await walletClient.getAddresses())?.[0];
    }
  } catch (e) {
    throw new CofheError({
      code: CofheErrorCode.PublicWalletGetAddressesFailed,
      message: 'getting address from wallet client failed',
      cause: e instanceof Error ? e : undefined,
    });
  }
  if (!address) {
    throw new CofheError({
      code: CofheErrorCode.PublicWalletGetAddressesFailed,
      message: 'address from wallet client is null',
    });
  }
  return address;
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
