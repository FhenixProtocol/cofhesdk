import { useState, useCallback } from 'react';
import { useCofheContext } from '../providers/CofheProvider.js';
import { Encryptable } from '@cofhe/sdk';
import type { EncryptableItem } from '@cofhe/sdk';
import type { FheTypeValue } from '../utils/utils.js';
import type { EncryptionStep } from '../types/component-types.js';

// Map SDK encrypt steps to UI display info
const STEP_CONFIG: Record<EncryptionStep, { label: string; progress: number }> = {
  'initTfhe': {
    label: 'Initializing TFHE...',
    progress: 5,
  },
  'fetchKeys': {
    label: 'Fetching FHE keys...',
    progress: 20,
  },
  'pack': {
    label: 'Packing data...',
    progress: 40,
  },
  'prove': {
    label: 'Generating proof...',
    progress: 70,
  },
  'verify': {
    label: 'Verifying...',
    progress: 90,
  },
  'done': {
    label: 'Encryption complete!',
    progress: 100,
  },
};

export interface UseEncryptInputReturn {
  onEncryptInput: (_type: FheTypeValue, _value: string) => Promise<any>;
  isEncryptingInput: boolean;
  encryptionStep: EncryptionStep | null;
  encryptionProgress: number;
  encryptionProgressLabel: string;
  inputEncryptionDisabled: boolean;
}

export function useEncryptInput(): UseEncryptInputReturn {
  const { client } = useCofheContext();
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [encryptionStep, setEncryptionStep] = useState<EncryptionStep | null>(null);
  const [encryptionProgress, setEncryptionProgress] = useState<number>(0);
  const [encryptionProgressLabel, setEncryptionProgressLabel] = useState<string>('');

  const onEncryptInput = useCallback(async (type: FheTypeValue, value: string) => {
    if (!client) {
      throw new Error('CoFHE client not initialized');
    }

    setIsEncrypting(true);
    setError(null);

    try {
      // Convert value based on type
      let convertedValue: number | bigint | boolean | string;
      
      if (type === 'bool') {
        convertedValue = value.toLowerCase() === 'true' || value === '1';
      } else if (type === 'address') {
        convertedValue = value as string | bigint;
      } else {
        // Numeric types
        convertedValue = value.includes('.') ? parseFloat(value) : parseInt(value, 10);
      }

      // Create encryptable item
      let encryptableItem: EncryptableItem;
      
      switch (type) {
        case 'bool':
          encryptableItem = Encryptable.bool(convertedValue as boolean);
          break;
        case 'uint8':
          encryptableItem = Encryptable.uint8(BigInt(convertedValue));
          break;
        case 'uint16':
          encryptableItem = Encryptable.uint16(BigInt(convertedValue));
          break;
        case 'uint32':
          encryptableItem = Encryptable.uint32(BigInt(convertedValue));
          break;
        case 'uint64':
          encryptableItem = Encryptable.uint64(BigInt(convertedValue));
          break;
        case 'uint128':
          encryptableItem = Encryptable.uint128(BigInt(convertedValue));
          break;
        case 'address':
          encryptableItem = Encryptable.address(convertedValue as string | bigint);
          break;
        default:
          encryptableItem = Encryptable.uint32(BigInt(convertedValue));
      }

      // Perform encryption with real-time step tracking
      const encryptionBuilder = client.encryptInputs([encryptableItem]).setStepCallback((step, context) => {
        const stepConfig = STEP_CONFIG[step as EncryptionStep];
        
        if (stepConfig) {
          // Update UI with real step information
          setEncryptionStep(step as EncryptionStep);
          setEncryptionProgress(stepConfig.progress);
          setEncryptionProgressLabel(stepConfig.label);
        }
        
        // Log worker status for debugging (prove step only)
        if (step === 'prove' && context?.isEnd) {
          console.log('[Encryption] Worker Status:', {
            useWorker: context.useWorker,
            usedWorker: context.usedWorker,
            workerFailedError: context.workerFailedError,
            duration: context.duration + 'ms'
          });
        }
      });
      const result = await encryptionBuilder.encrypt();
      
      if (!result.success) {
        throw result.error;
      }

      // Complete
      setEncryptionStep('done');
      setEncryptionProgress(100);
      setEncryptionProgressLabel('Encryption complete!');

      // Reset after a short delay
      setTimeout(() => {
        setEncryptionStep(null);
        setEncryptionProgress(0);
        setEncryptionProgressLabel('');
      }, 1000);

      setIsEncrypting(false);
      return result.data[0]; // Return first (and only) encrypted item
    } catch (err) {
      // Reset on error
      setEncryptionStep(null);
      setEncryptionProgress(0);
      setEncryptionProgressLabel('');
      setIsEncrypting(false);
      const error = err instanceof Error ? err : new Error('Encryption failed');
      setError(error);
      throw error;
    }
  }, [client]);

  return {
    onEncryptInput,
    isEncryptingInput: isEncrypting,
    encryptionStep,
    encryptionProgress,
    encryptionProgressLabel,
    inputEncryptionDisabled: isEncrypting || !!error,
  };
}
