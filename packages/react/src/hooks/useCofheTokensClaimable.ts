import {
  type QueryFunctionContext,
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useMemo } from 'react';
import { isAddress, type Address } from 'viem';
import { assert } from 'ts-essentials';

import { useCofhePublicClient } from './useCofheConnection.js';
import { type Token } from './useCofheTokenLists.js';
import { useInternalQueries } from '../providers/index.js';
import { useNormalizedList } from './useNormalizedList.js';
import { useIsWaitingForDecryptionByAddress } from './useIsWaitingForDecryptionByAddress.js';
import {
  constructUnshieldClaimsQueryKey,
  DEFAULT_UNSHIELD_CLAIM_SUMMARY,
  fetchUnshieldClaimsSummary,
  isTokenConfidentialityTypeClaimable,
  type UnshieldClaimsSummary,
} from './useCofheTokenClaimable.js';

export type UnshieldClaimsSummaryByTokenAddress = Record<Address, UnshieldClaimsSummary>;
export type ClaimableAmountByTokenAddress = Record<Address, bigint>;
export type IsWaitingForDecryptionByTokenAddress = Record<Address, boolean>;

type UseUnshieldClaimsManyInput = {
  tokens: Token[];
  accountAddress: Address | undefined;
};

type UseUnshieldClaimsManyOptions = Omit<
  UseQueryOptions<
    UnshieldClaimsSummary,
    Error,
    UnshieldClaimsSummary,
    ReturnType<typeof constructUnshieldClaimsQueryKey>
  >,
  'queryKey' | 'queryFn' | 'enabled'
>;

type ClaimableToken = Token & {
  extensions: Token['extensions'] & {
    fhenix: Token['extensions']['fhenix'] & {
      confidentialityType: 'dual' | 'wrapped';
    };
  };
};

function isClaimableToken(token: Token): token is ClaimableToken {
  return isTokenConfidentialityTypeClaimable(token.extensions?.fhenix?.confidentialityType);
}

function claimableDedupeKey(token: ClaimableToken): string {
  const confidentialityType = token.extensions.fhenix.confidentialityType;
  return `${token.chainId}:${token.address.toLowerCase()}:${confidentialityType}`;
}

function claimableSort(a: ClaimableToken, b: ClaimableToken): number {
  if (a.chainId !== b.chainId) return a.chainId - b.chainId;
  return a.address.toLowerCase().localeCompare(b.address.toLowerCase());
}

export function useCofheTokensClaimable(
  { tokens, accountAddress: account }: UseUnshieldClaimsManyInput,
  queryOptions?: UseUnshieldClaimsManyOptions
): {
  summariesByTokenAddress: UnshieldClaimsSummaryByTokenAddress;
  claimableByTokenAddress: ClaimableAmountByTokenAddress;
  isWaitingForDecryptionByTokenAddress: IsWaitingForDecryptionByTokenAddress;
  queries: UseQueryResult<UnshieldClaimsSummary, Error>[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
} {
  const publicClient = useCofhePublicClient();

  const normalizedTokens = useNormalizedList(tokens, {
    filter: isClaimableToken,
    dedupeKey: claimableDedupeKey,
    sort: claimableSort,
  });

  const enabledBase = !!publicClient && !!account && normalizedTokens.length > 0;

  const waitingEntries = useMemo(() => {
    if (!account) return [];
    return normalizedTokens.map((token) => ({
      address: token.address,
      queryKey: constructUnshieldClaimsQueryKey({
        chainId: token.chainId,
        tokenAddress: token.address,
        confidentialityType: token.extensions.fhenix.confidentialityType,
        accountAddress: account,
      }),
    }));
  }, [account, normalizedTokens]);

  const isWaitingForDecryptionByTokenAddress = useIsWaitingForDecryptionByAddress(waitingEntries);

  const queries = useInternalQueries({
    queries: normalizedTokens.map((token) => {
      const confidentialityType = token.extensions.fhenix.confidentialityType;
      const queryKey = constructUnshieldClaimsQueryKey({
        chainId: token.chainId,
        tokenAddress: token.address,
        confidentialityType,
        accountAddress: account,
      });

      return {
        queryKey,
        queryFn: async ({
          signal,
          queryKey,
        }: QueryFunctionContext<ReturnType<typeof constructUnshieldClaimsQueryKey>>) => {
          assert(
            isTokenConfidentialityTypeClaimable(confidentialityType),
            'confidentialityType narrowed by token guard'
          );

          assert(account, 'account is required to fetch unshield claims');
          assert(publicClient, 'publicClient is required to fetch unshield claims');

          return fetchUnshieldClaimsSummary({
            publicClient,
            token,
            accountAddress: account,
            confidentialityType,
            queryKey,
            signal,
          });
        },
        refetchOnMount: false,
        enabled: enabledBase,
        ...queryOptions,
      };
    }),
  });

  const summariesByTokenAddress = useMemo((): UnshieldClaimsSummaryByTokenAddress => {
    const map: UnshieldClaimsSummaryByTokenAddress = {};
    for (let i = 0; i < normalizedTokens.length; i++) {
      const token = normalizedTokens[i];
      map[token.address] = queries[i]?.data ?? DEFAULT_UNSHIELD_CLAIM_SUMMARY;
    }
    return map;
  }, [normalizedTokens, queries]);

  const claimableByTokenAddress = useMemo((): ClaimableAmountByTokenAddress => {
    const map: ClaimableAmountByTokenAddress = {};
    for (const [address, summary] of Object.entries(summariesByTokenAddress)) {
      assert(isAddress(address), 'address is valid');
      map[address] = summary.claimableAmount;
    }
    return map;
  }, [summariesByTokenAddress]);

  const isLoading = queries.some((q) => q.isLoading);
  const isFetching = queries.some((q) => q.isFetching);
  const isError = queries.some((q) => q.isError);
  const error = queries.find((q) => q.error)?.error ?? null;

  return {
    summariesByTokenAddress,
    claimableByTokenAddress,
    queries,
    isLoading,
    isFetching,
    isError,
    error,
    isWaitingForDecryptionByTokenAddress,
  };
}
