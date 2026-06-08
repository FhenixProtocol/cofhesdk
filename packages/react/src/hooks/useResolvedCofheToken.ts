import type { UseQueryOptions } from '@tanstack/react-query';
import { type Abi, type Address, isAddress, parseAbi, zeroAddress } from 'viem';

import { ERC20_DECIMALS_ABI, ERC20_NAME_ABI, ERC20_SYMBOL_ABI } from '@/constants/erc20ABIs';
import {
  TOKEN_CONFIDENTIALITY_TYPE_INTERFACE_IDS,
  detectSupportedTokenTypeFromInterfaces,
  getTokenTypeConfig,
} from '@/constants/tokenTypeConfig';
import { useInternalQuery } from '@/providers';
import {
  ETH_ADDRESS_LOWERCASE,
  buildToken,
  getTokenConfidentialValueType,
  type SupportedTokenConfidentialityType,
  type Token,
} from '@/types/token';

import { useCofheChainId, useCofhePublicClient } from './useCofheConnection';

const ERC165_ABI = parseAbi(['function supportsInterface(bytes4 interfaceId) view returns (bool)']);
const TOKEN_INTERFACE_DETECTION_ENTRIES = Object.entries(TOKEN_CONFIDENTIALITY_TYPE_INTERFACE_IDS) as Array<
  [SupportedTokenConfidentialityType, `0x${string}`]
>;

function getAddressGetterAbi(functionName: string): Abi {
  return [
    {
      inputs: [],
      name: functionName,
      outputs: [{ name: '', type: 'address' }],
      stateMutability: 'view',
      type: 'function',
    },
  ];
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

      const interfaceResults = await publicClient.multicall({
        contracts: TOKEN_INTERFACE_DETECTION_ENTRIES.map(([, interfaceId]) => ({
          address,
          abi: ERC165_ABI,
          functionName: 'supportsInterface',
          args: [interfaceId],
        })),
        allowFailure: true,
      });

      const interfaceSupport = Object.fromEntries(
        TOKEN_INTERFACE_DETECTION_ENTRIES.map(([confidentialityType], index) => [
          confidentialityType,
          interfaceResults[index]?.status === 'success' ? interfaceResults[index].result === true : false,
        ])
      ) as Partial<Record<SupportedTokenConfidentialityType, boolean>>;
      const confidentialityType = detectSupportedTokenTypeFromInterfaces(interfaceSupport);

      if (!confidentialityType) {
        throw new Error('Address is not a supported CoFHE token');
      }

      let wrapperKind: Token['extensions']['fhenix']['wrapperKind'];
      let erc20Pair: Token['extensions']['fhenix']['erc20Pair'];

      const pairGetterFunctionNames = getTokenTypeConfig(confidentialityType).pairGetterFunctionNames ?? [];

      if (pairGetterFunctionNames.length > 0) {
        const pairGetterResults = await publicClient.multicall({
          contracts: pairGetterFunctionNames.map((functionName) => ({
            address,
            abi: getAddressGetterAbi(functionName),
            functionName,
          })),
          allowFailure: true,
        });
        const pairAddress = pickUnderlyingPairAddress(pairGetterResults, address);

        if (pairAddress) {
          if (pairAddress.toLowerCase() === ETH_ADDRESS_LOWERCASE) {
            wrapperKind = 'native';
            erc20Pair = {
              address: ETH_ADDRESS_LOWERCASE,
              symbol: 'ETH',
              decimals: 18,
            };
          } else {
            wrapperKind = 'erc20';
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
              erc20Pair = {
                address: pairAddress,
                symbol: pairSymbol,
                decimals: pairDecimals,
              };
            }
          }
        }
      }

      return buildToken({
        base: {
          chainId,
          address,
          decimals,
          symbol,
          name,
          logoURI: undefined,
        },
        confidentialityType,
        confidentialValueType: getTokenConfidentialValueType(confidentialityType),
        wrapperKind,
        erc20Pair,
      });
    },
    enabled: (queryOptions?.enabled ?? true) && !!publicClient && !!chainId && !!address,
    staleTime: Infinity,
    ...queryOptions,
  });
}
