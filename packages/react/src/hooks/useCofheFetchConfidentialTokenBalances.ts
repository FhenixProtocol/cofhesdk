import type { UseQueryResult } from '@tanstack/react-query';
import type { Address } from 'viem';

import { assert } from 'ts-essentials';
import { useEffect } from 'react';

import { useCofheTokens, type Token } from './useCofheTokenLists';
import { getTokenContractConfig } from '@/constants/confidentialTokenABIs';
import { useCofheAccount, useCofheChainId, useCofhePublicClient } from './useCofheConnection';
import { useCofheActivePermit } from './useCofhePermits';
import { useIsCofheErrorActive } from './useIsCofheErrorActive';
import { useInternalQueryClient } from '@/providers';
import { constructCofheReadContractQueryKey, getEnabledForCofheReadContract } from './useCofheReadContract';
import {
  getEnabledForCofheReadContracts,
  useCofheReadContracts,
  type CofheReadContractsContract,
  type CofheReadContractsItem,
  type UseCofheReadContractsQueryOptions,
} from './useCofheReadContracts';

export type ConfidentialTokenBalanceItem = {
  token: Token;
  contract: CofheReadContractsContract;
  item: CofheReadContractsItem;
};

export type UseCofheFetchConfidentialTokenBalancesInput = {
  tokens?: readonly Token[];
  /** Defaults to connected account. */
  accountAddress?: Address;
  /** Defaults to true. */
  enabled?: boolean;
  /** Defaults to true. */
  allowFailure?: boolean;
  /**
   * When true (default), writes successful multicall results into the
   * `useCofheReadContract` cache so existing per-token hooks can reuse them.
   */
  seedReadContractCache?: boolean;
};

export type UseCofheFetchConfidentialTokenBalancesOptions = Omit<
  UseCofheReadContractsQueryOptions<ConfidentialTokenBalanceItem[]>,
  'select'
>;

/**
 * Batch-fetch confidential token *encrypted* balances via multicall.
 *
 * This avoids N separate RPC calls by using a single `publicClient.multicall`.
 * Optionally seeds `useCofheReadContract` cache entries for each token balance
 * read so existing code paths don’t refetch one-by-one.
 */
export function useCofheFetchConfidentialTokenBalances(
  {
    tokens: _tokens,
    accountAddress,
    enabled: userEnabled = true,
    allowFailure = true,
    seedReadContractCache = true,
  }: UseCofheFetchConfidentialTokenBalancesInput = {},
  queryOptions?: UseCofheFetchConfidentialTokenBalancesOptions
): UseQueryResult<ConfidentialTokenBalanceItem[], Error> {
  const connectedAccount = useCofheAccount();
  const account = accountAddress ?? connectedAccount;

  const cofheChainId = useCofheChainId();
  const publicClient = useCofhePublicClient();
  const isCofheErrorActive = useIsCofheErrorActive();
  const activePermit = useCofheActivePermit();
  const queryClient = useInternalQueryClient();

  const allTokens = useCofheTokens(cofheChainId);
  const tokens = _tokens ?? allTokens;

  const tokensForActiveChain = (tokens ?? []).filter((t): t is Token => {
    return !!cofheChainId && t.chainId === cofheChainId;
  });

  const contracts: CofheReadContractsContract[] = tokensForActiveChain
    .filter((t) => !!t?.address)
    .map((token) => {
      const cfg = getTokenContractConfig(token.extensions.fhenix.confidentialityType);
      return {
        address: token.address,
        abi: cfg.abi,
        functionName: cfg.functionName,
        args: account ? [account] : undefined,
      };
    });

  const { enabled: optionsEnabled, ...restQueryOptions } = queryOptions ?? {};

  const baseEnabled = getEnabledForCofheReadContracts({
    isCofheErrorActive,
    publicClient,
    cofheChainId,
    contracts,
    userEnabled,
  });

  // For confidential balances, we additionally require an active permit.
  const enabled = baseEnabled && !!activePermit && !!account && (optionsEnabled ?? true);

  const result = useCofheReadContracts<ConfidentialTokenBalanceItem[]>(
    {
      contracts,
      multicallOptions: {
        allowFailure,
      },
      // Include permit hash so switching permits re-seeds per-token cache keys.
      cacheKeySuffix: [activePermit?.hash],
    },
    {
      ...restQueryOptions,
      enabled,
      select: (items: CofheReadContractsItem[]) => {
        return items.map((item, index) => {
          const token = tokensForActiveChain[index];
          const contract = contracts[index];
          assert(token, 'Token list and multicall results should align');
          assert(contract, 'Contract list and multicall results should align');
          return { token, contract, item };
        });
      },
    }
  );

  useEffect(() => {
    if (!seedReadContractCache) return;
    if (!cofheChainId || !account || !activePermit?.hash) return;
    if (!result.data) return;

    for (const { token, item } of result.data) {
      if (item.error || item.result === undefined) continue;

      const cfg = getTokenContractConfig(token.extensions.fhenix.confidentialityType);

      const enabledForReadContract = getEnabledForCofheReadContract({
        isCofheErrorActive,
        publicClient,
        address: token.address,
        abi: cfg.abi,
        functionName: cfg.functionName,
        requiresPermit: true,
        hasActivePermit: true,
        userEnabled: true,
      });

      const queryKey = constructCofheReadContractQueryKey({
        cofheChainId,
        address: token.address,
        functionName: cfg.functionName,
        args: [account],
        requiresPermit: true,
        activePermitHash: activePermit.hash,
        enabled: enabledForReadContract,
      });

      queryClient.setQueryData(queryKey, item.result);
    }
  }, [
    account,
    activePermit?.hash,
    cofheChainId,
    isCofheErrorActive,
    publicClient,
    queryClient,
    result.data,
    seedReadContractCache,
  ]);

  return result;
}
