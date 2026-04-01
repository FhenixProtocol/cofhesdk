import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type {
  Address,
  Abi,
  Account,
  Chain,
  ContractFunctionArgs,
  ContractFunctionName,
  PublicClient,
  SimulateContractParameters,
  SimulateContractReturnType,
} from 'viem';
import { assert } from 'ts-essentials';
import { useInternalQuery } from '../providers/index.js';
import { useCofheChainId, useCofhePublicClient, useCofheWalletClient } from './useCofheConnection.js';
import { serializeBigintRecursively, serializeIfBigint } from '../utils/serializeBigint.js';

const QUERY_CACHE_PREFIX = 'cofheSimulateWriteContract';

export type CofheSimulateWriteContractCallArgs<
  TAbi extends Abi | readonly unknown[] = Abi,
  TFunctionName extends ContractFunctionName<TAbi, 'nonpayable' | 'payable'> = ContractFunctionName<
    TAbi,
    'nonpayable' | 'payable'
  >,
  TArgs extends ContractFunctionArgs<TAbi, 'nonpayable' | 'payable', TFunctionName> = ContractFunctionArgs<
    TAbi,
    'nonpayable' | 'payable',
    TFunctionName
  >,
  TChainOverride extends Chain | undefined = Chain | undefined,
> = SimulateContractParameters<
  TAbi,
  TFunctionName,
  TArgs,
  Chain | undefined,
  TChainOverride,
  Account | Address | undefined
>;

type CofheSimulateWriteContractData<
  TAbi extends Abi | readonly unknown[],
  TFunctionName extends ContractFunctionName<TAbi, 'nonpayable' | 'payable'>,
  TArgs extends ContractFunctionArgs<TAbi, 'nonpayable' | 'payable', TFunctionName>,
  TChainOverride extends Chain | undefined,
> = SimulateContractReturnType<
  TAbi,
  TFunctionName,
  TArgs,
  Chain | undefined,
  Account | undefined,
  TChainOverride,
  Account | Address | undefined
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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

export type UseCofheSimulateWriteContractQueryOptions<TData, TSelectedData> = Omit<
  UseQueryOptions<TData, Error, TSelectedData>,
  'queryKey' | 'queryFn'
> & {
  enabled?: boolean;
};

export function constructCofheSimulateWriteContractQueryKey(params: {
  cofheChainId?: number;
  callArgs?: unknown;
  resolvedAccountAddress?: Address;
  enabled?: boolean;
}): readonly unknown[] {
  const { cofheChainId, callArgs, resolvedAccountAddress, enabled } = params;

  const serialized = isRecord(callArgs)
    ? {
        address: typeof callArgs.address === 'string' ? callArgs.address : undefined,
        functionName: typeof callArgs.functionName === 'string' ? callArgs.functionName : undefined,
        args: Array.isArray(callArgs.args) ? serializeBigintRecursively(callArgs.args) : undefined,
        value: serializeIfBigint(callArgs.value),
        dataSuffix: typeof callArgs.dataSuffix === 'string' ? callArgs.dataSuffix : undefined,
        account: resolvedAccountAddress,
      }
    : undefined;

  return [QUERY_CACHE_PREFIX, cofheChainId, serialized, enabled] as const;
}

export function useCofheSimulateWriteContract<
  TAbi extends Abi | readonly unknown[] = Abi,
  TFunctionName extends ContractFunctionName<TAbi, 'nonpayable' | 'payable'> = ContractFunctionName<
    TAbi,
    'nonpayable' | 'payable'
  >,
  TArgs extends ContractFunctionArgs<TAbi, 'nonpayable' | 'payable', TFunctionName> = ContractFunctionArgs<
    TAbi,
    'nonpayable' | 'payable',
    TFunctionName
  >,
  TChainOverride extends Chain | undefined = Chain | undefined,
  TSelectedData = CofheSimulateWriteContractData<TAbi, TFunctionName, TArgs, TChainOverride>,
>(
  callArgs?: CofheSimulateWriteContractCallArgs<TAbi, TFunctionName, TArgs, TChainOverride>,
  queryOptions?: UseCofheSimulateWriteContractQueryOptions<
    CofheSimulateWriteContractData<TAbi, TFunctionName, TArgs, TChainOverride>,
    TSelectedData
  >
): UseQueryResult<TSelectedData, Error> {
  const walletClient = useCofheWalletClient();
  const publicClient = useCofhePublicClient();
  const cofheChainId = useCofheChainId();

  const { enabled: userEnabled, ...restQueryOptions } = queryOptions || {};

  const resolvedAccountAddress = getAccountAddress(callArgs?.account ?? walletClient?.account);
  const enabled = !!publicClient && !!walletClient && !!callArgs && !!resolvedAccountAddress && (userEnabled ?? true);

  type TData = CofheSimulateWriteContractData<TAbi, TFunctionName, TArgs, TChainOverride>;

  return useInternalQuery<TData, Error, TSelectedData>({
    enabled,
    queryKey: constructCofheSimulateWriteContractQueryKey({
      cofheChainId,
      callArgs,
      resolvedAccountAddress,
      enabled,
    }),
    retry: false, // no need to retry on error. The whole point of simulation is to check if there's an error
    queryFn: async () => {
      assert(publicClient, 'PublicClient is required to simulate contract');
      assert(walletClient, 'WalletClient is required to simulate contract');
      assert(callArgs, 'callArgs is guaranteed to be defined by enabled condition');

      const accountForSimulation = callArgs.account ?? walletClient.account;
      assert(accountForSimulation, 'Wallet account is required to simulate contract');

      const simulateArgs: CofheSimulateWriteContractCallArgs<TAbi, TFunctionName, TArgs, TChainOverride> = {
        ...callArgs,
        account: accountForSimulation,
      };

      return publicClient.simulateContract<TAbi, TFunctionName, TArgs, TChainOverride, Account | Address | undefined>(
        simulateArgs
      );
    },
    ...restQueryOptions,
  });
}
