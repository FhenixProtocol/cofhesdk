import { type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { assert } from 'ts-essentials';
import type { Address } from 'viem';
import { useCofheChainId, useCofhePublicClient } from './useCofheConnection';
import { useInternalQuery } from '../providers/index';
import { transformEncryptedReturnTypes, type Abi } from '@cofhe/abi';
import { serializeBigintRecursively } from '../utils/serializeBigint.js';

const QUERY_CACHE_PREFIX = 'cofheReadContracts';

export type CofheReadContractsContract = {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
};

export type CofheReadContractsMulticallOptions = {
  /**
   * When `true` (default in viem), returns per-call status objects.
   * When `false`, throws on any failed call.
   */
  allowFailure?: boolean;
  /** Optional viem multicall options (kept loose to avoid coupling to viem's internal generics). */
  [key: string]: unknown;
};

export type CofheReadContractsItem = {
  result?: unknown;
  error?: Error;
};

export type UseCofheReadContractsQueryOptions = Omit<
  UseQueryOptions<CofheReadContractsItem[], Error>,
  'queryKey' | 'queryFn'
> & {
  enabled?: boolean;
};

export function constructCofheReadContractsQueryKey(params: {
  cofheChainId?: number;
  contracts?: readonly CofheReadContractsContract[];
  allowFailure?: boolean;
  enabled?: boolean;
}): readonly unknown[] {
  const { cofheChainId, contracts, allowFailure, enabled } = params;

  const serializedContracts = (contracts ?? []).map((contract) => {
    // Avoid putting non-serializable values in queryKey.
    // `abi` is typically a plain JSON array, safe to include.
    return {
      address: contract.address,
      functionName: contract.functionName,
      args: Array.isArray(contract.args) ? serializeBigintRecursively(contract.args) : contract.args,
      abi: contract.abi,
    };
  });

  return [QUERY_CACHE_PREFIX, cofheChainId, serializedContracts, allowFailure, enabled];
}

export function getEnabledForCofheReadContracts(params: {
  publicClient: unknown;
  cofheChainId?: number;
  contracts?: readonly CofheReadContractsContract[];
  userEnabled?: boolean;
}): boolean {
  const { publicClient, cofheChainId, contracts, userEnabled } = params;

  return !!publicClient && !!cofheChainId && !!contracts && contracts.length > 0 && (userEnabled ?? true);
}

function isViemAllowFailureResult(
  value: unknown
): value is { status: 'success' | 'failure'; result?: unknown; error?: Error } {
  return !!value && typeof value === 'object' && 'status' in value;
}

function transformResultForContract(contract: CofheReadContractsContract, value: unknown): unknown {
  // `transformEncryptedReturnTypes` expects Cofhe ABI & function typing, but multicall contracts can be heterogeneous.
  // Runtime transformation still works; we keep types intentionally loose here.
  return transformEncryptedReturnTypes(contract.abi, contract.functionName, value);
}

export function useCofheReadContracts(
  params: {
    contracts?: readonly CofheReadContractsContract[];
    multicallOptions?: CofheReadContractsMulticallOptions;
  },
  queryOptions?: UseCofheReadContractsQueryOptions
): UseQueryResult<CofheReadContractsItem[], Error> {
  const { contracts, multicallOptions } = params;

  const publicClient = useCofhePublicClient();
  const cofheChainId = useCofheChainId();

  const enabled = getEnabledForCofheReadContracts({
    publicClient,
    cofheChainId,
    contracts,
    userEnabled: queryOptions?.enabled,
  });

  const { enabled: _ignoredEnabled, ...restQueryOptions } = queryOptions || {};

  return useInternalQuery({
    enabled,
    queryKey: constructCofheReadContractsQueryKey({
      cofheChainId,
      contracts,
      allowFailure: multicallOptions?.allowFailure,
    }),
    queryFn: async () => {
      assert(publicClient, 'PublicClient should be guaranteed by enabled check');
      assert(contracts && contracts.length > 0, 'Contracts should be guaranteed by enabled check');

      const raw = await publicClient.multicall({
        contracts,
        ...(multicallOptions || {}),
      });

      // When `allowFailure: true`, viem returns per-item { status, result?, error? }.
      // When `allowFailure: false`, viem returns an array of results (and throws on failure).
      return raw.map((item, index): CofheReadContractsItem => {
        const contract = contracts[index];
        if (!contract) return { error: new Error('Multicall result length mismatch') };

        if (isViemAllowFailureResult(item)) {
          if (item.status === 'failure') {
            return { error: item.error ?? new Error('Multicall call failed') };
          }
          return { result: transformResultForContract(contract, item.result) };
        }

        return { result: transformResultForContract(contract, item) };
      });
    },
    ...restQueryOptions,
  });
}
