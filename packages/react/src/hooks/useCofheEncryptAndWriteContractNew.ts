import type {
  Abi,
  Account,
  Chain,
  ContractFunctionArgs,
  ContractFunctionName,
  WriteContractParameters,
  WriteContractReturnType,
} from 'viem';
import { type CofheInputArgsPreTransform, extractEncryptableValues, insertEncryptedValues } from '@cofhe/abi';
import type { EncryptableItem, EncryptedItemInput } from '@cofhe/sdk';
import {
  useCofheEncryptInputsMutation,
  type EncryptInputsOptions,
  type UseCofheEncryptInputsMutationOptions,
} from './useCofheEncryptInputsMutation';
import {
  useCofheWalletWriteContractMutation,
  type UseCofheWalletWriteContractMutationOptions,
} from './useCofheWalletWriteContractMutation';

type NoInferLocal<T> = [T][T extends any ? 0 : never];

type ConfidentialityAwareAbiArgs<TAbi extends Abi | readonly unknown[], TFunctionName extends string> = NoInferLocal<
  Exclude<CofheInputArgsPreTransform<TAbi, TFunctionName>, undefined>
>;

export async function _encryptAndWriteContract<
  const TAbi extends Abi | readonly unknown[],
  TFunctionName extends ContractFunctionName<TAbi, 'payable' | 'nonpayable'>,
  TChainOverride extends Chain | undefined = undefined,
>({
  params,
  confidentialityAwareAbiArgs,
  encrypt,
  write,
}: {
  params: Omit<
    WriteContractParameters<
      TAbi,
      TFunctionName,
      ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
      Chain | undefined,
      Account | undefined,
      TChainOverride
    >,
    'args' | 'functionName'
  > & { functionName: TFunctionName };
  // Don't let args participate in inferring `TAbi`/`TFunctionName`.
  // Otherwise, an incorrect args shape can cause TS to widen TAbi to `readonly unknown[]`
  // (and then args become `unknown[]`, silently accepting anything).
  confidentialityAwareAbiArgs: ConfidentialityAwareAbiArgs<TAbi, TFunctionName>;
  encrypt: (encryptableItems: EncryptableItem[]) => Promise<readonly EncryptedItemInput[]>;
  write: (
    writeParams: WriteContractParameters<
      TAbi,
      TFunctionName,
      ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
      Chain | undefined,
      Account | undefined,
      TChainOverride
    >
  ) => Promise<WriteContractReturnType>;
}): Promise<WriteContractReturnType> {
  const transformer = constructEncryptAndTransform<TAbi, TFunctionName, TChainOverride>(
    params.abi,
    params.functionName,
    encrypt
  );
  const transformedArgs: WriteContractParameters<
    TAbi,
    TFunctionName,
    ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
    Chain | undefined,
    Account | undefined,
    TChainOverride
  >['args'] = await transformer(confidentialityAwareAbiArgs);

  // You can’t fix that spot “purely” (no as … and no any) while keeping this wrapper fully-generic over TAbi/TFunctionName.
  // Reason: viem’s WriteContractParameters ultimately includes a conditional type that depends on:
  // readonly [] extends ContractFunctionArgs<TAbi, ..., TFunctionName>
  // Inside a generic function body, TypeScript must typecheck for all possible TAbi/TFunctionName, so it cannot prove which branch you’re in. That’s why it rejects constructing/passing newParams as WriteContractParameters<...> even when your runtime object is correct.
  const newParams = {
    ...params,
    args: transformedArgs,
  } as WriteContractParameters<
    TAbi,
    TFunctionName,
    ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
    Chain | undefined,
    Account | undefined,
    TChainOverride
  >;

  return write(newParams);
}

function constructEncryptAndTransform<
  TAbi extends Abi | readonly unknown[],
  TFunctionName extends ContractFunctionName<TAbi, 'payable' | 'nonpayable'>,
  TChainOverride extends Chain | undefined = undefined,
>(
  abi: TAbi,
  functionName: TFunctionName,
  encrypt: (encryptableItems: EncryptableItem[]) => Promise<readonly EncryptedItemInput[]>
): (
  mixedArgs: Exclude<CofheInputArgsPreTransform<TAbi, TFunctionName>, undefined>
) => Promise<
  WriteContractParameters<
    TAbi,
    TFunctionName,
    ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
    Chain | undefined,
    Account | undefined,
    TChainOverride
  >['args']
> {
  // encrypts inputs that need to be encrypted and transform them
  return async (mixedArgs) => {
    const extracted = extractEncryptableValues(abi, functionName, mixedArgs);
    const encrypted = await encrypt(extracted);
    const merged = insertEncryptedValues(abi, functionName, mixedArgs, encrypted);

    // TODO: mismatch between CofheInputArgs<TAbi, TFunctionName> and WriteContractParameters<...>['args'] types
    return merged as WriteContractParameters<
      TAbi,
      TFunctionName,
      ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
      Chain | undefined,
      Account | undefined,
      TChainOverride
    >['args'];
  };
}

export function useCofheEncryptAndWriteContractNew<TExtraVars = unknown>({
  encrypingMutationOptions,
  writingMutationOptions,
}: {
  encrypingMutationOptions?: UseCofheEncryptInputsMutationOptions;
  writingMutationOptions?: UseCofheWalletWriteContractMutationOptions<TExtraVars>;
}) {
  const encryption = useCofheEncryptInputsMutation(encrypingMutationOptions);
  const write = useCofheWalletWriteContractMutation<TExtraVars>(writingMutationOptions);

  const encryptAndWrite = async <
    const TAbi extends Abi | readonly unknown[],
    TFunctionName extends ContractFunctionName<TAbi, 'payable' | 'nonpayable'>,
    TChainOverride extends Chain | undefined = undefined,
  >(args: {
    params: Omit<
      WriteContractParameters<
        TAbi,
        TFunctionName,
        ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
        Chain | undefined,
        Account | undefined,
        TChainOverride
      >,
      'args' | 'functionName'
    > & { functionName: TFunctionName };
    confidentialityAwareAbiArgs: ConfidentialityAwareAbiArgs<TAbi, TFunctionName>;
    extras?: TExtraVars;
    encryptionOptions?: EncryptInputsOptions;
  }) =>
    _encryptAndWriteContract<TAbi, TFunctionName, TChainOverride>({
      ...args,
      encrypt: (encryptableItems) =>
        encryption.encryptInputsAsync({
          items: encryptableItems as readonly EncryptableItem[],
          ...(args.encryptionOptions ?? {}),
        }),
      write: (writeParams) => {
        const vars =
          'extras' in args ? { writeContractInput: writeParams, extras: args.extras as TExtraVars } : writeParams;

        return write.writeContractAsync<
          TAbi,
          TFunctionName,
          ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
          TChainOverride
        >(vars);
      },
    });

  return {
    encryptAndWrite,
    encryption,
    write,
  };
}
