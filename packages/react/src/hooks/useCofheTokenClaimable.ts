import { QueryClient, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { type Address } from 'viem';
import { useCofhePublicClient } from './useCofheConnection.js';
import { type Token } from './useCofheTokenLists.js';
import { DUAL_GET_UNSHIELD_CLAIM_ABI, WRAPPED_GET_USER_CLAIMS_ABI } from '../constants/confidentialTokenABIs.js';

import { useInternalQuery, useInternalQueryClient } from '../providers/index.js';
import { constructDecryptionTrackedBlockQueryKey } from './decryptionTracking.js';

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
): UseQueryResult<UnshieldClaimsSummary, Error> {
  const publicClient = useCofhePublicClient();
  const queryClient = useInternalQueryClient();

  const confidentialityType = token?.extensions.fhenix.confidentialityType;

  const queryKey = constructUnshieldClaimsQueryKey({
    chainId: token?.chainId,
    tokenAddress: token?.address,
    confidentialityType,
    accountAddress: account,
  });

  return useInternalQuery({
    queryKey,
    queryFn: async (): Promise<UnshieldClaimsSummary> => {
      if (!publicClient) {
        throw new Error('PublicClient is required to fetch unshield claims');
      }
      if (!account) {
        throw new Error('Account address is required to fetch unshield claims');
      }
      if (!token) {
        throw new Error('Token address is required');
      }

      const latestBlockNumber = await publicClient.getBlockNumber();

      // Read at the latest tracked block (written by useTrackDecryptingTransactions).
      // Fetching this value at execution-time avoids cache fragmentation and avoids relying on a re-render
      // to update the queryFn closure.
      const trackedBlockNumber = queryClient.getQueryData<bigint | undefined>(
        constructDecryptionTrackedBlockQueryKey({
          chainId: token.chainId,
          accountAddress: account,
        })
      );

      // explicitely set block number, becuase for claiming it's important to fetch AFTER decryption has happened
      const blockNumberToUse =
        trackedBlockNumber && trackedBlockNumber > latestBlockNumber ? trackedBlockNumber : latestBlockNumber;

      if (confidentialityType === 'dual') {
        // Dual tokens: single claim via getUserUnshieldClaim
        const result = await publicClient.readContract({
          address: token.address,
          abi: DUAL_GET_UNSHIELD_CLAIM_ABI,
          functionName: 'getUserUnshieldClaim',
          args: [account],
          blockNumber: blockNumberToUse,
        });

        const claim = result as {
          ctHash: bigint;
          requestedAmount: bigint;
          decryptedAmount: bigint;
          decrypted: boolean;
          claimed: boolean;
        };

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
          hasClaimable: claim.decrypted,
          hasPending: !claim.decrypted,
        };
      } else if (confidentialityType === 'wrapped') {
        // Wrapped tokens: multiple claims via getUserClaims
        const result = await publicClient.readContract({
          address: token.address,
          abi: WRAPPED_GET_USER_CLAIMS_ABI,
          functionName: 'getUserClaims',
          args: [account],
          blockNumber: blockNumberToUse,
        });

        type WrappedClaimResult = {
          ctHash: bigint;
          requestedAmount: bigint;
          decryptedAmount: bigint;
          decrypted: boolean;
          to: Address;
          claimed: boolean;
        };

        const claims = (result as WrappedClaimResult[]).filter((c) => !c.claimed);

        let claimableAmount = 0n;
        let pendingAmount = 0n;

        for (const claim of claims) {
          if (claim.decrypted) {
            claimableAmount += claim.decryptedAmount;
          } else {
            pendingAmount += claim.requestedAmount;
          }
        }

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
    enabled:
      !!publicClient && !!account && !!token && (confidentialityType === 'dual' || confidentialityType === 'wrapped'),
    ...queryOptions,
  });
}
