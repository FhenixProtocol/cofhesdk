import { useState, useCallback } from 'react';
import { useCofheContext } from '../providers/CofheProvider.js';
import { Encryptable, type EncryptableItem } from '@cofhesdk/web';
import { FheTypeValue } from '../utils/utils.js';
import { EncryptionStep } from '../types/component-types.js';

export interface UseEncryptInputReturn {
  onEncryptInput: (type: FheTypeValue, value: string) => Promise<any>;
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
      // Set initial state
      setEncryptionStep('fetchKeys');
      setEncryptionProgress(10);
      setEncryptionProgressLabel('Fetching FHE keys...');

      // Simulate progress updates
      setTimeout(() => {
        setEncryptionStep('pack');
        setEncryptionProgress(30);
        setEncryptionProgressLabel('Packing data...');
      }, 100);

      setTimeout(() => {
        setEncryptionStep('prove');
        setEncryptionProgress(60);
        setEncryptionProgressLabel('Generating proof...');
      }, 200);

      setTimeout(() => {
        setEncryptionStep('verify');
        setEncryptionProgress(90);
        setEncryptionProgressLabel('Verifying...');
      }, 300);

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

      // Perform encryption
      const encryptionBuilder = client.encryptInputs([encryptableItem]);
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
