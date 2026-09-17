import { getPublicBalanceSourceType } from '@/types/token';
import { formatTokenAmount, type TokenFormatOutput } from '@/utils/format';
import { withInvalidationContext } from '@/utils/invalidationContext';
import { maybeWaitUntilRpcAware } from '@/utils/waitUntilRpcAwareAndReadContract';
import { type UseQueryOptions } from '@tanstack/react-query';
import { assert } from 'ts-essentials';
import { type Address } from 'viem';
import { ERC20_BALANCE_OF_ABI } from '../constants/erc20ABIs';
import { useInternalQuery } from '../providers/index';
import { useCofheAccount, useCofhePublicClient } from './useCofheConnection';
import {
  checksummedOr,
  constructCofheReadContractQueryKey,
  createCofheReadContractQueryOptions,
  type UseCofheReadContractQueryOptions,
} from './useCofheReadContract';
import { ETH_ADDRESS_LOWERCASE, type ConfidentialToken } from './useCofheTokenLists';

type UseTokenBalanceInput = {
  /** Token contract address */
  tokenAddress?: Address;
  /** Account address to check balance for (optional, defaults to connected account) */
  accountAddress?: Address;
};

export type UseTokenBalanceOptions<TSelectedData = bigint> = Omit<
  UseQueryOptions<bigint, Error, TSelectedData>,
  'queryKey' | 'queryFn'
> & {
  // Plain boolean only (no callback form): the query key and the generic read
  // factory need the resolved value at construction time.
  enabled?: boolean;
};

export type PublicTokenBalanceSource = {
  address: Address;
  decimals: number;
};

export function getPublicTokenBalanceSource(
  token: ConfidentialToken | undefined
): PublicTokenBalanceSource | undefined {
  const confidentialityType = token?.extensions.fhenix.confidentialityType;
  const underlyingErc20 = token?.extensions.fhenix.erc20Pair;

  const publicBalanceSourceType = getPublicBalanceSourceType(confidentialityType);
  const tokenToFetchBalanceFrom =
    publicBalanceSourceType === 'erc20Pair' ? underlyingErc20 : publicBalanceSourceType === 'token' ? token : undefined;

  if (!tokenToFetchBalanceFrom) return undefined;

  return {
    address: tokenToFetchBalanceFrom.address,
    decimals: tokenToFetchBalanceFrom.decimals,
  };
}

/// A public token balance is an ORDINARY contract read — `balanceOf(account)` on the token (or
/// the native pseudo-read, keyed at the ETH sentinel address) — and the query built here comes
/// from the generic read factory, so it lives under the standard `cofheReadContract` key grammar.
/// A plain invalidation descriptor `{ address: token, functionName: 'balanceOf' }` reaches it,
/// args-narrowable to one account — no bespoke key vocabulary. (This replaced the
/// `['tokenBalance', …]` family, which forced consumers to couple to a second key shape.)
export function createPublicTokenBalanceQueryOptions<TSelectedData = bigint>(params: {
  publicClient: ReturnType<typeof useCofhePublicClient>;
  accountAddress?: Address;
  tokenAddress?: Address;
  queryOptions?: UseTokenBalanceOptions<TSelectedData>;
}): UseQueryOptions<bigint, Error, TSelectedData> {
  const { publicClient, accountAddress, tokenAddress, queryOptions } = params;

  const { enabled: userEnabled, ...restQueryOptions } = queryOptions ?? {};
  const enabled = !!publicClient && !!accountAddress && !!tokenAddress && (userEnabled ?? true);

  // Canonicalized at the input so the key, the fetch and any args-narrowed
  // invalidation target all meet on the same checksummed account.
  const account = checksummedOr(accountAddress);
  const isNativeToken = !!tokenAddress && tokenAddress.toLowerCase() === ETH_ADDRESS_LOWERCASE;

  if (!isNativeToken) {
    // An ERC20 public balance IS an ordinary `balanceOf(account)` read: delegate to the generic
    // read factory — the exact query (key, block-aware queryFn, recognition meta) that
    // `useCofheReadContract` of the same call would run, shared cache entry included.
    return createCofheReadContractQueryOptions({
      enabled,
      cofheChainId: publicClient?.chain?.id,
      address: tokenAddress,
      abi: ERC20_BALANCE_OF_ABI,
      functionName: 'balanceOf',
      args: account ? [account] : undefined,
      requiresACP: false,
      publicClient,
      queryOptions: { refetchOnMount: false, ...restQueryOptions } as UseCofheReadContractQueryOptions<
        typeof ERC20_BALANCE_OF_ABI,
        'balanceOf'
      >,
    }) as UseQueryOptions<bigint, Error, TSelectedData>;
  }

  // The native balance has no contract behind it — `eth_getBalance`, not `eth_call` — so only
  // the queryFn stays bespoke. Everything else is the generic read shape: the key comes from the
  // generic builder (a pseudo-read of `balanceOf(account)` at the ETH sentinel address), so
  // invalidation descriptors and cache tooling see just another read.
  return {
    enabled,
    meta: { kind: 'cofheRead', chainId: publicClient?.chain?.id, address: tokenAddress, functionName: 'balanceOf' },
    queryKey: constructCofheReadContractQueryKey({
      cofheChainId: publicClient?.chain?.id,
      address: tokenAddress,
      functionName: 'balanceOf',
      args: account ? [account] : undefined,
      requiresACP: false,
    }),
    queryFn: withInvalidationContext<readonly unknown[], { blockHashToBeAwareOf: `0x${string}` }, bigint>(
      async ({ invalidationContext, signal }) => {
        assert(publicClient, 'PublicClient is required to fetch native balance');
        assert(account, 'Account address is required to fetch native balance');

        return maybeWaitUntilRpcAware(
          publicClient,
          {
            blockHashToBeAwareOf: invalidationContext?.blockHashToBeAwareOf,
            readDescription: 'read native balance',
            read: () => publicClient.getBalance({ address: account }),
          },
          { signal }
        );
      }
    ),
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
  token: ConfidentialToken | undefined;
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
 * Handles wrapped tokens by reading the paired ERC20 balance or native ETH balance.
 *
 * @param input - token and optional account address
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
          'ConfidentialToken decimals must be defined to format public token balance'
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
