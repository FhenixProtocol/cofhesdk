// Styles
import './styles.css';

// Providers
export { CofheProvider, useCofheContext } from './providers/index.js';

// Hooks
export {
  useEncrypt,
  useEncryptInput,
  useCofheConnection,
  useCofheActivePermit,
  useCofheAllPermits,
  useCofheRemovePermit,
  useCofheSelectPermit,
  useCofhePublicClient,
  useCofheWalletClient,
  useCofheClient,
} from './hooks/index';

// Components
export { FnxEncryptInput, FnxFloatingButton } from './components/index.js';
export { MainPage, SettingsPage, TokenListPage } from './components/FnxFloatingButton/pages/index.js';

// Utils
export {
  FheTypesList,
  fheTypeToString,
  encryptedValueToString,
  getBlockExplorerUrl,
  getBlockExplorerTxUrl,
  getBlockExplorerAddressUrl,
  getBlockExplorerTokenUrl,
  formatRelativeTime,
  truncateHash,
  type FheTypeValue,
} from './utils/index';

// Stores
export {
  useTransactionStore,
  TransactionStatus,
  TransactionActionType,
  actionToString,
  statusToString,
  addTransactionAndWatch,
  checkPendingTransactions,
  stopPendingTransactionPolling,
  type Transaction,
  type TransactionStore,
  type TransactionStatusString,
  type TransactionActionString,
} from './stores/transactionStore.js';

export { createCofhesdkConfig } from './config';

// Types
export type { CofheContextValue, CofheProviderProps, CofheClientConfig } from './types/index';

export type { FnxFloatingButtonProps } from './components/FnxFloatingButton/FnxFloatingButton.js';

export type {
  FloatingButtonPosition,
  FloatingButtonSize,
  FloatingButtonPositionType,
} from './components/FnxFloatingButton/FnxFloatingButtonContext.js';

export { createCofhesdkClient } from '@cofhe/sdk/web';
