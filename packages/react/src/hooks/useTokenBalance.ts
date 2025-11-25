import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import type { Address, Abi } from 'viem';
import { parseAbi } from 'viem';
import { FheTypes } from '@cofhe/sdk';
import { useCofheAccount, useCofheChainId, useCofhePublicClient } from './useCofheConnection.js';
import { useCofheContext } from '../providers/CofheProvider.js';
import { detectContractType, getSelectorsFromAbi } from './useTokenContractDetection.js';

// ERC20 ABIs
const ERC20_BALANCE_OF_ABI = parseAbi(['function balanceOf(address owner) view returns (uint256)']);
const ERC20_DECIMALS_ABI = parseAbi(['function decimals() view returns (uint8)']);
const ERC20_SYMBOL_ABI = parseAbi(['function symbol() view returns (string)']);
const ERC20_NAME_ABI = parseAbi(['function name() view returns (string)']);

// Confidential token ABIs for different contract types
const CONFIDENTIAL_TYPE_A_ABI = parseAbi(['function encBalanceOf(address account) view returns (uint256)']); // Used in Redact
const CONFIDENTIAL_TYPE_B_ABI = parseAbi(['function confidentialBalanceOf(address account) view returns (uint256)']); // Used in Base mini app (402)

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

type UseTokenBalanceOptions = Omit<
  UseQueryOptions<string, Error>,
  'queryKey' | 'queryFn' | 'enabled'
>;

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

      // Normalize by decimals: divide by 10^decimals
      const divisor = BigInt(10 ** decimals);
      const normalizedValue = Number(balance) / Number(divisor);

      // Format as string with limited decimal places
      // Use displayDecimals places, but remove trailing zeros
      return normalizedValue.toFixed(displayDecimals).replace(/\.?0+$/, '');
    },
    enabled: !!publicClient && !!account && !!tokenAddress,
    ...queryOptions,
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

      // Normalize by decimals: divide by 10^decimals
      const divisor = BigInt(10 ** decimals);
      const normalizedValue = Number(balance) / Number(divisor);

      // Format as string with limited decimal places
      return normalizedValue.toFixed(displayDecimals).replace(/\.?0+$/, '');
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


const CONFIDENTIAL_TYPE_SELECTORS = {
  TypeA: (abi: Abi) => getSelectorsFromAbi(abi, ['encBalanceOf']),
  TypeB: (abi: Abi) => getSelectorsFromAbi(abi, ['confidentialBalanceOf']),
};

const CONFIDENTIAL_ABIS = {
  TypeA: CONFIDENTIAL_TYPE_A_ABI,
  TypeB: CONFIDENTIAL_TYPE_B_ABI,
};

/**
 * Hook to get confidential token balance (encrypted balance) and decrypt it
 * Supports multiple contract types:
 * - TypeA: uses `encBalanceOf(address)` function
 * - TypeB: uses `confidentialBalanceOf(address)` function
 * @param input - Token address and optional accountAddress
 * @param queryOptions - Optional React Query options
 * @returns Query result with decrypted balance as bigint
 */
export function useTokenConfidentialBalance(
  { tokenAddress, accountAddress }: { tokenAddress: Address; accountAddress?: Address },
  queryOptions?: Omit<UseQueryOptions<bigint, Error>, 'queryKey' | 'queryFn' | 'enabled'>
): UseQueryResult<bigint, Error> {
  const connectedAccount = useCofheAccount();
  const publicClient = useCofhePublicClient();
  const { client } = useCofheContext();
  const account = accountAddress || (connectedAccount as Address | undefined);

  return useQuery({
    queryKey: ['tokenConfidentialBalance', tokenAddress, account],
    queryFn: async (): Promise<bigint> => {
      if (!publicClient) {
        throw new Error('PublicClient is required to fetch confidential token balance');
      }
      if (!account) {
        throw new Error('Account address is required to fetch confidential token balance');
      }
      if (!tokenAddress) {
        throw new Error('Token address is required');
      }
      if (!client) {
        throw new Error('CoFHE client is required to decrypt confidential balance');
      }

      // Make sure we have an active permit
      const permit = await client.permits.getOrCreateSelfPermit();
      if (!permit.success) {
        throw permit.error || new Error('Failed to get or create self permit');
      }

      console.log('permit', permit);

      // Detect contract type
      const type = await detectContractType(
        tokenAddress,
        publicClient,
        CONFIDENTIAL_TYPE_SELECTORS,
        CONFIDENTIAL_ABIS
      );

      if (!type) {
        throw new Error(`Unknown confidential token type for ${tokenAddress}. Could not detect TypeA or TypeB.`);
      }

      console.log('type', type);

      // Call the appropriate function based on detected type
      let ctHash: bigint;
      switch (type) {
        case 'TypeA': {
          ctHash = (await publicClient.readContract({
            address: tokenAddress,
            abi: CONFIDENTIAL_TYPE_A_ABI,
            functionName: 'encBalanceOf',
            args: [account],
          })) as bigint;
          break;
        }
        case 'TypeB': {
          ctHash = (await publicClient.readContract({
            address: tokenAddress,
            abi: CONFIDENTIAL_TYPE_B_ABI,
            functionName: 'confidentialBalanceOf',
            args: [account],
          })) as bigint;
          break;
        }
        default:
          throw new Error(`Unsupported confidential token type: ${type}`);
      }

      console.log('ctHash', ctHash);

      // Decrypt the encrypted balance using SDK
      const unsealedResult = await client
        .decryptHandle(ctHash, FheTypes.Uint128)
        .decrypt();

      console.log('unsealedResult', unsealedResult);

      if (!unsealedResult.success) {
        throw unsealedResult.error || new Error('Failed to decrypt confidential balance');
      }

      return unsealedResult.data as bigint;
    },
    enabled: !!publicClient && !!account && !!tokenAddress && !!client,
    ...queryOptions,
  });
}

/**
 * Hook to get pinned token address for the current chain
 * @returns Pinned token address for current chain, or undefined if none
 */
export function usePinnedTokenAddress(): Address | undefined {
  const widgetConfig = useCofheContext().config.react;
  const chainId = useCofheChainId();

  if (!chainId || !widgetConfig?.pinnedTokens) {
    return undefined;
  }

  const pinnedTokenAddress = widgetConfig.pinnedTokens[chainId.toString()];
  return pinnedTokenAddress as Address | undefined;
}

