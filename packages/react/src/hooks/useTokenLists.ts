import { useQueries, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { useCofheContext } from '../providers/CofheProvider';
import { useMemo } from 'react';
export type Token = {
  chainId: number;
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  logoURI?: string;
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
export function useTokenLists(
  { chainId }: UseTokenListsInput,
  queryOptions?: UseTokenListsOptions
): UseTokenListsResult {
  const widgetConfig = useCofheContext().widgetConfig;
  const tokensListsUrls = widgetConfig?.tokenLists?.[chainId];

  const queriesOptions: UseQueryOptions<TokenList, Error, TokenList>[] =
    tokensListsUrls?.map((url) => ({
      cacheTime: Infinity,
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      queryKey: ['tokenList', chainId, url],
      queryFn: async ({ signal }): Promise<TokenList> => {
        const res = await fetch(url, { signal });
        if (!res.ok) {
          throw new Error(`Failed to fetch token list: ${res.status} ${res.statusText}`);
        }
        return await res.json();
      },
      select: (data) => {
        const filtered = {
          ...data,
          // filter only tokens for the current chain (some lists contain multiple chains)
          tokens: data.tokens.filter((token) => token.chainId === chainId),
        };
        return filtered;
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

export function useTokens(chainId: number): Token[] {
  const tokenLists = useTokenLists({ chainId });
  const tokens = useMemo(() => {
    const map = new Map<string, Token>();
    tokenLists.forEach((result) => {
      if (result.data) {
        result.data.tokens.forEach((token) => {
          const key = `${token.chainId}-${token.address.toLowerCase()}`;
          if (!map.has(key)) {
            map.set(key, token);
          }
        });
      }
    });
    return Array.from(map.values());
  }, [tokenLists, chainId]);
  return tokens;
}
