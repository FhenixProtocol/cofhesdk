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
  useCofheTokenClaims,
  useCofheTokenApprove,
  useCofheTokenClaimUnshielded,
  useCofheTokenDecryptedBalance,
  useCofheTokenPublicBalance,
  useCofheTokenLists,
  useCofheToken,
  useCofheTokens,
  useCofheTokensClaimable,
  useCofheTokenShield,
  useCofheTokensWithExistingEncryptedBalances,
  useCofheTokenTransactions,
  useCofheTokenTransfer,
  useResolvedCofheToken,
  useCofheTransactions,
  addCofheTransaction,
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
  type UseCofheTokenTransactionsInput,
  type UseCofheTokenTransactionsResult,
  type UseTransactionReceiptsByHashInput,
  type AddCofheTransactionInput,
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
export { useCustomTokensStore } from './stores/customTokensStore';

export {
  actionToString,
  isCustomTransactionActionType,
  statusToString,
  transactionMatchesToken,
  TransactionActionType,
  TransactionStatus,
  useTransactionStore,
  type Transaction,
  type BuiltInTransactionActionType,
  type CustomTransactionActionType,
  type JsonValue,
  type NewTransaction,
  type TransactionActionString,
  type TransactionStatusString,
  type TransactionStore,
} from './stores/transactionStore';

export { createCofheConfig } from './config';
export type { CofheReactLogger, CofheReactLoggerMethod } from './config';

// Types
export type {
  CofheClientConfig,
  CofheContextValue,
  CofheProviderProps,
  TransactionRenderer,
  TransactionRendererProps,
  TransactionRenderers,
} from './types/index';

export { createCofheClient } from '@cofhe/sdk/web';

export { useCofheCreatePermit } from '@/hooks/permits/useCofheCreatePermit';
export { useCofheNavigateToCreatePermit } from '@/hooks/permits/useCofheNavigateToCreatePermit';
export { useCofheAutoConnect } from '@/hooks/useCofheAutoConnect';
export { CofheFloatingButtonProvider, sortCofheStatuses } from './components/index';
export { COFHE_STATUS_IDS, CofheStatusActionIntents } from './components/CofheFloatingButton/types';

export type { CofheConfigWithReact as CofhesdkConfigWithReact } from './config';

export type { CofheStatus, CofheStatusActionIntent, CofheStatusId } from './components/CofheFloatingButton/types';
export type { ConfidentialToken } from './types/token';

export { useInternalQueryClient } from './providers/index';

// Type bridges for cross-repo / multi-instance viem peer dependency scenarios
export { asCofhePublicClient, asCofheWalletClient } from './utils/viemClientBridge';
export type {
  PublicClientLike as CofhePublicClientLike,
  WalletClientLike as CofheWalletClientLike,
} from './utils/viemClientBridge';
