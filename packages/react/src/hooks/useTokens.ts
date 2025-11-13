import { useQueries, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { useCofheContext } from '../providers/CofheProvider';

type TokenList = {
  name: string;
  timestamp: string;
  version: {
    major: number;
    minor: number;
    patch: number;
  };
  tokens: Array<{
    chainId: number;
    address: string;
    symbol: string;
    decimals: number;
    name: string;
    logoURI?: string;
  }>;
};

type UseTokenListsResult = UseQueryResult<TokenList, Error>[];

// returns array of loaded tokens lists for the current network
export function useTokenLists(): UseTokenListsResult {
  // TODO: uncomment when https://github.com/FhenixProtocol/cofhesdk/pull/46 is merged
  // const {chainId} = useCofheConnection();
  const chainId = 11155111;
  const widgetConfig = useCofheContext().widgetConfig;
  const tokensListsUrls = widgetConfig?.tokenLists?.[chainId];

  const queriesOptions: UseQueryOptions<TokenList, Error, TokenList>[] =
    tokensListsUrls?.map((url) => ({
      cacheTime: Infinity,
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      queryKey: ['tokenList', chainId, url],
      queryFn: async ({ signal }): Promise<TokenList> => await (await fetch(url, { signal })).json(),
      select: (data) => {
        return {
          ...data,
          // filter only tokens for the current chain (some lists contain multiple chains)
          tokens: data.tokens.filter((token) => token.chainId === chainId),
        };
      },
    })) || [];

  const result = useQueries({
    queries: queriesOptions,
  });

  return result;
}
