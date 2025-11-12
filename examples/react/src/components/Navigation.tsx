import React from 'react';
import { useCofheConnection } from '@cofhe/react';
interface NavigationProps {
  activeComponent: string;
  onComponentSelect: (component: string) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

const components = [
  { id: 'overview', label: 'Overview', description: 'Introduction to FnxEncryptInput component' },
  { id: 'fnx-encrypt-input', label: 'FnxEncryptInput', description: 'Advanced input with type selection' },
  { id: 'hooks-example', label: 'Hooks Usage', description: 'Using useEncryptInput hook directly' },
];

export const Navigation: React.FC<NavigationProps> = ({
  activeComponent,
  onComponentSelect,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const connectionState = useCofheConnection();

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

        {/* Status */}
        <div className="mb-6">
          <h3 className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Connection Status: <pre>{JSON.stringify(connectionState, null, 2)}</pre>
          </h3>
          <div
            className={`text-sm p-2 rounded ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}
          >
            CoFHE SDK Ready
          </div>
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
