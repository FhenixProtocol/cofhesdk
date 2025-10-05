import { PublicClient, WalletClient } from "viem";
import { CofhesdkError, CofhesdkErrorCode } from "./error";

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
    chainId = publicClient.chain?.id ?? await publicClient.getChainId();
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

export async function getWalletClientAddress(walletClient: WalletClient) {
  let address: string | undefined;
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