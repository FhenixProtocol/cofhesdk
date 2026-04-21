import { type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { useCofheContext } from '../providers/CofheProvider';
import { useMemo } from 'react';
import {
  ETH_ADDRESS_LOWERCASE,
  isSupportedTokenConfidentialityType,
  type Erc20Pair,
  type Token,
} from '../types/token.js';
import { useInternalQueries } from '../providers/index.js';
import type { Address } from 'viem';
import { useCofheChainId } from './useCofheConnection';
import { useCustomTokensStore } from '@/stores/customTokensStore';
import { useResolvedCofheToken } from './useResolvedCofheToken';

export { ETH_ADDRESS_LOWERCASE, type Token, type Erc20Pair };

function isSupportedToken(token: Token): boolean {
  const confidentialityType = token.extensions?.fhenix?.confidentialityType;
  return isSupportedTokenConfidentialityType(confidentialityType);
}

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

function getCustomTokensForChain(customTokensByChainId: Record<string, Token[]>, chainId?: number): Token[] {
  if (!chainId) return [];
  return customTokensByChainId[chainId.toString()] ?? [];
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
          tokens: data.tokens.filter((token) => token.chainId === chainId && isSupportedToken(token)),
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
