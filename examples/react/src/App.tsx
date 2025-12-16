import { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { ComponentRenderer } from './components/ComponentRenderer';
import { Providers as WagmiProviders } from './utils/wagmi';
import { CofheProviderLocal } from './utils/cofhe.config';
import { useAutoConnectCofhe } from './utils/useAutoConnectCofhe';
import {
  CREATE_PERMITT_BODY_BY_ERROR_CAUSE,
  ErrorCause,
  Token,
  useCofheConnection,
  useCofheCreatePermit,
  useTokenConfidentialBalance,
} from '@cofhe/react';
import { DynamicCofheConfigProvider } from './utils/dynamicCofheConfig';

const WETH_SEPOLIA_TOKEN: Token = {
  chainId: 11155111,
  address: '0x87A3effB84CBE1E4caB6Ab430139eC41d156D55A',
  name: 'Redact eETH',
  symbol: 'eETH',
  decimals: 18,
  logoURI: 'https://storage.googleapis.com/cofhesdk/token-icons/eth.webp',
  extensions: {
    fhenix: {
      confidentialityType: 'wrapped',
      confidentialValueType: 'uint128',
      erc20Pair: {
        address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        symbol: 'ETH',
        decimals: 18,
        logoURI: 'https://storage.googleapis.com/cofhesdk/token-icons/eth.webp',
      },
    },
  },
};

function DemoErrorOutsideFloatingButton() {
  const account = useCofheConnection().account;
  const { disabledDueToMissingPermit, data, error, isLoading } = useTokenConfidentialBalance({
    token: WETH_SEPOLIA_TOKEN,
    accountAddress: account,
  });

  const navigateToGeneratePermit = useCofheCreatePermit({
    ReasonBody: CREATE_PERMITT_BODY_BY_ERROR_CAUSE[ErrorCause.AttemptToFetchConfidentialBalance],
  });
  return (
    <pre>
      {disabledDueToMissingPermit ? (
        <div
          onClick={(e) => {
            e.stopPropagation();
            navigateToGeneratePermit();
          }}
        >
          * * *
        </div>
      ) : isLoading ? (
        'Loading...'
      ) : error ? (
        `Error: ${error.message}`
      ) : (
        data?.toString() ?? 'No Data'
      )}
    </pre>
  );
}
function Updaters() {
  useAutoConnectCofhe();
  // This component can be used to add global updaters or hooks if needed in the future
  return null;
}

function App() {
  const [activeComponent, setActiveComponent] = useState<string>('fnx-floating-button');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Apply dark class to html element for TailwindCSS dark mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  return (
    <WagmiProviders>
      <DynamicCofheConfigProvider>
        <CofheProviderLocal>
          <DemoErrorOutsideFloatingButton />
          <Updaters />
          <div className={`min-h-screen flex ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
            <Navigation
              activeComponent={activeComponent}
              onComponentSelect={setActiveComponent}
              isDarkMode={isDarkMode}
              onToggleDarkMode={toggleDarkMode}
            />
            <ComponentRenderer activeComponent={activeComponent} isDarkMode={isDarkMode} />
          </div>
        </CofheProviderLocal>
      </DynamicCofheConfigProvider>
    </WagmiProviders>
  );
}

export default App;
