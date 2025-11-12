import { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { ComponentRenderer } from './components/ComponentRenderer';
import { Providers as WagmiProviders } from './utils/wagmi';
import { CofheProviderLocal } from './utils/cofhe.config';
import { FloatingCofhePortal } from '@cofhe/react';

function App() {
  const [activeComponent, setActiveComponent] = useState<string>('overview');
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
      <CofheProviderLocal>
        <FloatingCofhePortal />
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
    </WagmiProviders>
  );
}

export default App;
