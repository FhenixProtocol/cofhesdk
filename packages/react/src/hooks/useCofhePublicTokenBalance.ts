import { type UseQueryOptions } from '@tanstack/react-query';
import { type Address } from 'viem';
import { useCofheAccount, useCofhePublicClient } from './useCofheConnection';
import { type Token, ETH_ADDRESS } from './useCofheTokenLists';
import { ERC20_BALANCE_OF_ABI } from '../constants/erc20ABIs';
import { assert } from 'ts-essentials';
import { useInternalQuery } from '../providers/index';
import { formatTokenAmount, type TokenFormatOutput } from '@/utils/format';

type UseTokenBalanceInput = {
  /** Token contract address */
  tokenAddress?: Address;
  /** Account address to check balance for (optional, defaults to connected account) */
  accountAddress?: Address;
};

type UseTokenBalanceOptions<TSelectedData = bigint> = Omit<
  UseQueryOptions<bigint, Error, TSelectedData>,
  'queryKey' | 'queryFn'
>;
/**
 * Hook to get ERC20 token balance and return normalized display value
 * @param input - Token address, decimals, and optional publicClient/accountAddress
 * @param queryOptions - Optional React Query options
 * @returns Query result with normalized balance as string
 */
function useTokenBalance<TSelectedData = bigint>(
  { tokenAddress, accountAddress }: UseTokenBalanceInput,
  queryOptions?: UseTokenBalanceOptions<TSelectedData>
) {
  const publicClient = useCofhePublicClient();

  const { enabled: userEnabled, ...restQueryOptions } = queryOptions ?? {};
  const baseEnabled = !!publicClient && !!accountAddress && !!tokenAddress;
  const enabled = baseEnabled && (userEnabled ?? true);

  return useInternalQuery({
    queryKey: ['tokenBalance', publicClient?.chain?.id, accountAddress, tokenAddress],
    queryFn: async () => {
      assert(tokenAddress, 'Token address is required to fetch token balance');
      assert(publicClient, 'PublicClient is required to fetch token balance');
      assert(accountAddress, 'Account address is required to fetch token balance');

      const isNativeToken = tokenAddress.toLowerCase() === ETH_ADDRESS.toLowerCase();

      // Read balance from contract
      const balance = isNativeToken
        ? publicClient.getBalance({
            address: accountAddress,
          })
        : publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_BALANCE_OF_ABI,
            functionName: 'balanceOf',
            args: [accountAddress],
          });

      return balance;
    },
    enabled,
    ...restQueryOptions,
  });
}

// ============================================================================
// Unified Public Balance Hook
// ============================================================================

type UsePublicTokenBalanceInput = {
  /** Token from token list */
  token: Token | null | undefined;
  /** Account address (optional, defaults to connected account) */
  accountAddress?: Address;
  /** Display decimals for formatting (default: 5) */
  displayDecimals?: number;
};

type UsePublicTokenBalanceResult = {
  data?: TokenFormatOutput;
  /** Whether balance is loading */
  isLoading: boolean;
  /** Refetch function */
  refetch: () => Promise<unknown>;
};

/**
 * Hook to get public (non-confidential) balance for a token.
 * Handles both dual tokens (balanceOf on token address) and wrapped tokens (balanceOf on erc20Pair or native ETH).
 *
 * @param input - Token and optional account address
 * @param options - Query options
 * @returns Balance data with formatted string, numeric value, loading state, and refetch function
 */
export function useCofhePublicTokenBalance(
  { token, accountAddress, displayDecimals = 5 }: UsePublicTokenBalanceInput,
  options?: Omit<UseTokenBalanceOptions, 'select'> // disallow passing 'select' because it's harder to type
): UsePublicTokenBalanceResult {
  const connectedAccount = useCofheAccount();
  const account = accountAddress || connectedAccount;

  const { enabled: userEnabled = true, ...restOptions } = options ?? {};

  // Determine token type
  const confidentialityType = token?.extensions.fhenix.confidentialityType;
  const erc20Pair = token?.extensions.fhenix.erc20Pair;

  const tokenBalanceFetchArs =
    confidentialityType === 'wrapped'
      ? {
          // ERC20 balance for wrapped tokens (from erc20Pair address)
          tokenAddress: erc20Pair?.address,
          decimals: erc20Pair?.decimals,
          accountAddress: account,
          displayDecimals,
        }
      : confidentialityType === 'dual'
        ? {
            // ERC20 balance for dual tokens (from token's own address)
            tokenAddress: token?.address,
            decimals: token?.decimals,
            accountAddress: account,
            displayDecimals,
          }
        : {};

  const { data, isLoading, refetch } = useTokenBalance(tokenBalanceFetchArs, {
    enabled: userEnabled,
    select: (value) => {
      assert(
        typeof tokenBalanceFetchArs.decimals === 'number',
        'Token decimals must be defined to format public token balance'
      );
      return formatTokenAmount(value, tokenBalanceFetchArs.decimals, displayDecimals);
    },
    ...restOptions,
  });

  return {
    data,
    isLoading,
    refetch,
  };
}
