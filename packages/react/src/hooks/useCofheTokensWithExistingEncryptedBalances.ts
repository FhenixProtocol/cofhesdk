import { useMemo } from 'react';
import type { Address } from 'viem';

import type { Token } from '@/types/token';
import { useCofheAccount, useCofheChainId } from './useCofheConnection';
import { useCofheTokens } from './useCofheTokenLists';
import { getTokenContractConfig } from '../constants/confidentialTokenABIs';
import {
  useCofheReadContracts,
  type CofheReadContractsContract,
  type UseCofheReadContractsQueryOptions,
} from './useCofheReadContracts';

function asCtHash(value: unknown): bigint | undefined {
  if (typeof value === 'bigint') return value;
  if (value && typeof value === 'object' && 'ctHash' in value) {
    const ctHash = (value as { ctHash?: unknown }).ctHash;
    if (typeof ctHash === 'bigint') return ctHash;
  }
  return undefined;
}

export type UseCofheTokensWithExistingBalancesInput = {
  chainId?: number;
  accountAddress?: Address;
};

export type UseCofheTokensWithExistingBalancesResult = {
  tokens: Token[];
  tokensWithExistingEncryptedBalance: Token[];
  ctHashByTokenAddress: Record<string, bigint>;

  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;

  refetch: () => Promise<unknown>;
};

/**
 * Returns tokens whose confidential (encrypted) balance handle exists for the given account.
 *
 * This does NOT decrypt balances. It only checks if the encrypted balance return value (ctHash) is non-zero.
 */
export function useCofheTokensWithExistingEncryptedBalances(
  { chainId: _chainId, accountAddress }: UseCofheTokensWithExistingBalancesInput = {},
  queryOptions?: UseCofheReadContractsQueryOptions
): UseCofheTokensWithExistingBalancesResult {
  const connectedAccount = useCofheAccount();
  const account = accountAddress ?? connectedAccount;
  const currentChainId = useCofheChainId();
  const chainIdForTokens = _chainId ?? currentChainId;

  const tokens = useCofheTokens(chainIdForTokens);

  const contracts = useMemo((): readonly CofheReadContractsContract[] => {
    if (!account) return [];

    return tokens.map((token) => {
      const config = getTokenContractConfig(token.extensions.fhenix.confidentialityType);
      return {
        address: token.address,
        abi: config.abi,
        functionName: config.functionName,
        args: [account],
      };
    });
  }, [account, tokens]);

  const read = useCofheReadContracts(
    {
      contracts,
      multicallOptions: {
        allowFailure: true,
      },
    },
    {
      refetchOnMount: false,
      ...queryOptions,
      enabled: (queryOptions?.enabled ?? true) && !!account && tokens.length > 0,
    }
  );

  console.log('useCofheTokensWithExistingBalances', {
    account,
    tokens,
    contracts,
    readData: read.data,
    readError: read.error,
  });

  const { tokensWithExistingEncryptedBalance, ctHashByTokenAddress, error } = useMemo(() => {
    const map: Record<string, bigint> = {};
    const filtered: Token[] = [];

    const items = read.data;
    if (!items || items.length === 0) {
      return {
        tokensWithExistingEncryptedBalance: filtered,
        ctHashByTokenAddress: map,
        error: read.error ?? null,
      };
    }

    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index];
      const item = items[index];
      if (!token || !item) continue;
      if (item.error) continue;

      const ctHash = asCtHash(item.result);
      if (ctHash == null) continue;
      if (ctHash === 0n) continue;

      map[token.address.toLowerCase()] = ctHash;
      filtered.push(token);
    }

    return {
      tokensWithExistingEncryptedBalance: filtered,
      ctHashByTokenAddress: map,
      error: read.error ?? null,
    };
  }, [read.data, read.error, tokens]);

  return {
    tokens,
    tokensWithExistingEncryptedBalance,
    ctHashByTokenAddress,

    isLoading: read.isLoading,
    isFetching: read.isFetching,
    isError: read.isError,
    error,

    refetch: read.refetch,
  };
}
