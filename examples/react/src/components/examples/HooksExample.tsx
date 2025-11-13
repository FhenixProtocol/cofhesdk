import React, { useState } from 'react';
import { useCofheContext, useEncryptInput } from '@cofhe/react';

export const HooksExample: React.FC = () => {
  const { client, isInitialized, error } = useCofheContext();
  const { onEncryptInput, isEncryptingInput } = useEncryptInput();
  const [results, setResults] = useState<any>(null);

  const handleDirectEncryption = async () => {
    try {
      const result = await onEncryptInput('uint32', '123');
      setResults({ direct: result });
      console.log('Direct encryption result:', result);
    } catch (err) {
      console.error('Direct encryption error:', err);
      setResults({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4">useEncryptInput Hook Usage</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Examples of using the useEncryptInput hook directly for custom encryption workflows.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-3">Client Information</h3>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border mb-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-2xl font-bold">{client ? '✅' : '❌'}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Client</div>
              </div>

              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-2xl font-bold">{isInitialized ? '✅' : '❌'}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Initialized</div>
              </div>

              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-2xl font-bold">{error ? '❌' : '✅'}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">No Errors</div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3">Direct Encryption</h3>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border mb-4">
            <button
              onClick={handleDirectEncryption}
              disabled={!isInitialized || isEncryptingInput}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:bg-gray-300"
            >
              {isEncryptingInput ? 'Encrypting...' : 'Encrypt Value (123)'}
            </button>
          </div>
        </div>

        {results && (
          <div>
            <h3 className="text-lg font-semibold mb-3">Results</h3>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
              <pre className="text-sm overflow-x-auto">
                {JSON.stringify(results, (key, value) => (typeof value === 'bigint' ? value.toString() : value), 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
