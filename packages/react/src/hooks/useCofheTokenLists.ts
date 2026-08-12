import { type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { useCofheContext } from '../providers/CofheProvider';
import { useMemo } from 'react';
import {
  DEFAULT_TOKEN_BY_CHAIN_ID,
  ETH_ADDRESS_LOWERCASE,
  isSupportedTokenConfidentialityType,
  normalizeToken,
  type Erc20Pair,
  type ConfidentialToken,
} from '../types/token.js';
import { useInternalQueries } from '../providers/index.js';
import type { Address } from 'viem';
import { useCofheChainId } from './useCofheConnection';
import { useCustomTokensStore } from '@/stores/customTokensStore';
import { cofheLogger } from '@/utils/debug';

export { ETH_ADDRESS_LOWERCASE, type ConfidentialToken, type Erc20Pair };

function isSupportedToken(token: ConfidentialToken): boolean {
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
  tokens: ConfidentialToken[];
};

type UseTokenListsResult = UseQueryResult<TokenList, Error>[];
type UseTokenListsInput = {
  chainId?: number;
};
type UseTokenListsOptions = Omit<UseQueryOptions<TokenList, Error, TokenList>, 'queryKey' | 'queryFn' | 'select'>;

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

function getCustomTokensForChain(
  customTokensByChainId: Record<string, ConfidentialToken[]>,
  chainId?: number
): ConfidentialToken[] {
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

  const queriesOptions: UseQueryOptions<TokenList, Error, TokenList>[] =
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
      queryFn: async ({ signal }): Promise<TokenList> => {
        const timestamp = Date.now();
        const urlWithCacheBust = `${url}${url.includes('?') ? '&' : '?'}v=${timestamp}`;
        const res = await fetch(urlWithCacheBust, { signal });
        if (!res.ok) {
          throw new TokenListFetchError(`Failed to fetch token list: ${res.status} ${res.statusText}`, res.status);
        }
        return await res.json();
      },
      select: (data: TokenList): TokenList => {
        // filter only tokens for the current chain (some lists contain multiple chains)
        return {
          ...data,
          tokens: data.tokens
            .filter((token) => token.chainId === chainId)
            .map((token) => normalizeToken(token))
            .filter((token): token is ConfidentialToken => !!token && isSupportedToken(token)),
        };
      },
      ...queryOptions,
    })) || [];

  const result = useInternalQueries({
    queries: queriesOptions,
  });

  return result;
}

export function selectTokensFromTokensList(tokenList: TokenList): ConfidentialToken[] {
  return tokenList.tokens;
}

export function useCofheTokens(chainId?: number): ConfidentialToken[] {
  const tokenLists = useCofheTokenLists({ chainId });
  const customTokensByChainId = useCustomTokensStore((state) => state.customTokensByChainId);
  const customTokens = getCustomTokensForChain(customTokensByChainId, chainId);
  const defaultToken = chainId ? DEFAULT_TOKEN_BY_CHAIN_ID[chainId] : undefined;

  const tokens = useMemo(() => {
    const map = new Map<string, ConfidentialToken>();

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

/**
 * Resolve a token address against what the client already KNOWS: the configured
 * tokenlists, the user's imported (custom) tokens, and the chain's default token.
 * Never touches the chain — an address that isn't known resolves to `undefined`
 * (which, before the tokenlists have loaded, simply means "not known yet").
 */
export function useKnownCofheToken({
  chainId: _chainId,
  address,
}: {
  chainId?: number;
  address?: Address;
}): ConfidentialToken | undefined {
  const cofheChainId = useCofheChainId();
  const chainId = _chainId ?? cofheChainId;

  const tokens = useCofheTokens(chainId);
  return useMemo(() => {
    if (!address || !chainId) return;
    return tokens.find((t) => t.chainId === chainId && t.address.toLowerCase() === address.toLowerCase());
  }, [address, chainId, tokens]);
}

export function useCofheToken(
  { chainId, address }: { chainId?: number; address?: Address },
  /** @deprecated No longer used — this hook no longer issues any query (see below). */
  _metadataQueryOptions?: Omit<UseQueryOptions<ConfidentialToken | undefined, Error>, 'queryKey' | 'queryFn' | 'select'>
) {
  // This hook used to silently fall back to useResolvedCofheToken's ON-CHAIN interface
  // probe for any address not found in the lists. That was incorrect: it also fired for
  // known tokens during the tokenlist-loading window and probed the CONNECTED chain
  // regardless of the requested chainId, producing spurious "Address is not a supported
  // CoFHE token" failures for stale/wrong-chain addresses. Consumers who genuinely want
  // on-chain resolution must call useResolvedCofheToken explicitly.
  // TODO: if implicit resolution is ever wanted again, design it as an explicit opt-in
  // (e.g. `probeUnknown: true`) with a null-not-throw negative verdict.
  return useKnownCofheToken({ chainId, address });
}
