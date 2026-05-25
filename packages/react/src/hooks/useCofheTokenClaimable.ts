import { QueryClient, type QueryKey, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { type Address, type Hex } from 'viem';
import { useCofhePublicClient } from './useCofheConnection.js';
import { type Token } from './useCofheTokenLists.js';
import { getClaimableContractConfig } from '../constants/confidentialTokenABIs.js';
import { isTokenOperationSupported, type SupportedTokenConfidentialityType } from '@/types/token';
import { useInternalQuery } from '../providers/index.js';
import { useIsWaitingForDecryptionToInvalidate } from './useIsWaitingForDecryptionToInvalidate.js';
import { assert } from 'ts-essentials';
import { cofheLogger } from '@/utils/debug';
import { maybeWaitUntilRpcAwareAndReadContract } from '@/utils/waitUntilRpcAwareAndReadContract.js';
import { invalidateQueriesWithContext, withInvalidationContext } from '@/utils/invalidationContext';

export function constructUnshieldClaimsQueryKey({
  chainId,
  tokenAddress,
  confidentialityType,
  accountAddress,
}: {
  chainId: number | undefined;
  tokenAddress: Address | undefined;
  confidentialityType: string | undefined;
  accountAddress: Address | undefined;
}) {
  return ['unshieldClaims', chainId, tokenAddress, confidentialityType, accountAddress];
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

export function constructUnshieldClaimsQueryKeyForInvalidation({
  chainId,
  tokenAddress,
  confidentialityType,
  accountAddress,
}: {
  chainId: number;
  tokenAddress: Address;
  confidentialityType: string;
  accountAddress: Address;
}) {
  return constructUnshieldClaimsQueryKey({
    chainId,
    tokenAddress,
    confidentialityType,
    accountAddress,
  });
}

export const DEFAULT_UNSHIELD_CLAIM_SUMMARY: UnshieldClaimsSummary = {
  claimableAmount: 0n,
  pendingAmount: 0n,
  hasClaimable: false,
  hasPending: false,
};

export type UnshieldClaim = {
  ctHash: Hex | bigint;
  requestedAmount: bigint;
  decryptedAmount: bigint;
  claimed: boolean;
  decrypted?: boolean;
  to?: Address;
};

export function isTokenConfidentialityTypeClaimable(
  type: string | undefined
): type is SupportedTokenConfidentialityType {
  return isTokenOperationSupported(type, 'claimable');
}

export type FetchUnshieldClaimsSummaryInput = {
  publicClient: NonNullable<ReturnType<typeof useCofhePublicClient>>;
  token: Token;
  accountAddress: Address;
  confidentialityType: SupportedTokenConfidentialityType;
  signal: AbortSignal;
  blockHashToBeAwareOf?: `0x${string}`;
};

function normalizeUnshieldClaims(result: unknown): UnshieldClaim[] {
  return (Array.isArray(result) ? result : []).filter(
    (claim): claim is UnshieldClaim =>
      !!claim &&
      typeof claim === 'object' &&
      'ctHash' in claim &&
      (typeof claim.ctHash === 'bigint' || typeof claim.ctHash === 'string') &&
      'claimed' in claim &&
      typeof claim.claimed === 'boolean' &&
      'decryptedAmount' in claim &&
      typeof claim.decryptedAmount === 'bigint' &&
      'requestedAmount' in claim &&
      typeof claim.requestedAmount === 'bigint'
  );
}

export async function fetchUnshieldClaims({
  publicClient,
  token,
  accountAddress,
  confidentialityType,
  signal,
  blockHashToBeAwareOf,
}: FetchUnshieldClaimsSummaryInput): Promise<UnshieldClaim[]> {
  const contractConfig = getClaimableContractConfig(confidentialityType);
  const result = await maybeWaitUntilRpcAwareAndReadContract(publicClient, {
    blockHashToBeAwareOf,
    address: token.address,
    abi: contractConfig.abi,
    functionName: contractConfig.functionName,
    args: [accountAddress],
  }, { signal });

  return normalizeUnshieldClaims(result);
}

export async function fetchUnshieldClaimsSummary({
  publicClient,
  token,
  accountAddress,
  confidentialityType,
  signal,
  blockHashToBeAwareOf,
}: FetchUnshieldClaimsSummaryInput): Promise<UnshieldClaimsSummary> {
  const claims = (
    await fetchUnshieldClaims({
      publicClient,
      token,
      accountAddress,
      confidentialityType,
      signal,
      blockHashToBeAwareOf,
    })
  ).filter((claim) => !claim.claimed);

  const { claimableAmount, pendingAmount } = claims.reduce(
    (acc, claim) => {
      if (confidentialityType === 'dual') {
        acc.claimableAmount += claim.requestedAmount;
        return acc;
      }

      const isDecrypted = 'decrypted' in claim ? claim.decrypted === true : claim.decryptedAmount > 0n;

      if (isDecrypted) {
        acc.claimableAmount += claim.decryptedAmount;
      } else {
        acc.pendingAmount += claim.requestedAmount;
      }
      return acc;
    },
    { claimableAmount: 0n, pendingAmount: 0n }
  );

  return {
    claimableAmount,
    pendingAmount,
    hasClaimable: claimableAmount > 0n,
    hasPending: pendingAmount > 0n,
  };
}

// ============================================================================
// Unified Unshield Claims Hook
// ============================================================================

/**
 * Unshield claims summary for wrapped tokens.
 */
export type UnshieldClaimsSummary = {
  /** Total amount that can be claimed now (decrypted and not claimed) */
  claimableAmount: bigint;
  /** Total amount pending decryption */
  pendingAmount: bigint;
  /** Whether there are any claimable amounts */
  hasClaimable: boolean;
  /** Whether there are any pending (not yet decrypted) claims */
  hasPending: boolean;
};

type UseUnshieldClaimsInput = {
  /** Token object with confidentialityType */
  token: Token | undefined;
  /** Account address (optional, defaults to connected account) */
  accountAddress: Address | undefined;
};

type UseUnshieldClaimsOptions = Omit<UseQueryOptions<UnshieldClaimsSummary, Error>, 'queryKey' | 'queryFn'>;

/**
 * Hook to fetch wrapped-token unshield claims.
 * @param input - Token object and optional account address
 * @param queryOptions - Optional React Query options
 * @returns Query result with UnshieldClaimsSummary
 */
export function useCofheTokenClaimable(
  { accountAddress: account, token }: UseUnshieldClaimsInput,
  queryOptions?: UseUnshieldClaimsOptions
): UseQueryResult<UnshieldClaimsSummary, Error> & {
  isWaitingForDecryption: boolean;
} {
  const publicClient = useCofhePublicClient();

  const confidentialityType = token?.extensions.fhenix.confidentialityType;

  const queryKey = constructUnshieldClaimsQueryKey({
    chainId: token?.chainId,
    tokenAddress: token?.address,
    confidentialityType,
    accountAddress: account,
  });
  // is waiting for decryption finalization -> once Unshield tx mined, but before Decryption result available
  const isWaitingForDecryption = useIsWaitingForDecryptionToInvalidate(queryKey);

  const result = useInternalQuery({
    queryKey,
    queryFn: withInvalidationContext<readonly unknown[], { blockHashToBeAwareOf: `0x${string}` }, UnshieldClaimsSummary>(
      async ({ signal, invalidationContext }): Promise<UnshieldClaimsSummary> => {
        assert(token, 'token is guaranteed to be defined in query function due to `enabled` condition');
        assert(confidentialityType, 'token.confidentialityType is guaranteed to be defined in query function');
        assert(account, 'account is guaranteed to be defined in query function due to `enabled` condition');
        assert(publicClient, 'publicClient is guaranteed to be defined in query function due to `enabled` condition');

        assert(
          isTokenConfidentialityTypeClaimable(confidentialityType),
          'confidentialityType is guaranteed to be claimable type due to `enabled` condition'
        );

        return fetchUnshieldClaimsSummary({
          publicClient,
          token,
          accountAddress: account,
          confidentialityType,
          signal,
          blockHashToBeAwareOf: invalidationContext?.blockHashToBeAwareOf,
        });
      }
    ),
    refetchOnMount: false,
    enabled: !!publicClient && !!account && !!token && isTokenConfidentialityTypeClaimable(confidentialityType),
    ...queryOptions,
  });

  return {
    ...result,
    isWaitingForDecryption,
  };
}
