import type { FheTypeValue } from '../utils/utils.js';

// Base props for all components
export interface BaseProps {
  /** Additional CSS class names */
  className?: string;
  /** Test ID for testing purposes */
  testId?: string;
}

// Component size variants
export type ComponentSize = 'sm' | 'md' | 'lg';

// Dropdown option interface
export interface DropdownOption {
  label: string;
  value: FheTypeValue;
  maxValue?: bigint | null;
  description?: string;
}

// Encryption progress data
export interface EncryptionProgressData {
  step: string;
  progress: number;
  label: string;
}

// Encryption result data
export interface EncryptionResultData {
  value: string;
  encrypted: any;
}

// Encryption start data
export interface EncryptionStartData {
  value: string;
  type: string;
}
