// Providers
export { CofheProvider, useCofheContext } from './providers/index';

// Hooks
export {
  useCofheConnection,
  useCofheEnabled,
  useCofheActivePermit,
  useCofheAllPermits,
  useCofheRemovePermit,
  useCofheSelectPermit,
  useCofhePublicClient,
  useCofheWalletClient,
  useCofheEncrypt,
  useCofheWriteContract,
  useCofheSimulateWriteContract,
  useCofheClient,
  useCofheTokens,
  useCofheTokensWithExistingEncryptedBalances,
  useTokensWithPublicBalances,
  useCofheTokenLists,
  useCofheTokenShield,
  getCofheTokenShieldCallArgs,
  useCofheTokenUnshield,
  getCofheTokenUnshieldCallArgs,
  useCofheTokenClaimUnshielded,
  getCofheTokenClaimUnshieldedCallArgs,
  useCofheTokenClaimable,
  useCofheTokensClaimable,
  useCofheTokenDecryptedBalance,
  useCofheTokenTransfer,
  useTokenAllowance,
  useTransactionReceiptsByHash,
  ETH_ADDRESS_LOWERCASE,
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

// Utils
export {
  FheTypesList,
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

export { createCofheConfig } from './config';
export type { CofheReactLogger, CofheReactLoggerMethod } from './config';

// Types
export type { CofheContextValue, CofheProviderProps, CofheClientConfig } from './types/index';

export { createCofheClient } from '@cofhe/sdk/web';

export { useCofheNavigateToCreatePermit } from '@/hooks/permits/useCofheNavigateToCreatePermit';
export { useCofheAutoConnect } from '@/hooks/useCofheAutoConnect';

export type { CofheConfigWithReact as CofhesdkConfigWithReact } from './config';

export type { Token } from './types/token';

export { useInternalQueryClient } from './providers/index';
