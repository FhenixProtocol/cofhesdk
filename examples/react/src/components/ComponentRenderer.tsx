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
  WalletClient,
  Transport,
} from 'viem';
import { createMockWalletAndPublicClient } from '../utils/misc';
import { sepolia } from 'viem/chains';
import { Abi, CofheInputArgsPreTransform, extractEncryptableValues, insertEncryptedValues } from '@cofhe/abi';
import { useCofheClient } from '@cofhe/react';

interface ComponentRendererProps {
  activeComponent: string;
  isDarkMode: boolean;
}

export const TestABI = [
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
  // {
  //   inputs: [
  //     {
  //       internalType: 'address',
  //       name: 'to',
  //       type: 'address',
  //     },
  //     {
  //       internalType: 'euint128',
  //       name: 'value',
  //       type: 'uint256',
  //     },
  //   ],
  //   name: 'encTransfer',
  //   outputs: [
  //     {
  //       internalType: 'euint128',
  //       name: 'transferred',
  //       type: 'uint256',
  //     },
  //   ],
  //   stateMutability: 'nonpayable',
  //   type: 'function',
  // },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'returnsTwoEncryptedValues',
    outputs: [
      {
        internalType: 'euint128',
        name: '',
        type: 'uint256',
      },
      {
        internalType: 'euint128',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const CONTRACT_ADDRESS: Address = '0xfEF0C260cb5a9A1761C0c0Fd6e34248C330C9e5a';

export async function encryptAndWriteContract<
  const TAbi extends Abi | readonly unknown[],
  TFunctionName extends ContractFunctionName<TAbi, 'payable' | 'nonpayable'>,
  TArgs extends ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
  TChainOverride extends Chain | undefined = undefined,
  TChain extends Chain | undefined = Chain | undefined,
  TAccount extends Account | undefined = Account | undefined,
>(
  params: Omit<
    WriteContractParameters<TAbi, TFunctionName, TArgs, TChain, TAccount, TChainOverride>,
    'args' | 'functionName'
  > & { functionName: TFunctionName },
  walletClient: WalletClient<Transport, TChain, TAccount>,
  cofheClient: ReturnType<typeof useCofheClient>,
  confidentialityAwareAbiArgs: CofheInputArgsPreTransform<TAbi, TFunctionName>,
): Promise<WriteContractReturnType> {
  console.log('Writing contract with params:', confidentialityAwareAbiArgs);
  const transformer = constructTransformFn<TAbi, TFunctionName, TArgs, TChainOverride, TChain, TAccount>(
    params.abi,
    params.functionName,
    cofheClient,
  );
  const transformedArgs: WriteContractParameters<TAbi, TFunctionName, TArgs, TChain, TAccount, TChainOverride>['args'] =
    await transformer(confidentialityAwareAbiArgs);

  // You can’t fix that spot “purely” (no as … and no any) while keeping this wrapper fully-generic over TAbi/TFunctionName.
  // Reason: viem’s WriteContractParameters ultimately includes a conditional type that depends on:
  // readonly [] extends ContractFunctionArgs<TAbi, ..., TFunctionName>
  // Inside a generic function body, TypeScript must typecheck for all possible TAbi/TFunctionName, so it cannot prove which branch you’re in. That’s why it rejects constructing/passing newParams as WriteContractParameters<...> even when your runtime object is correct.

  const newParams = {
    ...params,
    args: transformedArgs,
  } as WriteContractParameters<TAbi, TFunctionName, TArgs, TChain, TAccount, TChainOverride>;

  return walletClient.writeContract(newParams);
}

const walletClient = createMockWalletAndPublicClient(sepolia.id).walletClient;

// 1. I pass args decoded + encrypted in the same one UnencryptedUserInputArgs<TAbi, TFunctionName> (aka CofheInputArgsPreTransform<TAbi, TFunctionName>)
// 2. encryptAndWriteFn figures out what needs to be encrypted (extractEncryptableValues) and encrypts only those values
// 3. it merges the original args with the encrypted values (insertEncryptedValues) to produce final args
//

function constructTransformFn<
  TAbi extends Abi | readonly unknown[],
  TFunctionName extends ContractFunctionName<TAbi, 'payable' | 'nonpayable'>,
  TArgs extends ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
  TChainOverride extends Chain | undefined = undefined,
  TChain extends Chain | undefined = Chain | undefined,
  TAccount extends Account | undefined = Account | undefined,
>(
  abi: TAbi,
  functionName: TFunctionName,
  client: ReturnType<typeof useCofheClient>,
): (
  mixedArgs: CofheInputArgsPreTransform<TAbi, TFunctionName>,
) => Promise<WriteContractParameters<TAbi, TFunctionName, TArgs, TChain, TAccount, TChainOverride>['args']> {
  return async (mixedArgs) => {
    const extracted = extractEncryptableValues(abi, functionName, mixedArgs);
    const encrypted = await client.encryptInputs(extracted).encrypt();
    const merged = insertEncryptedValues(abi, functionName, mixedArgs, encrypted);
    // TODO: constructTransformFn make types match
    return merged as WriteContractParameters<TAbi, TFunctionName, TArgs, TChain, TAccount, TChainOverride>['args'];
  };
}

const TestAutoDecryptionComponent: React.FC = () => {
  const client = useCofheClient();

  useEffect(() => {
    encryptAndWriteContract(
      {
        abi: TestABI,
        functionName: 'encTransfer',
        // args: ['0x9A9B640F221Fb8E7A283501367812c50C6805ED1', 124n] as const,
        account: '0x1234567890123456789012345678901234567890',
        address: CONTRACT_ADDRESS,
        chain: undefined,
      },
      walletClient,
      client,
      ['0x9A9B640F221Fb8E7A283501367812c50C6805ED1', 124n],
    );
  }, []);

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
