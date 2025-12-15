// Styles
import './styles.css';

// Providers
export { CofheProvider, useCofheContext } from './providers/index';

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
export { FnxEncryptInput, FnxFloatingButton } from './components/index';
export { MainPage, SettingsPage, TokenListPage } from './components/FnxFloatingButton/pages/index';

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
} from './stores/transactionStore';

export { createCofhesdkConfig } from './config';

// Types
export type { CofheContextValue, CofheProviderProps, CofheClientConfig } from './types/index';

export type { FnxFloatingButtonProps } from './components/FnxFloatingButton/types';

export type { FloatingButtonPosition, FloatingButtonSize } from './components/FnxFloatingButton/types';

export { createCofhesdkClient } from '@cofhe/sdk/web';

export { useTokenConfidentialBalance } from './hooks/useTokenBalance';
export type { Token } from './hooks/useTokenLists';
