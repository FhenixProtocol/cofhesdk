import React from 'react';

export const Overview: React.FC = () => {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-4">CoFHE SDK React - FnxEncryptInput</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
          Interactive examples of the FnxEncryptInput component for the CoFHE SDK.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold mb-2">FnxEncryptInput</h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
          Advanced input component with integrated type selection, progress tracking, and copy functionality.
          Features Material-UI icons, real-time validation, and seamless encryption workflow.
        </p>
        <div className="text-xs text-gray-500 dark:text-gray-500">
          Features: Type dropdown, progress bar, clipboard copy, Material-UI icons, input validation
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border">
        <h2 className="text-xl font-semibold mb-4">Getting Started</h2>
        <pre className="bg-gray-900 text-gray-100 p-3 rounded text-sm overflow-x-auto">
{`npm install @cofhe/react @cofhesdk/web @cofhesdk/adapters`}
        </pre>
      </div>
    </div>
  );
};