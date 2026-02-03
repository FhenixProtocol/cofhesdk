import { type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import { isAddress, type Address } from 'viem';
import { assert } from 'ts-essentials';

import { useCofhePublicClient } from './useCofheConnection.js';
import { type Token } from './useCofheTokenLists.js';
import { useInternalQueries } from '../providers/index.js';
import { useIsWaitingForDecryptionToInvalidateMany } from './useIsWaitingForDecryptionToInvalidate.js';
import {
  constructUnshieldClaimsQueryKey,
  constructUnshieldClaimsQueryKeyForInvalidation,
  DEFAULT_UNSHIELD_CLAIM_SUMMARY,
  fetchUnshieldClaimsSummary,
  isTokenConfidentialityTypeClaimable,
  type UnshieldClaimsSummary,
} from './useCofheTokenClaimable.js';

export type UnshieldClaimsSummaryByTokenAddress = Record<Address, UnshieldClaimsSummary>;
export type ClaimableAmountByTokenAddress = Record<Address, bigint>;

type UseUnshieldClaimsManyInput = {
  tokens: Token[];
  accountAddress: Address | undefined;
};

type UseUnshieldClaimsManyOptions = Omit<
  UseQueryOptions<UnshieldClaimsSummary, Error>,
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

export function useCofheTokensClaimable(
  { tokens, accountAddress: account }: UseUnshieldClaimsManyInput,
  queryOptions?: UseUnshieldClaimsManyOptions
): {
  summariesByTokenAddress: UnshieldClaimsSummaryByTokenAddress;
  claimableByTokenAddress: ClaimableAmountByTokenAddress;
  queries: UseQueryResult<UnshieldClaimsSummary, Error>[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  isWaitingForDecryption: boolean;
} {
  const publicClient = useCofhePublicClient();

  const normalizedTokens = useMemo(() => {
    if (!tokens || tokens.length === 0) return [];

    const supported = tokens.filter(isClaimableToken);

    const seen = new Set<string>();
    const unique: ClaimableToken[] = [];
    for (const token of supported) {
      const confidentialityType = token.extensions.fhenix.confidentialityType;
      const dedupeKey = `${token.chainId}:${token.address.toLowerCase()}:${confidentialityType}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      unique.push(token);
    }

    unique.sort((a, b) => {
      if (a.chainId !== b.chainId) return a.chainId - b.chainId;
      return a.address.toLowerCase().localeCompare(b.address.toLowerCase());
    });

    return unique;
  }, [tokens]);

  const enabledBase = !!publicClient && !!account && normalizedTokens.length > 0;

  const queryKeys = useMemo(() => {
    if (!account) return [];
    return normalizedTokens.map((token) =>
      constructUnshieldClaimsQueryKeyForInvalidation({
        chainId: token.chainId,
        tokenAddress: token.address,
        confidentialityType: token.extensions.fhenix.confidentialityType,
        accountAddress: account,
      })
    );
  }, [account, normalizedTokens]);

  const isWaitingForDecryption = useIsWaitingForDecryptionToInvalidateMany(queryKeys);

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
        queryFn: async ({ signal, queryKey }): Promise<UnshieldClaimsSummary> => {
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
      } as const;
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
    isWaitingForDecryption,
  };
}
