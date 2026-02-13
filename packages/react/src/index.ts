// Styles
import './styles.css';

// Providers
export { CofheProvider, useCofheContext } from './providers/index';

// Hooks
export {
  useCofheConnection,
  useCofheActivePermit,
  useCofheAllPermits,
  useCofheRemovePermit,
  useCofheSelectPermit,
  useCofhePublicClient,
  useCofheWalletClient,
  useCofheEncrypt,
  useCofheWriteContract,
  useCofheClient,
  useCofheTokens,
  useCofheTokensWithExistingEncryptedBalances,
  useTokensWithPublicBalances,
  useCofheTokenLists,
  useCofheTokenShield,
  useCofheTokenUnshield,
  useCofheTokenClaimUnshielded,
  useCofheTokenClaimable,
  useCofheTokensClaimable,
  useCofheTokenDecryptedBalance,
  useCofheTokenTransfer,
  useTransactionReceiptsByHash,
  ETH_ADDRESS,
  type Erc20Pair,
  type UnshieldClaim,
  type UnshieldClaimsSummary,
  type UnshieldClaimsSummaryByTokenAddress,
  type ClaimableAmountByTokenAddress,
  type UseTransactionReceiptsByHashInput,
  useCoingeckoUsdPrice,
  type UseCoingeckoUsdPriceInput,
  type UseCoingeckoUsdPriceOptions,
  useCoingeckoContractMarketChartRange,
  type CoingeckoMarketChartPoint,
  type UseCoingeckoContractMarketChartRangeInput,
  type UseCoingeckoContractMarketChartRangeOptions,
} from '@/hooks/index';

export { useCofheEncryptAndWriteContract } from '@/hooks/useCofheEncryptAndWriteContract';
export { useCofheReadContractAndDecrypt } from '@/hooks/useCofheReadContractAndDecrypt';

// Components
export { FnxEncryptInput, FnxFloatingButtonWithProvider } from './components/index';
export { MainPage, SettingsPage } from './components/FnxFloatingButton/pages/index';

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
} from './utils/index';

// Stores
export {
  useTransactionStore,
  TransactionStatus,
  TransactionActionType,
  actionToString,
  statusToString,
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

export { useCofheNavigateToCreatePermit } from '@/hooks/permits/useCofheNavigateToCreatePermit';
export { useCofheAutoConnect } from '@/hooks/useCofheAutoConnect';
export { CREATE_PERMITT_BODY_BY_ERROR_CAUSE } from './providers/errors';
export { ErrorCause } from './utils/errors';

export type { CofhesdkConfigWithReact } from './config';

export type { Token } from './types/token';

export { useInternalQueryClient } from './providers/index';
