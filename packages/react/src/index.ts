// Styles
import './styles.css';

// Providers
export { CofheProvider, useCofheContext } from './providers/index.js';

// Hooks
export { useEncryptInput } from './hooks/index.js';

// Components
export { FnxEncryptInput, FloatingCofheButton, FnxFloatingButton } from './components/index.js';

// Utils
export { FheTypesList, fheTypeToString, encryptedValueToString, type FheTypeValue } from './utils/index.js';

export { createCofhesdkConfig } from './widget/index';

// Types
export type { CofheContextValue, CofheProviderProps, CofheClientConfig } from './types/index.js';

export { createCofhesdkClient } from '@cofhe/sdk/web';
export type {
  CofheContextValue,
  CofheProviderProps,
  CofheClientConfig,
} from './types/index.js';

export type {
  FnxFloatingButtonProps,
  FloatingButtonPosition,
} from './components/FnxFloatingButton.js';
