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
  useCofheAddToken,
  useCofheTokens,
  useCofheTokenLists,
  useCofheTokenShield,
  useCofheTokenUnshield,
  useCofheClaimUnshield,
  useCofheUnshieldClaims,
  useCofheTokenBalance,
  useCofheNativeBalance,
  useCofheTokenConfidentialBalance,
  useCofheTokenMetadata,
  useCofheTokenDecimals,
  useCofheTokenSymbol,
  useCofhePinnedTokenAddress,
  useCofhePublicTokenBalance,
  useCofheConfidentialTokenBalance,
  useCofheTokenTransfer,
  ETH_ADDRESS,
  type Token,
  type Erc20Pair,
  type UnshieldClaim,
  type UnshieldClaimsSummary,
  type TokenMetadata,
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

export type { FloatingButtonPosition, FloatingButtonSize } from './components/FnxFloatingButton/types';

export { createCofhesdkClient } from '@cofhe/sdk/web';
