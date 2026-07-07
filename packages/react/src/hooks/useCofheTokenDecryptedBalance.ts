import { type UseQueryOptions } from '@tanstack/react-query';
import { type Address } from 'viem';
import { FheTypes } from '@cofhe/sdk';
import { type ConfidentialToken } from './useCofheTokenLists';
import { getTokenTypeContracts } from '../constants/tokenTypeConfig';
import { assert } from 'ts-essentials';
import { formatTokenAmount, type TokenFormatOutput } from '@/utils/format';
import { useCofheReadContractAndDecrypt } from './useCofheReadContractAndDecrypt';
import type { CofheDecryptMeta } from '@/meta';

// ============================================================================
// Unified Confidential Balance Hook
// ============================================================================

type UseConfidentialTokenBalanceInput = {
  /** Token from token list */
  token?: ConfidentialToken;
  /** Account address (optional, defaults to connected account) */
  accountAddress?: Address;
  /** Display decimals for formatting (default: 5) */
  displayDecimals?: number;
  /**
   * Consumer metadata for debug/activity views. `label` defaults to the token
   * symbol when omitted; any extra fields are carried onto the decryption card.
   */
  meta?: CofheDecryptMeta;
};

type UseConfidentialTokenBalanceOptions = Omit<UseQueryOptions<bigint, Error>, 'queryKey' | 'queryFn' | 'select'> & {
  enabled?: boolean;
};

type UseConfidentialTokenBalanceResult = {
  /** Raw balance in smallest unit (bigint) */
  data?: TokenFormatOutput;
  /** Whether balance is loading */
  isFetching: boolean;
  /** Refetch function */
  refetch: () => Promise<unknown>;
  disabledDueToMissingValidPermit: boolean;
  /** The on-chain ctHash read is currently failing. */
  isReadError: boolean;
  /** The decryption's latest outcome is an error; any stale decrypted value is withheld from `data`. */
  isDecryptError: boolean;
  /** A balance is shown but the read that produced it is currently failing (stale). */
  isValueStale: boolean;
};

/**
 * Hook to get confidential (encrypted) balance for a token with convenient formatting.
 *
 * @param input - token and optional account address
 * @param options - Query options
 * @returns Balance data with raw bigint, formatted string, numeric value, loading state, and refetch function
 */
export function useCofheTokenDecryptedBalance(
  { token, accountAddress, displayDecimals = 5, meta }: UseConfidentialTokenBalanceInput,
  options?: UseConfidentialTokenBalanceOptions
): UseConfidentialTokenBalanceResult {
  const { enabled: userEnabled = true, ...restOptions } = options ?? {};

  const contractConfig =
    token && getTokenTypeContracts(token.extensions.fhenix.confidentialityType).confidentialBalance;

  // Recognition label defaults to the token symbol; consumer overrides win.
  const decryptMeta: CofheDecryptMeta = { label: token?.symbol, ...meta };

  const {
    decrypted: { data: decryptedData, isFetching: isDecryptionFetching },
    encrypted: { isFetching: isEncryptedFetching, refetch: refetchCiphertext },
    disabledDueToMissingValidPermit,
    isReadError,
    isDecryptError,
    isValueStale,
    isKnownZero,
  } = useCofheReadContractAndDecrypt(
    {
      address: token?.address,
      abi: contractConfig?.abi,
      functionName: contractConfig?.functionName,
      args: accountAddress ? [accountAddress] : undefined,
      requiresPermit: true,
    },
    {
      readQueryOptions: {
        refetchOnMount: false,
        enabled: userEnabled && !!token,
      },
      decryptingQueryOptions: {
        refetchOnMount: false,
        select: (amountWei) => {
          assert(token, 'ConfidentialToken must be defined to format confidential balance');
          if (typeof amountWei !== 'bigint') {
            throw new Error('Expected bigint from confidential decryption');
          }
          return formatTokenAmount(amountWei, token.decimals, displayDecimals);
        },
      },
      meta: decryptMeta,
      ...restOptions,
    }
  );

  // A 0 handle is a known-zero balance (no ciphertext to decrypt) — return a formatted 0 so callers
  // don't mistake the absent decrypted value for a fault. When the decrypt itself is faulted, drop
  // any stale decrypted value: react-query keeps the last success across a failed refetch, so
  // returning it would render a faulted balance as if it were current. `data === undefined` then
  // unambiguously means "no trustworthy value" (pending or faulted).
  const data = isKnownZero && token ? formatTokenAmount(0n, token.decimals, displayDecimals) : decryptedData;

  return {
    disabledDueToMissingValidPermit,

    data: isDecryptError ? undefined : data,

    isFetching: isDecryptionFetching || isEncryptedFetching,
    refetch: refetchCiphertext,
    isReadError,
    isDecryptError,
    isValueStale,
  };
}
