import { QueryClient, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { type Address } from 'viem';
import { useCofhePublicClient } from './useCofheConnection.js';
import { type Token } from './useCofheTokenLists.js';
import { DUAL_GET_UNSHIELD_CLAIM_ABI, WRAPPED_GET_USER_CLAIMS_ABI } from '../constants/confidentialTokenABIs.js';
import { useInternalQuery } from '../providers/index.js';
import { decryptionAwareReadContract } from '@/utils/decryptionAwareReadContract.js';
import { useIsWaitingForDecryptionToInvalidate } from './useIsWaitingForDecryptionToInvalidate.js';
import { assert } from 'ts-essentials';

function constructUnshieldClaimsQueryKey({
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
  console.log('Invalidating unshield claims queries for token:', token);

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

// ============================================================================
// Unified Unshield Claims Hook
// ============================================================================

/**
 * Unified unshield claims summary - works for both dual and wrapped tokens
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
 * Unified hook to fetch unshield claims for any token type (dual or wrapped)
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
      assert(
        confidentialityType,
        'token.confidentialityType is guaranteed to be defined in query function due to `enabled` condition'
      );
      assert(account, 'account is guaranteed to be defined in query function due to `enabled` condition');
      assert(publicClient, 'publicClient is guaranteed to be defined in query function due to `enabled` condition');

      if (confidentialityType === 'dual') {
        // Dual tokens: single claim via getUserUnshieldClaim
        const claim = await decryptionAwareReadContract({
          publicClient,
          queryKey,
          signal,
          readContractParams: {
            address: token.address,
            abi: DUAL_GET_UNSHIELD_CLAIM_ABI,
            functionName: 'getUserUnshieldClaim',
            args: [account],
          },
        });

        // No active claim
        if (claim.ctHash === 0n || claim.claimed) {
          return {
            claimableAmount: 0n,
            pendingAmount: 0n,
            hasClaimable: false,
            hasPending: false,
          };
        }

        return {
          claimableAmount: claim.decrypted ? claim.decryptedAmount : 0n,
          pendingAmount: claim.decrypted ? 0n : claim.requestedAmount,
          hasClaimable: claim.decrypted && claim.decryptedAmount > 0n,
          hasPending: !claim.decrypted,
        };
      } else if (confidentialityType === 'wrapped') {
        // Wrapped tokens: multiple claims via getUserClaims
        const result = await decryptionAwareReadContract({
          publicClient,
          queryKey,
          signal,
          readContractParams: {
            address: token.address,
            abi: WRAPPED_GET_USER_CLAIMS_ABI,
            functionName: 'getUserClaims',
            args: [account],
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

      // Token type doesn't support claims
      return {
        claimableAmount: 0n,
        pendingAmount: 0n,
        hasClaimable: false,
        hasPending: false,
      };
    },
    refetchOnMount: false,
    enabled:
      !!publicClient && !!account && !!token && (confidentialityType === 'dual' || confidentialityType === 'wrapped'),
    ...queryOptions,
  });

  return {
    ...result,
    isWaitingForDecryption,
  };
}
