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

export type WalletWriteContractInputWithExtras<TExtras> = {
  writeContractInput: WalletWriteContractParamsAny;
  extras: TExtras;
};

type WalletWriteContractMutationVariables<TExtras> =
  | WalletWriteContractParamsAny
  | WalletWriteContractInputWithExtras<TExtras>;

function hasExtras<TExtras>(
  variables: WalletWriteContractMutationVariables<TExtras>
): variables is WalletWriteContractInputWithExtras<TExtras> {
  return (
    typeof variables === 'object' && variables !== null && 'writeContractInput' in variables && 'extras' in variables
  );
}

export type WalletWriteContractParams<
  TAbi extends Abi | readonly unknown[],
  TFunctionName extends ContractFunctionName<TAbi, 'payable' | 'nonpayable'>,
  TArgs extends ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
  TChainOverride extends Chain | undefined = undefined,
> = WriteContractParameters<TAbi, TFunctionName, TArgs, Chain | undefined, Account | undefined, TChainOverride>;

export type UseCofheWalletWriteContractMutationOptions<TExtras = unknown> = Omit<
  UseMutationOptions<Hash, Error, WalletWriteContractMutationVariables<TExtras>, unknown>,
  'mutationFn'
>;

/**
 * Low-level mutation hook: call `walletClient.writeContract`.
 *
 * Unlike `useCofheWriteContract`, this accepts viem's full `writeContract` parameter type.
 */
export function useCofheWalletWriteContractMutation<TExtras = unknown>(
  options?: UseCofheWalletWriteContractMutationOptions<TExtras>
): UseMutationResult<Hash, Error, WalletWriteContractMutationVariables<TExtras>, unknown> & {
  writeContractAsync: <
    TAbi extends Abi | readonly unknown[],
    TFunctionName extends ContractFunctionName<TAbi, 'payable' | 'nonpayable'>,
    TArgs extends ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
    TChainOverride extends Chain | undefined = undefined,
  >(
    params:
      | WalletWriteContractParams<TAbi, TFunctionName, TArgs, TChainOverride>
      | {
          writeContractInput: WalletWriteContractParams<TAbi, TFunctionName, TArgs, TChainOverride>;
          extras: TExtras;
        }
  ) => Promise<Hash>;
  writeContract: <
    TAbi extends Abi | readonly unknown[],
    TFunctionName extends ContractFunctionName<TAbi, 'payable' | 'nonpayable'>,
    TArgs extends ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
    TChainOverride extends Chain | undefined = undefined,
  >(
    params:
      | WalletWriteContractParams<TAbi, TFunctionName, TArgs, TChainOverride>
      | {
          writeContractInput: WalletWriteContractParams<TAbi, TFunctionName, TArgs, TChainOverride>;
          extras: TExtras;
        }
  ) => void;
} {
  const walletClient = useCofheWalletClient();

  const mutation = useInternalMutation<Hash, Error, WalletWriteContractMutationVariables<TExtras>, unknown>({
    ...options,
    mutationKey: options?.mutationKey ?? ['cofhe', 'walletWriteContract'],
    mutationFn: async (variables) => {
      assert(walletClient, 'WalletClient is required to write to a contract');

      const writeContractInput = hasExtras(variables) ? variables.writeContractInput : variables;
      return walletClient.writeContract(writeContractInput);
    },
  });

  const writeContractAsync = async <
    TAbi extends Abi | readonly unknown[],
    TFunctionName extends ContractFunctionName<TAbi, 'payable' | 'nonpayable'>,
    TArgs extends ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
    TChainOverride extends Chain | undefined = undefined,
  >(
    params:
      | WalletWriteContractParams<TAbi, TFunctionName, TArgs, TChainOverride>
      | {
          writeContractInput: WalletWriteContractParams<TAbi, TFunctionName, TArgs, TChainOverride>;
          extras: TExtras;
        }
  ) => mutation.mutateAsync(params as unknown as WalletWriteContractMutationVariables<TExtras>);

  const writeContract = <
    TAbi extends Abi | readonly unknown[],
    TFunctionName extends ContractFunctionName<TAbi, 'payable' | 'nonpayable'>,
    TArgs extends ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
    TChainOverride extends Chain | undefined = undefined,
  >(
    params:
      | WalletWriteContractParams<TAbi, TFunctionName, TArgs, TChainOverride>
      | {
          writeContractInput: WalletWriteContractParams<TAbi, TFunctionName, TArgs, TChainOverride>;
          extras: TExtras;
        }
  ) => mutation.mutate(params as unknown as WalletWriteContractMutationVariables<TExtras>);

  return {
    ...mutation,
    writeContractAsync,
    writeContract,
  };
}
