import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { Address } from 'viem';

import { useInternalQuery } from '@/providers';
import {
  buildCoingeckoSimplePriceUrl,
  buildCoingeckoSimpleTokenPriceUrl,
  DEFAULT_COINGECKO_API_BASE_URL,
  getCoingeckoNativeCoinId,
  getCoingeckoPlatformId,
  isNativeTokenAddress,
  parseCoingeckoSimplePriceUsd,
  parseCoingeckoSimpleTokenPriceUsd,
} from '@/utils/coingecko';

export type UseCoingeckoUsdPriceInput = {
  chainId?: number;
  tokenAddress?: Address;
  /** Defaults to true. */
  enabled?: boolean;
  /** Defaults to https://api.coingecko.com/api/v3 */
  apiBaseUrl?: string;
  /** Optional override when chainId isn't in our mapping. */
  platformIdOverride?: string;
  /** Optional override for native token lookup (ETH_ADDRESS). */
  nativeCoinIdOverride?: string;
};

export type UseCoingeckoUsdPriceOptions = Omit<
  UseQueryOptions<number | null, Error, number | null>,
  'queryKey' | 'queryFn' | 'enabled'
>;

/**
 * Fetches a token's USD price from CoinGecko.
 * - ERC20: uses /simple/token_price/{platform}
 * - Native token (ETH_ADDRESS): uses /simple/price?ids={coinId}
 *
 * Returns `null` when CoinGecko has no price for the token.
 */
export function useCoingeckoUsdPrice(
  {
    chainId,
    tokenAddress,
    enabled: enabledInput = true,
    apiBaseUrl,
    platformIdOverride,
    nativeCoinIdOverride,
  }: UseCoingeckoUsdPriceInput,
  queryOptions?: UseCoingeckoUsdPriceOptions
): UseQueryResult<number | null, Error> {
  const platformId = platformIdOverride ?? getCoingeckoPlatformId(chainId);
  const nativeCoinId = nativeCoinIdOverride ?? getCoingeckoNativeCoinId(chainId);
  const effectiveApiBaseUrl = apiBaseUrl ?? DEFAULT_COINGECKO_API_BASE_URL;

  const baseEnabled = !!tokenAddress && (isNativeTokenAddress(tokenAddress) ? !!nativeCoinId : !!platformId);
  const enabled = baseEnabled && enabledInput;

  console.debug('useCoingeckoUsdPrice', {
    chainId,
    tokenAddress,
    platformId,
    nativeCoinId,
    enabled,
  });

  const queryKey = [
    'coingecko-usd-price',
    { chainId, tokenAddress, apiBaseUrl: effectiveApiBaseUrl, platformId, nativeCoinId },
  ] as const;

  return useInternalQuery({
    queryKey,
    enabled,
    queryFn: async ({ signal }) => {
      if (!tokenAddress) throw new Error('tokenAddress is required');
      if (typeof fetch !== 'function') {
        throw new Error('Global fetch is not available in this environment');
      }

      if (isNativeTokenAddress(tokenAddress)) {
        if (!nativeCoinId) return null;
        const url = buildCoingeckoSimplePriceUrl({ apiBaseUrl: effectiveApiBaseUrl, coinId: nativeCoinId });
        const res = await fetch(url, { signal, headers: { accept: 'application/json' } });
        if (!res.ok) throw new Error(`CoinGecko request failed: ${res.status} ${res.statusText}`);
        const json = await res.json();
        return parseCoingeckoSimplePriceUsd({ responseJson: json, coinId: nativeCoinId });
      }

      if (!platformId) return null;
      const url = buildCoingeckoSimpleTokenPriceUrl({
        apiBaseUrl: effectiveApiBaseUrl,
        platformId,
        contractAddress: tokenAddress,
      });

      const res = await fetch(url, { signal, headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`CoinGecko request failed: ${res.status} ${res.statusText}`);
      const json = await res.json();
      return parseCoingeckoSimpleTokenPriceUsd({ responseJson: json, contractAddress: tokenAddress });
    },
    // Reasonable defaults; consumer can override via queryOptions.
    staleTime: queryOptions?.staleTime ?? 60_000,
    refetchOnWindowFocus: queryOptions?.refetchOnWindowFocus ?? false,
    ...queryOptions,
  });
}
