import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { formatUnits, type Address } from 'viem';
import { FheTypes } from '@cofhe/sdk';
import { useCofheAccount, useCofheChainId, useCofhePublicClient } from './useCofheConnection.js';
import { useCofheContext } from '../providers/CofheProvider.js';
import { type Token, ETH_ADDRESS } from './useTokenLists.js';
import { CONFIDENTIAL_ABIS } from '../constants/confidentialTokenABIs.js';
import { ERC20_BALANCE_OF_ABI, ERC20_DECIMALS_ABI, ERC20_SYMBOL_ABI, ERC20_NAME_ABI } from '../constants/erc20ABIs.js';

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
export function useTokenBalance(
  { tokenAddress, decimals, accountAddress, displayDecimals = 5 }: UseTokenBalanceInput,
  queryOptions?: UseTokenBalanceOptions
): UseQueryResult<string, Error> {
  const connectedAccount = useCofheAccount();
  const publicClient = useCofhePublicClient();
  const account = accountAddress || (connectedAccount as Address | undefined);
  
  const { enabled: userEnabled, ...restQueryOptions } = queryOptions ?? {};
  const baseEnabled = !!publicClient && !!account && !!tokenAddress;
  const enabled = baseEnabled && (userEnabled ?? true);

  return useQuery({
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
export function useNativeBalance(
  accountAddress?: Address,
  decimals: number = 18,
  displayDecimals: number = 5,
  queryOptions?: UseTokenBalanceOptions
): UseQueryResult<string, Error> {
  const connectedAccount = useCofheAccount();
  const publicClient = useCofhePublicClient();
  const account = accountAddress || (connectedAccount as Address | undefined);

  return useQuery({
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
export function useTokenMetadata(
  tokenAddress: Address | undefined,
  queryOptions?: Omit<UseQueryOptions<TokenMetadata, Error>, 'queryKey' | 'queryFn' | 'enabled'>
): UseQueryResult<TokenMetadata, Error> {
  const publicClient = useCofhePublicClient();

  return useQuery({
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

      const decimals = results[0].result as number;
      const symbol = results[1].result as string;
      const name = results[2].result as string;

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
export function useTokenDecimals(
  tokenAddress: Address | undefined,
  queryOptions?: Omit<UseQueryOptions<number, Error>, 'queryKey' | 'queryFn' | 'enabled'>
): UseQueryResult<number, Error> {
  const publicClient = useCofhePublicClient();

  return useQuery({
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
export function useTokenSymbol(
  tokenAddress: Address | undefined,
  queryOptions?: Omit<UseQueryOptions<string, Error>, 'queryKey' | 'queryFn' | 'enabled'>
): UseQueryResult<string, Error> {
  const publicClient = useCofhePublicClient();

  return useQuery({
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
 * Hook to get confidential token balance (encrypted balance) and decrypt it
 * Uses confidentialityType from token structure to determine which ABI/function to use:
 * - wrapped: uses `encBalanceOf(address)` function
 * - pure: uses `confidentialBalanceOf(address)` function
 * - dual: uses `TBD_DUAL_FUNCTION_NAME` function
 * @param input - Token object and optional accountAddress
 * @param queryOptions - Optional React Query options
 * @returns Query result with decrypted balance as bigint
 */
export function useTokenConfidentialBalance(
  {
    token,
    accountAddress,
  }: {
    token: Token | undefined;
    accountAddress: Address;
  },
  queryOptions?: Omit<UseQueryOptions<bigint, Error>, 'queryKey' | 'queryFn'>
): UseQueryResult<bigint, Error> {
  const publicClient = useCofhePublicClient();
  const { client } = useCofheContext();

  // Extract values from token object (only if token exists)
  const tokenAddress = token?.address as Address | undefined;
  const confidentialityType = token?.extensions.fhenix.confidentialityType;
  const confidentialValueType = token?.extensions.fhenix.confidentialValueType;

  // Merge enabled conditions: both our internal checks and user-provided enabled must be true
  const baseEnabled =
    !!publicClient && !!accountAddress && !!token && !!tokenAddress && !!confidentialityType && !!confidentialValueType;
  const userEnabled = queryOptions?.enabled ?? true;
  const enabled = baseEnabled && userEnabled;

  // Extract enabled from queryOptions to avoid override
  const { enabled: _, ...restQueryOptions } = queryOptions || {};

  return useQuery({
    queryKey: ['tokenConfidentialBalance', tokenAddress, accountAddress, confidentialityType, confidentialValueType],
    queryFn: async (): Promise<bigint> => {
      if (!publicClient) {
        throw new Error('PublicClient is required to fetch confidential token balance');
      }

      if (!token) {
        throw new Error('Token is required to fetch confidential token balance');
      }

      if (!tokenAddress) {
        throw new Error('Token address is required to fetch confidential token balance');
      }

      if (!confidentialityType) {
        throw new Error('confidentialityType is required in token extensions');
      }

      if (!confidentialValueType) {
        throw new Error('confidentialValueType is required in token extensions');
      }

      // Make sure we have an active permit
      const permit = await client.permits.getOrCreateSelfPermit();
      if (!permit.success) {
        throw permit.error || new Error('Failed to get or create self permit');
      }

      // Get the appropriate ABI and function name based on confidentialityType
      const contractConfig = CONFIDENTIAL_ABIS[confidentialityType];
      if (!contractConfig) {
        throw new Error(`Unsupported confidentialityType: ${confidentialityType}`);
      }

      // Call the appropriate function based on confidentialityType
      const ctHash = (await publicClient.readContract({
        address: tokenAddress,
        abi: contractConfig.abi,
        functionName: contractConfig.functionName,
        args: [accountAddress],
      })) as bigint;

      if (ctHash === 0n) {
        // no ciphertext means no confidential balance
        return 0n;
      }

      // Map confidentialValueType to FheTypes
      const fheType = confidentialValueType === 'uint64' ? FheTypes.Uint64 : FheTypes.Uint128;

      // Decrypt the encrypted balance using SDK
      const unsealedResult = await client.decryptHandle(ctHash, fheType).decrypt();

      if (!unsealedResult.success) {
        throw unsealedResult.error || new Error('Failed to decrypt confidential balance');
      }

      return unsealedResult.data as bigint;
    },
    enabled,
    ...restQueryOptions,
  });
}

/**
 * Hook to get pinned token address for the current chain
 * @returns Pinned token address for current chain, or undefined if none
 */
export function usePinnedTokenAddress(): Address | undefined {
  const widgetConfig = useCofheContext().config.react;
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
export function usePublicTokenBalance(
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
  const { data: nativeBalance, isLoading: isLoadingNative, refetch: refetchNative } = useNativeBalance(
    account as Address,
    18,
    displayDecimals,
    { enabled: userEnabled && !!account && isWrappedToken && isNativeEthPair, ...restOptions }
  );

  // ERC20 balance for wrapped tokens (from erc20Pair address)
  const { data: wrappedErc20Balance, isLoading: isLoadingWrappedErc20, refetch: refetchWrappedErc20 } = useTokenBalance(
    {
      tokenAddress: (erc20Pair?.address ?? '0x') as Address,
      decimals: erc20Pair?.decimals ?? 18,
      accountAddress: account as Address,
      displayDecimals,
    },
    { enabled: userEnabled && !!erc20Pair?.address && !!account && isWrappedToken && !isNativeEthPair, ...restOptions }
  );

  // ERC20 balance for dual tokens (from token's own address)
  const { data: dualPublicBalance, isLoading: isLoadingDualPublic, refetch: refetchDualPublic } = useTokenBalance(
    {
      tokenAddress: (token?.address ?? '0x') as Address,
      decimals: token?.decimals ?? 18,
      accountAddress: account as Address,
      displayDecimals,
    },
    { enabled: userEnabled && !!token?.address && !!account && isDualToken, ...restOptions }
  );

  // Combine results based on token type
  const data = isDualToken
    ? dualPublicBalance
    : isNativeEthPair
      ? nativeBalance
      : wrappedErc20Balance;

  const isLoading = isDualToken
    ? isLoadingDualPublic
    : isNativeEthPair
      ? isLoadingNative
      : isLoadingWrappedErc20;

  const refetch = isDualToken
    ? refetchDualPublic
    : isNativeEthPair
      ? refetchNative
      : refetchWrappedErc20;

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
  token: Token | null | undefined;
  /** Account address (optional, defaults to connected account) */
  accountAddress?: Address;
  /** Display decimals for formatting (default: 5) */
  displayDecimals?: number;
};

type UseConfidentialTokenBalanceOptions = Omit<UseQueryOptions<bigint, Error>, 'queryKey' | 'queryFn'> & {
  enabled?: boolean;
};

type UseConfidentialTokenBalanceResult = {
  /** Raw balance in smallest unit (bigint) */
  data: bigint | undefined;
  /** Formatted balance string */
  formatted: string | undefined;
  /** Numeric balance value */
  numericValue: number;
  /** Whether balance is loading */
  isLoading: boolean;
  /** Refetch function */
  refetch: () => Promise<unknown>;
};

/**
 * Hook to get confidential (encrypted) balance for a token with convenient formatting.
 * 
 * @param input - Token and optional account address
 * @param options - Query options
 * @returns Balance data with raw bigint, formatted string, numeric value, loading state, and refetch function
 */
export function useConfidentialTokenBalance(
  { token, accountAddress, displayDecimals = 5 }: UseConfidentialTokenBalanceInput,
  options?: UseConfidentialTokenBalanceOptions
): UseConfidentialTokenBalanceResult {
  const { enabled: userEnabled = true, ...restOptions } = options ?? {};

  const { data, isLoading, refetch } = useTokenConfidentialBalance(
    {
      token: token ?? undefined,
      accountAddress: accountAddress as Address,
    },
    { enabled: userEnabled && !!token, ...restOptions }
  );

  const decimals = token?.decimals ?? 18;
  
  const formatted = data !== undefined
    ? parseFloat(formatUnits(data, decimals)).toFixed(displayDecimals)
    : undefined;

  const numericValue = formatted ? parseFloat(formatted) : 0;

  return {
    data,
    formatted,
    numericValue,
    isLoading,
    refetch,
  };
}
