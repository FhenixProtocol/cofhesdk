import React, { useMemo } from 'react';
import { useConnectors, type Connector } from 'wagmi';
import { useConnectBrowserWallet } from '../utils/useConnectBrowserWallet';
import { useIsUsingBrowserWallet } from '../utils/useIsUsingBrowserWallet';
interface NavigationProps {
  activeComponent: string;
  onComponentSelect: (component: string) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

const components = [
  { id: 'overview', label: 'Overview', description: 'Introduction to CofheEncryptInput component' },
  { id: 'cofhe-encrypt-input', label: 'CofheEncryptInput', description: 'Advanced input with type selection' },
  { id: 'cofhe-floating-button', label: 'CofheFloatingButton', description: 'Floating action button component' },
  { id: 'hooks-example', label: 'Hooks Usage', description: 'Using useEncryptInput hook directly' },
];

export const Navigation: React.FC<NavigationProps> = ({
  activeComponent,
  onComponentSelect,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const isUsingBrowserWallet = useIsUsingBrowserWallet();
  const { connectBrowserWallet, isConnecting } = useConnectBrowserWallet();
  const connectors = useConnectors();

  // Wallets discovered via EIP-6963, deduped by id (first wins). The generic `injected` entry is only
  // kept as a fallback when no wallet was discovered.
  const walletConnectors = useMemo(() => {
    const unique = connectors.filter((c, i) => connectors.findIndex((x) => x.id === c.id) === i);
    const discovered = unique.filter((connector) => connector.id !== 'injected');
    return discovered.length > 0 ? discovered : unique;
  }, [connectors]);

  const handleConnectBrowserWallet = async (connector: Connector) => {
    try {
      await connectBrowserWallet(connector);
    } catch (error) {
      console.error('Failed to connect browser wallet:', error);
      alert('Failed to connect wallet. Please make sure a browser wallet extension is installed and unlocked.');
    }
  };

  return (
    <div
      className={`w-80 h-screen ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-r overflow-y-auto`}
    >
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>CoFHE SDK React</h1>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Component Examples</p>
        </div>

        {/* Wallet Connection Section */}
        <div className="mb-6">
          {isUsingBrowserWallet ? (
            <div
              className={`p-3 rounded-lg border-2 ${isDarkMode ? 'bg-green-900/20 border-green-600' : 'bg-green-50 border-green-500'}`}
            >
              <div className={`text-sm font-medium mb-1 ${isDarkMode ? 'text-green-400' : 'text-green-700'}`}>
                🌐 Browser Wallet Connected
              </div>
              <div className={`text-xs ${isDarkMode ? 'text-green-300' : 'text-green-600'}`}>
                Using MetaMask or injected wallet
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {walletConnectors.map((connector) => (
                <button
                  key={connector.uid}
                  onClick={() => handleConnectBrowserWallet(connector)}
                  disabled={isConnecting}
                  className={`w-full mt-2 px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-center gap-2 ${
                    isDarkMode
                      ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-400'
                      : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500'
                  }`}
                >
                  {connector.icon && <img src={connector.icon} alt="" className="w-5 h-5 rounded" />}
                  {isConnecting ? 'Connecting...' : connector.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dark Mode Toggle */}
        <div className="mb-6">
          <button
            onClick={onToggleDarkMode}
            className={`w-full px-3 py-2 text-sm rounded-lg transition-colors ${
              isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
            }`}
          >
            {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>
        </div>

        {/* Component List */}
        <div>
          <h3 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Components</h3>
          <nav className="space-y-1">
            {components.map((component) => (
              <button
                key={component.id}
                onClick={() => onComponentSelect(component.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeComponent === component.id
                    ? isDarkMode
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-100 text-blue-900'
                    : isDarkMode
                      ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <div className="font-medium">{component.label}</div>
                <div
                  className={`text-xs ${
                    activeComponent === component.id
                      ? isDarkMode
                        ? 'text-blue-200'
                        : 'text-blue-700'
                      : isDarkMode
                        ? 'text-gray-400'
                        : 'text-gray-500'
                  }`}
                >
                  {component.description}
                </div>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
};
