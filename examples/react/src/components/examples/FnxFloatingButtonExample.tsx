import React from 'react';
import { useDynamicCofheConfigContext } from '../../utils/dynamicCofheConfig';

// Example with Material UI icons
export const FnxFloatingButtonExample: React.FC = () => {
  const { position, setPosition, darkMode, setDarkMode } = useDynamicCofheConfigContext();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4">FnxFloatingButton</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          A customizable floating action button (FAB) that stays on top of your content. Perfect for primary actions in
          your app.
        </p>
      </div>

      <div className="space-y-6">
        {/* Interactive Demo */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Interactive Demo</h3>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border mb-4">
            {/* Position */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Position:</label>
              <div className="flex flex-wrap gap-2">
                {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setPosition(pos)}
                    className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                      position === pos
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>

            {/* Dark Mode Toggle */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Dark Mode:</label>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                  darkMode
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <span>{darkMode ? '🌙' : '☀️'}</span>
                <span>{darkMode ? 'Dark Mode' : 'Light Mode'}</span>
              </button>
            </div>

            {/* Preview */}
            <div className="mb-4">
              <p className="text-xs text-gray-400 dark:text-gray-500">Look at the {position} corner of this page!</p>
              <p className="text-xs text-blue-500 dark:text-blue-400 mt-2">
                💡 Click the button to toggle the expandable panel
              </p>
            </div>
          </div>
        </div>

        {/* Usage Code */}
        <div>
          <h3 className="text-lg font-semibold mb-3">1. wrap your App with CofheProvider</h3>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border mb-4">
            <pre className="text-sm overflow-x-auto">
              <code className="text-gray-800 dark:text-gray-200">
                {`import { CofheProvider } from '@cofhe/react';

function App() {
  return (
    <CofheProvider>
      {/* Your app content */}}
    </CofheProvider>
  );
}`}
              </code>
            </pre>
          </div>

          <h3 className="text-lg font-semibold mb-3">2. Auto-connect WalletClient and PublicClient to CoFHE</h3>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
            <pre className="text-sm overflow-x-auto">
              <code className="text-gray-800 dark:text-gray-200">
                {`

import { useEffect } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { useCofheClient } from '@cofhe/react';


// TODO: expose useCofheAutoConnect hook? that'd accept {publicClient, walletClient}
//  and do the effect internally?
// or just accept them in the CofheProvider?
// I think autoConnect hook is better, as it can be wrapped into a mutation and yield it's benefits

export const useAutoConnectCofhe = () => {  
  const cofheClient = useCofheClient();  
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  useEffect(() => {
    const autoConnect = async () => {
      if (!publicClient || !walletClient) return;      
      await cofheClient.connect(publicClient, walletClient);    
    };
    autoConnect();
  }, [publicClient, walletClient, cofheClient]);
};

... @TODO: finish this piece.
`}
              </code>
            </pre>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3">
            3. use Cofhe React API to get the user ready for decrypting (i.e. make the user generate a permit when it's
            needed) and decrypt
          </h3>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
            <pre className="text-sm overflow-x-auto">
              <code className="text-gray-800 dark:text-gray-200">
                {`
import { useCofheTokenConfidentialBalance } from '@cofhe/react';
import { WETH_SEPOLIA_TOKEN } from '../constants/tokens';

function MyComponent() {
  const account = useCofheConnection().account;
  
  const navigateToGeneratePermit = useCofheCreatePermit({
    ReasonBody: CREATE_PERMITT_BODY_BY_ERROR_CAUSE[ErrorCause.AttemptToFetchConfidentialBalance],
  });
  
  const { disabledDueToMissingPermit, data, error, isLoading } = useCofheTokenConfidentialBalance({
    token: WETH_SEPOLIA_TOKEN,
    accountAddress: account,
  });

  return (
    <pre>
      {disabledDueToMissingPermit ? (
        <div
          onClick={async (e) => {
            e.stopPropagation();
            navigateToGeneratePermit();
            
          }}
        >
          * * *
        </div>
      ) : isLoading ? (
        'Loading...'
      ) : error ? (
        \`Error: \${error.message}\`
      ) : (
        data?.toString() ?? 'No Data'
      )}
    </pre>
  );
}`}
              </code>
            </pre>
          </div>
        </div>

        {/* TODO -- add info about error handling and query options prop-drilling */}
        <div>
          <h3 className="text-lg font-semibold mb-3">
            TODO: add info about error handling and query options prop drilling
          </h3>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border mb-4">
            <pre className="text-sm overflow-x-auto">
              <code className="text-gray-800 dark:text-gray-200">
                {`
                // TODO
                `}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
