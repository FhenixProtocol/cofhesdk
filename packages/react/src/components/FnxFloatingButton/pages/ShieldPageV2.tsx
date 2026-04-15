import { ArrowBackIcon, KeyboardArrowDownIcon } from '@/components/Icons';
import { TbShieldPlus, TbShieldMinus } from 'react-icons/tb';
import { LuExternalLink } from 'react-icons/lu';
import { useMemo, useState } from 'react';
import { ContractFunctionExecutionError, parseUnits, type Address } from 'viem';
import { useCofheAccount, useCofheChainId } from '@/hooks/useCofheConnection';
import { useCofheTokenDecryptedBalance } from '@/hooks/useCofheTokenDecryptedBalance';
import { type Token } from '@/hooks/useCofheTokenLists';
import { useCofheTokenShield } from '@/hooks/useCofheTokenShield';
import { FloatingButtonPage } from '../pagesConfig/types';
import { cn } from '../../../utils/cn';
import { getBlockExplorerTxUrl, truncateHash } from '../../../utils/utils';
import { ActionButton, AmountInput, CofheTokenConfidentialBalance, TokenIcon } from '../components/index';
import { useCofheTokenPublicBalance } from '@/hooks/useCofheTokenPublicBalance';
import { formatTokenAmount, unitToWei } from '@/utils/format';
import {
  getCofheTokenClaimUnshieldedCallArgs,
  getCofheTokenShieldCallArgs,
  getCofheTokenUnshieldCallArgs,
  useCofheSimulateWriteContract,
  useCofheTokenApprove,
  useCofheTokenClaimUnshielded,
  useCofheTokenUnshield,
  useCofheTokenClaimable,
  useCofheTokensWithExistingEncryptedBalances,
  useTokensWithPublicBalances,
  useTokenAllowance,
} from '@/hooks';
import { useOnceTransactionMined } from '@/hooks/useOnceTransactionMined';
import { useReschedulableTimeout } from '@/hooks/useReschedulableTimeout';
import { assert } from 'ts-essentials';
import { usePortalModals, usePortalNavigation } from '@/stores';
import { BalanceType, CofheTokenPublicBalance } from '../components/CofheTokenConfidentialBalance';
import { useIsUnshieldingMining } from '@/hooks/useIsUnshieldingMining';
import { cofheHumanizeViemError } from '@/utils/cofheErrors';
import { PageContainer } from '../components/PageContainer';
import { PortalModal } from '../modals/types';
import { CopyButton } from '../components/HashLink';

const AUTOCLEAR_TX_STATUS_TIMEOUT = 5000;
const DISPLAY_DECIMALS = 5;

type Mode = 'shield' | 'unshield';

type LifecycleStatus = { message: React.ReactNode; type: 'info' | 'success' };

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
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [status, setStatus] = useState<LifecycleStatus | null>(null);
  return {
    error,
    setError,
    status,
    setStatus,
  };
}

function humanizeSimulationError(error: unknown, fallbackMessage: string): React.ReactNode | null {
  if (!error) return null;
  const cofheErrorMessage = cofheHumanizeViemError(error);
  if (cofheErrorMessage) return cofheErrorMessage;
  if (error instanceof ContractFunctionExecutionError) return error.shortMessage;
  return fallbackMessage;
}

function TxHashWithActions({ hash, chainId }: { hash: string; chainId?: number }) {
  const href = chainId ? getBlockExplorerTxUrl(chainId, hash) : undefined;
  const ellipsed = truncateHash(hash);

  const handleOpenExplorer = () => {
    if (href) {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <span className="inline-flex items-center gap-1.5 align-baseline">
      <span className="font-mono">{ellipsed}</span>
      <CopyButton text={hash} size={14} />
      <button
        type="button"
        onClick={handleOpenExplorer}
        disabled={!href}
        aria-label="Open transaction in explorer"
        title={href ? 'Open in explorer' : 'Explorer not available for this chain'}
        className={cn(
          'fnx-text-primary opacity-50 hover:opacity-100 transition-opacity cursor-pointer',
          !href && 'cursor-default opacity-30'
        )}
      >
        <LuExternalLink style={{ width: 14, height: 14 }} />
      </button>
    </span>
  );
}

// Reusable hook to safely auto-clear a status message after a delay
// (moved) useReschedulableTimeout is now in '@/hooks/useReschedulableTimeout'

function useClaimUnshieldedWithLifecycle() {
  const { setError, setStatus, error, status } = useLifecycleStore();
  const chainId = useCofheChainId();
  const { schedule: scheduleStatusClear } = useReschedulableTimeout(() => setStatus(null), AUTOCLEAR_TX_STATUS_TIMEOUT);
  const claimUnshield = useCofheTokenClaimUnshielded({
    onMutate: () => {
      setError(null);
      setStatus({ message: 'Preparing claim transaction...', type: 'info' });
    },
    onSuccess: (hash) => {
      setStatus({
        message: (
          <>
            Claim transaction sent! Hash: <TxHashWithActions hash={hash} chainId={chainId} /> Waiting for
            confirmation...
          </>
        ),
        type: 'info',
      });
    },
    onError: (error) => {
      const errorMessage =
        cofheHumanizeViemError(error) ?? (error instanceof Error ? error.message : 'Failed to claim unshielded tokens');
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
          message: (
            <>
              Claim transaction confirmed! Hash: <TxHashWithActions hash={transaction.hash} chainId={chainId} />
            </>
          ),
          type: 'success',
        });
      } else if (transaction.status === 'failed') {
        setError(
          <>
            Claim transaction failed! Hash: <TxHashWithActions hash={transaction.hash} chainId={chainId} />
          </>
        );
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

function useShieldWithLifecycle(token: Token): Omit<ShieldAndUnshieldViewProps, 'setToken'> {
  const account = useCofheAccount();
  const chainId = useCofheChainId();
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
        message: (
          <>
            Shield transaction sent! Hash: <TxHashWithActions hash={hash} chainId={chainId} /> Waiting for
            confirmation...
          </>
        ),
        type: 'info',
      });
      setShieldAmount('');
    },
    onError: (error) => {
      const errorMessage =
        cofheHumanizeViemError(error) ?? (error instanceof Error ? error.message : 'Failed to shield tokens');
      setError(errorMessage);
      setStatus(null);
      console.error('Shield tx submit error:', error);
    },
  });

  const { tokenApprove, isApprovingMining } = useApproveWithLifecycle({
    chainId,
    setError,
    setStatus,
    scheduleStatusClear,
  });
  const { isMining: isTokenShieldMining } = useOnceTransactionMined({
    txHash: tokenShield.data,
    onceMined: (transaction) => {
      if (transaction.status === 'confirmed') {
        setStatus({
          message: (
            <>
              Shield transaction confirmed! Hash: <TxHashWithActions hash={transaction.hash} chainId={chainId} />
            </>
          ),
          type: 'success',
        });
      } else if (transaction.status === 'failed') {
        setError(
          <>
            Shield transaction failed! Hash: <TxHashWithActions hash={transaction.hash} chainId={chainId} />
          </>
        );
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

  const handleApprove = async () => {
    assert(approvalCallArgs, 'Approval call args are required to approve');
    assert(shieldAmountWei, 'Shield amount is required to approve');
    assert(account, 'Wallet account is required to approve');
    await tokenApprove.writeContractAsync({
      writeContractInput: { ...approvalCallArgs, account: account ?? null, chain: undefined },
      extras: { token, tokenAmount: shieldAmountWei, account },
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

  const shieldAmountWei = useMemo<bigint | undefined>(() => {
    if (!isValidShieldAmount) return undefined;
    try {
      return unitToWei(shieldAmount, token.decimals);
    } catch {
      return undefined;
    }
  }, [isValidShieldAmount, shieldAmount, token.decimals]);

  const shieldTxCallArgs = useMemo(() => {
    if (!account || !shieldAmountWei) return undefined;
    return getCofheTokenShieldCallArgs({ token, amount: shieldAmountWei, account });
  }, [account, shieldAmountWei, token]);

  const shieldCallArgs = shieldTxCallArgs?.main;
  const approvalCallArgs = shieldTxCallArgs?.approval;
  const approvalSpender = (approvalCallArgs?.args?.[0] as Address | undefined) ?? undefined;

  const { data: allowanceWei, isFetching: isFetchingAllowance } = useTokenAllowance(
    {
      tokenAddress: approvalCallArgs?.address,
      ownerAddress: account,
      spenderAddress: approvalSpender,
    },
    {
      enabled: !!approvalCallArgs && !!account && !!approvalSpender && !!shieldAmountWei,
    }
  );

  const requiresApproval = !!approvalCallArgs;
  const isAllowanceKnown = !requiresApproval || typeof allowanceWei === 'bigint';
  const hasSufficientAllowance =
    !requiresApproval ||
    (typeof allowanceWei === 'bigint' && typeof shieldAmountWei === 'bigint' && allowanceWei >= shieldAmountWei);

  const shouldApprove =
    requiresApproval &&
    typeof allowanceWei === 'bigint' &&
    typeof shieldAmountWei === 'bigint' &&
    allowanceWei < shieldAmountWei;

  const approvalSimulation = useCofheSimulateWriteContract(approvalCallArgs, {
    enabled: shouldApprove,
  });

  const shieldSimulation = useCofheSimulateWriteContract(shieldCallArgs, {
    enabled: !!shieldCallArgs && !shouldApprove,
  });

  const simulationError = useMemo<React.ReactNode | null>(() => {
    const relevantError = shouldApprove ? approvalSimulation.error : shieldSimulation.error;
    if (!relevantError) return null;

    const cofheErrorMessage = cofheHumanizeViemError(relevantError);
    if (cofheErrorMessage) return cofheErrorMessage;
    if (relevantError instanceof ContractFunctionExecutionError) return relevantError.shortMessage;
    return shouldApprove ? 'Failed to simulate approval transaction' : 'Failed to simulate shield transaction';
  }, [approvalSimulation.error, shieldSimulation.error, shouldApprove]);

  const canShield =
    isValidShieldAmount &&
    !!shieldCallArgs &&
    isAllowanceKnown &&
    hasSufficientAllowance &&
    !shieldSimulation.isFetching &&
    !shieldSimulation.error;

  const canApprove =
    isValidShieldAmount &&
    shouldApprove &&
    !isFetchingAllowance &&
    !approvalSimulation.isFetching &&
    !approvalSimulation.error;

  const canWrite = shouldApprove ? canApprove : canShield;

  return {
    status,
    error: error ?? simulationError,
    isProcessing: tokenShield.isPending || isTokenShieldMining || tokenApprove.isPending || isApprovingMining,
    inputAmount: shieldAmount,
    setInputAmount: setShieldAmount,
    onMaxClick: handleShieldMax,
    canWriteContract: canWrite,
    sourceSymbol: token.extensions.fhenix.erc20Pair?.symbol,
    destSymbol: token.symbol,
    sourceLogoURI: token.extensions.fhenix.erc20Pair?.logoURI,
    destLogoURI: token.logoURI,
    handlePrimaryAction: shouldApprove ? handleApprove : handleShield,
    primaryLabel: shouldApprove ? 'Approve' : 'Shield',
    primaryIcon: <TbShieldPlus className="w-3 h-3" />,
  };
}

function useUnshieldWithLifecycle(token: Token): Omit<ShieldAndUnshieldViewProps, 'setToken'> {
  const account = useCofheAccount();
  const chainId = useCofheChainId();
  const { setError, setStatus, error, status } = useLifecycleStore();
  const { schedule: scheduleStatusClear } = useReschedulableTimeout(() => setStatus(null), AUTOCLEAR_TX_STATUS_TIMEOUT);
  const [unshieldAmount, setUnshieldAmount] = useState('');
  const tokenUnshield = useCofheTokenUnshield({
    onUserSignatureRequest: (hash) => {
      () => {
        setError(null);
        setStatus({ message: 'Preparing unshielding transaction...', type: 'info' });
      };
    },
    onTransactionSubmitSuccess: (hash) => {
      setStatus({
        message: (
          <>
            Unshield transaction sent! Hash: <TxHashWithActions hash={hash} chainId={chainId} /> Waiting for
            confirmation...
          </>
        ),
        type: 'info',
      });
      setUnshieldAmount('');
    },
    onTransactionSubmitError: (error) => {
      const errorMessage =
        cofheHumanizeViemError(error) ?? (error instanceof Error ? error.message : 'Failed to unshield tokens');
      setError(errorMessage);
      setStatus(null);
      console.error('Unshield tx submit error:', error);
    },
    onceMined: (transaction) => {
      if (transaction.status === 'confirmed') {
        setStatus({
          message: (
            <>
              Unshield transaction confirmed! Hash: <TxHashWithActions hash={transaction.hash} chainId={chainId} /> Now
              waiting for decryption...
            </>
          ),
          type: 'success',
        });
      } else if (transaction.status === 'failed') {
        setError(
          <>
            Unshield transaction failed! Hash: <TxHashWithActions hash={transaction.hash} chainId={chainId} />
          </>
        );
        setStatus(null);
      }
    },
    onceDecrypted: () => {
      setStatus({ message: 'Unshield decryption completed!', type: 'success' });
      scheduleStatusClear();
    },
  });
  const handleUnshield = async () => {
    const amountWei = parseUnits(unshieldAmount, token.decimals);
    tokenUnshield.mutateAsync({
      token,
      amount: amountWei,
      onStatusChange: (message) => setStatus({ message, type: 'info' }),
    });
  };

  const { data: { unit: confidentialBalanceUnit } = {}, isFetching: isFetchingConfidential } =
    useCofheTokenDecryptedBalance({ token, accountAddress: account });
  const handleUnshieldMax = () => {
    if (confidentialBalanceUnit) setUnshieldAmount(confidentialBalanceUnit.toFixed());
  };
  const isValidUnshieldAmount = (unshieldAmount.length > 0 && confidentialBalanceUnit?.gte(unshieldAmount)) ?? false;

  const unshieldCallArgs = useMemo(() => {
    if (!account || !isValidUnshieldAmount) return undefined;
    const amountWei = parseUnits(unshieldAmount, token.decimals);
    return getCofheTokenUnshieldCallArgs({ token, amount: amountWei, account });
  }, [account, isValidUnshieldAmount, token, unshieldAmount]);

  const unshieldSimulation = useCofheSimulateWriteContract(unshieldCallArgs, {
    enabled: !!unshieldCallArgs,
  });

  const simulationError = useMemo(
    () => humanizeSimulationError(unshieldSimulation.error, 'Failed to simulate unshield transaction'),
    [unshieldSimulation.error]
  );

  const canUnshield =
    isValidUnshieldAmount && !!unshieldCallArgs && !unshieldSimulation.isFetching && !unshieldSimulation.error;

  return {
    status,
    error: error ?? simulationError,
    isProcessing: tokenUnshield.isPending || tokenUnshield.isTokenUnshieldMining || tokenUnshield.isPendingDecryption,
    inputAmount: unshieldAmount,
    setInputAmount: setUnshieldAmount,
    onMaxClick: handleUnshieldMax,
    canWriteContract: canUnshield,
    sourceSymbol: token.symbol,
    destSymbol: token.extensions.fhenix.erc20Pair?.symbol,
    sourceLogoURI: token.logoURI,
    destLogoURI: token.extensions.fhenix.erc20Pair?.logoURI,
    handlePrimaryAction: handleUnshield,
    primaryLabel: 'Unshield',
    primaryIcon: <TbShieldMinus className="w-3 h-3" />,
  };
}

const shieldableTypes = new Set(['wrapped']);

export const ShieldPageV2: React.FC<ShieldPageProps> = ({ token: _token, defaultMode }) => {
  const [mode, setMode] = useState<Mode>(defaultMode ?? 'shield');
  const [overriddenToken, setOverriddenToken] = useState<Token | null>(null);
  const token = overriddenToken ?? _token;

  return mode === 'shield' ? (
    <ShieldTab token={token} mode={mode} setMode={setMode} setToken={setOverriddenToken} />
  ) : (
    <UnshieldTab token={token} mode={mode} setMode={setMode} setToken={setOverriddenToken} />
  );
};

type ShieldPageViewProps = {
  error: React.ReactNode | null;
  token: Token;
  mode: Mode;
  status: LifecycleStatus | null;
  setToken: (token: Token) => void;
  setMode: (mode: Mode) => void;

  isProcessing: boolean;
  inputAmount: string;
  setInputAmount: (value: string) => void;
  onMaxClick: () => void;
  canWriteContract: boolean;
  sourceSymbol: string | undefined;
  destSymbol: string | undefined;

  sourceLogoURI: string | undefined;
  destLogoURI: string | undefined;
  handlePrimaryAction: () => void;
  primaryLabel: string;
  primaryIcon: React.ReactNode;
};

function ShieldTab({
  token,
  mode,
  setMode,
  setToken,
}: {
  token: Token;
  mode: Mode;
  setMode: (mode: Mode) => void;
  setToken: (token: Token) => void;
}) {
  const shieldViewProps = useShieldWithLifecycle(token);
  return (
    <ShieldAndUnshieldPageView token={token} mode={mode} setMode={setMode} setToken={setToken} {...shieldViewProps} />
  );
}

function UnshieldTab({
  token,
  mode,
  setMode,
  setToken,
}: {
  token: Token;
  mode: Mode;
  setMode: (mode: Mode) => void;
  setToken: (token: Token) => void;
}) {
  const unshieldViewProps = useUnshieldWithLifecycle(token);
  return (
    <ShieldAndUnshieldPageView token={token} mode={mode} setMode={setMode} setToken={setToken} {...unshieldViewProps} />
  );
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

  const claimCallArgs = useMemo(() => {
    if (!account || !unshieldedClaims?.hasClaimable) return undefined;
    return getCofheTokenClaimUnshieldedCallArgs({ token, account });
  }, [account, token, unshieldedClaims?.hasClaimable]);

  const claimSimulation = useCofheSimulateWriteContract(claimCallArgs, {
    enabled: !!claimCallArgs,
  });

  const claimSimulationError = useMemo(
    () => humanizeSimulationError(claimSimulation.error, 'Failed to simulate claim transaction'),
    [claimSimulation.error]
  );

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
            isUnshieldingMining ||
            !claimCallArgs ||
            claimSimulation.isFetching ||
            !!claimSimulation.error
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
      <StatusAndError status={claimingStatus} error={claimingError ?? claimSimulationError} />
    </>
  );
}

function StatusAndError({ status, error }: { status: LifecycleStatus | null; error: React.ReactNode | null }) {
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
  setToken,

  isProcessing,
  inputAmount,
  setInputAmount,
  onMaxClick,
  canWriteContract,
  sourceSymbol,
  destSymbol,

  sourceLogoURI,
  destLogoURI,
  handlePrimaryAction,
  primaryLabel,
  primaryIcon,
}) => {
  const { navigateBack } = usePortalNavigation();
  const { openModal } = usePortalModals();

  const isShieldableToken = shieldableTypes.has(token.extensions.fhenix.confidentialityType);

  const { tokensWithExistingEncryptedBalance } = useCofheTokensWithExistingEncryptedBalances();
  const { tokensWithPublicBalances } = useTokensWithPublicBalances();
  const selectableTokens = useMemo(
    () =>
      (mode === 'unshield' ? tokensWithExistingEncryptedBalance : tokensWithPublicBalances).filter((candidate) =>
        shieldableTypes.has(candidate.extensions.fhenix.confidentialityType)
      ),
    [mode, tokensWithExistingEncryptedBalance, tokensWithPublicBalances]
  );

  // TODO: probably can be refactored into a view with more stramlined logic
  return (
    <PageContainer
      header={
        <div className="flex items-center justify-between">
          <button
            onClick={navigateBack}
            className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity"
          >
            <ArrowBackIcon style={{ fontSize: 16 }} />
            <p className="text-sm font-medium">Shield / Unshield</p>
          </button>

          <button
            onClick={() =>
              openModal(PortalModal.TokenList, {
                balanceType: mode === 'shield' ? BalanceType.Public : BalanceType.Confidential,
                tokens: selectableTokens,
                title: mode === 'shield' ? 'Select token to shield' : 'Select token to unshield',
                onSelectToken: (token) => setToken(token),
              })
            }
            className="flex items-center gap-1 text-sm font-bold fnx-text-primary hover:opacity-80 transition-opacity"
          >
            <span>{token.symbol}</span>
            <KeyboardArrowDownIcon style={{ fontSize: 16 }} className="opacity-60" />
          </button>
        </div>
      }
      content={
        <div className="flex flex-col gap-3">
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
                    <AmountInput
                      value={inputAmount}
                      onChange={setInputAmount}
                      onMaxClick={onMaxClick}
                      className="w-28"
                    />
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
            disabled={!canWriteContract || isProcessing || !isShieldableToken}
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
      }
    />
  );
};

function useApproveWithLifecycle({
  chainId,
  setError,
  setStatus,
  scheduleStatusClear,
}: {
  chainId?: number;
  setError: (error: React.ReactNode | null) => void;
  setStatus: (status: LifecycleStatus | null) => void;
  scheduleStatusClear: () => void;
}) {
  const tokenApprove = useCofheTokenApprove({
    onMutate: () => {
      setError(null);
      setStatus({ message: 'Preparing approval transaction...', type: 'info' });
    },
    onSuccess: (hash, variables) => {
      setStatus({
        message: (
          <>
            Approval transaction sent! Hash: <TxHashWithActions hash={hash} chainId={chainId} /> Waiting for
            confirmation...
          </>
        ),
        type: 'info',
      });
    },
    onError: (error) => {
      const errorMessage =
        cofheHumanizeViemError(error) ?? (error instanceof Error ? error.message : 'Failed to approve tokens');
      setError(errorMessage);
      setStatus(null);
      console.error('Approve tx submit error:', error);
    },
  });

  const { isMining: isApprovingMining } = useOnceTransactionMined({
    txHash: tokenApprove.data,
    onceMined: async (transaction) => {
      if (transaction.status === 'confirmed') {
        setStatus({
          message: (
            <>
              Approval transaction confirmed! Hash: <TxHashWithActions hash={transaction.hash} chainId={chainId} />
            </>
          ),
          type: 'success',
        });
      } else if (transaction.status === 'failed') {
        setError(
          <>
            Approval transaction failed! Hash: <TxHashWithActions hash={transaction.hash} chainId={chainId} />
          </>
        );
        setStatus(null);
      }
      scheduleStatusClear();
    },
  });

  return {
    tokenApprove,
    isApprovingMining,
  };
}
