import { type UseQueryOptions } from '@tanstack/react-query';
import { type Address } from 'viem';

import { ERC20_ALLOWANCE_ABI } from '../constants/erc20ABIs';
import { checksummedOr, useCofheReadContract } from './useCofheReadContract';

type UseTokenAllowanceInput = {
  /** ERC20 token contract address */
  tokenAddress?: Address;
  /** Allowance owner */
  ownerAddress?: Address;
  /** Allowance spender */
  spenderAddress?: Address;
};

export type UseTokenAllowanceOptions = Omit<UseQueryOptions<bigint, Error>, 'queryKey' | 'queryFn'> & {
  // Plain boolean only (no callback form): the wrapped read resolves it at
  // construction time (it participates in the query key).
  enabled?: boolean;
};

export type UseTokenAllowanceResult = {
  data?: bigint;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
};

/// A token allowance is an ORDINARY contract read — `allowance(owner, spender)` on the token —
/// and `useTokenAllowance` is a thin wrapper around `useCofheReadContract`, so it lives under the
/// standard `cofheReadContract` key grammar with the exact same query (key, block-aware queryFn,
/// cache entry) a direct read would use. A plain invalidation descriptor
/// `{ address: token, functionName: 'allowance' }` reaches it, args-narrowable to one
/// owner/spender pair — no bespoke key vocabulary.
export function useTokenAllowance(
  { tokenAddress, ownerAddress, spenderAddress }: UseTokenAllowanceInput,
  options?: UseTokenAllowanceOptions
): UseTokenAllowanceResult {
  // Canonicalized at the input so the key, the fetch and any args-narrowed
  // invalidation target all meet on the same checksummed pair.
  const owner = checksummedOr(ownerAddress);
  const spender = checksummedOr(spenderAddress);

  const { data, isFetching, refetch } = useCofheReadContract(
    {
      address: tokenAddress,
      abi: ERC20_ALLOWANCE_ABI,
      functionName: 'allowance',
      args: owner && spender ? [owner, spender] : undefined,
      requiresACP: false,
    },
    {
      refetchOnMount: false,
      ...options,
      enabled: !!owner && !!spender && (options?.enabled ?? true),
    }
  );

  return { data, isFetching, refetch };
}
