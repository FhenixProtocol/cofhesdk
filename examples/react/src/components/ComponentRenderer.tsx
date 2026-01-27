import React, { useEffect } from 'react';
import { Overview } from './examples/Overview';
import { FnxEncryptInputExample } from './examples/FnxEncryptInputExample';
import { HooksExample } from './examples/HooksExample';
import { FnxFloatingButtonExample } from './examples/FnxFloatingButtonExample';
import { Address } from 'viem';
import { useCofheEncryptAndWriteContractNew } from '@cofhe/react';
import { TestABI } from './tmp-abis';

interface ComponentRendererProps {
  activeComponent: string;
  isDarkMode: boolean;
}

export const CONTRACT_ADDRESS: Address = '0xfEF0C260cb5a9A1761C0c0Fd6e34248C330C9e5a';

function useTesting() {
  const { encryptAndWriteContract } = useCofheEncryptAndWriteContractNew();

  useEffect(() => {
    // if (true as any) return;
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
      confidentialityAwareAbiArgs: ['0x9A9B640F221Fb8E7A283501367812c50C6805ED1', true],
    });
  }, [encryptAndWriteContract]);
}

const TestAutoDecryptionComponent: React.FC = () => {
  useTesting();

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
