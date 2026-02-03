import { type QueryFunctionContext, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import { type Address } from 'viem';
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
type CombinedResult = {
  summariesByTokenAddress: UnshieldClaimsSummaryByTokenAddress;
  claimableByTokenAddress: ClaimableAmountByTokenAddress;
  isWaitingForDecryptionByTokenAddress: IsWaitingForDecryptionByTokenAddress;
  queries: UseQueryResult<UnshieldClaimsSummary, Error>[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  totalTokensClaimable: number;
  error: Error | null;
};
export function useCofheTokensClaimable(
  { tokens, accountAddress: account }: UseUnshieldClaimsManyInput,
  queryOptions?: UseUnshieldClaimsManyOptions
): CombinedResult {
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

  const combined = useInternalQueries({
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
    combine: (results) => {
      return results.reduce<Omit<CombinedResult, 'isWaitingForDecryptionByTokenAddress'>>(
        (acc, result, index) => {
          const token = normalizedTokens[index];
          if (!token) return acc;

          const summary = result.data ?? DEFAULT_UNSHIELD_CLAIM_SUMMARY;
          acc.summariesByTokenAddress[token.address] = summary;
          acc.claimableByTokenAddress[token.address] = summary.claimableAmount;

          if (summary.hasClaimable) {
            acc.totalTokensClaimable += 1;
          }

          acc.isLoading = acc.isLoading || result.isLoading;
          acc.isFetching = acc.isFetching || result.isFetching;
          acc.isError = acc.isError || result.isError;
          if (!acc.error && result.error) acc.error = result.error;

          return acc;
        },
        {
          summariesByTokenAddress: {},
          claimableByTokenAddress: {},
          totalTokensClaimable: 0,
          queries: results,
          isLoading: false,
          isFetching: false,
          isError: false,
          error: null,
        }
      );
    },
  });

  return {
    summariesByTokenAddress: combined.summariesByTokenAddress,
    claimableByTokenAddress: combined.claimableByTokenAddress,
    totalTokensClaimable: combined.totalTokensClaimable,
    queries: combined.queries,
    isLoading: combined.isLoading,
    isFetching: combined.isFetching,
    isError: combined.isError,
    error: combined.error,
    isWaitingForDecryptionByTokenAddress,
  };
}
