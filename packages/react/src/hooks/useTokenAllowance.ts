import { type UseQueryOptions } from '@tanstack/react-query';
import { type Address } from 'viem';
import { assert } from 'ts-essentials';

import { getShieldAllowanceContractConfig } from '../constants/confidentialTokenABIs';
import { useInternalQuery } from '../providers/index';
import { useCofhePublicClient } from './useCofheConnection';

export function constructTokenAllowanceQueryKey({
  chainId,
  tokenAddress,
  ownerAddress,
  spenderAddress,
}: {
  chainId?: number;
  tokenAddress?: Address;
  ownerAddress?: Address;
  spenderAddress?: Address;
}): readonly unknown[] {
  return [
    'tokenAllowance',
    chainId,
    tokenAddress?.toLowerCase(),
    ownerAddress?.toLowerCase(),
    spenderAddress?.toLowerCase(),
  ];
}

export function constructTokenAllowanceQueryKeyForInvalidation({
  chainId,
  tokenAddress,
  ownerAddress,
  spenderAddress,
}: {
  chainId: number;
  tokenAddress: Address;
  ownerAddress: Address;
  spenderAddress: Address;
}): readonly unknown[] {
  return constructTokenAllowanceQueryKey({
    chainId,
    tokenAddress,
    ownerAddress,
    spenderAddress,
  });
}

type UseTokenAllowanceInput = {
  /** ERC20 token contract address */
  tokenAddress?: Address;
  /** Allowance owner */
  ownerAddress?: Address;
  /** Allowance spender */
  spenderAddress?: Address;
};

export type UseTokenAllowanceOptions<TSelectedData = bigint> = Omit<
  UseQueryOptions<bigint, Error, TSelectedData>,
  'queryKey' | 'queryFn'
>;

export function createTokenAllowanceQueryOptions<TSelectedData = bigint>(params: {
  publicClient: ReturnType<typeof useCofhePublicClient>;
  tokenAddress?: Address;
  ownerAddress?: Address;
  spenderAddress?: Address;
  queryOptions?: UseTokenAllowanceOptions<TSelectedData>;
}): UseQueryOptions<bigint, Error, TSelectedData> {
  const { publicClient, tokenAddress, ownerAddress, spenderAddress, queryOptions } = params;
  const { enabled: userEnabled, ...restQueryOptions } = queryOptions ?? {};
  const baseEnabled = !!publicClient && !!tokenAddress && !!ownerAddress && !!spenderAddress;
  const enabled = baseEnabled && (userEnabled ?? true);

  const queryKey = constructTokenAllowanceQueryKey({
    chainId: publicClient?.chain?.id,
    tokenAddress,
    ownerAddress,
    spenderAddress,
  });

  return {
    queryKey,
    queryFn: async () => {
      assert(publicClient, 'PublicClient is required to fetch token allowance');
      assert(tokenAddress, 'Token address is required to fetch token allowance');
      assert(ownerAddress, 'Owner address is required to fetch token allowance');
      assert(spenderAddress, 'Spender address is required to fetch token allowance');
      const allowanceContract = getShieldAllowanceContractConfig();

      const allowance = await publicClient.readContract({
        address: tokenAddress,
        abi: allowanceContract.abi,
        functionName: allowanceContract.functionName,
        args: [ownerAddress, spenderAddress],
      });
      assert(typeof allowance === 'bigint', 'Token allowance must resolve to bigint');
      return allowance;
    },
    enabled,
    refetchOnMount: false,
    ...restQueryOptions,
  };
}

export type UseTokenAllowanceResult = {
  data?: bigint;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
};

export function useTokenAllowance(
  { tokenAddress, ownerAddress, spenderAddress }: UseTokenAllowanceInput,
  options?: UseTokenAllowanceOptions
): UseTokenAllowanceResult {
  const publicClient = useCofhePublicClient();

  const queryOptions = createTokenAllowanceQueryOptions({
    publicClient,
    tokenAddress,
    ownerAddress,
    spenderAddress,
    queryOptions: options,
  });

  const { data, isFetching, refetch } = useInternalQuery(queryOptions);

  return {
    data,
    isFetching,
    refetch,
  };
}
