import { type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { type Address, type Abi } from 'viem';
import { useCofheChainId, useCofhePublicClient } from './useCofheConnection';
import { useCofheActivePermit } from './useCofhePermits';
import { assert } from 'ts-essentials';
import { useIsCofheErrorActive } from './useIsCofheErrorActive';
import { useInternalQuery } from '../providers/index';

export type UseCofheReadContractQueryOptions = Omit<UseQueryOptions<bigint, Error>, 'queryKey' | 'queryFn'>;
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

  const result = useInternalQuery({
    enabled,
    queryKey: [
      'cofheReadContract',
      cofheChainId,
      address,
      functionName,
      args ?? [],
      requiresPermit ? activePermit?.hash : undefined,
      // normally, "enabled" shouldn't be part of queryKey, but without adding it, there is a weird bug: when there's a CofheError, query still running queryFn resulting in the blank screen
      enabled,
    ],
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
