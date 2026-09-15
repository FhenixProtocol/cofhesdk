import { type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import {
  getAddress,
  type Address,
  type ContractFunctionReturnType,
  type ContractFunctionName,
  type ContractFunctionArgs,
  type ReadContractReturnType,
} from 'viem';
import { useMemo } from 'react';
import { useCofheConnection, type useCofhePublicClient } from './useCofheConnection';
import { useCofheActiveACP } from './useCofheACPs';
import { assert } from 'ts-essentials';
import { useInternalQuery } from '../providers/index';
import { transformEncryptedReturnTypes, type Abi, type CofheReturnType, type ContractReturnType } from '@cofhe/abi';
import { serializeBigintRecursively } from '../utils/serializeBigint.js';
import { maybeWaitUntilRpcAwareAndReadContract } from '@/utils/waitUntilRpcAwareAndReadContract';
import { withInvalidationContext } from '@/utils/invalidationContext';
import { asCofhePublicClient, type PublicClientLike } from '@/utils/viemClientBridge';

const QUERY_CACHE_PREFIX = 'cofheReadContract';

/// Best-effort checksum. The address segment of every read key — and of every invalidation
/// prefix, since both flow through `constructCofheReadContractQueryForInvalidation` — is
/// canonicalized here, so a read key and an invalidation descriptor can never disagree on
/// address case. Anything that isn't a valid address passes through untouched.
export function checksummedOr(address: Address | undefined): Address | undefined {
  if (!address) return address;
  try {
    return getAddress(address);
  } catch {
    return address;
  }
}

export function constructCofheReadContractQueryKey({
  cofheChainId,
  address,
  functionName,
  args,
  requiresACP,
  activeACPHash,
}: {
  cofheChainId?: number;
  address?: Address;
  functionName?: string;
  args?: readonly unknown[];
  requiresACP?: boolean;
  activeACPHash?: string;
}): readonly unknown[] {
  return [
    ...constructCofheReadContractQueryForInvalidation({
      cofheChainId,
      address,
      functionName,
    }),

    args ? serializeBigintRecursively(args) : [],
    requiresACP ? activeACPHash : undefined,
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
  return [QUERY_CACHE_PREFIX, cofheChainId, checksummedOr(address), functionName];
}

/** The chain segment of a cofhe read key or invalidation prefix — `undefined` for any other key. */
export function cofheReadKeyChainId(queryKey: readonly unknown[]): number | undefined {
  return queryKey[0] === QUERY_CACHE_PREFIX && typeof queryKey[1] === 'number' ? queryKey[1] : undefined;
}

export type UseCofheReadContractQueryOptions<
  TAbi extends Abi,
  TfunctionName extends ContractFunctionName<TAbi, 'pure' | 'view'>,
> = Omit<UseQueryOptions<CofheReturnType<TAbi, TfunctionName>, Error>, 'queryKey' | 'queryFn'> & {
  // Plain boolean only (no callback form): it is composed with the hook's own gating
  // (client/address/ACP presence) at construction time.
  enabled?: boolean;
};

/**
 * Which chain a read belongs to — its cache key's chain segment — and optionally the client that
 * serves it:
 * - neither: the read follows the connected wallet, its chain and its client;
 * - `chainId` alone GUARDS the read to that chain: it runs only while the wallet is connected to
 *   it, and is otherwise disabled with `disabledDueToWrongChain` — never a silent read of the
 *   wrong chain;
 * - `publicClient` (which requires `chainId`) serves the read through that client instead,
 *   wherever the wallet sits — or with no wallet connected at all. A client whose own chain
 *   disagrees with `chainId` keeps the read disabled (`disabledDueToWrongChain`).
 *
 * ACP gating (`requiresACP`) and decryption follow the read's chain: they use that chain's ACP.
 */
export type CofheReadChainParams =
  | {
      /**
       * The read's chain — its cache key's chain segment.
       * - alone: GUARDS the read — it runs only while the wallet is connected to this chain,
       *   otherwise it stays disabled (`disabledDueToWrongChain`);
       * - with `publicClient`: the read goes through that client, wherever the wallet sits.
       *
       * Omit both to follow the connected wallet.
       */
      chainId?: number;
      /**
       * Serve the read through this client instead of the wallet's — wherever the wallet sits, or
       * with no wallet connected. Requires `chainId`; a client whose own chain disagrees with it
       * keeps the read disabled (`disabledDueToWrongChain`). While `undefined` (e.g. still
       * loading), the read behaves like `chainId` alone.
       */
      publicClient?: undefined;
    }
  | {
      /**
       * The read's chain — its cache key's chain segment.
       * - alone: GUARDS the read — it runs only while the wallet is connected to this chain,
       *   otherwise it stays disabled (`disabledDueToWrongChain`);
       * - with `publicClient`: the read goes through that client, wherever the wallet sits.
       *
       * Omit both to follow the connected wallet.
       */
      chainId: number;
      /**
       * Serve the read through this client instead of the wallet's — wherever the wallet sits, or
       * with no wallet connected. Requires `chainId`; a client whose own chain disagrees with it
       * keeps the read disabled (`disabledDueToWrongChain`). While `undefined` (e.g. still
       * loading), the read behaves like `chainId` alone.
       */
      publicClient: PublicClientLike | undefined;
    };

/** Resolves a read's `CofheReadChainParams` into the chain it belongs to and the client serving it. */
export function useCofheReadTarget({ chainId, publicClient: ownClient }: CofheReadChainParams): {
  publicClient: ReturnType<typeof useCofhePublicClient>;
  cofheChainId: number | undefined;
  disabledDueToWrongChain: boolean;
} {
  const connection = useCofheConnection();
  const ownPublicClient = useMemo(() => asCofhePublicClient(ownClient), [ownClient]);

  if (ownPublicClient) {
    const clientChainId = ownPublicClient.chain?.id;
    const wrongChain = chainId === undefined || (clientChainId !== undefined && clientChainId !== chainId);
    return {
      publicClient: wrongChain ? undefined : ownPublicClient,
      cofheChainId: chainId,
      disabledDueToWrongChain: wrongChain,
    };
  }

  if (chainId === undefined) {
    return { publicClient: connection.publicClient, cofheChainId: connection.chainId, disabledDueToWrongChain: false };
  }

  // Guarded: only the connected client of THAT chain may serve the read. Disconnected is not
  // "wrong chain" — the read waits for a connection like any other.
  const wrongChain = connection.chainId !== undefined && connection.chainId !== chainId;
  return {
    publicClient: wrongChain ? undefined : connection.publicClient,
    cofheChainId: chainId,
    disabledDueToWrongChain: wrongChain,
  };
}

export function getEnabledForCofheReadContract(params: {
  publicClient: unknown;
  address?: Address;
  abi?: Abi;
  functionName?: string;
  requiresACP: boolean;
  hasValidActiveACP: boolean;
  userEnabled?: boolean;
}): boolean {
  const { publicClient, address, abi, functionName, requiresACP, hasValidActiveACP, userEnabled } = params;

  return (
    !!publicClient &&
    !!address &&
    !!abi &&
    !!functionName &&
    (!requiresACP || hasValidActiveACP) &&
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
  requiresACP: boolean;
  activeACPHash?: string;
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
    requiresACP,
    activeACPHash,
    publicClient,
    queryOptions,
  } = params;

  const { enabled: _ignoredEnabled, meta: optionMeta, ...restQueryOptions } = queryOptions || {};

  return {
    enabled,
    // Recognition metadata for observers (debug panels / activity hook): the
    // contract + method, without them having to parse the query key.
    meta: {
      kind: 'cofheRead',
      chainId: cofheChainId,
      address,
      functionName,
      ...optionMeta,
    },
    queryKey: constructCofheReadContractQueryKey({
      cofheChainId,
      address,
      functionName,
      args: Array.isArray(args) ? args : undefined,
      requiresACP,
      activeACPHash,
    }),
    queryFn: withInvalidationContext<
      readonly unknown[],
      { blockHashToBeAwareOf: `0x${string}` },
      CofheReturnType<TAbi, TfunctionName>
    >(async ({ invalidationContext, signal }) => {
      // the invalidationContext matches the current query by key
      assert(address, 'Contract address should be guaranteed by enabled check');
      assert(publicClient, 'PublicClient should be guaranteed by enabled check');
      assert(abi, 'ABI should be guaranteed by enabled check');
      assert(functionName, 'Function name should be guaranteed by enabled check');

      const normalizedArgs = (args ?? []) as ContractFunctionArgs<TAbi, 'pure' | 'view', TfunctionName>;

      const out = await maybeWaitUntilRpcAwareAndReadContract(
        publicClient,
        {
          blockHashToBeAwareOf: invalidationContext?.blockHashToBeAwareOf,
          address,
          abi,
          functionName,
          args: normalizedArgs,
        },
        { signal }
      );

      const convertedOut = convertReadContractResultToCofheReturnType<TAbi, TfunctionName, TArgs>(out);

      const transformed = transformEncryptedReturnTypes(abi, functionName, convertedOut);

      return transformed;
    }),
    ...restQueryOptions,
  };
}

/**
 * Generic hook: read a contract and return the result (with acp/error gating support).
 * is Cofhe-ABI aware: returns CofheReturnType (but doesn't support TArgs typing yet).
 */
export type UseCofheReadContractResult<
  TAbi extends Abi,
  TfunctionName extends ContractFunctionName<TAbi, 'pure' | 'view'>,
> = UseQueryResult<CofheReturnType<TAbi, TfunctionName>, Error> & {
  disabledDueToMissingValidACP: boolean;
  /** The read is pinned to a `chainId` the client able to serve it is not on (see `CofheReadChainParams`). */
  disabledDueToWrongChain: boolean;
};

/**
 * Read a contract view function through the SDK cache; `useCofheWriteContract({ invalidates })`
 * refreshes it block-awarely. Which chain and client serve it:
 * - neither `chainId` nor `publicClient`: the connected wallet's;
 * - `chainId` alone: only while the wallet is on that chain (else `disabledDueToWrongChain`);
 * - `chainId` + `publicClient`: that client, wherever the wallet sits;
 * - `publicClient` alone: a type error.
 */
export function useCofheReadContract<
  TAbi extends Abi,
  TfunctionName extends ContractFunctionName<TAbi, 'pure' | 'view'>,
>(
  params: {
    address?: Address;
    abi?: TAbi;
    functionName?: TfunctionName;
    args?: ContractFunctionArgs<TAbi, 'pure' | 'view', TfunctionName>;
    requiresACP?: boolean;
  } & CofheReadChainParams,
  queryOptions?: UseCofheReadContractQueryOptions<TAbi, TfunctionName>
): UseCofheReadContractResult<TAbi, TfunctionName> {
  const { address, abi, functionName, args, requiresACP = true } = params;

  const { publicClient, cofheChainId, disabledDueToWrongChain } = useCofheReadTarget(params);
  const activeACP = useCofheActiveACP(cofheChainId);

  const enabled = getEnabledForCofheReadContract({
    publicClient,
    address,
    abi,
    functionName,
    requiresACP,
    hasValidActiveACP: !!activeACP?.isValid,
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
      requiresACP,
      activeACPHash: activeACP?.acp.hash,
      publicClient,
      queryOptions,
    })
  );

  return {
    ...result,
    disabledDueToMissingValidACP: requiresACP && (!activeACP || !activeACP.isValid),
    disabledDueToWrongChain,
  };
}
