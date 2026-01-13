import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { TbShieldPlus, TbShieldMinus } from 'react-icons/tb';
import { useMemo, useState } from 'react';
import { parseUnits } from 'viem';
import { useFnxFloatingButtonContext } from '../FnxFloatingButtonContext';
import { useCofheAccount } from '@/hooks/useCofheConnection';
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
import { assert } from 'ts-essentials';
import type { BigNumber } from 'bignumber.js';

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

function useLifecycleStore() {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ message: string; type: 'info' | 'success' } | null>(null);
  return {
    error,
    setError,
    status,
    setStatus,
  };
}

function useClaimUnshieldedWithLifecycle() {
  const { setError, setStatus, error, status } = useLifecycleStore();
  const claimUnshield = useCofheTokenClaimUnshielded({
    onMutate: () => {
      setError(null);
      setStatus({ message: 'Preparing claim transaction...', type: 'info' });
    },
    onSuccess: (hash) => {
      setStatus({
        message: `Claim transaction sent! Hash: ${truncateHash(hash)}. Waiting for confirmation...`,
        type: 'info',
      });
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to claim unshielded tokens';
      setError(errorMessage);
      setStatus(null);
      console.error('Claim tx submit error:', error);
    },
  });

  const { isMining: isClaimingMining } = useOnceTransactionMined({
    txHash: claimUnshield.data,
    onceMined: (transaction) => {
      if (transaction.status === 'confirmed') {
        setStatus({
          message: `Claim transaction confirmed! Hash: ${truncateHash(transaction.hash)}`,
          type: 'success',
        });
      } else if (transaction.status === 'failed') {
        setError(`Claim transaction failed! Hash: ${truncateHash(transaction.hash)}`);
      }
    },
  });

  return {
    claimUnshield,
    isClaimingMining,
    error,
    status,
  };
}

function useShieldWithLifecycle(token: Token) {
  const account = useCofheAccount();
  const [shieldAmount, setShieldAmount] = useState('');
  const { setError, setStatus, error, status } = useLifecycleStore();
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

  const handleShield = async () => {
    const amountWei = unitToWei(shieldAmount, token.decimals);
    await tokenShield.mutateAsync({
      token,
      amount: amountWei,
      onStatusChange: (message) => setStatus({ message, type: 'info' }),
    });
  };

  const { data: { unit: publicBalanceUnit } = {}, isFetching: isFetchingPublic } = useCofheTokenPublicBalance({
    token,
    accountAddress: account,
  });

  const { data: { unit: confidentialBalanceUnit } = {}, isFetching: isFetchingConfidential } =
    useCofheTokenDecryptedBalance({ token, accountAddress: account });

  const handleShieldMax = () => {
    if (publicBalanceUnit) setShieldAmount(publicBalanceUnit.toFixed());
  };

  const isValidShieldAmount = useMemo(() => {
    if (!shieldAmount) return false;
    const numAmount = parseFloat(shieldAmount);
    if (isNaN(numAmount) || numAmount <= 0) return false;
    return publicBalanceUnit?.gt(numAmount);
  }, [shieldAmount, publicBalanceUnit]);

  return {
    handleShield,
    tokenShield,
    isTokenShieldMining,
    shieldAmount,
    setShieldAmount,
    error,
    status,
    handleShieldMax,
    isValidShieldAmount,

    sourceAvailable: publicBalanceUnit,
    destAvailable: confidentialBalanceUnit,
    isFetchingSource: isFetchingPublic,
    isFetchingDest: isFetchingConfidential,
  };
}

function useUnshieldWithLifecycle(token: Token) {
  const account = useCofheAccount();
  const { setError, setStatus, error, status } = useLifecycleStore();
  const [unshieldAmount, setUnshieldAmount] = useState('');
  const tokenUnshield = useCofheTokenUnshield({
    onMutate: () => {
      setError(null);
      setStatus({ message: 'Preparing unshielding transaction...', type: 'info' });
    },
    onSuccess: (hash) => {
      setStatus({
        message: `Unshield transaction sent! Hash: ${truncateHash(hash)}. Waiting for confirmation...`,
        type: 'info',
      });
      setUnshieldAmount('');
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to unshield tokens';
      setError(errorMessage);
      setStatus(null);
      console.error('Unshield tx submit error:', error);
    },
  });

  const { isMining: isTokenUnshieldMining } = useOnceTransactionMined({
    txHash: tokenUnshield.data,
    onceMined: (transaction) => {
      if (transaction.status === 'confirmed') {
        setStatus({
          message: `Unshield transaction confirmed! Hash: ${truncateHash(transaction.hash)}`,
          type: 'success',
        });
      } else if (transaction.status === 'failed') {
        setError(`Unshield transaction failed! Hash: ${truncateHash(transaction.hash)}`);
      }
    },
  });
  const handleUnshield = async () => {
    const amountInSmallestUnit = parseUnits(unshieldAmount, token.decimals);
    tokenUnshield.mutateAsync({
      token,
      amount: amountInSmallestUnit,
      onStatusChange: (message) => setStatus({ message, type: 'info' }),
    });
  };
  const { data: { unit: publicBalanceUnit } = {}, isFetching: isFetchingPublic } = useCofheTokenPublicBalance({
    token,
    accountAddress: account,
  });

  const { data: { unit: confidentialBalanceUnit } = {}, isFetching: isFetchingConfidential } =
    useCofheTokenDecryptedBalance({ token, accountAddress: account });
  const handleUnshieldMax = () => {
    if (confidentialBalanceUnit) setUnshieldAmount(confidentialBalanceUnit.toFixed());
  };
  const isValidUnshieldAmount = (unshieldAmount.length > 0 && confidentialBalanceUnit?.gte(unshieldAmount)) ?? false;

  return {
    tokenUnshield,
    isTokenUnshieldMining,
    error,
    status,
    unshieldAmount,
    setUnshieldAmount,
    handleUnshield,
    handleUnshieldMax,
    isValidUnshieldAmount,

    sourceAvailable: confidentialBalanceUnit,
    destAvailable: publicBalanceUnit,
    isFetchingSource: isFetchingConfidential,
    isFetchingDest: isFetchingPublic,
  };
}

const shieldableTypes = new Set(['dual', 'wrapped']);

export const ShieldPageV2: React.FC<ShieldPageProps> = ({ token, defaultMode }) => {
  const [mode, setMode] = useState<Mode>(defaultMode ?? 'shield');

  const {
    shieldAmount,
    setShieldAmount,
    tokenShield,
    isTokenShieldMining,
    error: shieldingError,
    status: shieldingStatus,
    handleShield,
    handleShieldMax,
    isValidShieldAmount,

    sourceAvailable: shieldSourceAvailable,
    destAvailable: shieldDestAvailable,
    isFetchingSource: isShieldFetchingPublic,
    isFetchingDest: isShieldFetchingConfidential,
  } = useShieldWithLifecycle(token);

  const {
    unshieldAmount,
    setUnshieldAmount,
    tokenUnshield,
    isTokenUnshieldMining,
    error: unshieldingError,
    status: unshildingStatus,
    handleUnshield,
    handleUnshieldMax,
    isValidUnshieldAmount,

    sourceAvailable: unshieldSourceAvailable,
    destAvailable: unshieldDestAvailable,
    isFetchingSource: isUnshieldFetchingConfidential,
    isFetchingDest: isUnshieldFetchingPublic,
  } = useUnshieldWithLifecycle(token);

  const tokenSymbol = token.symbol;
  const pairedSymbol = token.extensions.fhenix.erc20Pair?.symbol;

  const pairedLogoURI = token.extensions.fhenix.erc20Pair?.logoURI;

  // TODO: redo: const object = mode === 'shield' ? obj1 : obj2;
  const shieldingProp: ShieldPageViewProps = {
    token,
    mode,
    setMode,
    status: shieldingStatus,
    error: shieldingError,

    isProcessing: tokenShield.isPending || isTokenShieldMining,
    inputAmount: shieldAmount,
    setInputAmount: setShieldAmount,
    onMaxClick: handleShieldMax,
    isValidAmount: isValidShieldAmount ?? false,
    sourceSymbol: pairedSymbol,
    destSymbol: tokenSymbol,
    sourceAvailable: shieldSourceAvailable,
    destAvailable: shieldDestAvailable,
    isFetchingSource: isShieldFetchingPublic,
    isFetchingDest: isShieldFetchingConfidential,
    sourceLogoURI: pairedLogoURI,
    destLogoURI: token.logoURI,
    handlePrimaryAction: handleShield,
    primaryLabel: 'Shield',
    primaryIcon: <TbShieldPlus className="w-3 h-3" />,
  };

  const unshieldingProps: ShieldPageViewProps = {
    error: unshieldingError,
    token,
    mode,
    setMode,
    status: unshildingStatus,

    isProcessing: tokenUnshield.isPending || isTokenUnshieldMining,
    inputAmount: unshieldAmount,
    setInputAmount: setUnshieldAmount,
    onMaxClick: handleUnshieldMax,
    isValidAmount: isValidUnshieldAmount,
    sourceSymbol: tokenSymbol,
    destSymbol: pairedSymbol,
    sourceAvailable: unshieldSourceAvailable,
    destAvailable: unshieldDestAvailable,
    isFetchingSource: isUnshieldFetchingConfidential,
    isFetchingDest: isUnshieldFetchingPublic,
    sourceLogoURI: token.logoURI,
    destLogoURI: pairedLogoURI,
    handlePrimaryAction: handleUnshield,
    primaryLabel: 'Unshield',
    primaryIcon: <TbShieldMinus className="w-3 h-3" />,
  };
  return <ShieldPageView {...(mode === 'shield' ? shieldingProp : unshieldingProps)} />;
};

type ShieldPageViewProps = {
  error: string | null;
  token: Token;
  mode: Mode;
  status: { message: string; type: 'info' | 'success' } | null;
  setMode: (mode: Mode) => void;

  isProcessing: boolean;
  inputAmount: string;
  setInputAmount: (value: string) => void;
  onMaxClick: () => void;
  isValidAmount: boolean;
  sourceSymbol: string | undefined;
  destSymbol: string | undefined;
  sourceAvailable: BigNumber | undefined;
  destAvailable: BigNumber | undefined;
  isFetchingSource: boolean;
  isFetchingDest: boolean;
  sourceLogoURI: string | undefined;
  destLogoURI: string | undefined;
  handlePrimaryAction: () => void;
  primaryLabel: string;
  primaryIcon: React.ReactNode;
};
const ShieldPageView: React.FC<ShieldPageViewProps> = ({
  error: _error,
  token,
  mode,
  setMode,
  status: _status,

  isProcessing: _isProcessing,
  inputAmount,
  setInputAmount,
  onMaxClick,
  isValidAmount,
  sourceSymbol,
  destSymbol,
  sourceAvailable,
  destAvailable,
  isFetchingSource,
  isFetchingDest,
  sourceLogoURI,
  destLogoURI,
  handlePrimaryAction,
  primaryLabel,
  primaryIcon,
}) => {
  const account = useCofheAccount();
  const { navigateBack, navigateTo } = useFnxFloatingButtonContext();
  const { data: unshieldClaims } = useCofheTokenClaimable({
    token,
    accountAddress: account,
  });

  const {
    claimUnshield,
    isClaimingMining,
    error: claimingError,
    status: claimingStatus,
  } = useClaimUnshieldedWithLifecycle();

  const isShieldableToken = shieldableTypes.has(token.extensions.fhenix.confidentialityType);
  const isProcessing = _isProcessing || claimUnshield.isPending || isClaimingMining;
  const error = _error || claimingError;
  const status = _status || claimingStatus;

  const handleClaim = async () => {
    assert(unshieldClaims, 'Unshield claims data is required to claim unshielded tokens');
    claimUnshield.mutateAsync({
      token,
      amount: unshieldClaims.claimableAmount,
    });
  };

  const pairedSymbol = token.extensions.fhenix.erc20Pair?.symbol;
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
          <span>{token.symbol}</span>
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
                  isFetching={isFetchingSource}
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
                  isFetching={isFetchingDest}
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
          disabled={claimUnshield.isPending || !unshieldClaims.hasClaimable}
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
