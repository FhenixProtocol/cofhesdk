import { type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import {
  type Address,
  type Abi,
  type ContractFunctionReturnType,
  type ContractFunctionName,
  type ContractFunctionArgs,
} from 'viem';
import { useCofheChainId, useCofhePublicClient } from './useCofheConnection';
import { useCofheActivePermit } from './useCofhePermits';
import { assert } from 'ts-essentials';
import { useIsCofheErrorActive } from './useIsCofheErrorActive';
import { useInternalQueries, useInternalQuery } from '../providers/index';
import {
  createCofheReadContractQueryOptions,
  getEnabledForCofheReadContract,
  type InferredData,
  type UseCofheReadContractQueryOptions,
} from './useCofheReadContract';

/**
 * Batched variant of `useCofheReadContract`: executes multiple reads of the same
 * contract function with different `args`.
 */
export function useCofheReadContractMany<
  TAbi extends Abi,
  TfunctionName extends ContractFunctionName<TAbi, 'pure' | 'view'>,
>(
  params: {
    address?: Address;
    abi?: TAbi;
    functionName?: TfunctionName;
    argsList?: ContractFunctionArgs<TAbi, 'pure' | 'view', TfunctionName>[];
    requiresPermit?: boolean;
  },
  queryOptions?: UseCofheReadContractQueryOptions<TAbi, TfunctionName>
): {
  results: UseQueryResult<InferredData<TAbi, TfunctionName>, Error>[];
  disabledDueToMissingPermit: boolean;
} {
  const { address, abi, functionName, argsList = [], requiresPermit = true } = params;

  const isCofheErrorActive = useIsCofheErrorActive();
  const publicClient = useCofhePublicClient();
  const cofheChainId = useCofheChainId();
  const activePermit = useCofheActivePermit();

  const enabledCommon = getEnabledForCofheReadContract({
    isCofheErrorActive,
    publicClient,
    address,
    abi,
    functionName,
    requiresPermit,
    hasActivePermit: !!activePermit,
    userEnabled: queryOptions?.enabled,
  });

  const queries: UseQueryOptions<InferredData<TAbi, TfunctionName>, Error>[] = argsList.map((args) =>
    createCofheReadContractQueryOptions({
      enabled: enabledCommon,
      cofheChainId,
      address,
      abi,
      functionName,
      args,
      requiresPermit,
      activePermitHash: activePermit?.hash,
      publicClient,
      queryOptions,
    })
  );

  const results = useInternalQueries({ queries });

  return {
    results,
    disabledDueToMissingPermit: requiresPermit && !activePermit,
  };
}
