import { QueryClient, type QueryKey, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { type Address } from 'viem';
import { useCofhePublicClient } from './useCofheConnection.js';
import { type Token } from './useCofheTokenLists.js';
import { getClaimableContractConfig } from '../constants/confidentialTokenABIs.js';
import { isTokenOperationSupported, type SupportedTokenConfidentialityType } from '@/types/token';
import { useInternalQuery } from '../providers/index.js';
import { decryptionAwareReadContract } from '@/utils/decryptionAwareReadContract.js';
import { useIsWaitingForDecryptionToInvalidate } from './useIsWaitingForDecryptionToInvalidate.js';
import { assert } from 'ts-essentials';
import { cofheLogger } from '@/utils/debug';

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
}: {
  token: Token;
  accountAddress: Address;
  queryClient: QueryClient;
}) {
  cofheLogger.log('Invalidating unshield claims queries for token:', token);

  queryClient.invalidateQueries({
    queryKey: constructUnshieldClaimsQueryKeyForInvalidation({
      chainId: token.chainId,
      tokenAddress: token.address,
      confidentialityType: token.extensions.fhenix.confidentialityType,
      accountAddress,
    }),
  });
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
  queryKey: QueryKey;
  signal: AbortSignal;
};

export async function fetchUnshieldClaimsSummary({
  publicClient,
  token,
  accountAddress,
  confidentialityType,
  queryKey,
  signal,
}: FetchUnshieldClaimsSummaryInput): Promise<UnshieldClaimsSummary> {
  const contractConfig = getClaimableContractConfig(confidentialityType);
  const result = await decryptionAwareReadContract({
    publicClient,
    queryKey,
    signal,
    readContractParams: {
      address: token.address,
      abi: contractConfig.abi,
      functionName: contractConfig.functionName,
      args: [accountAddress],
    },
  });

  const claims = result.filter((c) => !c.claimed);

  const { claimableAmount, pendingAmount } = claims.reduce(
    (acc, claim) => {
      if (claim.decrypted) {
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
    queryFn: async ({ signal, queryKey }): Promise<UnshieldClaimsSummary> => {
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
        queryKey,
        signal,
      });
    },
    refetchOnMount: false,
    enabled: !!publicClient && !!account && !!token && isTokenConfidentialityTypeClaimable(confidentialityType),
    ...queryOptions,
  });

  return {
    ...result,
    isWaitingForDecryption,
  };
}
