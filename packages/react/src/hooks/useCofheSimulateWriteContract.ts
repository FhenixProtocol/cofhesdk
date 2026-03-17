import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type {
  Address,
  Abi,
  Account,
  Chain,
  ContractFunctionArgs,
  ContractFunctionName,
  PublicClient,
  WalletClient,
  WriteContractParameters,
} from 'viem';
import { assert } from 'ts-essentials';
import { useInternalQuery } from '../providers/index.js';
import { useCofheChainId, useCofhePublicClient, useCofheWalletClient } from './useCofheConnection.js';
import { useIsCofheErrorActive } from './useIsCofheErrorActive.js';

const QUERY_CACHE_PREFIX = 'cofheSimulateWriteContract';

type SimulateContractReturnAny = Awaited<ReturnType<PublicClient['simulateContract']>>;

type WalletWriteContractParamsAny = Parameters<WalletClient['writeContract']>[0];

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

function serializeIfBigint(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

function serializeBigintRecursively(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(serializeBigintRecursively);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = serializeIfBigint(v);
    return out;
  }
  return serializeIfBigint(value);
}

function getAccountAddress(account: unknown): `0x${string}` | undefined {
  if (!account) return undefined;
  if (typeof account === 'string') return account as `0x${string}`;
  if (typeof account === 'object' && 'address' in (account as any)) return (account as any).address as `0x${string}`;
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
  callArgs?: WalletWriteContractParamsAny;
  resolvedAccountAddress?: `0x${string}`;
  enabled?: boolean;
}): readonly unknown[] {
  const { cofheChainId, callArgs, resolvedAccountAddress, enabled } = params;

  const serialized =
    callArgs && typeof callArgs === 'object'
      ? {
          address: (callArgs as any).address,
          functionName: (callArgs as any).functionName,
          args: Array.isArray((callArgs as any).args) ? serializeBigintRecursively((callArgs as any).args) : undefined,
          value: serializeIfBigint((callArgs as any).value),
          dataSuffix: (callArgs as any).dataSuffix,
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
      callArgs: callArgs as unknown as WalletWriteContractParamsAny | undefined,
      resolvedAccountAddress,
      enabled,
    }),
    queryFn: async () => {
      assert(publicClient, 'PublicClient is required to simulate contract');
      assert(walletClient, 'WalletClient is required to simulate contract');
      assert(callArgs, 'callArgs is guaranteed to be defined by enabled condition');

      const accountForSimulation = (callArgs.account ?? walletClient.account) as Account | undefined;
      assert(accountForSimulation, 'Wallet account is required to simulate contract');

      const { chain, ...rest } = callArgs as any;
      return publicClient.simulateContract({
        ...(chain ? { ...rest, chain } : rest),
        account: accountForSimulation,
      } as any);
    },
    ...restQueryOptions,
  });
}
