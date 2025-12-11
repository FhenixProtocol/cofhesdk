import { useState, useMemo } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { TbShieldPlus, TbShieldMinus } from 'react-icons/tb';
import { type Address, formatUnits, parseUnits } from 'viem';
import { useFnxFloatingButtonContext } from '../FnxFloatingButtonContext.js';
import { useCofheAccount, useCofheChainId, useCofhePublicClient } from '../../../hooks/useCofheConnection.js';
import {
  useTokenMetadata,
  usePinnedTokenAddress,
  usePublicTokenBalance,
  useConfidentialTokenBalance,
} from '../../../hooks/useTokenBalance.js';
import { useTokens } from '../../../hooks/useTokenLists.js';
import { useTokenShield, useTokenUnshield, useClaimUnshield, useUnshieldClaimStatus, useWrappedClaims } from '../../../hooks/useTokenShield.js';
import { cn } from '../../../utils/cn.js';
import { truncateHash } from '../../../utils/utils.js';
import { ShieldMeter, ActionButton, AmountInput, TokenBalance } from '../components/index.js';

// Constants
const SUCCESS_TIMEOUT = 5000;
const DISPLAY_DECIMALS = 2;

export const ShieldPage: React.FC = () => {
  const { navigateBack, selectedToken, navigateToTokenListForSelection } = useFnxFloatingButtonContext();
  const account = useCofheAccount();
  const chainId = useCofheChainId();
  const publicClient = useCofhePublicClient();
  const tokens = useTokens(chainId ?? 0);

  // Separate states for shield and unshield amounts
  const [shieldAmount, setShieldAmount] = useState('');
  const [unshieldAmount, setUnshieldAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Unified status message with type
  const [status, setStatus] = useState<{ message: string; type: 'info' | 'success' } | null>(null);
  const [isRefreshingBalances, setIsRefreshingBalances] = useState(false);
  const [isWaitingForConfirmation, setIsWaitingForConfirmation] = useState(false);

  const tokenShield = useTokenShield();
  const tokenUnshield = useTokenUnshield();
  const claimUnshield = useClaimUnshield();

  const pinnedTokenAddress = usePinnedTokenAddress();

  // Use selected token if available, otherwise fall back to pinned token
  const activeTokenAddress =
    selectedToken && !selectedToken.isNative ? (selectedToken.address as Address) : pinnedTokenAddress;

  // Filter tokens to only show shieldable tokens (dual and wrapped)
  const shieldableTokens = useMemo(() => {
    return tokens.filter((t) => {
      const type = t.extensions.fhenix.confidentialityType;
      return type === 'dual' || type === 'wrapped';
    });
  }, [tokens]);

  // Find token from token list
  const tokenFromList = useMemo(() => {
    if (!activeTokenAddress || !chainId) return null;
    return (
      shieldableTokens.find(
        (t) => t.chainId === chainId && t.address.toLowerCase() === activeTokenAddress.toLowerCase()
      ) || null
    );
  }, [activeTokenAddress, chainId, shieldableTokens]);

  const { data: tokenMetadata } = useTokenMetadata(activeTokenAddress);

  // Determine token type
  const confidentialityType = tokenFromList?.extensions.fhenix.confidentialityType;
  const isWrappedToken = confidentialityType === 'wrapped';

  // Get public balance using unified hook
  const {
    numericValue: publicBalanceNum,
    isLoading: isLoadingPublic,
    refetch: refetchPublic,
  } = usePublicTokenBalance(
    { token: tokenFromList, accountAddress: account as Address, displayDecimals: DISPLAY_DECIMALS },
    { enabled: !!tokenFromList && !!account }
  );

  // Get confidential balance using unified hook
  const {
    numericValue: confidentialBalanceNum,
    isLoading: isLoadingConfidential,
    refetch: refetchConfidential,
  } = useConfidentialTokenBalance(
    { token: tokenFromList, accountAddress: account as Address, displayDecimals: DISPLAY_DECIMALS },
    { enabled: !!tokenFromList && !!account }
  );

  // Function to refresh all balances and claims
  const refreshBalances = async () => {
    setIsRefreshingBalances(true);
    try {
      const refetchPromises: Promise<unknown>[] = [refetchPublic(), refetchConfidential()];
      // Only refetch wrapped claims for wrapped tokens
      if (isWrappedToken) {
        refetchPromises.push(refetchWrappedClaims());
      }
      await Promise.all(refetchPromises);
    } finally {
      setIsRefreshingBalances(false);
    }
  };

  // Helper to execute transaction with common status/confirmation flow
  const executeTransaction = async (
    txFn: () => Promise<`0x${string}`>,
    successMessage: string,
    errorMessage: string
  ): Promise<`0x${string}`> => {
    if (!publicClient) {
      throw new Error('PublicClient is required');
    }

    setError(null);
    setStatus({ message: 'Preparing transaction...', type: 'info' });

    try {
      const hash = await txFn();

      setStatus({ message: `Waiting for confirmation... ${truncateHash(hash)}`, type: 'info' });
      setIsWaitingForConfirmation(true);
      await publicClient.waitForTransactionReceipt({ hash });
      setIsWaitingForConfirmation(false);

      setStatus({ message: 'Refreshing balances...', type: 'info' });
      await refreshBalances();

      setStatus({ message: `${successMessage} ${truncateHash(hash)}`, type: 'success' });
      setTimeout(() => setStatus(null), SUCCESS_TIMEOUT);

      return hash;
    } catch (err) {
      setIsWaitingForConfirmation(false);
      setStatus(null);
      const message = err instanceof Error ? err.message : errorMessage;
      setError(message);
      console.error(`${errorMessage}:`, err);
      throw err;
    }
  };

  // Check for pending unshield claim (dual tokens only)
  const { data: unshieldClaim } = useUnshieldClaimStatus(
    {
      tokenAddress: activeTokenAddress as Address,
      accountAddress: account as Address,
    },
    {
      enabled:
        !!activeTokenAddress &&
        !!account &&
        tokenFromList?.extensions.fhenix.confidentialityType === 'dual',
      refetchInterval: 5000,
    }
  );

  // Check for pending claims (wrapped tokens only)
  const { data: wrappedClaims, refetch: refetchWrappedClaims } = useWrappedClaims(
    {
      tokenAddress: activeTokenAddress as Address,
      accountAddress: account as Address,
    },
    {
      enabled:
        !!activeTokenAddress &&
        !!account &&
        tokenFromList?.extensions.fhenix.confidentialityType === 'wrapped',
      refetchInterval: 5000,
    }
  );

  // Use selected token metadata if available, otherwise use fetched metadata
  const displayToken =
    selectedToken ||
    (tokenMetadata
      ? {
          name: tokenMetadata.name,
          symbol: tokenMetadata.symbol,
          decimals: tokenMetadata.decimals,
          logoURI: undefined,
        }
      : null);

  const isProcessing = tokenShield.isPending || tokenUnshield.isPending || claimUnshield.isPending || isRefreshingBalances || isWaitingForConfirmation;

  // Validate amounts
  const isValidShieldAmount = useMemo(() => {
    if (!shieldAmount) return false;
    const numAmount = parseFloat(shieldAmount);
    if (isNaN(numAmount) || numAmount <= 0) return false;
    return numAmount <= publicBalanceNum;
  }, [shieldAmount, publicBalanceNum]);

  const isValidUnshieldAmount = useMemo(() => {
    if (!unshieldAmount) return false;
    const numAmount = parseFloat(unshieldAmount);
    if (isNaN(numAmount) || numAmount <= 0) return false;
    return numAmount <= confidentialBalanceNum;
  }, [unshieldAmount, confidentialBalanceNum]);

  // Check if token supports shielding
  const isShieldableToken = useMemo(() => {
    if (!tokenFromList) return false;
    const type = tokenFromList.extensions.fhenix.confidentialityType;
    return type === 'dual' || type === 'wrapped';
  }, [tokenFromList]);


  const handleShieldMax = () => {
    if (publicBalanceNum > 0) {
      setShieldAmount(publicBalanceNum.toString());
    }
  };

  const handleUnshieldMax = () => {
    if (confidentialBalanceNum > 0) {
      setUnshieldAmount(confidentialBalanceNum.toString());
    }
  };

  const handleShield = async () => {
    if (!tokenFromList || !tokenMetadata || !account || !publicClient) {
      setError('Missing required data. Please ensure wallet is connected and a token is selected.');
      return;
    }

    if (!isValidShieldAmount) {
      setError('Invalid shield amount. Please check your balance.');
      return;
    }

    const amountInSmallestUnit = parseUnits(shieldAmount, tokenMetadata.decimals);

    try {
      await executeTransaction(
        () => tokenShield.mutateAsync({
          token: tokenFromList,
          amount: amountInSmallestUnit,
          onStatusChange: (message) => setStatus({ message, type: 'info' }),
        }),
        'Shield complete!',
        'Failed to shield tokens'
      );
      setShieldAmount('');
    } catch {
      // Error already handled by executeTransaction
    }
  };

  const handleUnshield = async () => {
    if (!tokenFromList || !tokenMetadata || !account || !publicClient) {
      setError('Missing required data. Please ensure wallet is connected and a token is selected.');
      return;
    }

    if (!isValidUnshieldAmount) {
      setError('Invalid unshield amount. Please check your balance.');
      return;
    }

    const amountInSmallestUnit = parseUnits(unshieldAmount, tokenMetadata.decimals);

    try {
      await executeTransaction(
        () => tokenUnshield.mutateAsync({
          token: tokenFromList,
          amount: amountInSmallestUnit,
          onStatusChange: (message) => setStatus({ message, type: 'info' }),
        }),
        'Unshield complete!',
        'Failed to unshield tokens'
      );
      setUnshieldAmount('');
    } catch {
      // Error already handled by executeTransaction
    }
  };

  const handleClaim = async () => {
    if (!tokenFromList || !publicClient) {
      setError('Missing token data');
      return;
    }

    try {
      await executeTransaction(
        () => claimUnshield.mutateAsync({ token: tokenFromList }),
        'Claim complete!',
        'Failed to claim tokens'
      );
    } catch {
      // Error already handled by executeTransaction
    }
  };

  // Token symbol for display
  const tokenSymbol = displayToken?.symbol || tokenMetadata?.symbol || 'TOKEN';
  // ERC20 pair symbol (for shield side)
  const erc20Symbol = tokenFromList?.extensions.fhenix.erc20Pair?.symbol || tokenSymbol.replace(/^e/, '');

  // Calculate meter percentage: shielded / total
  const meterPercentage = useMemo(() => {
    const total = publicBalanceNum + confidentialBalanceNum;
    if (total > 0) {
      return (confidentialBalanceNum / total) * 100;
    }
    return 0;
  }, [publicBalanceNum, confidentialBalanceNum]);

  return (
    <div className="fnx-text-primary space-y-3">
      {/* Back Button */}
      <button
        onClick={navigateBack}
        className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity"
      >
        <ArrowBackIcon style={{ fontSize: 16 }} />
        <p className="text-sm font-medium">Shield</p>
      </button>

      {/* Three Column Layout */}
      <div className="grid grid-cols-3 gap-2">
        {/* Left Column: Shield */}
        <div className="flex flex-col items-center space-y-2">
          <p className="text-xs font-medium opacity-70">Unshielded</p>
          <TokenBalance
            value={publicBalanceNum}
            isLoading={isLoadingPublic}
            symbol={erc20Symbol}
            showSymbol={false}
            decimalPrecision={DISPLAY_DECIMALS}
            size="sm"
            className="font-bold"
          />
          <p className="text-xs opacity-60">{erc20Symbol}</p>
          
          <AmountInput
            value={shieldAmount}
            onChange={setShieldAmount}
            onMaxClick={handleShieldMax}
          />
          
          <ActionButton
            onClick={handleShield}
            disabled={!isValidShieldAmount || isProcessing || !activeTokenAddress || !isShieldableToken}
            icon={<TbShieldPlus className="w-3 h-3" />}
            label="Shield"
          />
        </div>

        {/* Center Column: Token Selector + Meter */}
        <div className="flex flex-col items-center">
          <button
            onClick={navigateToTokenListForSelection}
            className="flex items-center gap-1 text-sm font-bold fnx-text-primary hover:opacity-80 transition-opacity mb-1"
          >
            <span>{tokenSymbol}</span>
            <KeyboardArrowDownIcon style={{ fontSize: 16 }} className="opacity-60" />
          </button>
          
          <ShieldMeter
            percentage={meterPercentage}
            size={100}
            showPercentage={true}
            isProcessing={isProcessing}
          />

          {/* Wrapped token claim button */}
          {wrappedClaims?.hasClaimable && tokenMetadata && (
            <ActionButton
              onClick={handleClaim}
              disabled={claimUnshield.isPending || isRefreshingBalances}
              label={claimUnshield.isPending ? 'Claiming...' : `Claim ${formatUnits(wrappedClaims.claimableAmount, tokenMetadata.decimals)} ${erc20Symbol}`}
              className="mt-2"
            />
          )}

          {/* Wrapped token pending notice */}
          {wrappedClaims?.hasPending && tokenMetadata && !wrappedClaims.hasClaimable && (
            <p className="text-xxs text-yellow-600 dark:text-yellow-400 mt-2 text-center">
              Pending: {formatUnits(wrappedClaims.pendingAmount, tokenMetadata.decimals)} {erc20Symbol}
            </p>
          )}
        </div>

        {/* Right Column: Unshield */}
        <div className="flex flex-col items-center space-y-2">
          <p className="text-xs font-medium opacity-70">Shielded</p>
          <TokenBalance
            value={confidentialBalanceNum}
            isLoading={isLoadingConfidential}
            symbol={tokenSymbol}
            showSymbol={false}
            decimalPrecision={DISPLAY_DECIMALS}
            size="sm"
            className="font-bold"
          />
          <p className="text-xs opacity-60">{tokenSymbol}</p>
          
          <AmountInput
            value={unshieldAmount}
            onChange={setUnshieldAmount}
            onMaxClick={handleUnshieldMax}
          />
          
          <ActionButton
            onClick={handleUnshield}
            disabled={!isValidUnshieldAmount || isProcessing || !activeTokenAddress || !isShieldableToken}
            icon={<TbShieldMinus className="w-3 h-3" />}
            label="Unshield"
          />
        </div>
      </div>

      {/* Pending Claim Notice (for dual tokens) */}
      {unshieldClaim && !unshieldClaim.claimed && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-2">
          <p className="text-xs text-yellow-800 dark:text-yellow-200 mb-1">
            Pending claim:{' '}
            {tokenMetadata
              ? formatUnits(unshieldClaim.requestedAmount, tokenMetadata.decimals)
              : unshieldClaim.requestedAmount.toString()}{' '}
            {tokenSymbol}
          </p>
          {unshieldClaim.decrypted ? (
            <ActionButton
              onClick={handleClaim}
              disabled={claimUnshield.isPending}
              label={claimUnshield.isPending ? 'Claiming...' : 'Claim Now'}
            />
          ) : (
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              Waiting for decryption...
            </p>
          )}
        </div>
      )}

      {/* Not Shieldable Token Warning */}
      {tokenFromList && !isShieldableToken && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-2">
          <p className="text-xs text-yellow-800 dark:text-yellow-200">
            This token does not support shielding/unshielding.
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2">
          <p className="text-xs text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Unified Status Message */}
      {status && (
        <div className={cn(
          'rounded-lg p-2 border',
          status.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
        )}>
          <p className={cn(
            'text-xs',
            status.type === 'success'
              ? 'text-green-800 dark:text-green-200'
              : 'text-blue-800 dark:text-blue-200'
          )}>
            {status.message}
          </p>
        </div>
      )}
    </div>
  );
};
