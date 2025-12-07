import * as viemChains from 'viem/chains';

// Build a lookup map of chainId -> viem chain (for block explorers, etc.)
const viemChainById = Object.values(viemChains).reduce<Record<number, (typeof viemChains)[keyof typeof viemChains]>>(
  (acc, chain) => {
    if (chain && typeof chain === 'object' && 'id' in chain) {
      acc[chain.id] = chain;
    }
    return acc;
  },
  {}
);

/**
 * Gets the block explorer URL for a given chain ID
 * @param chainId - The chain ID to look up
 * @returns The block explorer base URL, or undefined if not found
 */
export const getBlockExplorerUrl = (chainId: number): string | undefined => {
  const chain = viemChainById[chainId];
  return chain?.blockExplorers?.default?.url;
};

/**
 * Gets the block explorer transaction URL for a given chain ID and transaction hash
 * @param chainId - The chain ID
 * @param hash - The transaction hash
 * @returns The full transaction URL, or undefined if chain not found
 */
export const getBlockExplorerTxUrl = (chainId: number, hash: string): string | undefined => {
  const baseUrl = getBlockExplorerUrl(chainId);
  return baseUrl ? `${baseUrl}/tx/${hash}` : undefined;
};

/**
 * Gets the block explorer address URL for a given chain ID and address
 * @param chainId - The chain ID
 * @param address - The address
 * @returns The full address URL, or undefined if chain not found
 */
export const getBlockExplorerAddressUrl = (chainId: number, address: string): string | undefined => {
  const baseUrl = getBlockExplorerUrl(chainId);
  return baseUrl ? `${baseUrl}/address/${address}` : undefined;
};

/**
 * Gets the block explorer token URL for a given chain ID and token address
 * @param chainId - The chain ID
 * @param tokenAddress - The token contract address
 * @returns The full token URL, or undefined if chain not found
 */
export const getBlockExplorerTokenUrl = (chainId: number, tokenAddress: string): string | undefined => {
  const baseUrl = getBlockExplorerUrl(chainId);
  return baseUrl ? `${baseUrl}/token/${tokenAddress}` : undefined;
};

// FHE Types for the current CoFHE SDK
export type FheTypeValue = 'uint8' | 'uint16' | 'uint32' | 'uint64' | 'uint128' | 'bool' | 'address';

export interface FheTypeOption {
  label: string;
  value: FheTypeValue;
  maxValue: bigint | null;
  description: string;
}

export const FheTypesList: FheTypeOption[] = [
  {
    label: 'Encrypted Bool',
    value: 'bool',
    maxValue: BigInt(1), // 0 or 1
    description: 'Boolean value (true/false)',
  },
  {
    label: 'Encrypted Uint8',
    value: 'uint8',
    maxValue: BigInt(2 ** 8 - 1), // 255
    description: '8-bit unsigned integer (0 to 255)',
  },
  {
    label: 'Encrypted Uint16',
    value: 'uint16',
    maxValue: BigInt(2 ** 16 - 1), // 65,535
    description: '16-bit unsigned integer (0 to 65,535)',
  },
  {
    label: 'Encrypted Uint32',
    value: 'uint32',
    maxValue: BigInt(2 ** 32 - 1), // 4,294,967,295
    description: '32-bit unsigned integer (0 to 4,294,967,295)',
  },
  {
    label: 'Encrypted Uint64',
    value: 'uint64',
    maxValue: BigInt(2 ** 64 - 1), // 18,446,744,073,709,551,615
    description: '64-bit unsigned integer (0 to 18,446,744,073,709,551,615)',
  },
  {
    label: 'Encrypted Uint128',
    value: 'uint128',
    maxValue: BigInt(2 ** 128 - 1), // Very large number
    description: '128-bit unsigned integer',
  },
  {
    label: 'Encrypted Address',
    value: 'address',
    maxValue: null, // Address validation is different
    description: 'Ethereum address (0x...)',
  },
];

export const NOOP_CALLBACK = () => () => {};

/**
 * Truncates a hex string (address or hash) to show beginning and end with ellipsis
 * @param value - The hex string to truncate (address, hash, etc.)
 * @param start - Number of characters to show at the start (default: 6, includes 0x)
 * @param end - Number of characters to show at the end (default: 4)
 * @returns Truncated string, or original if too short
 * 
 * @example
 * truncateHash('0x1234567890abcdef1234567890abcdef12345678')
 * // Returns: '0x1234...5678'
 */
export const truncateHash = (value: string, start = 6, end = 4): string => {
  if (value.length <= start + end) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
};

/**
 * Truncates an Ethereum address (alias for truncateHash with address-friendly defaults)
 * @param address - The full Ethereum address (0x...)
 * @param start - Number of characters to show at the start (default: 6, includes 0x)
 * @param end - Number of characters to show at the end (default: 4)
 * @returns Truncated address string, or undefined if address is invalid
 * 
 * @example
 * truncateAddress('0x1234567890abcdef1234567890abcdef12345678')
 * // Returns: '0x1234...5678'
 */
export function truncateAddress(
  address: string | undefined | null,
  start: number = 6,
  end: number = 4
): string | undefined {
  if (!address) return undefined;
  return truncateHash(address, start, end);
}

/**
 * Sanitizes numeric input to only allow numbers and a single decimal point
 * @param value - The input value to sanitize
 * @returns Sanitized value with only numbers and at most one decimal point
 * 
 * @example
 * sanitizeNumericInput('123.45.67') // Returns: '123.4567'
 * sanitizeNumericInput('abc123.45') // Returns: '123.45'
 * sanitizeNumericInput('123') // Returns: '123'
 */
export function sanitizeNumericInput(value: string): string {
  // Only allow numbers and decimal point
  const cleaned = value.replace(/[^0-9.]/g, '');
  
  // Ensure only one decimal point
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    return parts[0] + '.' + parts.slice(1).join('');
  }
  
  return cleaned;
}

/**
 * Formats a timestamp as a relative time string (e.g., "2 hours ago")
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted relative time string
 */
export const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
};

