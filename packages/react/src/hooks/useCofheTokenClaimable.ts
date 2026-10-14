import { QueryClient, type QueryKey, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { type Address, type Hex } from 'viem';
import { FheTypes } from '@cofhe/sdk';
import { useCofheChainId, useCofhePublicClient } from './useCofheConnection.js';
import { useCofheClient } from './useCofheClient';
import { type ConfidentialToken } from './useCofheTokenLists.js';
import { getTokenTypeContracts } from '../constants/tokenTypeConfig.js';
import { isTokenOperationSupported, type SupportedTokenConfidentialityType } from '@/types/token';
import { useInternalQuery } from '../providers/index.js';
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
  claimableCount: 0,
  claimableAmount: 0n,
  undecryptedCount: 0,
  hasClaimable: false,
};

export type UnshieldClaim = {
  ctHash: Hex | bigint;
  id: Hex;
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
  token: ConfidentialToken;
  accountAddress: Address;
  confidentialityType: SupportedTokenConfidentialityType;
  signal: AbortSignal;
  blockHashToBeAwareOf?: `0x${string}`;
  /** CoFHE client + chain, required to decrypt each pending claim amount for display. */
  client?: ReturnType<typeof useCofheClient>;
  chainId?: number;
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
      'id' in claim &&
      typeof claim.id === 'string'
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
  const contractConfig = getTokenTypeContracts(confidentialityType).claims?.query;
  assert(contractConfig, `claimable config is not defined for confidentialityType: ${confidentialityType}`);
  const result = await maybeWaitUntilRpcAwareAndReadContract(
    publicClient,
    {
      blockHashToBeAwareOf,
      address: token.address,
      abi: contractConfig.abi,
      functionName: contractConfig.functionName,
      args: [accountAddress],
    },
    { signal }
  );

  return normalizeUnshieldClaims(result);
}

export async function fetchUnshieldClaimsSummary({
  publicClient,
  client,
  chainId,
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

  // getUserClaims only ever returns UNCLAIMED claims: handleClaim writes decryptedAmount
  // and removes the id from the claimant's set in the same call. So every entry here is
  // actionable, and every one necessarily carries decryptedAmount == 0 — testing that
  // field to decide claimability can never be true.
  //
  // The settle amount is not recorded in plaintext any more. The old struct carried a
  // requestedAmount, but only the plaintext unshield overload ever filled it — the
  // encrypted overload passed 0. The unified implementation now wraps a plaintext amount
  // to a handle before createClaim runs, so there is no plaintext left to record. The
  // value lives encrypted in ctHash until the claim proves it, so showing a figure means
  // decrypting under the holder's own ACP, which is what this does.
  //
  // Failures are tolerated per claim: a missing or expired ACP, or a ciphertext the
  // threshold network has not indexed yet, degrades the TOTAL and is counted in
  // undecryptedCount. It never drops a claim from the list, because an amount we cannot
  // read is not the same as an amount that is not there — hiding it would strand funds.
  const decrypted = await Promise.all(
    claims.map(async (claim) => {
      if (!client || chainId == null) return undefined;
      try {
        return (await client
          .decryptForView(claim.ctHash as Hex, FheTypes.Uint64)
          .setChainId(chainId)
          .setAccount(accountAddress)
          .withACP()
          .execute()) as bigint;
      } catch (error) {
        cofheLogger.warn('Could not decrypt a pending unshield claim amount for display', {
          ctHash: String(claim.ctHash),
          error,
        });
        return undefined;
      }
    })
  );

  let claimableAmount = 0n;
  let undecryptedCount = 0;
  for (const amount of decrypted) {
    if (typeof amount === 'bigint') claimableAmount += amount;
    else undecryptedCount += 1;
  }

  return {
    claimableCount: claims.length,
    claimableAmount,
    undecryptedCount,
    hasClaimable: claims.length > 0,
  };
  // ============================================================================
}
// Unified Unshield Claims Hook
// ============================================================================

/**
 * Unshield claims summary for wrapped tokens.
 */
export type UnshieldClaimsSummary = {
  /**
   * How many unshield claims are ready to claim.
   *
   * Not an amount: the settle value is encrypted in each claim's ctHash and is only
   * written on chain by handleClaim, i.e. after claiming. Showing a figure requires
   * decrypting ctHash client-side, which the claim flow already does to build its proof.
   */
  claimableCount: number;
  /**
   * Always 0n before a claim is settled. Retained so callers that log or display an
   * amount keep compiling; the real value only exists encrypted in ctHash until the
   * claim flow decrypts it. Prefer claimableCount for anything user-facing.
   */
  claimableAmount: bigint;
  /**
   * How many of those claims could NOT be decrypted for display (no valid ACP, or the
   * ciphertext is not yet readable). Their value is missing from claimableAmount, so a
   * non-zero count means the total shown is an understatement, not the whole picture.
   */
  undecryptedCount: number;
  /** Whether anything is ready to claim. */
  hasClaimable: boolean;
};

type UseUnshieldClaimsInput = {
  /** Token object with confidentialityType */
  token: ConfidentialToken | undefined;
  /** Account address (optional, defaults to connected account) */
  accountAddress: Address | undefined;
};

type UseUnshieldClaimsOptions = Omit<UseQueryOptions<UnshieldClaimsSummary, Error>, 'queryKey' | 'queryFn'>;

/**
 * Hook to fetch wrapped-token unshield claims.
 *
 * Returns an aggregate {@link UnshieldClaimsSummary} (totals only). The summary is
 * derived from the same per-claim list that {@link useCofheTokenClaims} exposes —
 * both share `fetchUnshieldClaims`/`constructUnshieldClaimsQueryKey`. Use this hook
 * for totals; use {@link useCofheTokenClaims} when you need the individual claims.
 *
 * @param input - Token object and optional account address
 * @param queryOptions - Optional React Query options
 * @returns Query result with UnshieldClaimsSummary
 */
export function useCofheTokenClaimable(
  { accountAddress: account, token }: UseUnshieldClaimsInput,
  queryOptions?: UseUnshieldClaimsOptions
): UseQueryResult<UnshieldClaimsSummary, Error> {
  const publicClient = useCofhePublicClient();
  const client = useCofheClient();
  const chainId = useCofheChainId();

  const confidentialityType = token?.extensions.fhenix.confidentialityType;

  const queryKey = constructUnshieldClaimsQueryKey({
    chainId: token?.chainId,
    tokenAddress: token?.address,
    confidentialityType,
    accountAddress: account,
  });

  const result = useInternalQuery({
    queryKey,
    queryFn: withInvalidationContext<
      readonly unknown[],
      { blockHashToBeAwareOf: `0x${string}` },
      UnshieldClaimsSummary
    >(async ({ signal, invalidationContext }): Promise<UnshieldClaimsSummary> => {
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
        client,
        chainId,
        token,
        accountAddress: account,
        confidentialityType,
        signal,
        blockHashToBeAwareOf: invalidationContext?.blockHashToBeAwareOf,
      });
    }),
    refetchOnMount: false,
    enabled: !!publicClient && !!account && !!token && isTokenConfidentialityTypeClaimable(confidentialityType),
    ...queryOptions,
  });

  return result;
}

type UseUnshieldClaimsListOptions = Omit<UseQueryOptions<UnshieldClaim[], Error>, 'queryKey' | 'queryFn'>;

/**
 * Hook returning the raw list of unclaimed unshield claims for a token (the per-claim
 * breakdown the {@link useCofheTokenClaimable} summary is derived from).
 *
 * Not a duplicate of {@link useCofheTokenClaimable}: that hook collapses these claims
 * into aggregate totals, whereas this one surfaces the individual claims (amount,
 * claimed/pending state, ctHash) needed for batch claiming and detailed claim views.
 * Both share `fetchUnshieldClaims`/`constructUnshieldClaimsQueryKey`; this hook appends
 * `'list'` to the key so the list and summary cache as separate entries.
 */
export function useCofheTokenClaims(
  { accountAddress: account, token }: UseUnshieldClaimsInput,
  queryOptions?: UseUnshieldClaimsListOptions
): UseQueryResult<UnshieldClaim[], Error> {
  const publicClient = useCofhePublicClient();

  const confidentialityType = token?.extensions.fhenix.confidentialityType;

  const queryKey = [
    ...constructUnshieldClaimsQueryKey({
      chainId: token?.chainId,
      tokenAddress: token?.address,
      confidentialityType,
      accountAddress: account,
    }),
    'list',
  ];

  return useInternalQuery({
    queryKey,
    queryFn: withInvalidationContext<readonly unknown[], { blockHashToBeAwareOf: `0x${string}` }, UnshieldClaim[]>(
      async ({ signal, invalidationContext }): Promise<UnshieldClaim[]> => {
        assert(token, 'token is guaranteed to be defined in query function due to `enabled` condition');
        assert(confidentialityType, 'token.confidentialityType is guaranteed to be defined in query function');
        assert(account, 'account is guaranteed to be defined in query function due to `enabled` condition');
        assert(publicClient, 'publicClient is guaranteed to be defined in query function due to `enabled` condition');
        assert(
          isTokenConfidentialityTypeClaimable(confidentialityType),
          'confidentialityType is guaranteed to be claimable type due to `enabled` condition'
        );

        const claims = await fetchUnshieldClaims({
          publicClient,
          token,
          accountAddress: account,
          confidentialityType,
          signal,
          blockHashToBeAwareOf: invalidationContext?.blockHashToBeAwareOf,
        });

        return claims.filter((claim) => !claim.claimed);
      }
    ),
    refetchOnMount: false,
    enabled: !!publicClient && !!account && !!token && isTokenConfidentialityTypeClaimable(confidentialityType),
    ...queryOptions,
  });
}
