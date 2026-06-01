import { type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { useCofheContext } from '../providers/CofheProvider';
import { useMemo } from 'react';
import {
  DEFAULT_TOKEN_BY_CHAIN_ID,
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
import { cofheLogger } from '@/utils/debug';

export { ETH_ADDRESS_LOWERCASE, type Token, type Erc20Pair };

type RawTokenListEntry = Omit<Token, 'extensions'> & {
  extensions?: Record<string, unknown> & {
    fhenix?: {
      confidentialityType?: string;
      confidentialValueType?: 'uint64' | 'uint128';
      erc20Pair?: Erc20Pair;
    };
    erc20Pair?: Erc20Pair;
  };
};

function normalizeTokenFromList(token: RawTokenListEntry): Token | undefined {
  const confidentialityType = token.extensions?.fhenix?.confidentialityType;
  if (!isSupportedTokenConfidentialityType(confidentialityType)) {
    return undefined;
  }

  return {
    ...token,
    extensions: {
      ...token.extensions,
      fhenix: {
        ...token.extensions?.fhenix,
        confidentialityType,
        confidentialValueType: token.extensions?.fhenix?.confidentialValueType ?? 'uint64',
        erc20Pair: token.extensions?.fhenix?.erc20Pair ?? token.extensions?.erc20Pair,
      },
    },
  };
}

function isSupportedToken(token: Token): boolean {
  const confidentialityType = token.extensions?.fhenix?.confidentialityType;
  return isSupportedTokenConfidentialityType(confidentialityType);
}

type TokenListBase = {
  name: string;
  timestamp: string;
  version: {
    major: number;
    minor: number;
    patch: number;
  };
};

type TokenList = TokenListBase & {
  tokens: Token[];
};

type RawTokenList = TokenListBase & {
  tokens: RawTokenListEntry[];
};

type UseTokenListsResult = UseQueryResult<TokenList, Error>[];
type UseTokenListsInput = {
  chainId?: number;
};
type UseTokenListsOptions = Omit<
  UseQueryOptions<RawTokenList, Error, TokenList>,
  'queryKey' | 'queryFn' | 'select'
>;

class TokenListFetchError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'TokenListFetchError';
  }
}

const DEFAULT_RETRY_DELAY_ON_429 = 30_000; // 30 seconds

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

  const queriesOptions: UseQueryOptions<RawTokenList, Error, TokenList>[] =
    tokensListsUrls?.map((url) => ({
      cacheTime: Infinity,
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      queryKey: ['tokenList', chainId, url],
      retryDelay(failureCount, error) {
        if (error instanceof TokenListFetchError && error.status === 429) {
          cofheLogger.debug(`Rate limited when fetching token list from ${url}. Not retrying for 30 seconds.`);
          return DEFAULT_RETRY_DELAY_ON_429;
        }

        return Math.min(1000 * 2 ** failureCount, DEFAULT_RETRY_DELAY_ON_429);
      },
      queryFn: async ({ signal }): Promise<RawTokenList> => {
        const timestamp = Date.now();
        const urlWithCacheBust = `${url}${url.includes('?') ? '&' : '?'}v=${timestamp}`;
        const res = await fetch(urlWithCacheBust, { signal });
        if (!res.ok) {
          throw new TokenListFetchError(`Failed to fetch token list: ${res.status} ${res.statusText}`, res.status);
        }
        return await res.json();
      },
      select: (data: RawTokenList): TokenList => {
        // filter only tokens for the current chain (some lists contain multiple chains)
        return {
          ...data,
          tokens: data.tokens
            .filter((token) => token.chainId === chainId)
            .map((token) => normalizeTokenFromList(token))
            .filter((token): token is Token => !!token && isSupportedToken(token)),
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
  const defaultToken = chainId ? DEFAULT_TOKEN_BY_CHAIN_ID[chainId] : undefined;

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

    if (defaultToken) {
      const key = `${defaultToken.chainId}-${defaultToken.address.toLowerCase()}`;
      if (!map.has(key)) {
        map.set(key, defaultToken);
      }
    }

    return Array.from(map.values());
  }, [customTokens, defaultToken, tokenLists]);
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
