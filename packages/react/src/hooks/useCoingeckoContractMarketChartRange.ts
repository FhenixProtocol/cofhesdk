import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { Address } from 'viem';

import { useInternalQuery } from '@/providers';
import {
  DEFAULT_COINGECKO_API_BASE_URL,
  getCoingeckoPlatformId,
  normalizeCoingeckoContractAddress,
} from '@/utils/coingecko';

export type CoingeckoMarketChartPoint = {
  /** Unix ms */
  ts: number;
  /** Price value (e.g. USD) */
  value: number;
};

export type UseCoingeckoContractMarketChartRangeInput = {
  chainId?: number;
  contractAddress?: Address;
  /** Defaults to true. */
  enabled?: boolean;
  /** Defaults to https://api.coingecko.com/api/v3 */
  apiBaseUrl?: string;
  /** Optional override when chainId isn't in our mapping. */
  platformIdOverride?: string;
  /** Defaults to 'usd'. */
  vsCurrency?: string;
  /** Defaults to 24 hours. */
  rangeMs?: number;
};

export type UseCoingeckoContractMarketChartRangeOptions = Omit<
  UseQueryOptions<CoingeckoMarketChartPoint[] | null, Error, CoingeckoMarketChartPoint[] | null>,
  'queryKey' | 'queryFn' | 'enabled'
>;

/**
 * Fetches contract market chart data from CoinGecko using:
 * /coins/{platformId}/contract/{contractAddress}/market_chart/range
 *
 * Returns `null` when CoinGecko has no data or request fails.
 */
export function useCoingeckoContractMarketChartRange(
  {
    chainId,
    contractAddress,
    enabled: enabledInput = true,
    apiBaseUrl,
    platformIdOverride,
    vsCurrency = 'usd',
    rangeMs = 24 * 3600_000,
  }: UseCoingeckoContractMarketChartRangeInput,
  queryOptions?: UseCoingeckoContractMarketChartRangeOptions
): UseQueryResult<CoingeckoMarketChartPoint[] | null, Error> {
  const platformId = platformIdOverride ?? getCoingeckoPlatformId(chainId);
  const effectiveApiBaseUrl = apiBaseUrl ?? DEFAULT_COINGECKO_API_BASE_URL;

  const enabled = !!platformId && !!contractAddress && enabledInput;

  const queryKey = [
    'coingecko-contract-market-chart-range',
    { chainId, contractAddress, apiBaseUrl: effectiveApiBaseUrl, platformId, vsCurrency, rangeMs },
  ] as const;

  return useInternalQuery({
    queryKey,
    enabled,
    queryFn: async ({ signal }) => {
      if (!platformId || !contractAddress) return null;
      if (typeof fetch !== 'function') {
        throw new Error('Global fetch is not available in this environment');
      }

      const now = Date.now();
      const from = Math.floor((now - rangeMs) / 1000);
      const to = Math.floor(now / 1000);

      const contract = normalizeCoingeckoContractAddress(contractAddress);
      const url = new URL(
        `${effectiveApiBaseUrl.replace(/\/$/, '')}/coins/${platformId}/contract/${contract}/market_chart/range`
      );
      url.searchParams.set('vs_currency', vsCurrency);
      url.searchParams.set('from', String(from));
      url.searchParams.set('to', String(to));

      try {
        const res = await fetch(url.toString(), { signal, headers: { accept: 'application/json' } });
        if (!res.ok) return null;

        const json = (await res.json()) as { prices?: Array<[number, number]> };
        const prices = json.prices ?? [];
        if (prices.length < 2) return null;

        const points: CoingeckoMarketChartPoint[] = prices
          .map(([ts, value]) => ({ ts, value }))
          .filter((p) => Number.isFinite(p.ts) && Number.isFinite(p.value));

        return points.length >= 2 ? points : null;
      } catch {
        return null;
      }
    },
    staleTime: queryOptions?.staleTime ?? 60_000,
    refetchOnWindowFocus: queryOptions?.refetchOnWindowFocus ?? false,
    ...queryOptions,
  });
}
