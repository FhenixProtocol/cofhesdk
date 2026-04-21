/**
 * Token types shared across hooks/components/utils.
 *
 * IMPORTANT: Keep this file dependency-free (no imports from hooks/providers/utils)
 * to avoid circular dependencies.
 */

import { baseSepolia, sepolia } from '@cofhe/sdk/chains';
import type { Address } from 'viem';

/**
 * Special address representing native ETH (used in erc20Pair for ConfidentialETH tokens)
 */
export const ETH_ADDRESS_LOWERCASE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' as const;

type TokenWithoutExtensions = Omit<Token, 'extensions'>;
export function constructNativeToken(chainId: number): TokenWithoutExtensions {
  return {
    chainId,
    address: ETH_ADDRESS_LOWERCASE,
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
    logoURI: 'https://storage.googleapis.com/cofhesdk/token-icons/eth.webp',
  };
}

/**
 * ERC20 pair information for wrapped confidential tokens
 */
export type Erc20Pair = {
  /** Address of the underlying ERC20 token (or ETH_ADDRESS for native ETH) */
  address: Address;
  symbol: string;
  decimals: number;
  logoURI?: string;
};

export type TokenSupportOperation =
  | 'confidentialBalance'
  | 'transfer'
  | 'publicBalance'
  | 'shield'
  | 'unshield'
  | 'claim'
  | 'claimable';

export const TOKEN_CONFIDENTIALITY_SUPPORT = {
  wrapped: {
    enabled: true,
    label: 'Wrapped confidential token',
    confidentialValueType: 'uint128',
    publicBalanceSource: 'erc20Pair',
    operations: {
      confidentialBalance: true,
      transfer: true,
      publicBalance: true,
      shield: true,
      unshield: true,
      claim: true,
      claimable: true,
    },
  },
  pure: {
    enabled: false,
    label: 'Pure confidential token',
    confidentialValueType: 'uint64',
    publicBalanceSource: null,
    operations: {
      confidentialBalance: false,
      transfer: false,
      publicBalance: false,
      shield: false,
      unshield: false,
      claim: false,
      claimable: false,
    },
  },
  dual: {
    enabled: false,
    label: 'Dual-balance confidential token',
    confidentialValueType: 'uint64',
    publicBalanceSource: 'token',
    operations: {
      confidentialBalance: false,
      transfer: false,
      publicBalance: false,
      shield: false,
      unshield: false,
      claim: false,
      claimable: false,
    },
  },
} as const;

export type TokenConfidentialityType = keyof typeof TOKEN_CONFIDENTIALITY_SUPPORT;
type EnabledTokenConfidentialityType<T extends Record<string, { enabled: boolean }>> = {
  [K in keyof T]: T[K]['enabled'] extends true ? K : never;
}[keyof T];

export type SupportedTokenConfidentialityType = EnabledTokenConfidentialityType<typeof TOKEN_CONFIDENTIALITY_SUPPORT>;

export const TOKEN_CONFIDENTIALITY_TYPES = Object.keys(TOKEN_CONFIDENTIALITY_SUPPORT) as TokenConfidentialityType[];

export function isTokenConfidentialityType(value: string | undefined): value is TokenConfidentialityType {
  return typeof value === 'string' && value in TOKEN_CONFIDENTIALITY_SUPPORT;
}

export function isSupportedTokenConfidentialityType(
  value: string | undefined
): value is SupportedTokenConfidentialityType {
  return isTokenConfidentialityType(value) && TOKEN_CONFIDENTIALITY_SUPPORT[value].enabled;
}

export function isTokenOperationSupported(type: string | undefined, operation: TokenSupportOperation): boolean {
  return isTokenConfidentialityType(type) && TOKEN_CONFIDENTIALITY_SUPPORT[type].operations[operation];
}

export function getPublicBalanceSourceType(
  type: string | undefined
): (typeof TOKEN_CONFIDENTIALITY_SUPPORT)[TokenConfidentialityType]['publicBalanceSource'] | null {
  if (!isTokenConfidentialityType(type)) return null;
  return TOKEN_CONFIDENTIALITY_SUPPORT[type].publicBalanceSource;
}

export function getTokenConfidentialityLabel(type: string | undefined): string | null {
  if (!isTokenConfidentialityType(type)) return null;
  return TOKEN_CONFIDENTIALITY_SUPPORT[type].label;
}

export function getTokenConfidentialValueType(
  type: TokenConfidentialityType
): (typeof TOKEN_CONFIDENTIALITY_SUPPORT)[TokenConfidentialityType]['confidentialValueType'] {
  return TOKEN_CONFIDENTIALITY_SUPPORT[type].confidentialValueType;
}

export function assertTokenOperationSupported(
  type: string | undefined,
  operation: TokenSupportOperation
): asserts type is SupportedTokenConfidentialityType {
  if (isTokenOperationSupported(type, operation)) return;
  throw new Error(`${operation} not supported for confidentialityType: ${type ?? 'undefined'}`);
}

export type Token = {
  chainId: number;
  address: `0x${string}`;
  symbol: string;
  decimals: number;
  name: string;
  logoURI?: string;
  extensions: Record<string, unknown> & {
    fhenix: {
      confidentialityType: TokenConfidentialityType;
      confidentialValueType: 'uint64' | 'uint128';
      /** ERC20 pair for wrapped tokens - contains underlying token info */
      erc20Pair?: Erc20Pair;
    };
  };
};

// source: https://storage.googleapis.com/cofhesdk/sepolia.json
export const WETH_SEPOLIA_TOKEN: Token = {
  chainId: 11155111,
  address: '0x87A3effB84CBE1E4caB6Ab430139eC41d156D55A',
  name: 'Redact eETH',
  symbol: 'eETH',
  decimals: 18,
  logoURI: 'https://storage.googleapis.com/cofhesdk/token-icons/eth.webp',
  extensions: {
    fhenix: {
      confidentialityType: 'wrapped',
      confidentialValueType: 'uint128',
      erc20Pair: {
        address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        symbol: 'ETH',
        decimals: 18,
        logoURI: 'https://storage.googleapis.com/cofhesdk/token-icons/eth.webp',
      },
    },
  },
};

// source: https://storage.googleapis.com/cofhesdk/base-sepolia.json
const WETH_BASE_SEPOLIA_TOKEN: Token = {
  chainId: 84532,
  address: '0xbED96aa98a49FeA71fcC55d755b915cF022a9159',
  name: 'Redact eETH',
  symbol: 'eETH',
  decimals: 18,
  logoURI: 'https://storage.googleapis.com/cofhesdk/token-icons/eth.webp',
  extensions: {
    coingeckoId: 'eeth',
    fhenix: {
      confidentialityType: 'wrapped',
      confidentialValueType: 'uint128',
      erc20Pair: {
        address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        symbol: 'ETH',
        decimals: 18,
        logoURI: 'https://storage.googleapis.com/cofhesdk/token-icons/eth.webp',
      },
    },
  },
};
export const DEFAULT_TOKEN_BY_CHAIN_ID: Record<number, Token> = {
  [sepolia.id]: WETH_SEPOLIA_TOKEN,
  [baseSepolia.id]: WETH_BASE_SEPOLIA_TOKEN,
};
