import { type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import {
  type Address,
  type ContractFunctionReturnType,
  type ContractFunctionName,
  type ContractFunctionArgs,
  type ReadContractReturnType,
} from 'viem';
import { useCofheChainId, useCofhePublicClient } from './useCofheConnection';
import { useCofheActivePermit } from './useCofhePermits';
import { assert } from 'ts-essentials';
import { useIsCofheErrorActive } from './useIsCofheErrorActive';
import { useInternalQueries, useInternalQuery } from '../providers/index';
import { transformEncryptedReturnTypes, type Abi, type CofheReturnType, type ContractReturnType } from '@cofhe/abi';

const QUERY_CACHE_PREFIX = 'cofheReadContract';

function serializeIfBigint(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }
}

function serializeBigintRecursively(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(serializeBigintRecursively);
  } else {
    return serializeIfBigint(value);
  }
}

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
    ...constructCofheReadContractQueryForInvalidation({
      cofheChainId,
      address,
      functionName,
    }),

    args ? serializeBigintRecursively(args) : [],
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
  cofheChainId?: number;
  address?: Address;
  functionName?: string;
  // add more specificity if needed. Just make sure it matches the order of keys
}): readonly unknown[] {
  return [QUERY_CACHE_PREFIX, cofheChainId, address, functionName];
}

export type UseCofheReadContractQueryOptions<
  TAbi extends Abi,
  TfunctionName extends ContractFunctionName<TAbi, 'pure' | 'view'>,
> = Omit<UseQueryOptions<CofheReturnType<TAbi, TfunctionName>, Error>, 'queryKey' | 'queryFn'> & {
  enabled?: boolean; // TODO: check callback variant, maybe it'll fix the issue above about forcing enable to be query key
};

export function getEnabledForCofheReadContract(params: {
  isCofheErrorActive: boolean;
  publicClient: unknown;
  address?: Address;
  abi?: Abi;
  functionName?: string;
  requiresPermit: boolean;
  hasActivePermit: boolean;
  userEnabled?: boolean;
}): boolean {
  const { isCofheErrorActive, publicClient, address, abi, functionName, requiresPermit, hasActivePermit, userEnabled } =
    params;

  return (
    !isCofheErrorActive &&
    !!publicClient &&
    !!address &&
    !!abi &&
    !!functionName &&
    (!requiresPermit || hasActivePermit) &&
    (userEnabled ?? true)
  );
}

function convertReadContractResultToCofheReturnType<
  TAbi extends Abi,
  TfunctionName extends ContractFunctionName<TAbi, 'pure' | 'view'>,
  TArgs extends ContractFunctionArgs<TAbi, 'pure' | 'view', TfunctionName>,
>(
  value: ContractFunctionReturnType<TAbi, 'pure' | 'view', TfunctionName, TArgs>
): ContractReturnType<
  TAbi,
  TfunctionName
  //TArgs
> {
  // TODO: convertViemReturnTypeToCofheReturnType -- need core typing changes, currently seems to not support fn overloads
  // viems inferred TArgs mismatch Cofhe's
  return value as ContractReturnType<
    TAbi,
    TfunctionName
    //TArgs
  >;
}

export function createCofheReadContractQueryOptions<
  TAbi extends Abi,
  TfunctionName extends ContractFunctionName<TAbi, 'pure' | 'view'>,
  TArgs extends ContractFunctionArgs<TAbi, 'pure' | 'view', TfunctionName>,
>(params: {
  enabled: boolean;
  cofheChainId?: number;
  address?: Address;
  abi?: TAbi;
  functionName?: TfunctionName;
  args?: TArgs;
  requiresPermit: boolean;
  activePermitHash?: string;
  publicClient: ReturnType<typeof useCofhePublicClient>;
  queryOptions?: UseCofheReadContractQueryOptions<TAbi, TfunctionName>;
}): UseQueryOptions<CofheReturnType<TAbi, TfunctionName>, Error> {
  const {
    enabled,
    cofheChainId,
    address,
    abi,
    functionName,
    args,
    requiresPermit,
    activePermitHash,
    publicClient,
    queryOptions,
  } = params;

  const { enabled: _ignoredEnabled, ...restQueryOptions } = queryOptions || {};

  return {
    enabled,
    queryKey: constructCofheReadContractQueryKey({
      cofheChainId,
      address,
      functionName,
      args: Array.isArray(args) ? args : undefined,
      requiresPermit,
      activePermitHash,
      enabled,
    }),
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

      const convertedOut = convertReadContractResultToCofheReturnType<TAbi, TfunctionName, TArgs>(out);

      const transformed = transformEncryptedReturnTypes(abi, functionName, convertedOut);

      console.log('transformEncryptedReturnTypes result:', transformed);
      return transformed;
    },
    ...restQueryOptions,
  };
}

/**
 * Generic hook: read a contract and return the result (with permit/error gating support).
 * is Cofhe-ABI aware: returns CofheReturnType (but doesn't support TArgs typing yet).
 */
export type UseCofheReadContractResult<
  TAbi extends Abi,
  TfunctionName extends ContractFunctionName<TAbi, 'pure' | 'view'>,
> = UseQueryResult<CofheReturnType<TAbi, TfunctionName>, Error> & {
  disabledDueToMissingPermit: boolean;
};
export function useCofheReadContract<
  TAbi extends Abi,
  TfunctionName extends ContractFunctionName<TAbi, 'pure' | 'view'>,
>(
  params: {
    address?: Address;
    abi?: TAbi;
    functionName?: TfunctionName;
    args?: ContractFunctionArgs<TAbi, 'pure' | 'view', TfunctionName>;
    requiresPermit?: boolean;
  },
  queryOptions?: UseCofheReadContractQueryOptions<TAbi, TfunctionName>
): UseCofheReadContractResult<TAbi, TfunctionName> {
  const { address, abi, functionName, args, requiresPermit = true } = params;

  const isCofheErrorActive = useIsCofheErrorActive();
  const publicClient = useCofhePublicClient();
  const cofheChainId = useCofheChainId();
  const activePermit = useCofheActivePermit();

  const enabled = getEnabledForCofheReadContract({
    isCofheErrorActive,
    publicClient,
    address,
    abi,
    functionName,
    requiresPermit,
    hasActivePermit: !!activePermit,
    userEnabled: queryOptions?.enabled,
  });

  const result = useInternalQuery(
    createCofheReadContractQueryOptions({
      enabled,
      cofheChainId,
      address,
      abi,
      functionName,
      args: Array.isArray(args) ? args : undefined,
      requiresPermit,
      activePermitHash: activePermit?.hash,
      publicClient,
      queryOptions,
    })
  );

  return {
    ...result,
    disabledDueToMissingPermit: requiresPermit && !activePermit,
  };
}
