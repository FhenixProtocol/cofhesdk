// Styles
import './styles.css';

// Providers
export { CofheProvider, useCofheContext } from './providers/index';

// Hooks
export {
  useCofheEncrypt,
  useCofheEncryptInput,
  useCofheConnection,
  useCofheActivePermit,
  useCofheAllPermits,
  useCofheRemovePermit,
  useCofheSelectPermit,
  useCofhePublicClient,
  useCofheWalletClient,
  useCofheClient,
  useCofheTokens,
  useCofheTokenLists,
  useCofheTokenShield,
  useCofheTokenUnshield,
  useCofheClaimUnshield,
  useCofheUnshieldClaims,
  useCofheTokenDecryptedBalance,
  useCofheReadContract,
  useCofheReadContractAndDecrypt,
  useCofheTokenMetadata,
  useCofhePinnedTokenAddress,
  useCofhePublicTokenBalance,
  useCofheTokenTransfer,
  ETH_ADDRESS,
  type Erc20Pair,
  type UnshieldClaim,
  type UnshieldClaimsSummary,
  type TokenMetadata,
} from './hooks/index';

// Components
export { FnxEncryptInput, FnxFloatingButtonWithProvider } from './components/index';
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
  isEthPair,
  isWrappedEthToken,
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

export type { FloatingButtonPosition } from './components/FnxFloatingButton/types';

export { createCofhesdkClient } from '@cofhe/sdk/web';

export { useCofheCreatePermit } from './hooks/permits/useCofheCreatePermit';
export { useCofheAutoConnect } from './hooks/useCofheAutoConnect';
export { CREATE_PERMITT_BODY_BY_ERROR_CAUSE } from './providers/errors';
export { ErrorCause } from './utils/errors';

export type { CofhesdkConfigWithReact } from './config';

export type { Token } from './types/token';
