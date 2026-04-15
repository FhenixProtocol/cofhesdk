import { useMemo } from 'react';
import type { Address } from 'viem';

import type { Token } from '@/types/token';
import { useInternalQueries } from '../providers';
import { useCofheAccount, useCofheChainId, useCofhePublicClient } from './useCofheConnection';
import { useCofheTokens } from './useCofheTokenLists';
import { formatTokenAmount, type TokenFormatOutput } from '@/utils/format';
import {
  createPublicTokenBalanceQueryOptions,
  getPublicTokenBalanceSource,
  type PublicTokenBalanceSource,
  type UseTokenBalanceOptions,
} from './useCofheTokenPublicBalance';

export type UseTokensWithPublicBalancesInput = {
  chainId?: number;
  accountAddress?: Address;
  displayDecimals?: number;
};

export type UseTokensWithPublicBalancesResult = {
  tokens: Token[];
  tokensWithPublicBalances: Token[];
  publicBalanceByTokenAddress: Record<string, TokenFormatOutput>;

  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;

  refetch: () => Promise<unknown>;
};

/**
 * Returns CoFHE tokens which have a non-zero public balance.
 *
 * Public balance source:
 * - `wrapped`: underlying `erc20Pair` (or native ETH)
 * - `pure`: skipped (no public balance)
 */
export function useTokensWithPublicBalances(
  { chainId: _chainId, accountAddress, displayDecimals = 5 }: UseTokensWithPublicBalancesInput = {},
  options?: { enabled?: boolean } & Omit<UseTokenBalanceOptions, 'select'>
): UseTokensWithPublicBalancesResult {
  const connectedAccount = useCofheAccount();
  const account = accountAddress ?? connectedAccount;

  const currentChainId = useCofheChainId();
  const chainIdForTokens = _chainId ?? currentChainId;

  const publicClient = useCofhePublicClient();

  const tokens = useCofheTokens(chainIdForTokens);

  const sources = useMemo((): Array<{ source: PublicTokenBalanceSource; tokens: Token[] }> => {
    // Multiple CoFHE tokens can share the same public-balance source (e.g. multiple wrapped tokens
    // pointing at the same underlying ERC20). rq warns if we pass duplicate queryKeys
    // within a single `useQueries` call, so we group by source address and fan out results.
    const bySourceAddress = new Map<string, { source: PublicTokenBalanceSource; tokens: Token[] }>();

    for (const token of tokens) {
      const source = getPublicTokenBalanceSource(token);
      if (!source) continue;

      const key = source.address.toLowerCase();
      const existing = bySourceAddress.get(key);
      if (existing) {
        existing.tokens.push(token);
      } else {
        bySourceAddress.set(key, { source, tokens: [token] });
      }
    }

    return Array.from(bySourceAddress.values());
  }, [tokens]);

  const { enabled: userEnabled = true, ...restOptions } = options ?? {};
  const enabled = userEnabled && !!publicClient && !!account && sources.length > 0;

  const combined = useInternalQueries({
    queries: sources.map(({ source }) =>
      createPublicTokenBalanceQueryOptions({
        publicClient,
        accountAddress: account,
        tokenAddress: source.address,
        queryOptions: {
          enabled,
          ...restOptions,
        },
      })
    ),
    combine: (results) => {
      const out: Token[] = [];
      const balanceMap: Record<string, TokenFormatOutput> = {};

      let isLoading = false;
      let isFetching = false;
      let isError = false;
      let error: Error | null = null;

      for (let index = 0; index < results.length; index++) {
        const result = results[index];
        const entry = sources[index];
        if (!result || !entry) continue;

        isLoading = isLoading || result.isLoading;
        isFetching = isFetching || result.isFetching;
        isError = isError || result.isError;
        if (!error && result.error) error = result.error;

        const wei = result.data;
        if (typeof wei !== 'bigint') continue;
        if (wei <= 0n) continue;

        const formatted = formatTokenAmount(wei, entry.source.decimals, displayDecimals);
        for (const token of entry.tokens) {
          out.push(token);
          balanceMap[token.address.toLowerCase()] = formatted;
        }
      }

      return {
        tokensWithPublicBalances: out,
        publicBalanceByTokenAddress: balanceMap,
        isLoading,
        isFetching,
        isError,
        error,
        refetch: async () => {
          await Promise.all(results.map((r) => r.refetch()));
        },
      };
    },
  });

  return {
    tokens,
    tokensWithPublicBalances: combined.tokensWithPublicBalances,
    publicBalanceByTokenAddress: combined.publicBalanceByTokenAddress,

    isLoading: combined.isLoading,
    isFetching: combined.isFetching,
    isError: combined.isError,
    error: combined.error,

    refetch: combined.refetch,
  };
}
