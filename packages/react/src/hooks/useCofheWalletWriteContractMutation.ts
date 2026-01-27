import type { UseMutationOptions, UseMutationResult } from '@tanstack/react-query';
import type {
  Abi,
  Account,
  Chain,
  ContractFunctionArgs,
  ContractFunctionName,
  Hash,
  WalletClient,
  WriteContractParameters,
} from 'viem';
import { assert } from 'ts-essentials';
import { useInternalMutation } from '../providers/index.js';
import { useCofheWalletClient } from './useCofheConnection.js';

type WalletWriteContractParamsAny = Parameters<WalletClient['writeContract']>[0];

export type WalletWriteContractParams<
  TAbi extends Abi | readonly unknown[],
  TFunctionName extends ContractFunctionName<TAbi, 'payable' | 'nonpayable'>,
  TArgs extends ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
  TChainOverride extends Chain | undefined = undefined,
> = WriteContractParameters<TAbi, TFunctionName, TArgs, Chain | undefined, Account | undefined, TChainOverride>;

export type UseCofheWalletWriteContractMutationOptions = Omit<
  UseMutationOptions<Hash, Error, WalletWriteContractParamsAny, unknown>,
  'mutationFn'
>;

/**
 * Low-level mutation hook: call `walletClient.writeContract`.
 *
 * Unlike `useCofheWriteContract`, this accepts viem's full `writeContract` parameter type.
 */
export function useCofheWalletWriteContractMutation(
  options?: UseCofheWalletWriteContractMutationOptions
): UseMutationResult<Hash, Error, WalletWriteContractParamsAny, unknown> & {
  writeContractAsync: <
    TAbi extends Abi | readonly unknown[],
    TFunctionName extends ContractFunctionName<TAbi, 'payable' | 'nonpayable'>,
    TArgs extends ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
    TChainOverride extends Chain | undefined = undefined,
  >(
    params: WalletWriteContractParams<TAbi, TFunctionName, TArgs, TChainOverride>
  ) => Promise<Hash>;
  writeContract: <
    TAbi extends Abi | readonly unknown[],
    TFunctionName extends ContractFunctionName<TAbi, 'payable' | 'nonpayable'>,
    TArgs extends ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
    TChainOverride extends Chain | undefined = undefined,
  >(
    params: WalletWriteContractParams<TAbi, TFunctionName, TArgs, TChainOverride>
  ) => void;
} {
  const walletClient = useCofheWalletClient();

  const mutation = useInternalMutation<Hash, Error, WalletWriteContractParamsAny, unknown>({
    ...options,
    mutationKey: options?.mutationKey ?? ['cofhe', 'walletWriteContract'],
    mutationFn: async (params) => {
      assert(walletClient, 'WalletClient is required to write to a contract');
      return walletClient.writeContract(params);
    },
  });

  const writeContractAsync = async <
    TAbi extends Abi | readonly unknown[],
    TFunctionName extends ContractFunctionName<TAbi, 'payable' | 'nonpayable'>,
    TArgs extends ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
    TChainOverride extends Chain | undefined = undefined,
  >(
    params: WalletWriteContractParams<TAbi, TFunctionName, TArgs, TChainOverride>
  ) => mutation.mutateAsync(params as WalletWriteContractParamsAny);

  const writeContract = <
    TAbi extends Abi | readonly unknown[],
    TFunctionName extends ContractFunctionName<TAbi, 'payable' | 'nonpayable'>,
    TArgs extends ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
    TChainOverride extends Chain | undefined = undefined,
  >(
    params: WalletWriteContractParams<TAbi, TFunctionName, TArgs, TChainOverride>
  ) => mutation.mutate(params as WalletWriteContractParamsAny);

  return {
    ...mutation,
    writeContractAsync,
    writeContract,
  };
}
