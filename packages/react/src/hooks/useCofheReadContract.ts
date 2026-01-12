import { type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { type Address, type Abi } from 'viem';
import { useCofheChainId, useCofhePublicClient } from './useCofheConnection';
import { useCofheActivePermit } from './useCofhePermits';
import { assert } from 'ts-essentials';
import { useIsCofheErrorActive } from './useIsCofheErrorActive';
import { useInternalQuery } from '../providers/index';

const QUERY_CACHE_PREFIX = 'cofheReadContract';

export function constructCofheReadContractQueryKey({
  cofheChainId,
  address,
  functionName,
  args,
  requiresPermit,
  activePermitHash,
  enabled,
}: {
  cofheChainId?: number;
  address?: Address;
  functionName?: string;
  args?: readonly unknown[];
  requiresPermit?: boolean;
  activePermitHash?: string;
  enabled?: boolean;
}): readonly unknown[] {
  return [
    QUERY_CACHE_PREFIX,
    cofheChainId,
    address,
    functionName,
    args ?? [],
    requiresPermit ? activePermitHash : undefined,
    // normally, "enabled" shouldn't be part of queryKey, but without adding it, there is a weird bug: when there's a CofheError, query still running queryFn resulting in the blank screen
    enabled,
  ];
}

export function constructCofheReadContractQueryForInvalidation({
  cofheChainId,
  address,
  functionName,
}: {
  cofheChainId: number;
  address: Address;
  functionName?: string;
  // add more specificity if needed. Just make sure it matches the order of keys
}): readonly unknown[] {
  return constructCofheReadContractQueryKey({
    cofheChainId,
    address,
    functionName,
  });
}

export type UseCofheReadContractQueryOptions = Omit<UseQueryOptions<bigint, Error>, 'queryKey' | 'queryFn'> & {
  enabled?: boolean; // TODO: check callback variant, maybe it'll fix the issue above about forcing enable to be query key
};
/**
 * Generic hook: read a contract and return the result (with permit/error gating support).
 */
export function useCofheReadContract(
  params: {
    address?: Address;
    abi?: Abi;
    functionName?: string;
    args?: readonly unknown[];
    requiresPermit?: boolean;
  },
  queryOptions?: UseCofheReadContractQueryOptions
): UseQueryResult<bigint, Error> & { disabledDueToMissingPermit: boolean } {
  const { address, abi, functionName, args, requiresPermit = true } = params;

  const isCofheErrorActive = useIsCofheErrorActive();
  const publicClient = useCofhePublicClient();
  const cofheChainId = useCofheChainId();
  const activePermit = useCofheActivePermit();

  const { enabled: userEnabled, ...restQueryOptions } = queryOptions || {};
  const enabled =
    !isCofheErrorActive &&
    !!publicClient &&
    !!address &&
    !!abi &&
    !!functionName &&
    (!requiresPermit || !!activePermit) &&
    (userEnabled ?? true);

  const queryKey = constructCofheReadContractQueryKey({
    cofheChainId,
    address,
    functionName,
    args,
    requiresPermit,
    activePermitHash: activePermit?.hash,
    enabled,
  });
  const result = useInternalQuery({
    enabled,
    queryKey,
    queryFn: async () => {
      assert(address, 'Contract address should be guaranteed by enabled check');
      assert(publicClient, 'PublicClient should be guaranteed by enabled check');
      assert(abi, 'ABI should be guaranteed by enabled check');
      assert(functionName, 'Function name should be guaranteed by enabled check');

      const out = await publicClient.readContract({
        address,
        abi,
        functionName,
        args,
      });

      assert(typeof out === 'bigint', 'Expected confidential contract read result to be bigint');
      return out;
    },
    ...restQueryOptions,
  });

  return {
    ...result,
    disabledDueToMissingPermit: requiresPermit && !activePermit,
  };
}
