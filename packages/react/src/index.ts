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
} from './hooks/index';

// Components
export { FnxEncryptInput, FloatingCofheButton } from './components/index';

// Utils
export { FheTypesList, fheTypeToString, encryptedValueToString, type FheTypeValue } from './utils/index';

export { createCofhesdkConfig } from './widget/index';

// Types
export type { CofheContextValue, CofheProviderProps, CofheClientConfig } from './types/index';

export { createCofhesdkClient } from '@cofhe/sdk/web';
