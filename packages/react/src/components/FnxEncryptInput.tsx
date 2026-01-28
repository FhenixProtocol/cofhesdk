import { useState, useRef, useEffect, useMemo } from 'react';
import type {
  BaseProps,
  DropdownOption,
  ComponentSize,
  EncryptionProgressData,
  EncryptionResultData,
  EncryptionStartData,
} from '../types/component-types.js';
import { cn } from '../utils/cn.js';
import { debounce } from '../utils/debounce.js';
import { FheTypesList, type FheTypeValue } from '../utils/utils.js';
import SecurityIcon from '@mui/icons-material/Security';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { getStepConfig, useCofheEncryptOld } from '@/hooks/useCofheEncryptOld.js';
import { createEncryptable } from '@cofhe/sdk';

export interface FnxEncryptInputProps extends BaseProps {
  /** Placeholder text for the text field */
  placeholder?: string;
  /** Initial value for the text field */
  initialValue?: string;
  /** Dropdown options for encryption types */
  options?: DropdownOption[];
  /** Component size */
  size?: ComponentSize;
  /** Whether inputs have errors */
  hasError?: boolean;
  /** Error message to display */
  errorMessage?: string;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Whether to show the progress bar during encryption */
  showProgressBar?: boolean;
  /** Debounce delay for validation in milliseconds (default: 300) */
  debounceMs?: number;
  /** Callback when text changes */
  onTextChange?: (_value: string) => void;
  /** Callback when encryption type selection changes */
  onTypeChange?: (_value: string) => void;
  /** Callback when encryption starts */
  onEncryptStart?: (_data: EncryptionStartData) => void;
  /** Callback for encryption progress updates */
  onEncryptProgress?: (_data: EncryptionProgressData) => void;
  /** Callback when encryption completes successfully */
  onEncryptComplete?: (_data: EncryptionResultData) => void;
  /** Callback when encryption fails */
  onEncryptError?: (_error: string) => void;
}

export const FnxEncryptInput: React.FC<FnxEncryptInputProps> = ({
  className,
  testId,
  placeholder = 'Enter number or address...',
  initialValue = '',
  options = FheTypesList,
  size = 'md',
  hasError = false,
  errorMessage,
  disabled = false,
  showProgressBar = false,
  debounceMs = 300,
  onTextChange,
  onTypeChange,
  onEncryptStart,
  onEncryptProgress,
  onEncryptComplete,
  onEncryptError,
}) => {
  const [textValue, setTextValue] = useState(initialValue);
  const [selectedType, setSelectedType] = useState<FheTypeValue>(options[0]?.value || 'uint32');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [encryptedResult, setEncryptedResult] = useState<any>(null);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const {
    encrypt,
    isEncrypting,
    stepsState: { lastStep: lastEncryptionStep },
  } = useCofheEncryptOld();

  const { progress: encryptionProgress, label: encryptionProgressLabel } = useMemo(() => {
    return lastEncryptionStep
      ? getStepConfig(lastEncryptionStep)
      : {
          progress: undefined,
          label: undefined,
        };
  }, [lastEncryptionStep]);

  // Debounced validation function
  const debouncedValidation = useRef(
    debounce((value: string) => {
      // This will be used for validation logic if needed in the future
      console.log('Debounced validation for:', value);
    }, debounceMs)
  ).current;

  // Handle progress bar visibility with animation
  useEffect(() => {
    if (showProgressBar && isEncrypting) {
      // Show immediately when encryption starts
      setShowProgress(true);
    } else if (!isEncrypting) {
      // Delay hiding to allow fade-out animation
      const timer = setTimeout(() => setShowProgress(false), 500);
      return () => clearTimeout(timer);
    }
  }, [showProgressBar, isEncrypting]);

  // Handle progress updates and call onEncryptProgress callback
  useEffect(() => {
    if (isEncrypting && lastEncryptionStep && encryptionProgress && encryptionProgressLabel) {
      onEncryptProgress?.({
        step: lastEncryptionStep.step,
        progress: encryptionProgress,
        label: encryptionProgressLabel,
      });
    }
  }, [encryptionProgress, encryptionProgressLabel, onEncryptProgress, isEncrypting, lastEncryptionStep]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Size variants
  const sizeClasses = {
    sm: { input: 'px-3 py-2 text-sm', dropdown: 'px-2 py-1 text-xs', button: 'px-3 py-1 text-sm' },
    md: { input: 'px-4 py-3 text-sm', dropdown: 'px-3 py-2 text-sm', button: 'px-4 py-2 text-sm' },
    lg: { input: 'px-5 py-4 text-base', dropdown: 'px-4 py-3 text-base', button: 'px-6 py-3 text-base' },
  };

  // Input container with integrated dropdown
  const inputContainerClasses = cn(
    'relative flex items-center bg-white dark:bg-gray-800 border rounded-lg transition-colors',
    'focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500',
    hasError
      ? 'border-red-500 focus-within:ring-red-500 focus-within:border-red-500'
      : 'border-gray-300 dark:border-gray-600',
    (disabled || isEncrypting) && 'bg-gray-100 dark:bg-gray-700 opacity-50',
    className
  );

  const inputClasses = cn(
    'flex-1 bg-transparent border-0 outline-none placeholder-gray-400 dark:placeholder-gray-500',
    'text-gray-900 dark:text-white',
    sizeClasses[size].input,
    'pr-20', // Make space for the dropdown button
    (disabled || isEncrypting) && 'cursor-not-allowed'
  );

  // Dropdown button inside the input
  const dropdownButtonClasses = cn(
    'absolute right-0 top-0 bottom-0',
    'flex items-center gap-1 px-2 rounded-r-md border-l border-gray-300 dark:border-gray-600',
    'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600',
    'transition-colors duration-200 cursor-pointer',
    'text-xs font-medium text-gray-700 dark:text-gray-300',
    (disabled || isEncrypting) && 'cursor-not-allowed opacity-50',
    isDropdownOpen && 'bg-gray-200 dark:bg-gray-600'
  );

  const dropdownItemClasses = (isSelected: boolean, isCompatible: boolean) =>
    cn(
      'px-3 py-2 text-sm transition-colors',
      isCompatible
        ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300'
        : 'cursor-not-allowed opacity-50 bg-gray-50 dark:bg-gray-700',
      isSelected && isCompatible
        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-medium'
        : isCompatible
          ? 'text-gray-700 dark:text-gray-300'
          : 'text-gray-400 dark:text-gray-500'
    );

  // Progress bar styles
  const progressVariantClasses = {
    primary: 'bg-blue-600 dark:bg-blue-500',
    success: 'bg-green-600 dark:bg-green-500',
    warning: 'bg-yellow-600 dark:bg-yellow-500',
    error: 'bg-red-600 dark:bg-red-500',
  };

  const progressContainerClasses = cn(
    'w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden',
    // Debug: Add border to see container
    'border'
  );

  const progressBarClasses = (variant: 'primary' | 'success' | 'warning' | 'error' = 'primary') =>
    cn('h-full transition-all duration-300 ease-out rounded-full', progressVariantClasses[variant]);

  // Check if a type is compatible with the current input value
  const isTypeCompatible = (typeValue: FheTypeValue, inputValue: string): boolean => {
    if (!inputValue.trim()) return true; // Empty input is compatible with all types

    const typeInfo = FheTypesList.find((type) => type.value === typeValue);
    if (!typeInfo) return false;

    // Boolean type validation
    if (typeValue === 'bool') {
      const lowerValue = inputValue.toLowerCase();
      return lowerValue === 'true' || lowerValue === 'false' || lowerValue === '0' || lowerValue === '1';
    }

    // Address type validation
    if (typeValue === 'address') {
      if (!inputValue.startsWith('0x')) return false;

      const addressPart = inputValue.slice(2);
      if (addressPart.length !== 40) return false;

      const hexRegex = /^[a-fA-F0-9]+$/;
      if (!hexRegex.test(addressPart)) return false;

      return true;
    }

    // Numeric type validation
    if (typeInfo.maxValue) {
      try {
        const numValue = BigInt(inputValue);
        return numValue >= 0 && numValue <= typeInfo.maxValue;
      } catch (error) {
        return false;
      }
    }

    return true;
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTextValue(value);
    onTextChange?.(value);

    // Clear encrypted result when text changes
    setEncryptedResult(null);
    setCopySuccess(false);

    // Trigger debounced validation
    debouncedValidation(value);
  };

  const handleCopyResult = async () => {
    if (!encryptedResult || copySuccess) return;

    try {
      // Custom JSON serializer that handles BigInt
      const textToCopy = JSON.stringify(
        encryptedResult,
        (key, value) => {
          if (typeof value === 'bigint') {
            return value.toString();
          }
          return value;
        },
        2
      ); // Pretty format with 2 spaces

      await navigator.clipboard.writeText(textToCopy);
      console.log('Copied to clipboard:', textToCopy);

      // Show success indication
      setCopySuccess(true);

      // Reset after 2 seconds
      setTimeout(() => {
        setCopySuccess(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const handleTypeSelect = async (type: FheTypeValue) => {
    setSelectedType(type);
    setIsDropdownOpen(false);
    onTypeChange?.(type);

    // Auto-encrypt when type is selected (if text field has value)
    if (textValue.trim() !== '') {
      try {
        console.log('Auto-encrypting value:', textValue, 'as type:', type);

        // Call onEncryptStart callback
        onEncryptStart?.({ value: textValue, type: type });

        // TODO: Try to create non-blocking encryption call that doesn't block the UI
        // Not really work, need to improve cofhejs side to make it non-blocking
        (async () => {
          try {
            const encryptionResult = await encrypt({
              input: createEncryptable(type, textValue),
            });

            // Store the result for the copy button
            setEncryptedResult(encryptionResult);

            const data = { value: textValue, encrypted: encryptionResult };

            // Call completion callback
            onEncryptComplete?.(data);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Encryption failed';
            console.error('Encryption failed:', error);
            onEncryptError?.(errorMessage);
          }
        })();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Encryption setup failed';
        console.error('Encryption setup failed:', error);
        onEncryptError?.(errorMessage);
      }
    }
  };

  const toggleDropdown = () => {
    if (!disabled && !isEncrypting) {
      setIsDropdownOpen(!isDropdownOpen);
    }
  };

  // Material Icons components
  const ShieldIcon = () => <SecurityIcon sx={{ fontSize: 14 }} />;

  const ChevronDownIcon = () => <KeyboardArrowDownIcon sx={{ fontSize: 14 }} />;

  return (
    <div className="w-full">
      <div className="flex items-start gap-3">
        {/* Input with integrated dropdown - this will determine progress bar width */}
        <div className="flex-1">
          <div className={inputContainerClasses} data-testid={testId}>
            <input
              type="text"
              className={inputClasses}
              placeholder={placeholder}
              value={textValue}
              onChange={handleTextChange}
              disabled={disabled || isEncrypting}
              data-testid={testId ? `${testId}-input` : 'fnx-encrypt-input'}
            />

            {/* Encryption status indicator */}
            {(isEncrypting || encryptedResult) && (
              <div className="absolute right-16 top-1/2 transform -translate-y-1/2">
                {isEncrypting ? (
                  <div className="bg-blue-500 px-2 py-1 text-xs text-white rounded animate-pulse">Encrypting...</div>
                ) : encryptedResult ? (
                  <button
                    onClick={handleCopyResult}
                    disabled={copySuccess}
                    className={`px-2 py-1 text-xs text-white rounded flex items-center gap-1 transition-all duration-300 ${
                      copySuccess ? 'bg-green-600 cursor-default' : 'bg-green-500 hover:bg-green-600'
                    }`}
                    title={copySuccess ? 'Copied to clipboard!' : 'Copy encrypted result to clipboard'}
                  >
                    <>
                      {copySuccess ? <CheckIcon sx={{ fontSize: 12 }} /> : <ContentCopyIcon sx={{ fontSize: 12 }} />}
                      Copy
                    </>
                  </button>
                ) : null}
              </div>
            )}

            {/* Integrated dropdown button */}
            <div className="cofhe-dropdown-container" ref={dropdownRef}>
              <button
                type="button"
                className={dropdownButtonClasses}
                onClick={toggleDropdown}
                disabled={disabled || isEncrypting}
                data-testid={testId ? `${testId}-type-selector` : 'fnx-type-selector'}
              >
                <ShieldIcon />
                <ChevronDownIcon />
              </button>

              {/* Dropdown menu */}
              {isDropdownOpen && (
                <div className="cofhe-dropdown-menu">
                  {options.map((option) => {
                    const isCompatible = isTypeCompatible(option.value, textValue);
                    const isSelected = option.value === selectedType;

                    return (
                      <div
                        key={option.value}
                        className={dropdownItemClasses(isSelected, isCompatible)}
                        onClick={() => isCompatible && handleTypeSelect(option.value)}
                        data-testid={`${testId ? `${testId}-` : ''}type-option-${option.value}`}
                        title={
                          !isCompatible ? `Value "${textValue}" is not compatible with ${option.label}` : undefined
                        }
                      >
                        <span className="font-mono">{option.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Progress bar section - shows immediately when encryption starts */}
          {showProgress && (
            <div
              className="mt-3 overflow-hidden"
              style={{
                animation: isEncrypting
                  ? 'slideDownFadeIn 0.5s ease-out forwards'
                  : 'slideUpFadeOut 0.5s ease-out forwards',
              }}
              data-testid={testId ? `${testId}-progress` : 'fnx-encrypt-progress'}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {encryptionProgressLabel || 'Processing...'}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">{encryptionProgress || 0}%</span>
              </div>
              <div className={progressContainerClasses}>
                <div
                  className={progressBarClasses('primary')}
                  style={{
                    width: `${Math.min(100, Math.max(0, encryptionProgress || 0))}%`,
                    transition: 'width 0.3s ease-out',
                  }}
                  data-testid={testId ? `${testId}-progress-bar` : 'fnx-encrypt-progress-bar'}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error message */}
      {hasError && errorMessage && (
        <p
          className="mt-2 text-sm text-red-600 dark:text-red-400"
          data-testid={testId ? `${testId}-error` : 'fnx-encrypt-error'}
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
};
