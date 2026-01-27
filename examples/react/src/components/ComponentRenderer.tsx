import React from 'react';
import { Overview } from './examples/Overview';
import { FnxEncryptInputExample } from './examples/FnxEncryptInputExample';
import { HooksExample } from './examples/HooksExample';
import { FnxFloatingButtonExample } from './examples/FnxFloatingButtonExample';
import { useCofheClient, useCofheEncryptAndWriteContractNew } from '@cofhe/react';
// import { TestABI } from './tmp-abis';

interface ComponentRendererProps {
  activeComponent: string;
  isDarkMode: boolean;
}

const TestAutoDecryptionComponent: React.FC = () => {
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
            address: '0x3a456e3758f6779d0b105778c2c8c284bc95a284e596d50cdc00fded070318f3',
            chain: undefined,
          },
          confidentialityAwareAbiArgs: [123n, 123n, true] as const,
        });
      }}
    >
      send tx
    </button>
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
