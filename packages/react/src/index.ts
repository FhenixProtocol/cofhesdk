// Providers
export { CofheProvider, useCofheContext } from './providers/index';

// Hooks
export {
  ETH_ADDRESS_LOWERCASE,
  getCofheTokenClaimUnshieldedCallArgs,
  getCofheTokenShieldCallArgs,
  getCofheTokenUnshieldCallArgs,
  useCofheActivePermit,
  useCofheAllPermits,
  useCofheClient,
  useCofheConnection,
  useCofheEnabled,
  useCofheEncrypt,
  useCofhePublicClient,
  useCofheRemovePermit,
  useCofheSelectPermit,
  useCofheSimulateWriteContract,
  useCofheStatuses,
  useCofheTokenClaimable,
  useCofheTokenClaimUnshielded,
  useCofheTokenDecryptedBalance,
  useCofheTokenLists,
  useCofheTokens,
  useCofheTokensClaimable,
  useCofheTokenShield,
  useCofheTokensWithExistingEncryptedBalances,
  useCofheTokenTransfer,
  useCofheTokenUnshield,
  useCofheWalletClient,
  useCofheWriteContract,
  useCoingeckoContractMarketChartRange,
  useCoingeckoUsdPrice,
  useTokenAllowance,
  useTokensWithPublicBalances,
  useTransactionReceiptsByHash,
  type ClaimableAmountByTokenAddress,
  type CoingeckoMarketChartPoint,
  type Erc20Pair,
  type UnshieldClaim,
  type UnshieldClaimsSummary,
  type UnshieldClaimsSummaryByTokenAddress,
  type UseCoingeckoContractMarketChartRangeInput,
  type UseCoingeckoContractMarketChartRangeOptions,
  type UseCoingeckoUsdPriceInput,
  type UseCoingeckoUsdPriceOptions,
  type UseTransactionReceiptsByHashInput,
} from '@/hooks/index';

export { useCofheEncryptAndWriteContract } from '@/hooks/useCofheEncryptAndWriteContract';
export { useCofheReadContractAndDecrypt } from '@/hooks/useCofheReadContractAndDecrypt';

// Utils
export {
  FheTypesList,
  formatRelativeTime,
  getBlockExplorerAddressUrl,
  getBlockExplorerTokenUrl,
  getBlockExplorerTxUrl,
  getBlockExplorerUrl,
  isEthPair,
  isWrappedEthToken,
  truncateHash,
} from './utils/index';

// Stores
export {
  actionToString,
  statusToString,
  TransactionActionType,
  TransactionStatus,
  useTransactionStore,
  type Transaction,
  type TransactionActionString,
  type TransactionStatusString,
  type TransactionStore,
} from './stores/transactionStore';

export { createCofheConfig } from './config';
export type { CofheReactLogger, CofheReactLoggerMethod } from './config';

// Types
export type { CofheClientConfig, CofheContextValue, CofheProviderProps } from './types/index';

export { createCofheClient } from '@cofhe/sdk/web';

export { useCofheCreatePermit } from '@/hooks/permits/useCofheCreatePermit';
export { useCofheNavigateToCreatePermit } from '@/hooks/permits/useCofheNavigateToCreatePermit';
export { useCofheAutoConnect } from '@/hooks/useCofheAutoConnect';
export { CofheFloatingButtonProvider, sortCofheStatuses } from './components/index';

export type { CofheConfigWithReact as CofhesdkConfigWithReact } from './config';

export type { CofheStatus, CofheStatusActionIntent } from './components/CofheFloatingButton/types';
export type { Token } from './types/token';

export { useInternalQueryClient } from './providers/index';
