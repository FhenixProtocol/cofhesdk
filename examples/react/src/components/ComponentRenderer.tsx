import React, { useEffect } from 'react';
import { Overview } from './examples/Overview';
import { FnxEncryptInputExample } from './examples/FnxEncryptInputExample';
import { HooksExample } from './examples/HooksExample';
import { FnxFloatingButtonExample } from './examples/FnxFloatingButtonExample';
import {
  // Abi,
  Account,
  Address,
  Chain,
  ContractFunctionArgs,
  ContractFunctionName,
  WriteContractParameters,
  WriteContractReturnType,
} from 'viem';
import { Abi, CofheInputArgsPreTransform, extractEncryptableValues, insertEncryptedValues } from '@cofhe/abi';
import type { EncryptableItem, EncryptedItemInput } from '@cofhe/sdk';
import { useCofheClient, useCofheEncryptInputsMutation, useCofheWalletWriteContractMutation } from '@cofhe/react';
import { TestABI } from './tmp-abis';

interface ComponentRendererProps {
  activeComponent: string;
  isDarkMode: boolean;
}

export const CONTRACT_ADDRESS: Address = '0xfEF0C260cb5a9A1761C0c0Fd6e34248C330C9e5a';

export async function encryptAndWriteContract<
  const TAbi extends Abi | readonly unknown[],
  TFunctionName extends ContractFunctionName<TAbi, 'payable' | 'nonpayable'>,
  TArgs extends ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
  TChainOverride extends Chain | undefined = undefined,
>({
  params,
  confidentialityAwareAbiArgs,
  encrypt,
  write,
}: {
  params: Omit<
    WriteContractParameters<TAbi, TFunctionName, TArgs, Chain | undefined, Account | undefined, TChainOverride>,
    'args' | 'functionName'
  > & { functionName: TFunctionName };
  confidentialityAwareAbiArgs: CofheInputArgsPreTransform<TAbi, TFunctionName>;
  encrypt: (encryptableItems: EncryptableItem[]) => Promise<readonly EncryptedItemInput[]>;
  write: (
    writeParams: WriteContractParameters<
      TAbi,
      TFunctionName,
      TArgs,
      Chain | undefined,
      Account | undefined,
      TChainOverride
    >,
  ) => Promise<WriteContractReturnType>;
}): Promise<WriteContractReturnType> {
  console.log('Writing contract with params:', confidentialityAwareAbiArgs);
  const transformer = constructTransformFn<TAbi, TFunctionName, TArgs, TChainOverride>(
    params.abi,
    params.functionName,
    encrypt,
  );
  const transformedArgs: WriteContractParameters<
    TAbi,
    TFunctionName,
    TArgs,
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
  } as WriteContractParameters<TAbi, TFunctionName, TArgs, Chain | undefined, Account | undefined, TChainOverride>;

  return write(newParams);
}

// const walletClient = createMockWalletAndPublicClient(sepolia.id).walletClient;

// 1. I pass args decoded + encrypted in the same one UnencryptedUserInputArgs<TAbi, TFunctionName> (aka CofheInputArgsPreTransform<TAbi, TFunctionName>)
// 2. encryptAndWriteFn figures out what needs to be encrypted (extractEncryptableValues) and encrypts only those values
// 3. it merges the original args with the encrypted values (insertEncryptedValues) to produce final args
//

function constructTransformFn<
  TAbi extends Abi | readonly unknown[],
  TFunctionName extends ContractFunctionName<TAbi, 'payable' | 'nonpayable'>,
  TArgs extends ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
  TChainOverride extends Chain | undefined = undefined,
>(
  abi: TAbi,
  functionName: TFunctionName,
  encrypt: (encryptableItems: EncryptableItem[]) => Promise<readonly EncryptedItemInput[]>,
): (
  mixedArgs: CofheInputArgsPreTransform<TAbi, TFunctionName>,
) => Promise<
  WriteContractParameters<TAbi, TFunctionName, TArgs, Chain | undefined, Account | undefined, TChainOverride>['args']
> {
  return async (mixedArgs) => {
    const extracted = extractEncryptableValues(abi, functionName, mixedArgs);
    const encrypted = await encrypt(extracted);
    const merged = insertEncryptedValues(abi, functionName, mixedArgs, encrypted);
    // TODO: constructTransformFn make types match
    return merged as WriteContractParameters<
      TAbi,
      TFunctionName,
      TArgs,
      Chain | undefined,
      Account | undefined,
      TChainOverride
    >['args'];
  };
}

function useNewEncryptAndWriteContract() {
  const client = useCofheClient();

  const { encryptInputsAsync } = useCofheEncryptInputsMutation();
  const { writeContractAsync } = useCofheWalletWriteContractMutation();

  useEffect(() => {
    encryptAndWriteContract({
      params: {
        abi: TestABI,
        functionName: 'encTransfer',
        // args: ['0x9A9B640F221Fb8E7A283501367812c50C6805ED1', 124n] as const,
        account: '0x1234567890123456789012345678901234567890',
        address: CONTRACT_ADDRESS,
        chain: undefined,
      },
      confidentialityAwareAbiArgs: ['0x9A9B640F221Fb8E7A283501367812c50C6805ED1', 124n],
      encrypt: encryptInputsAsync,
      write: writeContractAsync,
    });
  }, [client]);
}

const TestAutoDecryptionComponent: React.FC = () => {
  useNewEncryptAndWriteContract();
  //   address: '0xfEF0C260cb5a9A1761C0c0Fd6e34248C330C9e5a',
  //   abi: TestABI,
  //   functionName: 'returnsTwoEncryptedValues',
  //   args: ['0x9A9B640F221Fb8E7A283501367812c50C6805ED1'],
  //   potentialDecryptErrorCause: ErrorCause.AttemptToFetchConfidentialBalance,
  //   fheType: FheTypes.Int128,
  // });
  // console.log('Encrypted values from contract:', encrypted);
  // console.log('Decrypted values from contract:', decrypted);
  return null;
};
export const ComponentRenderer: React.FC<ComponentRendererProps> = ({ activeComponent, isDarkMode }) => {
  const renderComponent = () => {
    switch (activeComponent) {
      case 'overview':
        return <Overview />;
      case 'fnx-encrypt-input':
        return <FnxEncryptInputExample />;
      case 'fnx-floating-button':
        return <FnxFloatingButtonExample />;
      case 'hooks-example':
        return <HooksExample />;
      default:
        return <Overview />;
    }
  };

  return (
    <>
      <TestAutoDecryptionComponent />
      <div className={`flex-1 overflow-y-auto ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="max-w-4xl mx-auto p-8">
          <div className={isDarkMode ? 'text-white' : 'text-gray-900'}>{renderComponent()}</div>
        </div>
      </div>
    </>
  );
};
