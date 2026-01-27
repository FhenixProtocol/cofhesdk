import type {
  Abi,
  Account,
  Address,
  Chain,
  ContractFunctionArgs,
  ContractFunctionName,
  WriteContractParameters,
  WriteContractReturnType,
} from 'viem';
import { type CofheInputArgsPreTransform, extractEncryptableValues, insertEncryptedValues } from '@cofhe/abi';
import type { EncryptableItem, EncryptedItemInput } from '@cofhe/sdk';
import { useCofheEncryptInputsMutation } from './useCofheEncryptInputsMutation';
import { useCofheWalletWriteContractMutation } from './useCofheWalletWriteContractMutation';
import { useEffect } from 'react';

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
  confidentialityAwareAbiArgs: CofheInputArgsPreTransform<TAbi, TFunctionName>;
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
  console.log('Writing contract with params:', confidentialityAwareAbiArgs);
  const transformer = constructTransformFn<TAbi, TFunctionName, TChainOverride>(
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

function constructTransformFn<
  TAbi extends Abi | readonly unknown[],
  TFunctionName extends ContractFunctionName<TAbi, 'payable' | 'nonpayable'>,
  TChainOverride extends Chain | undefined = undefined,
>(
  abi: TAbi,
  functionName: TFunctionName,
  encrypt: (encryptableItems: EncryptableItem[]) => Promise<readonly EncryptedItemInput[]>
): (
  mixedArgs: CofheInputArgsPreTransform<TAbi, TFunctionName>
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
  return async (mixedArgs) => {
    const extracted = extractEncryptableValues(abi, functionName, mixedArgs);
    const encrypted = await encrypt(extracted);
    const merged = insertEncryptedValues(abi, functionName, mixedArgs, encrypted);
    // TODO: constructTransformFn make types match
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

export function useCofheEncryptAndWriteContractNew() {
  const encryption = useCofheEncryptInputsMutation();
  const write = useCofheWalletWriteContractMutation();

  const encryptAndWriteContract = async <
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
    confidentialityAwareAbiArgs: CofheInputArgsPreTransform<TAbi, TFunctionName>;
  }) =>
    _encryptAndWriteContract<TAbi, TFunctionName, TChainOverride>({
      ...args,
      encrypt: encryption.encryptInputsAsync,
      write: (writeParams) =>
        write.writeContractAsync(
          writeParams as unknown as Parameters<typeof write.writeContractAsync>[0]
        ) as Promise<WriteContractReturnType>,
    });

  return {
    encryptAndWriteContract,
    encryption,
    write,
  };
}

export const CONTRACT_ADDRESS: Address = '0xfEF0C260cb5a9A1761C0c0Fd6e34248C330C9e5a';

function useTesting() {
  const { encryptAndWriteContract } = useCofheEncryptAndWriteContractNew();

  useEffect(() => {
    if (true as any) return;
    encryptAndWriteContract({
      params: {
        abi: [
          {
            inputs: [
              {
                internalType: 'address',
                name: 'to',
                type: 'address',
              },
              {
                components: [
                  {
                    internalType: 'uint256',
                    name: 'ctHash',
                    type: 'uint256',
                  },
                  {
                    internalType: 'uint8',
                    name: 'securityZone',
                    type: 'uint8',
                  },
                  {
                    internalType: 'uint8',
                    name: 'utype',
                    type: 'uint8',
                  },
                  {
                    internalType: 'bytes',
                    name: 'signature',
                    type: 'bytes',
                  },
                ],
                internalType: 'struct InEuint128',
                name: 'inValue',
                type: 'tuple',
              },
            ],
            name: 'encTransfer',
            outputs: [
              {
                internalType: 'euint128',
                name: 'transferred',
                type: 'uint256',
              },
            ],
            stateMutability: 'nonpayable',
            type: 'function',
          },
        ] as const,
        functionName: 'encTransfer',
        // args: ['0x9A9B640F221Fb8E7A283501367812c50C6805ED1', 124n] as const,
        account: '0x1234567890123456789012345678901234567890',
        address: CONTRACT_ADDRESS,
        chain: undefined,
      },
      confidentialityAwareAbiArgs: ['0x9A9B640F221Fb8E7A283501367812c50C6805ED1', 123n],
    });
  }, [encryptAndWriteContract]);
}
