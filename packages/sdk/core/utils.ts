import { type PublicClient, type WalletClient } from 'viem';
import { CofhesdkError, CofhesdkErrorCode } from './error.js';
import { FheTypes } from './types.js';

export const toHexString = (bytes: Uint8Array) =>
  bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');

export const fromHexString = (hexString: string): Uint8Array => {
  const cleanString = hexString.length % 2 === 1 ? `0${hexString}` : hexString;
  const arr = cleanString.replace(/^0x/, '').match(/.{1,2}/g);
  if (!arr) return new Uint8Array();
  return new Uint8Array(arr.map((byte) => parseInt(byte, 16)));
};

export const toBigIntOrThrow = (value: bigint | string): bigint => {
  if (typeof value === 'bigint') {
    return value;
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
export const hexToBytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
};

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getPublicClientChainID(publicClient: PublicClient) {
  let chainId: number | null = null;
  try {
    chainId = publicClient.chain?.id ?? (await publicClient.getChainId());
  } catch (e) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.PublicWalletGetChainIdFailed,
      message: 'getting chain ID from public client failed',
      cause: e instanceof Error ? e : undefined,
    });
  }
  if (chainId === null) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.PublicWalletGetChainIdFailed,
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
    throw new CofhesdkError({
      code: CofhesdkErrorCode.PublicWalletGetAddressesFailed,
      message: 'getting address from wallet client failed',
      cause: e instanceof Error ? e : undefined,
    });
  }
  if (!address) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.PublicWalletGetAddressesFailed,
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
