import React from 'react';
import { Overview } from './examples/Overview';
import { FnxEncryptInputExample } from './examples/FnxEncryptInputExample';
import { HooksExample } from './examples/HooksExample';
import { FnxFloatingButtonExample } from './examples/FnxFloatingButtonExample';
import {
  ErrorCause,
  useCofheClient,
  useCofheEncryptAndWriteContractNew,
  useCofheReadContractAndDecrypt,
} from '@cofhe/react';
import { W } from '../../../../packages/sdk/dist/clientTypes-PFZXRtTO';
import { useAccount } from 'wagmi';
import { FheTypes } from '@cofhe/sdk';
// import { TestABI } from './tmp-abis';

interface ComponentRendererProps {
  activeComponent: string;
  isDarkMode: boolean;
}

const WritingTest: React.FC = () => {
  const client = useCofheClient();
  const { encryptAndWriteContract } = useCofheEncryptAndWriteContractNew();

  return (
    <button
      onClick={() => {
        const accountAddress = client.getSnapshot().walletClient?.account?.address;
        if (!accountAddress) throw new Error('No connected account');
        encryptAndWriteContract({
          params: {
            abi: [
              {
                inputs: [
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
                    name: 'inValue128',
                    type: 'tuple',
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
                    internalType: 'struct InEuint64',
                    name: 'inValue64',
                    type: 'tuple',
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
                    internalType: 'struct InEbool',
                    name: 'inValueBool',
                    type: 'tuple',
                  },
                ],
                name: 'writeThreeEncryptedValues',
                outputs: [],
                stateMutability: 'nonpayable',
                type: 'function',
              },
            ] as const,
            functionName: 'writeThreeEncryptedValues',
            // args: ['0x9A9B640F221Fb8E7A283501367812c50C6805ED1', 124n] as const,
            account: accountAddress,
            address: '0xa4a0d565f7f8e502b48680112220520f4d4483b8',
            chain: undefined,
          },
          confidentialityAwareAbiArgs: [123n, 321n, true] as const,
        });
      }}
    >
      send tx
    </button>
  );
};

const READING_ABI = [
  {
    inputs: [
      {
        internalType: 'address',
        name: 'k',
        type: 'address',
      },
    ],
    name: 'read128',
    outputs: [
      {
        internalType: 'euint128',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'k',
        type: 'address',
      },
    ],
    name: 'read64',
    outputs: [
      {
        internalType: 'euint64',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'k',
        type: 'address',
      },
    ],
    name: 'readBool',
    outputs: [
      {
        internalType: 'ebool',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
const ReadingTest: React.FC = () => {
  const account = useAccount();
  const {
    decrypted: { data: decrypted128Data },
  } = useCofheReadContractAndDecrypt(
    {
      address: '0xa4a0d565f7f8e502b48680112220520f4d4483b8',
      abi: READING_ABI,
      functionName: 'read128',
      args: account.address ? [account.address] : undefined,
      fheType: FheTypes.Uint128,
      potentialDecryptErrorCause: ErrorCause.AttemptToFetchCustomData,
    },
    {
      readQueryOptions: {
        refetchOnMount: false,
        enabled: !!account.address,
      },
      decryptingQueryOptions: {
        refetchOnMount: false,
      },
    },
  );

  const {
    decrypted: { data: decrypted64Data },
  } = useCofheReadContractAndDecrypt(
    {
      address: '0xa4a0d565f7f8e502b48680112220520f4d4483b8',
      abi: READING_ABI,
      functionName: 'read64',
      args: account.address ? [account.address] : undefined,
      fheType: FheTypes.Uint128,
      potentialDecryptErrorCause: ErrorCause.AttemptToFetchCustomData,
    },
    {
      readQueryOptions: {
        refetchOnMount: false,
        enabled: !!account.address,
      },
      decryptingQueryOptions: {
        refetchOnMount: false,
      },
    },
  );
  const {
    decrypted: { data: decryptedBoolData },
  } = useCofheReadContractAndDecrypt(
    {
      address: '0xa4a0d565f7f8e502b48680112220520f4d4483b8',
      abi: READING_ABI,
      functionName: 'readBool',
      args: account.address ? [account.address] : undefined,
      fheType: FheTypes.Uint128,
      potentialDecryptErrorCause: ErrorCause.AttemptToFetchCustomData,
    },
    {
      readQueryOptions: {
        refetchOnMount: false,
        enabled: !!account.address,
      },
      decryptingQueryOptions: {
        refetchOnMount: false,
      },
    },
  );

  console.log({ decrypted128Data, decrypted64Data, decryptedBoolData });
  return <div>Reading test</div>;
};

const TestAutoDecryptionComponent: React.FC = () => {
  return (
    <>
      <ReadingTest />
      <WritingTest />
    </>
  );
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
