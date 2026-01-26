import { type UseQueryOptions } from '@tanstack/react-query';
import { type Address } from 'viem';
import { FheTypes } from '@cofhe/sdk';
import { type Token } from './useCofheTokenLists';
import { CONFIDENTIAL_ABIS, getTokenContractConfig } from '../constants/confidentialTokenABIs';
import { assert } from 'ts-essentials';
import { formatTokenAmount, type TokenFormatOutput } from '@/utils/format';
import { useCofheReadContractAndDecrypt } from './useCofheReadContractAndDecrypt';
import { ErrorCause } from '@/utils';

// ============================================================================
// Unified Confidential Balance Hook
// ============================================================================

type UseConfidentialTokenBalanceInput = {
  /** Token from token list */
  token?: Token;
  /** Account address (optional, defaults to connected account) */
  accountAddress?: Address;
  /** Display decimals for formatting (default: 5) */
  displayDecimals?: number;
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
  disabledDueToMissingPermit: boolean;
};

/**
 * Hook to get confidential (encrypted) balance for a token with convenient formatting.
 *
 * @param input - Token and optional account address
 * @param options - Query options
 * @returns Balance data with raw bigint, formatted string, numeric value, loading state, and refetch function
 */
export function useCofheTokenDecryptedBalance(
  { token, accountAddress, displayDecimals = 5 }: UseConfidentialTokenBalanceInput,
  options?: UseConfidentialTokenBalanceOptions
): UseConfidentialTokenBalanceResult {
  const { enabled: userEnabled = true, ...restOptions } = options ?? {};

  const fheType = token?.extensions.fhenix.confidentialValueType === 'uint64' ? FheTypes.Uint64 : FheTypes.Uint128;

  const contractConfig = token && getTokenContractConfig(token.extensions.fhenix.confidentialityType);

  const {
    decrypted: { data: decryptedData, isFetching: isDecryptionFetching },
    encrypted: { isFetching: isEncryptedFetching, refetch: refetchCiphertext },
    disabledDueToMissingPermit,
  } = useCofheReadContractAndDecrypt(
    {
      address: token?.address,
      abi: contractConfig?.abi,
      functionName: contractConfig?.functionName,
      args: accountAddress ? [accountAddress] : undefined,
      fheType,
      requiresPermit: true,
      potentialDecryptErrorCause: ErrorCause.AttemptToFetchConfidentialBalance,
    },
    {
      readQueryOptions: {
        refetchOnMount: false,
        enabled: userEnabled && !!token,
      },
      decryptingQueryOptions: {
        refetchOnMount: false,
        select: (amountWei) => {
          assert(token, 'Token must be defined to format confidential balance');
          if (typeof amountWei !== 'bigint') {
            throw new Error('Expected bigint from confidential decryption');
          }
          return formatTokenAmount(amountWei, token.decimals, displayDecimals);
        },
      },
      ...restOptions,
    }
  );

  return {
    disabledDueToMissingPermit,

    data: decryptedData,

    isFetching: isDecryptionFetching || isEncryptedFetching,
    refetch: refetchCiphertext,
  };
}
