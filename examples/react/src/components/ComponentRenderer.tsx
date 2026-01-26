import React from 'react';
import { Overview } from './examples/Overview';
import { FnxEncryptInputExample } from './examples/FnxEncryptInputExample';
import { HooksExample } from './examples/HooksExample';
import { FnxFloatingButtonExample } from './examples/FnxFloatingButtonExample';
import {
  Abi,
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
import { CofheInputArgs } from '@cofhe/abi';
import { FheTypes } from '@cofhe/sdk';

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
        internalType: 'euint128',
        name: 'value',
        type: 'uint256',
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

export type WriteContractFn = <
  const TAbi extends Abi | readonly unknown[],
  TFunctionName extends ContractFunctionName<TAbi, 'payable' | 'nonpayable'>,
  // TArgs extends CofheInputArgs<TAbi, TFunctionName>,
  TConfidentialityAwareAbiArgs extends CofheInputArgs<TAbi, TFunctionName>,
  TArgs extends ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
  TChainOverride extends Chain | undefined = undefined,
  TChain extends Chain | undefined = Chain | undefined,
  TAccount extends Account | undefined = Account | undefined,
>(
  params: WriteContractParameters<TAbi, TFunctionName, TArgs, TChain, TAccount, TChainOverride>,
  walletClient: WalletClient<Transport, TChain, TAccount>,
  confidentialityAwareAbiArgs: TConfidentialityAwareAbiArgs,
) => Promise<WriteContractReturnType>;

export const CONTRACT_ADDRESS: Address = '0xfEF0C260cb5a9A1761C0c0Fd6e34248C330C9e5a';

export const writeContractFn: WriteContractFn = async (params, walletClient, confidentialityAwareAbiArgs) => {
  // Avoid mutation, but keep the *exact* generic type by annotating the clone.
  // Without the annotation, the spread object often widens and viem's conditional
  // typing (especially around `args`) can stop matching.
  const newParams: typeof params = { ...params, address: CONTRACT_ADDRESS };
  return walletClient.writeContract(newParams);
};

const walletClient = createMockWalletAndPublicClient(sepolia.id).walletClient;

void writeContractFn(
  {
    abi: TestABI,
    functionName: 'encTransfer',
    args: ['0x9A9B640F221Fb8E7A283501367812c50C6805ED1', 124n] as const,
    account: '0x1234567890123456789012345678901234567890',
    address: CONTRACT_ADDRESS,
    chain: undefined,
  },
  walletClient,
  [
    '0x9A9B640F221Fb8E7A283501367812c50C6805ED1',
    { ctHash: 123n, securityZone: 0, utype: FheTypes.Uint128, signature: '0x1234567890abcdef' },
  ] as const,
);

const TestAutoDecryptionComponent: React.FC = () => {
  // const { encrypted, decrypted } = useCofheReadContractAndDecrypt({
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
