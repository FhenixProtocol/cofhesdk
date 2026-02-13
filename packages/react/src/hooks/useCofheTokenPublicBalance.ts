import { type UseQueryOptions } from '@tanstack/react-query';
import { type Address } from 'viem';
import { useCofheAccount, useCofhePublicClient } from './useCofheConnection';
import { type Token, ETH_ADDRESS } from './useCofheTokenLists';
import { ERC20_BALANCE_OF_ABI } from '../constants/erc20ABIs';
import { assert } from 'ts-essentials';
import { useInternalQuery } from '../providers/index';
import { formatTokenAmount, type TokenFormatOutput } from '@/utils/format';

export function constructPublicTokenBalanceQueryKey({
  chainId,
  accountAddress,
  tokenAddress,
}: {
  chainId?: number;
  accountAddress?: Address;
  tokenAddress?: Address;
}): readonly unknown[] {
  return ['tokenBalance', chainId, accountAddress?.toLowerCase(), tokenAddress?.toLowerCase()];
}

export function constructPublicTokenBalanceQueryKeyForInvalidation({
  chainId,
  accountAddress,
  tokenAddress,
}: {
  chainId: number;
  accountAddress: Address;
  tokenAddress: Address;
}) {
  return constructPublicTokenBalanceQueryKey({
    chainId,
    accountAddress,
    tokenAddress,
  });
}

type UseTokenBalanceInput = {
  /** Token contract address */
  tokenAddress?: Address;
  /** Account address to check balance for (optional, defaults to connected account) */
  accountAddress?: Address;
};

export type UseTokenBalanceOptions<TSelectedData = bigint> = Omit<
  UseQueryOptions<bigint, Error, TSelectedData>,
  'queryKey' | 'queryFn'
>;

export type PublicTokenBalanceSource = {
  address: Address;
  decimals: number;
};

export function getPublicTokenBalanceSource(token: Token | undefined): PublicTokenBalanceSource | undefined {
  const confidentialityType = token?.extensions.fhenix.confidentialityType;
  const underlyingErc20 = token?.extensions.fhenix.erc20Pair;

  const tokenToFetchBalanceFrom =
    confidentialityType === 'wrapped' ? underlyingErc20 : confidentialityType === 'dual' ? token : undefined;

  if (!tokenToFetchBalanceFrom) return undefined;

  return {
    address: tokenToFetchBalanceFrom.address,
    decimals: tokenToFetchBalanceFrom.decimals,
  };
}

export function createPublicTokenBalanceQueryOptions<TSelectedData = bigint>(params: {
  publicClient: ReturnType<typeof useCofhePublicClient>;
  accountAddress?: Address;
  tokenAddress?: Address;
  queryOptions?: UseTokenBalanceOptions<TSelectedData>;
}): UseQueryOptions<bigint, Error, TSelectedData> {
  const { publicClient, accountAddress, tokenAddress, queryOptions } = params;

  const { enabled: userEnabled, ...restQueryOptions } = queryOptions ?? {};
  const baseEnabled = !!publicClient && !!accountAddress && !!tokenAddress;
  const enabled = baseEnabled && (userEnabled ?? true);

  const queryKey = constructPublicTokenBalanceQueryKey({
    chainId: publicClient?.chain?.id,
    accountAddress,
    tokenAddress,
  });

  return {
    queryKey,
    queryFn: async () => {
      assert(tokenAddress, 'Token address is required to fetch token balance');
      assert(publicClient, 'PublicClient is required to fetch token balance');
      assert(accountAddress, 'Account address is required to fetch token balance');

      const isNativeToken = tokenAddress.toLowerCase() === ETH_ADDRESS.toLowerCase();

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
    refetchOnMount: false,
    ...restQueryOptions,
  };
}

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

  return useInternalQuery(
    createPublicTokenBalanceQueryOptions({
      publicClient,
      accountAddress,
      tokenAddress,
      queryOptions,
    })
  );
}

// ============================================================================
// Unified Public Balance Hook
// ============================================================================

type UsePublicTokenBalanceInput = {
  /** Token from token list */
  token: Token | undefined;
  /** Account address (optional, defaults to connected account) */
  accountAddress?: Address;
  /** Display decimals for formatting (default: 5) */
  displayDecimals?: number;
};

type UsePublicTokenBalanceResult = {
  data?: TokenFormatOutput;
  /** Whether balance is loading */
  isFetching: boolean;
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
export function useCofheTokenPublicBalance(
  { token, accountAddress, displayDecimals = 5 }: UsePublicTokenBalanceInput,
  options?: Omit<UseTokenBalanceOptions, 'select'> // disallow passing 'select' because it's harder to type
): UsePublicTokenBalanceResult {
  const connectedAccount = useCofheAccount();
  const account = accountAddress || connectedAccount;

  const { enabled: userEnabled = true, ...restOptions } = options ?? {};

  const tokenToFetchBalanceFrom = getPublicTokenBalanceSource(token);

  const { data, isFetching, refetch } = useTokenBalance(
    {
      tokenAddress: tokenToFetchBalanceFrom?.address,
      accountAddress: account,
    },
    {
      enabled: userEnabled,
      select: (value) => {
        assert(
          typeof tokenToFetchBalanceFrom?.decimals === 'number',
          'Token decimals must be defined to format public token balance'
        );
        return formatTokenAmount(value, tokenToFetchBalanceFrom.decimals, displayDecimals);
      },
      ...restOptions,
    }
  );

  return {
    data,
    isFetching,
    refetch,
  };
}
