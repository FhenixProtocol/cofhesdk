import { useQueries, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { useCofheContext } from '../providers/CofheProvider';
import { useMemo } from 'react';
export type Token = {
  chainId: number;
  address: `0x${string}`;
  symbol: string;
  decimals: number;
  name: string;
  logoURI?: string;
  extensions: Record<string, unknown> & {
    fhenix: {
      confidentialityType: 'wrapped' | 'pure' | 'dual';
      confidentialValueType: 'uint64' | 'uint128';
      erc20Pair: {
        address: `0x${string}`;
        symbol: string;
        decimals: number;
        logoURI: string;
      };
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
  chainId?: number;
};
type UseTokenListsOptions = Omit<UseQueryOptions<TokenList, Error>, 'queryKey' | 'queryFn' | 'select'>;
// Returns array of query results for token lists for the current network
export function useTokenLists(
  { chainId }: UseTokenListsInput,
  queryOptions?: UseTokenListsOptions
): UseTokenListsResult {
  const widgetConfig = useCofheContext().config.react;
  const tokensListsUrls = chainId ? widgetConfig.tokenLists[chainId] : [];

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

export function useTokens(chainId?: number): Token[] {
  const tokenLists = useTokenLists({ chainId });
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
