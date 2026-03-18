import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { Address, Abi, Account, Chain, PublicClient } from 'viem';
import { assert } from 'ts-essentials';
import { useInternalQuery } from '../providers/index.js';
import { useCofheChainId, useCofhePublicClient, useCofheWalletClient } from './useCofheConnection.js';
import { useIsCofheErrorActive } from './useIsCofheErrorActive.js';

const QUERY_CACHE_PREFIX = 'cofheSimulateWriteContract';

type SimulateContractReturnAny = Awaited<ReturnType<PublicClient['simulateContract']>>;

/**
 * A deliberately loose type for write-like call arguments.
 *
 * viem's `WriteContractParameters` / `simulateContract` types use conditional typing
 * to allow/forbid fields like `value` depending on ABI + function mutability.
 *
 * For this hook we care about a stable, ergonomic input shape (so you can build
 * call args from higher-level hooks and just inspect `{ error }`).
 */
export type CofheSimulateWriteContractCallArgs = {
  address: Address;
  abi: Abi | readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
  account?: Account | Address | null;
  chain?: Chain | null | undefined;
  value?: bigint;
  dataSuffix?: `0x${string}`;
} & Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function serializeIfBigint(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

function serializeBigintRecursively(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(serializeBigintRecursively);
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = serializeIfBigint(v);
    return out;
  }
  return serializeIfBigint(value);
}

function hasAddress(value: object): value is { address: Address } {
  return 'address' in value && typeof (value as { address?: unknown }).address === 'string';
}

function getAccountAddress(account: Account | Address | null | undefined): Address | undefined {
  if (!account) return undefined;
  if (typeof account === 'string') return account;
  if (typeof account === 'object' && hasAddress(account)) return account.address;
  return undefined;
}

export type CofheSimulateWriteContractParams = CofheSimulateWriteContractCallArgs;

export type UseCofheSimulateWriteContractQueryOptions<TSelectedData> = Omit<
  UseQueryOptions<SimulateContractReturnAny, Error, TSelectedData>,
  'queryKey' | 'queryFn'
> & {
  enabled?: boolean;
};

export function constructCofheSimulateWriteContractQueryKey(params: {
  cofheChainId?: number;
  callArgs?: CofheSimulateWriteContractCallArgs;
  resolvedAccountAddress?: Address;
  enabled?: boolean;
}): readonly unknown[] {
  const { cofheChainId, callArgs, resolvedAccountAddress, enabled } = params;

  const serialized =
    callArgs && typeof callArgs === 'object'
      ? {
          address: callArgs.address,
          functionName: callArgs.functionName,
          args: Array.isArray(callArgs.args) ? serializeBigintRecursively(callArgs.args) : undefined,
          value: serializeIfBigint(callArgs.value),
          dataSuffix: callArgs.dataSuffix,
          account: resolvedAccountAddress,
        }
      : undefined;

  return [QUERY_CACHE_PREFIX, cofheChainId, serialized, enabled] as const;
}

export function useCofheSimulateWriteContract<TSelectedData = SimulateContractReturnAny>(
  callArgs?: CofheSimulateWriteContractParams,
  queryOptions?: UseCofheSimulateWriteContractQueryOptions<TSelectedData>
): UseQueryResult<TSelectedData, Error> {
  const walletClient = useCofheWalletClient();
  const publicClient = useCofhePublicClient();
  const cofheChainId = useCofheChainId();
  const isCofheErrorActive = useIsCofheErrorActive();

  const { enabled: userEnabled, ...restQueryOptions } = queryOptions || {};

  const resolvedAccountAddress = getAccountAddress(callArgs?.account ?? walletClient?.account);
  const enabled =
    !isCofheErrorActive &&
    !!publicClient &&
    !!walletClient &&
    !!callArgs &&
    !!resolvedAccountAddress &&
    (userEnabled ?? true);

  return useInternalQuery({
    enabled,
    queryKey: constructCofheSimulateWriteContractQueryKey({
      cofheChainId,
      callArgs,
      resolvedAccountAddress,
      enabled,
    }),
    queryFn: async () => {
      assert(publicClient, 'PublicClient is required to simulate contract');
      assert(walletClient, 'WalletClient is required to simulate contract');
      assert(callArgs, 'callArgs is guaranteed to be defined by enabled condition');

      const accountForSimulation = callArgs.account ?? walletClient.account;
      assert(accountForSimulation, 'Wallet account is required to simulate contract');

      const { chain, ...rest } = callArgs;

      // `simulateContract` uses ABI + function mutability to conditionally allow/disallow fields
      // like `value`. This hook deliberately accepts a stable, "write-like" input surface, so we
      // keep the type-escape hatch isolated to this one callsite.
      return publicClient.simulateContract({
        ...rest,
        ...(chain ? { chain } : {}),
        account: accountForSimulation,
      } as unknown as Parameters<PublicClient['simulateContract']>[0]);
    },
    ...restQueryOptions,
  });
}
