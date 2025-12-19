import { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { ComponentRenderer } from './components/ComponentRenderer';
import { Providers as WagmiProviders } from './utils/wagmi';
import { CofheProviderLocal } from './utils/cofhe.config';
import { useAutoConnectCofhe } from './utils/useAutoConnectCofhe';
import { DynamicCofheConfigProvider } from './utils/dynamicCofheConfig';

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
