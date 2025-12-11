import { useQueries, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { useCofheContext } from '../providers/CofheProvider';
import { useMemo } from 'react';

/**
 * Special address representing native ETH (used in erc20Pair for ConfidentialETH tokens)
 */
export const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' as const;

/**
 * ERC20 pair information for wrapped confidential tokens
 */
export type Erc20Pair = {
  /** Address of the underlying ERC20 token (or ETH_ADDRESS for native ETH) */
  address: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
};

export type Token = {
  chainId: number;
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  logoURI?: string;
  extensions: {
    fhenix: {
      confidentialityType: 'wrapped' | 'pure' | 'dual';
      confidentialValueType: 'uint64' | 'uint128';
      /** ERC20 pair for wrapped tokens - contains underlying token info */
      erc20Pair?: Erc20Pair;
    };
  };
};

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
  chainId: number;
};
type UseTokenListsOptions = Omit<UseQueryOptions<TokenList, Error>, 'queryKey' | 'queryFn' | 'select'>;
// Returns array of query results for token lists for the current network
export function useCofheTokenLists(
  { chainId }: UseTokenListsInput,
  queryOptions?: UseTokenListsOptions
): UseTokenListsResult {
  const widgetConfig = useCofheContext().config.react;
  const tokensListsUrls = widgetConfig.tokenLists[chainId];

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

  const result = useQueries({
    queries: queriesOptions,
  });

  return result;
}

export function selectTokensFromTokensList(tokenList: TokenList): Token[] {
  return tokenList.tokens;
}

export function useCofheTokens(chainId: number): Token[] {
  const tokenLists = useCofheTokenLists({ chainId });
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
    return Array.from(map.values());
  }, [tokenLists]);
  return tokens;
}
