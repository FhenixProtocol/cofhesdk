import { type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { formatUnits, type Address } from 'viem';
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
type UseTokenBalanceInput = {
  /** Token contract address */
  tokenAddress: Address;
  /** Token decimals (e.g., 18 for ETH, 6 for USDC) */
  decimals: number;
  /** Account address to check balance for (optional, defaults to connected account) */
  accountAddress?: Address;
  /** Maximum number of decimal places to display (default: 5) */
  displayDecimals?: number;
};

type UseTokenBalanceOptions = Omit<UseQueryOptions<string, Error>, 'queryKey' | 'queryFn'> & {
  /** Whether to enable the query (combined with internal enabled check) */
  enabled?: boolean;
};

/**
 * Hook to get ERC20 token balance and return normalized display value
 * @param input - Token address, decimals, and optional publicClient/accountAddress
 * @param queryOptions - Optional React Query options
 * @returns Query result with normalized balance as string
 */
export function useCofheTokenBalance(
  { tokenAddress, decimals, accountAddress, displayDecimals = 5 }: UseTokenBalanceInput,
  queryOptions?: UseTokenBalanceOptions
): UseQueryResult<string, Error> {
  const connectedAccount = useCofheAccount();
  const publicClient = useCofhePublicClient();
  const account = accountAddress || (connectedAccount as Address | undefined);

  const { enabled: userEnabled, ...restQueryOptions } = queryOptions ?? {};
  const baseEnabled = !!publicClient && !!account && !!tokenAddress;
  const enabled = baseEnabled && (userEnabled ?? true);

  return useInternalQuery({
    queryKey: ['tokenBalance', tokenAddress, account, decimals, displayDecimals],
    queryFn: async (): Promise<string> => {
      if (!publicClient) {
        throw new Error('PublicClient is required to fetch token balance');
      }
      if (!account) {
        throw new Error('Account address is required to fetch token balance');
      }

      // Read balance from contract
      const balance = (await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_BALANCE_OF_ABI,
        functionName: 'balanceOf',
        args: [account],
      })) as bigint;

      return parseFloat(formatUnits(balance, decimals)).toFixed(displayDecimals);
    },
    enabled,
    ...restQueryOptions,
  });
}

/**
 * Hook to get native coin balance (ETH, etc.) and return normalized display value
 * @param accountAddress - Account address (optional, defaults to connected account)
 * @param decimals - Decimals for native coin (default: 18)
 * @param displayDecimals - Maximum number of decimal places to display (default: 5)
 * @param queryOptions - Optional React Query options
 * @returns Query result with normalized balance as string
 */
export function useCofheNativeBalance(
  accountAddress?: Address,
  decimals: number = 18,
  displayDecimals: number = 5,
  queryOptions?: UseTokenBalanceOptions
): UseQueryResult<string, Error> {
  const connectedAccount = useCofheAccount();
  const publicClient = useCofhePublicClient();
  const account = accountAddress || (connectedAccount as Address | undefined);

  return useInternalQuery({
    queryKey: ['nativeBalance', account, decimals, displayDecimals],
    queryFn: async (): Promise<string> => {
      if (!publicClient) {
        throw new Error('PublicClient is required to fetch native balance');
      }
      if (!account) {
        throw new Error('Account address is required to fetch native balance');
      }

      // Get native balance
      const balance = await publicClient.getBalance({
        address: account,
      });

      return parseFloat(formatUnits(balance, decimals)).toFixed(displayDecimals);
    },
    enabled: !!publicClient && !!account,
    ...queryOptions,
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

/**
 * Hook to get token decimals from ERC20 contract
 * @param tokenAddress - Token contract address
 * @param queryOptions - Optional React Query options
 * @returns Query result with decimals as number
 */
export function useCofheTokenDecimals(
  tokenAddress: Address | undefined,
  queryOptions?: Omit<UseQueryOptions<number, Error>, 'queryKey' | 'queryFn' | 'enabled'>
): UseQueryResult<number, Error> {
  const publicClient = useCofhePublicClient();

  return useInternalQuery({
    queryKey: ['tokenDecimals', tokenAddress],
    queryFn: async (): Promise<number> => {
      if (!publicClient) {
        throw new Error('PublicClient is required to fetch token decimals');
      }
      if (!tokenAddress) {
        throw new Error('Token address is required');
      }

      const decimals = (await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_DECIMALS_ABI,
        functionName: 'decimals',
      })) as number;

      return decimals;
    },
    enabled: !!publicClient && !!tokenAddress,
    ...queryOptions,
  });
}

/**
 * Hook to get token symbol from ERC20 contract
 * @param tokenAddress - Token contract address
 * @param queryOptions - Optional React Query options
 * @returns Query result with symbol as string
 */
export function useCofheTokenSymbol(
  tokenAddress: Address | undefined,
  queryOptions?: Omit<UseQueryOptions<string, Error>, 'queryKey' | 'queryFn' | 'enabled'>
): UseQueryResult<string, Error> {
  const publicClient = useCofhePublicClient();

  return useInternalQuery({
    queryKey: ['tokenSymbol', tokenAddress],
    queryFn: async (): Promise<string> => {
      if (!publicClient) {
        throw new Error('PublicClient is required to fetch token symbol');
      }
      if (!tokenAddress) {
        throw new Error('Token address is required');
      }

      const symbol = (await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_SYMBOL_ABI,
        functionName: 'symbol',
      })) as string;

      return symbol;
    },
    enabled: !!publicClient && !!tokenAddress,
    ...queryOptions,
  });
}

/**
 * Hook to fetch a confidential (encrypted) token balance from chain.
 * Uses confidentialityType from token to determine contract and function.
 * @param input - Token object and optional accountAddress
 * @param queryOptions - Optional React Query options
 * @returns Query result with ciphertext bigint
 */
function useCofheTokenConfidentialBalance(
  {
    token,
    accountAddress,
  }: {
    token: Token | undefined;
    accountAddress?: Address;
  },
  queryOptions?: Omit<UseQueryOptions<bigint, Error>, 'queryKey' | 'queryFn'>
): UseQueryResult<bigint, Error> & {
  disabledDueToMissingPermit: boolean;
} {
  const isCofheErrorActive = useIsCofheErrorActive();
  const publicClient = useCofhePublicClient();
  const cofheChainId = useCofheChainId();
  const activePermit = useCofheActivePermit();

  const { enabled: userEnabled, ...restQueryOptions } = queryOptions || {};
  const enabled =
    !isCofheErrorActive && !!publicClient && !!accountAddress && !!token && !!activePermit && (userEnabled ?? true);

  const result = useInternalQuery({
    enabled,
    queryKey: [
      'tokenEncryptedBalance',
      accountAddress,
      cofheChainId,
      token?.address,
      activePermit?.hash,
      // normally, "enabled" shouldn't be part of queryKey, but without adding it, there is a weird bug: when there's a CofheError, query still running queryFn resulting in the blank screen
      enabled,
    ],
    queryFn: async () => {
      assert(accountAddress, 'Account address is required to fetch confidential token balance');
      assert(publicClient, 'PublicClient is required to fetch confidential token balance');
      assert(token, 'Token is required to fetch confidential token balance');

      // NB: no need to check for Permit validity and existence here. It's part of the 'enabled' and also if something is wrong with the Permit, ErrorBoundary will catch that and will redirect the user to Permit generation page.

      // Throw error if dual type is used (not yet implemented)
      assert(
        token.extensions.fhenix.confidentialityType !== 'dual',
        'Dual confidentiality type is not yet implemented'
      );

      // Get the appropriate ABI and function name based on confidentialityType
      const contractConfig = CONFIDENTIAL_ABIS[token.extensions.fhenix.confidentialityType];

      assert(contractConfig, `Unsupported confidentialityType: ${token.extensions.fhenix.confidentialityType}`);

      // Call the appropriate function based on confidentialityType
      const ctHash = await publicClient.readContract({
        address: token.address,
        abi: contractConfig.abi,
        functionName: contractConfig.functionName,
        args: [accountAddress],
      });

      if (ctHash === 0n) {
        // no ciphertext means no confidential balance
        return 0n;
      }

      return ctHash;
    },
    ...restQueryOptions,
  });

  return {
    ...result,
    disabledDueToMissingPermit: !activePermit,
  };
}

/**
 * Hook to get confidential token balance by composing encrypted fetch + decryption.
 * @param input - Token object and optional accountAddress
 * @param queryOptions - Optional React Query options
 * @returns Query result with decrypted balance as bigint
 */
export function useCofheTokenDecryptedBalance<TDecryptedSelectedData = bigint>(
  {
    token,
    accountAddress,
  }: {
    token: Token | undefined;
    accountAddress?: Address;
  },
  {
    confidentialQueryOptions,
    decryptingQueryOptions,
  }: {
    confidentialQueryOptions?: Omit<UseQueryOptions<bigint, Error>, 'queryKey' | 'queryFn'>;
    decryptingQueryOptions?: Omit<UseQueryOptions<bigint, Error, TDecryptedSelectedData>, 'queryKey' | 'queryFn'>;
  } = {}
): {
  encrypted: UseQueryResult<bigint, Error>;
  decrypted: UseQueryResult<TDecryptedSelectedData, Error>;
  disabledDueToMissingPermit: boolean;
} {
  const encrypted = useCofheTokenConfidentialBalance({ token, accountAddress }, confidentialQueryOptions);

  const fheType = token?.extensions.fhenix.confidentialValueType === 'uint64' ? FheTypes.Uint64 : FheTypes.Uint128;

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
  return pinnedTokenAddress as Address | undefined;
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

type UsePublicTokenBalanceOptions = Omit<UseQueryOptions<string, Error>, 'queryKey' | 'queryFn'> & {
  enabled?: boolean;
};

type UsePublicTokenBalanceResult = {
  /** Formatted balance string */
  data: string | undefined;
  /** Raw numeric balance */
  numericValue: number;
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
  options?: UsePublicTokenBalanceOptions
): UsePublicTokenBalanceResult {
  const connectedAccount = useCofheAccount();
  const account = accountAddress || (connectedAccount as Address | undefined);

  const { enabled: userEnabled = true, ...restOptions } = options ?? {};

  // Determine token type
  const confidentialityType = token?.extensions.fhenix.confidentialityType;
  const isWrappedToken = confidentialityType === 'wrapped';
  const isDualToken = confidentialityType === 'dual';
  const erc20Pair = token?.extensions.fhenix.erc20Pair;
  const isNativeEthPair = erc20Pair?.address?.toLowerCase() === ETH_ADDRESS.toLowerCase();

  // Native ETH balance (for wrapped ETH tokens)
  const {
    data: nativeBalance,
    isLoading: isLoadingNative,
    refetch: refetchNative,
  } = useCofheNativeBalance(account as Address, 18, displayDecimals, {
    enabled: userEnabled && !!account && isWrappedToken && isNativeEthPair,
    ...restOptions,
  });

  // ERC20 balance for wrapped tokens (from erc20Pair address)
  const {
    data: wrappedErc20Balance,
    isLoading: isLoadingWrappedErc20,
    refetch: refetchWrappedErc20,
  } = useCofheTokenBalance(
    {
      tokenAddress: (erc20Pair?.address ?? '0x') as Address,
      decimals: erc20Pair?.decimals ?? 18,
      accountAddress: account as Address,
      displayDecimals,
    },
    { enabled: userEnabled && !!erc20Pair?.address && !!account && isWrappedToken && !isNativeEthPair, ...restOptions }
  );

  // ERC20 balance for dual tokens (from token's own address)
  const {
    data: dualPublicBalance,
    isLoading: isLoadingDualPublic,
    refetch: refetchDualPublic,
  } = useCofheTokenBalance(
    {
      tokenAddress: (token?.address ?? '0x') as Address,
      decimals: token?.decimals ?? 18,
      accountAddress: account as Address,
      displayDecimals,
    },
    { enabled: userEnabled && !!token?.address && !!account && isDualToken, ...restOptions }
  );

  // Combine results based on token type
  const data = isDualToken ? dualPublicBalance : isNativeEthPair ? nativeBalance : wrappedErc20Balance;

  const isLoading = isDualToken ? isLoadingDualPublic : isNativeEthPair ? isLoadingNative : isLoadingWrappedErc20;

  const refetch = isDualToken ? refetchDualPublic : isNativeEthPair ? refetchNative : refetchWrappedErc20;

  const numericValue = data ? parseFloat(data) : 0;

  return {
    data,
    numericValue,
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
  data?: bigint;
  /** Formatted balance string */
  formatted?: string;
  /** Numeric balance value */
  numericValue?: number;
  /** Whether balance is loading */
  isLoading: boolean;
  /** Refetch function */
  refetch: () => Promise<unknown>;
  disabledDueToMissingPermit: boolean;
};

export function formatTokenAmount(amount: bigint, decimals: number, displayDecimals: number) {
  const rawUnit = formatUnits(amount, decimals);
  const formatted = parseFloat(rawUnit).toFixed(displayDecimals);
  return {
    wei: amount,
    numeric: parseFloat(formatted),
    formatted,
  };
}

/**
 * Hook to get confidential (encrypted) balance for a token with convenient formatting.
 *
 * @param input - Token and optional account address
 * @param options - Query options
 * @returns Balance data with raw bigint, formatted string, numeric value, loading state, and refetch function
 */
export function useDeprecateMe(
  { token, accountAddress, displayDecimals = 5 }: UseConfidentialTokenBalanceInput,
  options?: UseConfidentialTokenBalanceOptions
): UseConfidentialTokenBalanceResult {
  const { enabled: userEnabled = true, ...restOptions } = options ?? {};

  const {
    decrypted: { data, isLoading, refetch },
    disabledDueToMissingPermit,
  } = useCofheTokenDecryptedBalance(
    {
      token,
      accountAddress,
    },
    {
      confidentialQueryOptions: {
        enabled: userEnabled && !!token,
      },
      decryptingQueryOptions: {
        select: (amountWei) => {
          assert(token, 'Token must be defined to format confidential balance');
          return formatTokenAmount(amountWei, token.decimals, displayDecimals);
        },
      },
      ...restOptions,
    }
  );

  return {
    disabledDueToMissingPermit,

    data: data?.wei,
    formatted: data?.formatted,
    numericValue: data?.numeric,

    isLoading,
    refetch,
  };
}
