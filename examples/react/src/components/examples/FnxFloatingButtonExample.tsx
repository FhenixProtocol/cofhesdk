import React, { useState } from 'react';
import { FnxFloatingButton, type FloatingButtonSize } from '@cofhe/react';
// Example with Material UI icons
export const FnxFloatingButtonExample: React.FC = () => {
  const [position, setPosition] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('bottom-right');
  const [clickCount, setClickCount] = useState(0);
  const [buttonSize, setButtonSize] = useState<FloatingButtonSize>('large');
  const [darkMode, setDarkMode] = useState(false);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4">FnxFloatingButton</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          A customizable floating action button (FAB) that stays on top of your content. Perfect for primary actions in your app.
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

            {/* Size */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Size:</label>
              <div className="flex flex-wrap gap-2">
                {(['small', 'medium', 'large'] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => setButtonSize(size)}
                    className={`px-4 py-2 rounded-lg text-sm transition-colors capitalize ${
                      buttonSize === size
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {size}
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
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                Click count: {clickCount}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Look at the {position} corner of this page!
              </p>
              <p className="text-xs text-blue-500 dark:text-blue-400 mt-2">
                💡 Click the button to toggle the expandable panel
              </p>
            </div>
          </div>
        </div>

        {/* Usage Code */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Basic Usage</h3>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border mb-4">
            <pre className="text-sm overflow-x-auto">
              <code className="text-gray-800 dark:text-gray-200">
{`import { FnxFloatingButton } from '@cofhe/react';
import AddIcon from '@mui/icons-material/Add';

function MyApp() {
  return (
    <div>
      {/* Your app content */}
      
      <FnxFloatingButton
        position="bottom-right"
        size="large"
        onClick={() => console.log('Clicked!')}
      />
    </div>
  );
}`}
              </code>
            </pre>
          </div>

          <h3 className="text-lg font-semibold mb-3">With Expandable Panel</h3>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
            <pre className="text-sm overflow-x-auto">
              <code className="text-gray-800 dark:text-gray-200">
{`import { FnxFloatingButton } from '@cofhe/react';
import AddIcon from '@mui/icons-material/Add';

function MyApp() {
  return (
    <div>
      {/* Your app content */}
      
      <FnxFloatingButton
        position="bottom-right"
        size="large"
        onClick={() => console.log('Clicked!')}
      />
    </div>
  );
}`}
              </code>
            </pre>
          </div>
        </div>

        {/* Props Table */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Props</h3>
          <div className="bg-white dark:bg-gray-800 rounded-lg border overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Prop
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Default
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-gray-300">
                    position
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    'bottom-right'
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    Position of the button
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-gray-300">
                    icon
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    React.ReactNode
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    -
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    Icon to display
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-gray-300">
                    size
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    number
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    56
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    Button size in pixels
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-gray-300">
                    iconColor
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    string
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    '#ffffff'
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    Icon color
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-gray-300">
                    onClick
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    () =&gt; void
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    -
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    Click handler
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-gray-300">
                    title
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    string
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    -
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    Tooltip text
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-gray-300">
                    zIndex
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    number
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    9999
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    Z-index value
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-gray-300">
                    positionType
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    'fixed' | 'absolute'
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    'fixed'
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    Position type (fixed stays on screen)
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-gray-300">
                    expandable
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    boolean
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    false
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    Enable expandable panel
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-gray-300">
                    expandedWidth
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    number
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    250
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    Width of expanded panel in pixels
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Single FnxFloatingButton instance */}
      <FnxFloatingButton
        position={position}
        size={buttonSize}
        darkMode={darkMode}
        onClick={() => setClickCount(prev => prev + 1)}
      />
    </div>
  );
};

