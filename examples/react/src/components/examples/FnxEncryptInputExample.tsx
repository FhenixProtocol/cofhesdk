import React from 'react';
import { FnxEncryptInput, FheTypesList } from '@cofhe/react';

export const FnxEncryptInputExample: React.FC = () => {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4">FnxEncryptInput</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Advanced input component with integrated type selection, progress tracking, and copy functionality.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-3">Basic Usage</h3>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border mb-4">
            <FnxEncryptInput
              testId="fnx-encrypt-basic"
              placeholder="Enter a number to encrypt..."
              onTextChange={(value) => console.log('Text changed:', value)}
              onTypeChange={(type) => console.log('Type changed:', type)}
              onEncryptComplete={(data) => {
                console.log('Encryption complete:', data);
              }}
              onEncryptError={(error) => {
                console.error('Encryption error:', error);
              }}
            />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3">With Progress Bar</h3>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border mb-4">
            <FnxEncryptInput
              testId="fnx-encrypt-progress"
              placeholder="Enter value to see progress..."
              showProgressBar={true}
              onEncryptStart={(data) => console.log('Encryption started:', data)}
              onEncryptProgress={(data) => console.log('Progress:', data)}
              onEncryptComplete={(data) => {
                console.log('Encryption complete with progress:', data);
              }}
            />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3">Different Sizes</h3>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border mb-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Large Size</label>
              <FnxEncryptInput
                testId="fnx-encrypt-large"
                placeholder="Large size example..."
                size="lg"
                onEncryptComplete={(data) => console.log('Large encrypt:', data)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Small Size</label>
              <FnxEncryptInput
                testId="fnx-encrypt-small"
                placeholder="Small size example..."
                size="sm"
                onEncryptComplete={(data) => console.log('Small encrypt:', data)}
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3">Available FHE Types</h3>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {FheTypesList.map((type) => (
                <div
                  key={type.value}
                  className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded"
                >
                  <div>
                    <span className="font-mono text-sm font-medium">{type.label}</span>
                    <div className="text-xs text-gray-500">{type.description}</div>
                  </div>
                  <div className="text-xs text-gray-400 font-mono">
                    {type.maxValue ? `Max: ${type.maxValue.toString()}` : 'Address'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
