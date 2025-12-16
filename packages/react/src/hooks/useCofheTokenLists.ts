import { useQueries, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { useCofheContext } from '../providers/CofheProvider';
import { useMemo } from 'react';
import { ETH_ADDRESS, type Erc20Pair, type Token } from '../types/token.js';
import { useCofheAccount } from './useCofheConnection.js';
import { useUserTokenStore } from '../stores/userTokenStore';
import { shallow } from 'zustand/shallow';
import { useStoreWithEqualityFn } from 'zustand/traditional';

export { ETH_ADDRESS, type Token, type Erc20Pair };

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
  const account = useCofheAccount();
  // getTokens() returns a new array each call; use shallow equality to avoid infinite re-render loops
  const userTokens = useStoreWithEqualityFn(
    useUserTokenStore,
    (s) => (account ? s.getTokens(account, chainId) : []),
    shallow
  );
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

    userTokens.forEach((token) => {
      const key = `${token.chainId}-${token.address.toLowerCase()}`;
      if (map.has(key)) return;
      map.set(key, token);
    });
    return Array.from(map.values());
  }, [tokenLists, userTokens]);
  return tokens;
}
