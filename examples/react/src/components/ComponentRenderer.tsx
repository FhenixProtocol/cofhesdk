import React from 'react';
import { Overview } from './examples/Overview';
import { FnxEncryptInputExample } from './examples/FnxEncryptInputExample';
import { HooksExample } from './examples/HooksExample';
import { FnxFloatingButtonExample } from './examples/FnxFloatingButtonExample';
import { ErrorCause, useCofheReadContractAndDecrypt } from '@cofhe/react';
import { FheTypes } from '@cofhe/sdk';

interface ComponentRendererProps {
  activeComponent: string;
  isDarkMode: boolean;
}

const TestABI = [
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
