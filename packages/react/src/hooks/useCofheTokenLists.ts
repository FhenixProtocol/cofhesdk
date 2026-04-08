import { type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { useCofheContext } from '../providers/CofheProvider';
import { useMemo } from 'react';
import { ETH_ADDRESS_LOWERCASE, type Erc20Pair, type Token } from '../types/token.js';
import { useInternalQueries, useInternalQuery } from '../providers/index.js';
import { type Address, isAddress, parseAbi, zeroAddress } from 'viem';
import { useCofheChainId, useCofhePublicClient } from './useCofheConnection';
import { useCustomTokensStore } from '@/stores/customTokensStore';
import { ERC20_BALANCE_OF_ABI, ERC20_DECIMALS_ABI, ERC20_NAME_ABI, ERC20_SYMBOL_ABI } from '@/constants/erc20ABIs';
import { CONFIDENTIAL_TYPE_PURE_ABI, CONFIDENTIAL_TYPE_WRAPPED_ABI } from '@/constants/confidentialTokenABIs';

export { ETH_ADDRESS_LOWERCASE, type Token, type Erc20Pair };

type TokenList = {
  name: string;
  timestamp: string;
  version: {
    major: number;
    minor: number;
    patch: number;
  };
  tokens: Token[];
};

type UseTokenListsResult = UseQueryResult<TokenList, Error>[];
type UseTokenListsInput = {
  chainId?: number;
};
type UseTokenListsOptions = Omit<UseQueryOptions<TokenList, Error>, 'queryKey' | 'queryFn' | 'select'>;

const TOKEN_PAIR_GETTER_ABIS = {
  token: parseAbi(['function token() view returns (address)']),
  underlying: parseAbi(['function underlying() view returns (address)']),
  underlyingToken: parseAbi(['function underlyingToken() view returns (address)']),
  asset: parseAbi(['function asset() view returns (address)']),
  erc20: parseAbi(['function erc20() view returns (address)']),
  erc20Token: parseAbi(['function erc20Token() view returns (address)']),
} as const;

const PAIR_GETTER_ENTRIES = [
  ['token', TOKEN_PAIR_GETTER_ABIS.token],
  ['underlying', TOKEN_PAIR_GETTER_ABIS.underlying],
  ['underlyingToken', TOKEN_PAIR_GETTER_ABIS.underlyingToken],
  ['asset', TOKEN_PAIR_GETTER_ABIS.asset],
  ['erc20', TOKEN_PAIR_GETTER_ABIS.erc20],
  ['erc20Token', TOKEN_PAIR_GETTER_ABIS.erc20Token],
] as const;

function getCustomTokensForChain(customTokensByChainId: Record<string, Token[]>, chainId?: number): Token[] {
  if (!chainId) return [];
  return customTokensByChainId[chainId.toString()] ?? [];
}

function pickUnderlyingPairAddress(results: readonly unknown[], tokenAddress: Address): Address | undefined {
  for (const result of results) {
    if (!result || typeof result !== 'object') continue;

    const typedResult = result as { status?: unknown; result?: unknown };
    if (typedResult.status !== 'success') continue;

    const candidate = typedResult.result;
    if (typeof candidate !== 'string' || !isAddress(candidate)) continue;
    if (candidate.toLowerCase() === zeroAddress) continue;
    if (candidate.toLowerCase() === tokenAddress.toLowerCase()) continue;
    return candidate;
  }

  return undefined;
}

type UseResolvedCofheTokenInput = {
  chainId?: number;
  address?: Address;
};

type UseResolvedCofheTokenOptions = Omit<UseQueryOptions<Token | undefined, Error>, 'queryKey' | 'queryFn'>;

export function useResolvedCofheToken(
  { chainId: _chainId, address }: UseResolvedCofheTokenInput,
  queryOptions?: UseResolvedCofheTokenOptions
) {
  const publicClient = useCofhePublicClient();
  const cofheChainId = useCofheChainId();
  const chainId = _chainId ?? cofheChainId;

  return useInternalQuery({
    queryKey: ['resolvedCofheToken', chainId, address?.toLowerCase()],
    queryFn: async (): Promise<Token | undefined> => {
      if (!publicClient) {
        throw new Error('PublicClient is required to resolve a token');
      }
      if (!chainId || !address) {
        return undefined;
      }

      const metadataResults = await publicClient.multicall({
        contracts: [
          {
            address,
            abi: ERC20_DECIMALS_ABI,
            functionName: 'decimals',
          },
          {
            address,
            abi: ERC20_SYMBOL_ABI,
            functionName: 'symbol',
          },
          {
            address,
            abi: ERC20_NAME_ABI,
            functionName: 'name',
          },
        ],
      });

      const decimals = metadataResults[0].result;
      const symbol = metadataResults[1].result;
      const name = metadataResults[2].result;

      if (decimals == null || symbol == null || name == null) {
        throw new Error('Failed to fetch token metadata');
      }

      const [wrappedProbe, confidentialProbe, publicProbe, pairGetterResults] = await Promise.all([
        publicClient
          .readContract({
            address,
            abi: CONFIDENTIAL_TYPE_WRAPPED_ABI,
            functionName: 'encBalanceOf',
            args: [zeroAddress],
          })
          .then(() => true)
          .catch(() => false),
        publicClient
          .readContract({
            address,
            abi: CONFIDENTIAL_TYPE_PURE_ABI,
            functionName: 'confidentialBalanceOf',
            args: [zeroAddress],
          })
          .then(() => true)
          .catch(() => false),
        publicClient
          .readContract({
            address,
            abi: ERC20_BALANCE_OF_ABI,
            functionName: 'balanceOf',
            args: [zeroAddress],
          })
          .then(() => true)
          .catch(() => false),
        publicClient.multicall({
          contracts: PAIR_GETTER_ENTRIES.map(([, abi]) => ({
            address,
            abi,
            functionName: abi[0].name,
          })),
          allowFailure: true,
        }),
      ]);

      const supportsWrappedBalance = wrappedProbe;
      const supportsConfidentialBalance = confidentialProbe;
      const supportsPublicBalance = publicProbe;

      if (!supportsWrappedBalance && !supportsConfidentialBalance) {
        throw new Error('Address is not a supported CoFHE token');
      }

      const confidentialityType = supportsWrappedBalance ? 'wrapped' : supportsPublicBalance ? 'dual' : 'pure';

      const extensions: Token['extensions'] = {
        fhenix: {
          confidentialityType,
          confidentialValueType: confidentialityType === 'wrapped' ? 'uint128' : 'uint64',
        },
      };

      if (confidentialityType === 'wrapped') {
        const pairAddress = pickUnderlyingPairAddress(pairGetterResults, address);
        if (pairAddress) {
          if (pairAddress.toLowerCase() === ETH_ADDRESS_LOWERCASE) {
            extensions.fhenix.erc20Pair = {
              address: ETH_ADDRESS_LOWERCASE,
              symbol: 'ETH',
              decimals: 18,
            };
          } else {
            const pairMetadata = await publicClient.multicall({
              contracts: [
                {
                  address: pairAddress,
                  abi: ERC20_DECIMALS_ABI,
                  functionName: 'decimals',
                },
                {
                  address: pairAddress,
                  abi: ERC20_SYMBOL_ABI,
                  functionName: 'symbol',
                },
              ],
              allowFailure: true,
            });

            const pairDecimals = pairMetadata[0]?.status === 'success' ? pairMetadata[0].result : undefined;
            const pairSymbol = pairMetadata[1]?.status === 'success' ? pairMetadata[1].result : undefined;

            if (pairDecimals != null && pairSymbol != null) {
              extensions.fhenix.erc20Pair = {
                address: pairAddress,
                symbol: pairSymbol,
                decimals: pairDecimals,
              };
            }
          }
        }
      }

      return {
        chainId,
        address,
        decimals,
        symbol,
        name,
        extensions,
      };
    },
    enabled: (queryOptions?.enabled ?? true) && !!publicClient && !!chainId && !!address,
    staleTime: Infinity,
    ...queryOptions,
  });
}

// Returns array of query results for token lists for the current network
export function useCofheTokenLists(
  { chainId }: UseTokenListsInput,
  queryOptions?: UseTokenListsOptions
): UseTokenListsResult {
  const widgetConfig = useCofheContext().client.config.react;
  const tokensListsUrls = chainId ? widgetConfig.tokenLists?.[chainId] : [];

  const queriesOptions: UseQueryOptions<TokenList, Error>[] =
    tokensListsUrls?.map((url) => ({
      cacheTime: Infinity,
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      queryKey: ['tokenList', chainId, url],
      queryFn: async ({ signal }): Promise<TokenList> => {
        const timestamp = Date.now();
        const urlWithCacheBust = `${url}${url.includes('?') ? '&' : '?'}v=${timestamp}`;
        const res = await fetch(urlWithCacheBust, { signal });
        if (!res.ok) {
          throw new Error(`Failed to fetch token list: ${res.status} ${res.statusText}`);
        }
        return await res.json();
      },
      select: (data: TokenList): TokenList => {
        // filter only tokens for the current chain (some lists contain multiple chains)
        return {
          ...data,
          tokens: data.tokens.filter((token) => token.chainId === chainId),
        };
      },
      ...queryOptions,
    })) || [];

  const result = useInternalQueries({
    queries: queriesOptions,
  });

  return result;
}

export function selectTokensFromTokensList(tokenList: TokenList): Token[] {
  return tokenList.tokens;
}

export function useCofheTokens(chainId?: number): Token[] {
  const tokenLists = useCofheTokenLists({ chainId });
  const customTokensByChainId = useCustomTokensStore((state) => state.customTokensByChainId);
  const customTokens = getCustomTokensForChain(customTokensByChainId, chainId);

  const tokens = useMemo(() => {
    const map = new Map<string, Token>();

    tokenLists.forEach((result) => {
      if (!result.data) return;

      result.data.tokens.forEach((token) => {
        const key = `${token.chainId}-${token.address.toLowerCase()}`;
        if (map.has(key)) return;
        map.set(key, token);
      });
    });

    customTokens.forEach((token) => {
      const key = `${token.chainId}-${token.address.toLowerCase()}`;
      if (map.has(key)) return;
      map.set(key, token);
    });

    return Array.from(map.values());
  }, [customTokens, tokenLists]);
  return tokens;
}

export function useCofheToken(
  { chainId: _chainId, address }: { chainId?: number; address?: Address },
  // TODO: after adding this functionality, don't fetch if not enabled
  metdataQueryOptions?: Omit<UseQueryOptions<Token | undefined, Error>, 'queryKey' | 'queryFn' | 'select'>
) {
  const cofheChainId = useCofheChainId();
  const chainId = _chainId ?? cofheChainId;

  const tokens = useCofheTokens(chainId);
  const tokenFromList = useMemo(() => {
    if (!address || !chainId) return;
    return tokens.find((t) => t.chainId === chainId && t.address.toLowerCase() === address.toLowerCase());
  }, [address, chainId, tokens]);

  const resolvedToken = useResolvedCofheToken(
    {
      chainId,
      address,
    },
    {
      ...metdataQueryOptions,
      enabled: (metdataQueryOptions?.enabled ?? true) && !!address && !!chainId && !tokenFromList,
    }
  );

  return tokenFromList ?? resolvedToken.data;
}
