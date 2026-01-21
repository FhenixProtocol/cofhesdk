import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { TbShieldPlus, TbShieldMinus } from 'react-icons/tb';
import { useState } from 'react';
import { parseUnits } from 'viem';
import { useCofheAccount } from '@/hooks/useCofheConnection';
import { useCofheTokenDecryptedBalance } from '@/hooks/useCofheTokenDecryptedBalance';
import { type Token } from '@/hooks/useCofheTokenLists';
import { useCofheTokenShield } from '@/hooks/useCofheTokenShield';
import { cn } from '../../../utils/cn';
import { truncateHash } from '../../../utils/utils';
import { ActionButton, AmountInput, CofheTokenConfidentialBalance, TokenIcon } from '../components/index';
import { useCofheTokenPublicBalance } from '@/hooks/useCofheTokenPublicBalance';
import { formatTokenAmount, unitToWei } from '@/utils/format';
import { FloatingButtonPage } from '../pagesConfig/types';
import { useCofheTokenClaimUnshielded, useCofheTokenUnshield, useCofheTokenClaimable } from '@/hooks';
import { useOnceTransactionMined } from '@/hooks/useOnceTransactionMined';
import { useReschedulableTimeout } from '@/hooks/useReschedulableTimeout';
import { assert } from 'ts-essentials';
import type { BigNumber } from 'bignumber.js';
import { usePortalNavigation } from '@/stores';
import { CofheTokenPublicBalance } from '../components/CofheTokenConfidentialBalance';
import { useIsUnshieldingMining } from '@/hooks/useIsUnshieldingMining';

const AUTOCLEAR_TX_STATUS_TIMEOUT = 5000;
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

// Reusable hook to safely auto-clear a status message after a delay
// (moved) useReschedulableTimeout is now in '@/hooks/useReschedulableTimeout'

function useClaimUnshieldedWithLifecycle() {
  const { setError, setStatus, error, status } = useLifecycleStore();
  const { schedule: scheduleStatusClear } = useReschedulableTimeout(() => setStatus(null), AUTOCLEAR_TX_STATUS_TIMEOUT);
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
        setStatus(null);
      }
      scheduleStatusClear();
    },
  });

  return {
    claimUnshield,
    isClaimingMining,
    error,
    status,
  };
}

type ShieldAndUnshieldViewProps = Omit<ShieldPageViewProps, 'token' | 'mode' | 'setMode'>;

function useShieldWithLifecycle(token: Token): ShieldAndUnshieldViewProps {
  const account = useCofheAccount();
  const [shieldAmount, setShieldAmount] = useState('');
  const { setError, setStatus, error, status } = useLifecycleStore();
  const { schedule: scheduleStatusClear } = useReschedulableTimeout(() => setStatus(null), AUTOCLEAR_TX_STATUS_TIMEOUT);
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
        setStatus(null);
      }
      scheduleStatusClear();
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

  const isValidShieldAmount = (shieldAmount.length > 0 && publicBalanceUnit?.gte(shieldAmount)) ?? false;

  return {
    status,
    error,
    isProcessing: tokenShield.isPending || isTokenShieldMining,
    inputAmount: shieldAmount,
    setInputAmount: setShieldAmount,
    onMaxClick: handleShieldMax,
    isValidAmount: isValidShieldAmount,
    sourceSymbol: token.extensions.fhenix.erc20Pair?.symbol,
    destSymbol: token.symbol,
    sourceLogoURI: token.extensions.fhenix.erc20Pair?.logoURI,
    destLogoURI: token.logoURI,
    handlePrimaryAction: handleShield,
    primaryLabel: 'Shield',
    primaryIcon: <TbShieldPlus className="w-3 h-3" />,
  };
}

function useUnshieldWithLifecycle(token: Token): ShieldAndUnshieldViewProps {
  const account = useCofheAccount();
  const { setError, setStatus, error, status } = useLifecycleStore();
  const { schedule: scheduleStatusClear } = useReschedulableTimeout(() => setStatus(null), AUTOCLEAR_TX_STATUS_TIMEOUT);
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
        setStatus(null);
      }
      scheduleStatusClear();
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
    status,
    error,
    isProcessing: tokenUnshield.isPending || isTokenUnshieldMining,
    inputAmount: unshieldAmount,
    setInputAmount: setUnshieldAmount,
    onMaxClick: handleUnshieldMax,
    isValidAmount: isValidUnshieldAmount ?? false,
    sourceSymbol: token.symbol,
    destSymbol: token.extensions.fhenix.erc20Pair?.symbol,
    sourceLogoURI: token.logoURI,
    destLogoURI: token.extensions.fhenix.erc20Pair?.logoURI,
    handlePrimaryAction: handleUnshield,
    primaryLabel: 'Unshield',
    primaryIcon: <TbShieldMinus className="w-3 h-3" />,
  };
}

const shieldableTypes = new Set(['dual', 'wrapped']);

export const ShieldPageV2: React.FC<ShieldPageProps> = ({ token, defaultMode }) => {
  const [mode, setMode] = useState<Mode>(defaultMode ?? 'shield');

  return mode === 'shield' ? (
    <ShieldTab token={token} mode={mode} setMode={setMode} />
  ) : (
    <UnshieldTab token={token} mode={mode} setMode={setMode} />
  );
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

  sourceLogoURI: string | undefined;
  destLogoURI: string | undefined;
  handlePrimaryAction: () => void;
  primaryLabel: string;
  primaryIcon: React.ReactNode;
};

function ShieldTab({ token, mode, setMode }: { token: Token; mode: Mode; setMode: (mode: Mode) => void }) {
  const shieldViewProps = useShieldWithLifecycle(token);
  return <ShieldAndUnshieldPageView token={token} mode={mode} setMode={setMode} {...shieldViewProps} />;
}

function UnshieldTab({ token, mode, setMode }: { token: Token; mode: Mode; setMode: (mode: Mode) => void }) {
  const unshieldViewProps = useUnshieldWithLifecycle(token);
  return <ShieldAndUnshieldPageView token={token} mode={mode} setMode={setMode} {...unshieldViewProps} />;
}

function ClaimingSection({ token }: { token: Token }) {
  const account = useCofheAccount();
  const {
    data: unshieldedClaims,
    isFetching: isFetchingClaims,
    isWaitingForDecryption: isWaitingForNewClaimsDecryption,
  } = useCofheTokenClaimable({
    token,
    accountAddress: account,
  });
  const {
    claimUnshield,
    error: claimingError,
    status: claimingStatus,
    isClaimingMining,
  } = useClaimUnshieldedWithLifecycle();

  const pairedSymbol = token.extensions.fhenix.erc20Pair?.symbol;
  const handleClaim = async () => {
    assert(unshieldedClaims, 'Unshield claims data is required to claim unshielded tokens');
    claimUnshield.mutateAsync({
      token,
      amount: unshieldedClaims.claimableAmount,
    });
  };

  const isUnshieldingMining = useIsUnshieldingMining(token);

  return (
    <>
      {/* Claim + pending (same logic as ShieldPage) */}
      {unshieldedClaims?.hasClaimable && (
        <ActionButton
          onClick={handleClaim}
          disabled={
            claimUnshield.isPending ||
            isClaimingMining ||
            isFetchingClaims ||
            isWaitingForNewClaimsDecryption ||
            isUnshieldingMining
          }
          label={
            claimUnshield.isPending
              ? 'Claiming...'
              : `Claim ${isFetchingClaims || isWaitingForNewClaimsDecryption ? '...' : formatTokenAmount(unshieldedClaims.claimableAmount, token.decimals, 5).formatted} ${pairedSymbol}`
          }
          className="mt-1"
        />
      )}

      {unshieldedClaims?.hasPending && token && !unshieldedClaims.hasClaimable && (
        <p className="text-xxs text-yellow-600 dark:text-yellow-400 text-center">
          Pending: {formatTokenAmount(unshieldedClaims.pendingAmount, token.decimals).formatted} {pairedSymbol}
        </p>
      )}
      <StatusAndError status={claimingStatus} error={claimingError} />
    </>
  );
}

function StatusAndError({
  status,
  error,
}: {
  status: { message: string; type: 'info' | 'success' } | null;
  error: string | null;
}) {
  return (
    <>
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
    </>
  );
}

const ShieldAndUnshieldPageView: React.FC<ShieldPageViewProps> = ({
  error,
  token,
  mode,
  setMode,
  status,

  isProcessing,
  inputAmount,
  setInputAmount,
  onMaxClick,
  isValidAmount,
  sourceSymbol,
  destSymbol,

  sourceLogoURI,
  destLogoURI,
  handlePrimaryAction,
  primaryLabel,
  primaryIcon,
}) => {
  const { navigateBack, navigateTo } = usePortalNavigation();
  const isShieldableToken = shieldableTypes.has(token.extensions.fhenix.confidentialityType);

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
                {mode === 'unshield' ? (
                  <CofheTokenConfidentialBalance token={token} size="sm" decimalPrecision={DISPLAY_DECIMALS} />
                ) : (
                  <CofheTokenPublicBalance token={token} size="sm" decimalPrecision={DISPLAY_DECIMALS} />
                )}
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
                Balance
                {mode === 'shield' ? (
                  <CofheTokenConfidentialBalance token={token} size="sm" decimalPrecision={DISPLAY_DECIMALS} />
                ) : (
                  <CofheTokenPublicBalance token={token} size="sm" decimalPrecision={DISPLAY_DECIMALS} />
                )}
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
      <StatusAndError status={status} error={error} />
      <ClaimingSection token={token} />

      {/* Not Shieldable Token Warning */}
      {!isShieldableToken && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-2">
          <p className="text-xs text-yellow-800 dark:text-yellow-200">
            This token does not support shielding/unshielding.
          </p>
        </div>
      )}
    </div>
  );
};
