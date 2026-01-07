import { type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { formatUnits, type Address, type Abi } from 'viem';
import { FheTypes } from '@cofhe/sdk';
import { useCofheAccount, useCofheChainId, useCofhePublicClient } from './useCofheConnection';
import { useCofheContext } from '../providers/CofheProvider';
import { type Token, ETH_ADDRESS } from './useCofheTokenLists';
import { CONFIDENTIAL_ABIS } from '../constants/confidentialTokenABIs';
import { ERC20_BALANCE_OF_ABI, ERC20_DECIMALS_ABI, ERC20_SYMBOL_ABI, ERC20_NAME_ABI } from '../constants/erc20ABIs';
import { ErrorCause } from '@/utils/errors';
import { useCofheActivePermit } from './useCofhePermits';
import { assert } from 'ts-essentials';
import { useIsCofheErrorActive } from './useIsCofheErrorActive';
import { useInternalQuery } from '../providers/index';
import { useCofheDecrypt } from './useCofheDecrypt';
import BigNumber from 'bignumber.js';
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

export type TokenMetadata = {
  decimals: number;
  symbol: string;
  name: string;
};

/**
 * Hook to get token metadata (decimals, symbol, and name) from ERC20 contract using multicall
 * @param tokenAddress - Token contract address
 * @param queryOptions - Optional React Query options
 * @returns Query result with token metadata (decimals, symbol, and name)
 */
export function useCofheTokenMetadata(
  tokenAddress: Address | undefined,
  queryOptions?: Omit<UseQueryOptions<TokenMetadata, Error>, 'queryKey' | 'queryFn' | 'enabled'>
): UseQueryResult<TokenMetadata, Error> {
  const publicClient = useCofhePublicClient();

  return useInternalQuery({
    queryKey: ['tokenMetadata', tokenAddress],
    queryFn: async (): Promise<TokenMetadata> => {
      if (!publicClient) {
        throw new Error('PublicClient is required to fetch token metadata');
      }
      if (!tokenAddress) {
        throw new Error('Token address is required');
      }

      // Use multicall to fetch decimals, symbol, and name in a single RPC call
      const results = await publicClient.multicall({
        contracts: [
          {
            address: tokenAddress,
            abi: ERC20_DECIMALS_ABI,
            functionName: 'decimals',
          },
          {
            address: tokenAddress,
            abi: ERC20_SYMBOL_ABI,
            functionName: 'symbol',
          },
          {
            address: tokenAddress,
            abi: ERC20_NAME_ABI,
            functionName: 'name',
          },
        ],
      });

      const decimals = results[0].result;
      const symbol = results[1].result;
      const name = results[2].result;

      if (decimals === undefined || symbol === undefined || name === undefined) {
        throw new Error('Failed to fetch token metadata');
      }

      return { decimals, symbol, name };
    },
    enabled: !!publicClient && !!tokenAddress,
    ...queryOptions,
  });
}

type UseCofheReadContractQueryOptions = Omit<UseQueryOptions<bigint, Error>, 'queryKey' | 'queryFn'>;
/**
 * Generic hook: read a contract and return the result (with permit/error gating support).
 */
export function useCofheReadContract(
  params: {
    address?: Address;
    abi?: Abi;
    functionName?: string;
    args?: readonly unknown[];
    requiresPermit?: boolean;
  },
  queryOptions?: UseCofheReadContractQueryOptions
): UseQueryResult<bigint, Error> & { disabledDueToMissingPermit: boolean } {
  const { address, abi, functionName, args, requiresPermit = true } = params;

  const isCofheErrorActive = useIsCofheErrorActive();
  const publicClient = useCofhePublicClient();
  const cofheChainId = useCofheChainId();
  const activePermit = useCofheActivePermit();

  const { enabled: userEnabled, ...restQueryOptions } = queryOptions || {};
  const enabled =
    !isCofheErrorActive &&
    !!publicClient &&
    !!address &&
    !!abi &&
    !!functionName &&
    (!requiresPermit || !!activePermit) &&
    (userEnabled ?? true);

  const result = useInternalQuery({
    enabled,
    queryKey: [
      'cofheReadContract',
      cofheChainId,
      address,
      functionName,
      args ?? [],
      requiresPermit ? activePermit?.hash : undefined,
      // normally, "enabled" shouldn't be part of queryKey, but without adding it, there is a weird bug: when there's a CofheError, query still running queryFn resulting in the blank screen
      enabled,
    ],
    queryFn: async () => {
      assert(address, 'Contract address should be guaranteed by enabled check');
      assert(publicClient, 'PublicClient should be guaranteed by enabled check');
      assert(abi, 'ABI should be guaranteed by enabled check');
      assert(functionName, 'Function name should be guaranteed by enabled check');

      const out = await publicClient.readContract({
        address,
        abi,
        functionName,
        args,
      });

      assert(typeof out === 'bigint', 'Expected confidential contract read result to be bigint');
      return out;
    },
    ...restQueryOptions,
  });

  return {
    ...result,
    disabledDueToMissingPermit: requiresPermit && !activePermit,
  };
}

/**
 * Generic hook: read a confidential contract value and decrypt it.
 */
export function useCofheReadContractAndDecrypt<TDecryptedSelectedData = bigint>(
  params: {
    address?: Address;
    abi?: Abi;
    functionName?: string;
    args?: readonly unknown[];
    fheType: FheTypes;
    requiresPermit?: boolean;
  },
  {
    readQueryOptions,
    decryptingQueryOptions,
  }: {
    readQueryOptions?: UseCofheReadContractQueryOptions;
    decryptingQueryOptions?: Omit<
      UseQueryOptions<string | bigint | boolean, Error, TDecryptedSelectedData>,
      'queryKey' | 'queryFn'
    >;
  } = {}
): {
  encrypted: UseQueryResult<bigint, Error>;
  decrypted: UseQueryResult<TDecryptedSelectedData, Error>;
  disabledDueToMissingPermit: boolean;
} {
  const { address, abi, functionName, args, fheType, requiresPermit = true } = params;

  const encrypted = useCofheReadContract({ address, abi, functionName, args, requiresPermit }, readQueryOptions);

  const decrypted = useCofheDecrypt(
    {
      ciphertext: encrypted.data,
      fheType,
      cause: ErrorCause.AttemptToFetchConfidentialBalance,
    },
    decryptingQueryOptions
  );

  return {
    encrypted,
    decrypted,
    disabledDueToMissingPermit: encrypted.disabledDueToMissingPermit,
  };
}

/**
 * Hook to get pinned token address for the current chain
 * @returns Pinned token address for current chain, or undefined if none
 */
export function useCofhePinnedTokenAddress(): Address | undefined {
  const widgetConfig = useCofheContext().client.config.react;
  const chainId = useCofheChainId();

  if (!chainId) {
    return undefined;
  }

  const pinnedTokenAddress = widgetConfig.pinnedTokens[chainId.toString()];
  return pinnedTokenAddress;
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
  isLoading: boolean;
  /** Refetch function */
  refetch: () => Promise<unknown>;
  disabledDueToMissingPermit: boolean;
};

type TokenFormatOutput = {
  /** Raw balance in smallest unit (bigint) */
  wei: bigint;
  /** Numeric balance value */
  unit: BigNumber;
  /** Formatted balance string */
  formatted: string;
};

function formatTokenAmount(amount: bigint, decimals: number, displayDecimals?: number): TokenFormatOutput {
  const amountBN = new BigNumber(amount).dividedBy(10 ** decimals);
  return {
    wei: amount,
    unit: amountBN,
    formatted: displayDecimals ? amountBN.toFixed(displayDecimals) : amountBN.toFixed(), // the only precise way, without parseFloat
  };
}

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

  const contractConfig = token ? CONFIDENTIAL_ABIS[token.extensions.fhenix.confidentialityType] : undefined;

  const {
    decrypted: { data: decryptedData, isLoading: isDecryptionLoading },
    encrypted: { isLoading: isEncryptedLoading, refetch: refetchCiphertext },
    disabledDueToMissingPermit,
  } = useCofheReadContractAndDecrypt(
    {
      address: token?.address,
      abi: contractConfig?.abi,
      functionName: contractConfig?.functionName || '',
      args: [accountAddress],
      fheType,
      requiresPermit: true,
    },
    {
      readQueryOptions: {
        enabled: userEnabled && !!token,
      },
      decryptingQueryOptions: {
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

    isLoading: isDecryptionLoading || isEncryptedLoading,
    refetch: refetchCiphertext,
  };
}
