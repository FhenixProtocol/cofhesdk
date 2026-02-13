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
 * - `dual`: token contract `balanceOf` (ERC20)
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

  const entries = useMemo((): Array<{ token: Token; source: PublicTokenBalanceSource }> => {
    const out: Array<{ token: Token; source: PublicTokenBalanceSource }> = [];
    for (const token of tokens) {
      const source = getPublicTokenBalanceSource(token);
      if (!source) continue;
      out.push({ token, source });
    }
    return out;
  }, [tokens]);

  const { enabled: userEnabled = true, ...restOptions } = options ?? {};
  const enabled = userEnabled && !!publicClient && !!account && entries.length > 0;

  const combined = useInternalQueries({
    queries: entries.map(({ source }) =>
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
        const entry = entries[index];
        if (!result || !entry) continue;

        isLoading = isLoading || result.isLoading;
        isFetching = isFetching || result.isFetching;
        isError = isError || result.isError;
        if (!error && result.error) error = result.error as Error;

        const wei = result.data;
        if (typeof wei !== 'bigint') continue;
        if (wei <= 0n) continue;

        out.push(entry.token);
        balanceMap[entry.token.address.toLowerCase()] = formatTokenAmount(wei, entry.source.decimals, displayDecimals);
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
