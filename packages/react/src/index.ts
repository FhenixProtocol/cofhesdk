// Styles
import './styles.css';

// Providers
export { CofheProvider, useCofheContext } from './providers/index.js';

// Hooks
export {
  useEncryptInput,
  useCofheConnection,
  useCofheActivePermit,
  useCofheAllPermits,
  useCofheRemovePermit,
  useCofheSelectPermit,
  useCofheWalletClient,
  useCofhePublicClient,
} from './hooks/index';

// Components
export { FnxEncryptInput, FnxFloatingButton } from './components/index.js';
export { MainPage, SettingsPage, TokenListPage } from './components/FnxFloatingButton/pages/index.js';

// Utils
export { FheTypesList, fheTypeToString, encryptedValueToString, type FheTypeValue } from './utils/index';

export { createCofhesdkConfig } from './config';

// Types
export type { CofheContextValue, CofheProviderProps, CofheClientConfig } from './types/index';

export type {
  FnxFloatingButtonProps,
  FloatingButtonPosition,
  FloatingButtonSize,
} from './components/FnxFloatingButton/FnxFloatingButton.js';

export { createCofhesdkClient } from '@cofhe/sdk/web';
