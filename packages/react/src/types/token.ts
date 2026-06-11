/**
 * Token types shared across hooks/components/utils.
 *
 * IMPORTANT: Keep this file free from hooks/providers/utils imports
 * to avoid circular dependencies.
 */

import { baseSepolia, sepolia } from '@cofhe/sdk/chains';
import {
  TOKEN_CONFIDENTIALITY_TYPES,
  TOKEN_TYPE_CONFIG as TOKEN_CONFIDENTIALITY_SUPPORT,
  isSupportedTokenConfidentialityType,
  isTokenConfidentialityType,
  isWrappedTokenConfidentialityType,
  type SupportedTokenConfidentialityType,
  type TokenConfidentialityType,
  type ConfidentialTokenSupportOperation,
} from '@/constants/tokenTypeConfig';
import type { Address } from 'viem';

export {
  TOKEN_CONFIDENTIALITY_TYPES,
  TOKEN_CONFIDENTIALITY_SUPPORT,
  isSupportedTokenConfidentialityType,
  isTokenConfidentialityType,
  isWrappedTokenConfidentialityType,
};
export type { SupportedTokenConfidentialityType, TokenConfidentialityType, ConfidentialTokenSupportOperation };

/**
 * Special address representing native ETH (used in erc20Pair for ConfidentialETH tokens)
 */
export const ETH_ADDRESS_LOWERCASE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' as const;

type ConfidentialTokenWithoutExtensions = Omit<ConfidentialToken, 'extensions'>;
export function constructNativeToken(chainId: number): ConfidentialTokenWithoutExtensions {
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

export type TokenWrapperKind = 'erc20' | 'native';
export type TokenConfidentialValueType = 'uint64' | 'uint128';

export function isTokenOperationSupported(
  type: string | undefined,
  operation: ConfidentialTokenSupportOperation
): boolean {
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

export function getTokenWrapperKind(token: Pick<ConfidentialToken, 'extensions'>): TokenWrapperKind | undefined {
  if (!isWrappedTokenConfidentialityType(token.extensions.fhenix.confidentialityType)) {
    return undefined;
  }

  return token.extensions.fhenix.erc20Pair?.address?.toLowerCase() === ETH_ADDRESS_LOWERCASE ? 'native' : 'erc20';
}

export function assertTokenOperationSupported(
  type: string | undefined,
  operation: ConfidentialTokenSupportOperation
): asserts type is SupportedTokenConfidentialityType {
  if (isTokenOperationSupported(type, operation)) return;
  throw new Error(`${operation} not supported for confidentialityType: ${type ?? 'undefined'}`);
}

export type ConfidentialToken = {
  chainId: number;
  address: `0x${string}`;
  symbol: string;
  decimals: number;
  name: string;
  logoURI?: string;
  extensions: Record<string, unknown> & {
    fhenix: {
      confidentialityType: TokenConfidentialityType;
      confidentialValueType: TokenConfidentialValueType;
      /** ERC20 pair for wrapped tokens - contains underlying token info */
      erc20Pair?: Erc20Pair;
    };
  };
};

export function buildToken(params: {
  base: ConfidentialTokenWithoutExtensions;
  confidentialityType: SupportedTokenConfidentialityType;
  confidentialValueType: TokenConfidentialValueType;
  erc20Pair?: Erc20Pair;
  extensions?: Record<string, unknown>;
}): ConfidentialToken {
  const { base, confidentialityType, confidentialValueType, erc20Pair, extensions } = params;

  return {
    ...base,
    extensions: {
      ...extensions,
      fhenix: {
        confidentialityType,
        confidentialValueType,
        ...(erc20Pair ? { erc20Pair } : {}),
      },
    },
  };
}

export function normalizeToken(token: ConfidentialToken): ConfidentialToken | undefined {
  const erc20Pair = token.extensions?.fhenix?.erc20Pair;
  const inputConfidentialityType = token.extensions?.fhenix?.confidentialityType as string | undefined;
  const confidentialityType =
    inputConfidentialityType === 'wrapped'
      ? erc20Pair?.address?.toLowerCase() === ETH_ADDRESS_LOWERCASE
        ? 'wrappedNative'
        : 'wrappedErc20'
      : inputConfidentialityType;

  if (!isSupportedTokenConfidentialityType(confidentialityType)) {
    return undefined;
  }

  return buildToken({
    base: {
      chainId: token.chainId,
      address: token.address,
      symbol: token.symbol,
      decimals: token.decimals,
      name: token.name,
      logoURI: token.logoURI,
    },
    confidentialityType,
    confidentialValueType: token.extensions?.fhenix?.confidentialValueType ?? 'uint64',
    erc20Pair,
    extensions: token.extensions,
  });
}

// // source: https://storage.googleapis.com/cofhesdk/sepolia.json
// export const WETH_SEPOLIA_TOKEN: ConfidentialToken = {
//   chainId: 11155111,
//   address: '0x87A3effB84CBE1E4caB6Ab430139eC41d156D55A',
//   name: 'Redact eETH',
//   symbol: 'eETH',
//   decimals: 18,
//   logoURI: 'https://storage.googleapis.com/cofhesdk/token-icons/eth.webp',
//   extensions: {
//     fhenix: {
//       confidentialityType: 'wrappedNative',
//       confidentialValueType: 'uint128',
//       erc20Pair: {
//         address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
//         symbol: 'ETH',
//         decimals: 18,
//         logoURI: 'https://storage.googleapis.com/cofhesdk/token-icons/eth.webp',
//       },
//     },
//   },
// };

const WETH_BASE_SEPOLIA_TOKEN: ConfidentialToken = normalizeToken({
  name: 'Sample FHE ETH',
  symbol: 'fhETH',
  address: '0x3Cdcdd0EB7311a59fDe92D44B01165B2Ca2019C4',
  chainId: 84532,
  decimals: 6,
  extensions: {
    fhenix: {
      confidentialityType: 'wrappedNative',
      confidentialValueType: 'uint64',
      erc20Pair: {
        address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        symbol: 'ETH',
        decimals: 18,
        logoURI: 'https://storage.googleapis.com/cofhesdk/token-icons/eth.webp',
      },
    },
  },
})!;
export const DEFAULT_TOKEN_BY_CHAIN_ID: Record<number, ConfidentialToken> = {
  // [sepolia.id]: WETH_SEPOLIA_TOKEN,
  // [baseSepolia.id]: WETH_BASE_SEPOLIA_TOKEN,
};
