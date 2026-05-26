import { getTokenContractConfig } from '@/constants/confidentialTokenABIs';
import { cofheLogger } from '@/utils/debug';
import { invalidateQueriesWithContext } from '@/utils/invalidationContext';
import { QueryClient } from '@tanstack/react-query';
import { assert } from 'ts-essentials';
import type { Address } from 'viem';
import { constructCofheReadContractQueryForInvalidation } from '../useCofheReadContract';
import { constructUnshieldClaimsQueryKeyForInvalidation } from '../useCofheTokenClaimable';
import type { Token } from '../useCofheTokenLists';
import {
  constructPublicTokenBalanceQueryKeyForInvalidation,
  getPublicTokenBalanceSource,
} from '../useCofheTokenPublicBalance';
import { constructTokenAllowanceQueryKeyForInvalidation } from '../useTokenAllowance';

export function invalidateConfidentialTokenBalanceQueries(
  token: Token,
  queryClient: QueryClient,
  blockHashToBeAwareOf?: `0x${string}`
) {
  const tokenBalanceQueryKey = constructCofheReadContractQueryForInvalidation({
    cofheChainId: token.chainId,
    address: token.address,
    functionName: getTokenContractConfig(token.extensions.fhenix.confidentialityType).functionName,
  });

  cofheLogger.log('Invalidating shield/send read contract queries for token:', { token, tokenBalanceQueryKey });

  const filters = {
    queryKey: tokenBalanceQueryKey,
    // TODO: it can potentially invalidate irrelevenat queries who happen to belong to the same contract but different function. Not sure if worth fixing
    exact: false,
  } as const;

  if (!blockHashToBeAwareOf) {
    queryClient.invalidateQueries(filters);
    return;
  }

  invalidateQueriesWithContext(queryClient, filters, { blockHashToBeAwareOf });
}

export function invalidatePublicTokenBalanceQueries(
  {
    tokenAddress,
    chainId,
    accountAddress,
  }: {
    tokenAddress: Address;
    chainId: number;
    accountAddress: Address;
  },
  queryClient: QueryClient,
  blockHashToBeAwareOf?: `0x${string}`
) {
  const tokenBalanceQueryKey = constructPublicTokenBalanceQueryKeyForInvalidation({
    chainId,
    tokenAddress,
    accountAddress,
  });

  cofheLogger.log('Invalidating public token balance read contract queries for token:', tokenBalanceQueryKey);

  const filters = {
    queryKey: tokenBalanceQueryKey,
  } as const;

  if (!blockHashToBeAwareOf) {
    queryClient.invalidateQueries(filters);
    return;
  }

  invalidateQueriesWithContext(queryClient, filters, { blockHashToBeAwareOf });
}

export function invalidatePublicAndConfidentialTokenBalanceQueries(
  token: Token,
  accountAddress: Address,
  queryClient: QueryClient,
  blockHashToBeAwareOf?: `0x${string}`
) {
  invalidateConfidentialTokenBalanceQueries(token, queryClient, blockHashToBeAwareOf);

  const publicBalanceSource = getPublicTokenBalanceSource(token);
  assert(publicBalanceSource, 'Public balance source is required for shield transaction invalidation');
  invalidatePublicTokenBalanceQueries(
    {
      tokenAddress: publicBalanceSource.address,
      chainId: token.chainId,
      accountAddress,
    },
    queryClient,
    blockHashToBeAwareOf
  );
}

export function invalidateTokenAllowanceQueries(
  {
    chainId,
    tokenAddress,
    ownerAddress,
    spenderAddress,
  }: {
    chainId: number;
    tokenAddress: Address;
    ownerAddress: Address;
    spenderAddress: Address;
  },
  queryClient: QueryClient,
  blockHashToBeAwareOf?: `0x${string}`
) {
  const queryKey = constructTokenAllowanceQueryKeyForInvalidation({
    chainId,
    tokenAddress,
    ownerAddress,
    spenderAddress,
  });

  const filters = { queryKey } as const;

  if (!blockHashToBeAwareOf) {
    queryClient.invalidateQueries(filters);
    return;
  }

  invalidateQueriesWithContext(queryClient, filters, { blockHashToBeAwareOf });
}

export function invalidateClaimableQueries({
  token,
  accountAddress,
  queryClient,
  blockHashToBeAwareOf,
}: {
  token: Token;
  accountAddress: Address;
  queryClient: QueryClient;
  blockHashToBeAwareOf?: `0x${string}`;
}) {
  cofheLogger.log('Invalidating unshield claims queries for token:', token);

  const filters = {
    queryKey: constructUnshieldClaimsQueryKeyForInvalidation({
      chainId: token.chainId,
      tokenAddress: token.address,
      confidentialityType: token.extensions.fhenix.confidentialityType,
      accountAddress,
    }),
  } as const;

  if (!blockHashToBeAwareOf) {
    queryClient.invalidateQueries(filters);
    return;
  }

  invalidateQueriesWithContext(queryClient, filters, { blockHashToBeAwareOf });
}
