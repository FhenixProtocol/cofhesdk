import type { UseQueryOptions } from '@tanstack/react-query';
import { type Address, isAddress, parseAbi, zeroAddress } from 'viem';

import { ERC20_BALANCE_OF_ABI, ERC20_DECIMALS_ABI, ERC20_NAME_ABI, ERC20_SYMBOL_ABI } from '@/constants/erc20ABIs';
import { CONFIDENTIAL_TYPE_PURE_ABI, CONFIDENTIAL_TYPE_WRAPPED_ABI } from '@/constants/confidentialTokenABIs';
import { useInternalQuery } from '@/providers';
import { ETH_ADDRESS_LOWERCASE, type Token } from '@/types/token';

import { useCofheChainId, useCofhePublicClient } from './useCofheConnection';

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

      if (!wrappedProbe && !confidentialProbe) {
        throw new Error('Address is not a supported CoFHE token');
      }

      const confidentialityType = wrappedProbe ? 'wrapped' : publicProbe ? 'dual' : 'pure';

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
