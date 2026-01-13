import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { TbShieldPlus, TbShieldMinus } from 'react-icons/tb';
import { useMemo, useState } from 'react';
import { type Address, parseUnits } from 'viem';
import { useFnxFloatingButtonContext } from '../FnxFloatingButtonContext';
import { useCofheAccount, useCofhePublicClient } from '@/hooks/useCofheConnection';
import { useCofheTokenDecryptedBalance } from '@/hooks/useCofheTokenDecryptedBalance';
import { type Token } from '@/hooks/useCofheTokenLists';
import { useCofheTokenShield } from '@/hooks/useCofheTokenShield';
import { cn } from '../../../utils/cn';
import { truncateHash } from '../../../utils/utils';
import { ActionButton, AmountInput, TokenIcon } from '../components/index';
import { TokenBalanceView } from '../components/TokenBalanceView';
import { useCofheTokenPublicBalance } from '@/hooks/useCofheTokenPublicBalance';
import { formatTokenAmount, unitToWei } from '@/utils/format';
import { FloatingButtonPage } from '../pagesConfig/types';
import { useCofheTokenClaimUnshielded, useCofheTokenUnshield, useCofheTokenClaimable } from '@/hooks';
import { useOnceTransactionMined } from '@/hooks/useOnceTransactionMined';

const SUCCESS_TIMEOUT = 5000;
const DISPLAY_DECIMALS = 5;

type Mode = 'shield' | 'unshield';

export type ShieldPageProps = {
  token: Token;
  defaultMode?: Mode;
};

declare module '../pagesConfig/types' {
  interface FloatingButtonPagePropsRegistry {
    [FloatingButtonPage.Shield]: ShieldPageProps;
  }
}

const shieldableTypes = new Set(['dual', 'wrapped']);

export const ShieldPageV2: React.FC<ShieldPageProps> = ({ token, defaultMode }) => {
  const { navigateBack, navigateTo } = useFnxFloatingButtonContext();
  const account = useCofheAccount();
  const publicClient = useCofhePublicClient();

  const [mode, setMode] = useState<Mode>(defaultMode ?? 'shield');
  const [shieldAmount, setShieldAmount] = useState('');
  const [unshieldAmount, setUnshieldAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ message: string; type: 'info' | 'success' } | null>(null);
  const [isRefreshingBalances, setIsRefreshingBalances] = useState(false);
  // obsolete way for isMining
  const [isWaitingForConfirmation, setIsWaitingForConfirmation] = useState(false);

  const tokenShield = useCofheTokenShield({
    onMutate: () => {
      setError(null);
      setStatus({ message: 'Preparing shielding transaction...', type: 'info' });
    },
    onSuccess: (hash) => {
      setStatus({
        message: `Shield transaction sent! Hash: ${truncateHash(hash)}. Waiting for confirmation...`,
        type: 'info',
      });
      setShieldAmount('');
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to shield tokens';
      setError(errorMessage);
      setStatus(null);
      console.error('Shield tx submit error:', error);
    },
  });
  const { isMining: isTokenShieldMining } = useOnceTransactionMined({
    txHash: tokenShield.data,
    onceMined: (transaction) => {
      if (transaction.status === 'confirmed') {
        setStatus({
          message: `Shield transaction confirmed! Hash: ${truncateHash(transaction.hash)}`,
          type: 'success',
        });
      } else if (transaction.status === 'failed') {
        setError(`Shield transaction failed! Hash: ${truncateHash(transaction.hash)}`);
      }
    },
  });
  const tokenUnshield = useCofheTokenUnshield();
  const claimUnshield = useCofheTokenClaimUnshielded();

  const {
    data: { unit: publicBalanceNum } = {},
    isLoading: isLoadingPublic,
    refetch: refetchPublic,
  } = useCofheTokenPublicBalance({ token, accountAddress: account });

  const {
    data: { unit: confidentialBalanceUnit } = {},
    isLoading: isLoadingConfidential,
    refetch: refetchConfidential,
  } = useCofheTokenDecryptedBalance({ token, accountAddress: account });

  const { data: unshieldClaims, refetch: refetchClaims } = useCofheTokenClaimable({
    token,
    accountAddress: account,
  });

  const refreshBalances = async () => {
    setIsRefreshingBalances(true);
    try {
      await Promise.all([refetchPublic(), refetchConfidential(), refetchClaims()]);
    } finally {
      setIsRefreshingBalances(false);
    }
  };

  // TODO: wrap into a hook / mutation
  const executeTransaction = async (
    txFn: () => Promise<`0x${string}`>,
    successMessage: string,
    errorMessage: string
  ): Promise<`0x${string}`> => {
    if (!publicClient) throw new Error('PublicClient is required');

    setError(null);
    setStatus({ message: 'Preparing transaction...', type: 'info' });

    try {
      const hash = await txFn();

      setStatus({ message: `Waiting for confirmation... ${truncateHash(hash)}`, type: 'info' });
      setIsWaitingForConfirmation(true);
      await publicClient.waitForTransactionReceipt({ hash });
      setIsWaitingForConfirmation(false);

      setStatus({ message: 'Refreshing balances...', type: 'info' });
      // here
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

  const isProcessing =
    tokenShield.isPending ||
    tokenUnshield.isPending ||
    claimUnshield.isPending ||
    isRefreshingBalances ||
    isWaitingForConfirmation ||
    isTokenShieldMining;

  const isValidShieldAmount = useMemo(() => {
    if (!shieldAmount) return false;
    const numAmount = parseFloat(shieldAmount);
    if (isNaN(numAmount) || numAmount <= 0) return false;
    return publicBalanceNum?.gt(numAmount);
  }, [shieldAmount, publicBalanceNum]);

  const isValidUnshieldAmount = useMemo(() => {
    if (!unshieldAmount || !confidentialBalanceUnit) return false;
    return confidentialBalanceUnit.gte(unshieldAmount);
  }, [unshieldAmount, confidentialBalanceUnit]);

  const isShieldableToken = shieldableTypes.has(token.extensions.fhenix.confidentialityType);

  const tokenSymbol = token.symbol;
  const pairedSymbol = token.extensions.fhenix.erc20Pair?.symbol;

  const pairedLogoURI = token.extensions.fhenix.erc20Pair?.logoURI;

  const handleShieldMax = () => {
    if (publicBalanceNum?.gt(0)) setShieldAmount(publicBalanceNum.toFixed());
  };
  const handleUnshieldMax = () => {
    if (!confidentialBalanceUnit) return;
    if (confidentialBalanceUnit.gte(0)) setUnshieldAmount(confidentialBalanceUnit.toFixed());
  };

  const handleShield = async () => {
    const amountWei = unitToWei(shieldAmount, token.decimals);
    await tokenShield.mutateAsync({
      token,
      amount: amountWei,
      onStatusChange: (message) => setStatus({ message, type: 'info' }),
    });
  };

  const handleUnshield = async () => {
    if (!account || !publicClient) {
      setError('Missing required data. Please ensure wallet is connected and a token is selected.');
      return;
    }
    if (!isValidUnshieldAmount) {
      setError('Invalid unshield amount. Please check your balance.');
      return;
    }

    const amountInSmallestUnit = parseUnits(unshieldAmount, token.decimals);
    try {
      await executeTransaction(
        () =>
          tokenUnshield.mutateAsync({
            token,
            amount: amountInSmallestUnit,
            onStatusChange: (message) => setStatus({ message, type: 'info' }),
          }),
        'Unshield complete!',
        'Failed to unshield tokens'
      );
      setUnshieldAmount('');
    } catch {
      // handled
    }
  };

  const handleClaim = async () => {
    if (!publicClient || !unshieldClaims) {
      setError('Missing depenedencies to claim unshielded tokens.');
      return;
    }
    try {
      await executeTransaction(
        () =>
          claimUnshield.mutateAsync({
            token,
            amount: unshieldClaims.claimableAmount,
          }),
        'Claim complete!',
        'Failed to claim tokens'
      );
    } catch {
      // handled
    }
  };

  // TODO: redo: const object = mode === 'shield' ? obj1 : obj2;
  const inputAmount = mode === 'shield' ? shieldAmount : unshieldAmount;
  const setInputAmount = mode === 'shield' ? setShieldAmount : setUnshieldAmount;
  const onMaxClick = mode === 'shield' ? handleShieldMax : handleUnshieldMax;
  const isValidAmount = mode === 'shield' ? isValidShieldAmount : isValidUnshieldAmount;

  const sourceSymbol = mode === 'shield' ? pairedSymbol : tokenSymbol;
  const destSymbol = mode === 'shield' ? tokenSymbol : pairedSymbol;

  const sourceAvailable = mode === 'shield' ? publicBalanceNum : confidentialBalanceUnit;
  const destAvailable = mode === 'shield' ? confidentialBalanceUnit : publicBalanceNum;

  const isLoadingSource = mode === 'shield' ? isLoadingPublic : isLoadingConfidential;
  const isLoadingDest = mode === 'shield' ? isLoadingConfidential : isLoadingPublic;

  const sourceLogoURI = mode === 'shield' ? pairedLogoURI : token.logoURI;
  const destLogoURI = mode === 'shield' ? token.logoURI : pairedLogoURI;

  const handlePrimaryAction = mode === 'shield' ? handleShield : handleUnshield;
  const primaryLabel = mode === 'shield' ? 'Shield' : 'Unshield';
  const primaryIcon = mode === 'shield' ? <TbShieldPlus className="w-3 h-3" /> : <TbShieldMinus className="w-3 h-3" />;

  return (
    <div className="fnx-text-primary space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={navigateBack} className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity">
          <ArrowBackIcon style={{ fontSize: 16 }} />
          <p className="text-sm font-medium">Shield / Unshield</p>
        </button>

        <button
          onClick={() =>
            // navigateToTokenListForSelection(mode === 'shield' ? 'Select token to shield' : 'Select token to unshield')
            navigateTo(FloatingButtonPage.TokenList, {
              pageProps: {
                mode: 'select',
                title: mode === 'shield' ? 'Select token to shield' : 'Select token to unshield',
                backToPageState: { page: FloatingButtonPage.Shield, props: { defaultMode: mode } },
              },
            })
          }
          className="flex items-center gap-1 text-sm font-bold fnx-text-primary hover:opacity-80 transition-opacity"
        >
          <span>{tokenSymbol}</span>
          <KeyboardArrowDownIcon style={{ fontSize: 16 }} className="opacity-60" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <ActionButton
          onClick={() => setMode('shield')}
          variant="tab"
          className="flex-1"
          pressed={mode === 'shield'}
          label="Shield"
        />
        <ActionButton
          onClick={() => setMode('unshield')}
          variant="tab"
          className="flex-1"
          pressed={mode === 'unshield'}
          label="Unshield"
        />
      </div>

      {/* Two-panel layout */}
      <div className="space-y-2">
        {/* Source */}
        <div className="fnx-card-bg border fnx-card-border p-3">
          <p className="text-xs opacity-70 mb-2">
            {mode === 'shield' ? 'Asset to be shielded' : 'Asset to be unshielded'}
          </p>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <TokenIcon logoURI={sourceLogoURI} alt={sourceSymbol} size="sm" />
              <div className="min-w-0">
                <AmountInput value={inputAmount} onChange={setInputAmount} onMaxClick={onMaxClick} className="w-28" />
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">{sourceSymbol}</p>
              <p className="text-xxs opacity-70">
                Available{' '}
                <TokenBalanceView
                  formattedBalance={sourceAvailable ? sourceAvailable.toFixed(DISPLAY_DECIMALS) : '0'}
                  isLoading={isLoadingSource}
                  symbol={sourceSymbol}
                  size="sm"
                  className="inline font-bold"
                />
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-center text-xl opacity-80">↓</div>

        {/* Received (read-only) */}
        <div className="fnx-card-bg border fnx-card-border p-3">
          <p className="text-xs opacity-70 mb-2">
            {mode === 'shield' ? 'Shielded asset received' : 'Unshielded asset received'}
          </p>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <TokenIcon logoURI={destLogoURI} alt={destSymbol} size="sm" />
              <div className="min-w-0">
                <p className="text-lg font-bold leading-none">{inputAmount || '0'}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">{destSymbol}</p>
              <p className="text-xxs opacity-70">
                Balance{' '}
                <TokenBalanceView
                  formattedBalance={destAvailable ? destAvailable.toFixed(DISPLAY_DECIMALS) : '0'}
                  isLoading={isLoadingDest}
                  symbol={destSymbol}
                  size="sm"
                  className="inline font-bold"
                />
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Primary action */}
      <ActionButton
        onClick={handlePrimaryAction}
        disabled={!isValidAmount || isProcessing || !isShieldableToken}
        icon={primaryIcon}
        label={primaryLabel}
        className="py-2"
      />

      {/* Claim + pending (same logic as ShieldPage) */}
      {unshieldClaims?.hasClaimable && (
        <ActionButton
          onClick={handleClaim}
          disabled={claimUnshield.isPending || isRefreshingBalances}
          label={
            claimUnshield.isPending
              ? 'Claiming...'
              : `Claim ${formatTokenAmount(unshieldClaims.claimableAmount, token.decimals, 5).formatted} ${pairedSymbol}`
          }
          className="mt-1"
        />
      )}

      {unshieldClaims?.hasPending && token && !unshieldClaims.hasClaimable && (
        <p className="text-xxs text-yellow-600 dark:text-yellow-400 text-center">
          Pending: {formatTokenAmount(unshieldClaims.pendingAmount, token.decimals).formatted} {pairedSymbol}
        </p>
      )}

      {/* Not Shieldable Token Warning */}
      {token && !isShieldableToken && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-2">
          <p className="text-xs text-yellow-800 dark:text-yellow-200">
            This token does not support shielding/unshielding.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2">
          <p className="text-xs text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Status */}
      {status && (
        <div
          className={cn(
            'rounded-lg p-2 border',
            status.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
          )}
        >
          <p
            className={cn(
              'text-xs',
              status.type === 'success' ? 'text-green-800 dark:text-green-200' : 'text-blue-800 dark:text-blue-200'
            )}
          >
            {status.message}
          </p>
        </div>
      )}
    </div>
  );
};
