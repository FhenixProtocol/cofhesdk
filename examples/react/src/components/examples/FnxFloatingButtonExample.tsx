import React, { useState } from 'react';
import { FnxFloatingButton, type FloatingButtonPosition } from '@cofhe/react';

// Example with Material UI icons
import AddIcon from '@mui/icons-material/Add';
import MessageIcon from '@mui/icons-material/Message';
import SecurityIcon from '@mui/icons-material/Security';
import HelpIcon from '@mui/icons-material/Help';

type IconType = 'add' | 'message' | 'security' | 'help';

export const FnxFloatingButtonExample: React.FC = () => {
  const [position, setPosition] = useState<FloatingButtonPosition>('bottom-right');
  const [clickCount, setClickCount] = useState(0);
  const [selectedIcon, setSelectedIcon] = useState<IconType>('add');
  const [buttonSize, setButtonSize] = useState(56);
  const [backgroundColor, setBackgroundColor] = useState('#3b82f6');

  const icons: Record<IconType, React.ReactNode> = {
    add: <AddIcon style={{ fontSize: buttonSize > 60 ? 36 : buttonSize < 45 ? 20 : 24 }} />,
    message: <MessageIcon style={{ fontSize: buttonSize > 60 ? 36 : buttonSize < 45 ? 20 : 24 }} />,
    security: <SecurityIcon style={{ fontSize: buttonSize > 60 ? 36 : buttonSize < 45 ? 20 : 24 }} />,
    help: <HelpIcon style={{ fontSize: buttonSize > 60 ? 36 : buttonSize < 45 ? 20 : 24 }} />,
  };

  const colorPresets = [
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Green', value: '#10b981' },
    { name: 'Purple', value: '#8b5cf6' },
    { name: 'Orange', value: '#f59e0b' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Dark', value: '#1f2937' },
  ];

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
                {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as FloatingButtonPosition[]).map((pos) => (
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

            {/* Icon */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Icon:</label>
              <div className="flex flex-wrap gap-2">
                {(['add', 'message', 'security', 'help'] as IconType[]).map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setSelectedIcon(icon)}
                    className={`px-4 py-2 rounded-lg text-sm capitalize transition-colors ${
                      selectedIcon === icon
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Size */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Size: {buttonSize}px</label>
              <input
                type="range"
                min="40"
                max="80"
                value={buttonSize}
                onChange={(e) => setButtonSize(Number(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Color */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Color:</label>
              <div className="flex flex-wrap gap-2">
                {colorPresets.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setBackgroundColor(color.value)}
                    className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                      backgroundColor === color.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {color.name}
                  </button>
                ))}
              </div>
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
        icon={<AddIcon />}
        backgroundColor="#3b82f6"
        size={56}
        onClick={() => console.log('Clicked!')}
        title="Add new item"
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
        icon={<AddIcon />}
        backgroundColor="#3b82f6"
        size={56}
        expandable={true}
        expandedWidth={250}
        onClick={() => console.log('Clicked!')}
        title="Toggle menu"
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
                    backgroundColor
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    string
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    '#3b82f6'
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    Background color
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
        icon={icons[selectedIcon]}
        size={buttonSize}
        backgroundColor={backgroundColor}
        onClick={() => setClickCount(prev => prev + 1)}
        title="Interactive floating button"
        expandable={true}
        expandedWidth={250}
        showPopup={true}
        popupWidth={350}
        popupHeight={250}
        popupDelay={500}
      />
    </div>
  );
};

