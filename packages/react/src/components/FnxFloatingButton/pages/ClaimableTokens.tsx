import { useCofheClaimableTokens } from '@/hooks/useCofheClaimableTokens';
import { PageContainer } from '../components/PageContainer';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { usePortalNavigation } from '@/stores';
import { useCofheChainId } from '@/hooks/useCofheConnection';
import { useCofheTokens } from '@/hooks/useCofheTokenLists';
import { TokenIcon } from '../components/TokenIcon';
import { formatTokenAmount } from '@/utils/format';
import { useMemo, useState } from 'react';
import { useCofheTokenClaimUnshielded } from '@/hooks';
import { cn } from '@/utils';
export function ClaimableTokens() {
  // TODO: or show multichain, with switching?
  const chainsClaimableTokens = useCofheClaimableTokens();
  const claimableByTokenAddress = chainsClaimableTokens.claimableByTokenAddress;
  const waitingByTokenAddress = chainsClaimableTokens.isWaitingForDecryptionByTokenAddress;
  const { navigateBack } = usePortalNavigation();

  const chainId = useCofheChainId();
  const allTokens = useCofheTokens(chainId);
  const claimMutation = useCofheTokenClaimUnshielded();

  const [claimingTokenAddress, setClaimingTokenAddress] = useState<string | null>(null);
  const [isClaimingAll, setIsClaimingAll] = useState(false);

  const rows = useMemo(() => {
    const byLower = new Map(allTokens.map((t) => [t.address.toLowerCase(), t] as const));
    return Object.entries(claimableByTokenAddress)
      .filter(([_t, amount]) => amount > 0n)
      .map(([tokenAddress, claimableAmount]) => {
        const token = byLower.get(tokenAddress.toLowerCase());
        return token ? { token, claimableAmount } : null;
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [allTokens, claimableByTokenAddress]);

  const handleClaim = async (tokenAddress: string) => {
    const row = rows.find((r) => r.token.address.toLowerCase() === tokenAddress.toLowerCase());
    if (!row) return;

    setClaimingTokenAddress(row.token.address);
    try {
      await claimMutation.mutateAsync({ token: row.token, amount: row.claimableAmount });
    } finally {
      setClaimingTokenAddress(null);
    }
  };

  const handleClaimAll = async () => {
    if (rows.length === 0) return;
    setIsClaimingAll(true);
    try {
      for (const row of rows) {
        const isWaiting = !!waitingByTokenAddress?.[row.token.address as keyof typeof waitingByTokenAddress];
        if (isWaiting) continue;
        await claimMutation.mutateAsync({ token: row.token, amount: row.claimableAmount });
      }
    } finally {
      setIsClaimingAll(false);
    }
  };

  return (
    <PageContainer
      header={
        <div className="flex items-center justify-between gap-3">
          <button
            className="flex items-center gap-2 text-xl font-semibold text-[#0E2F3F] transition-opacity hover:opacity-80 dark:text-white"
            type="button"
            onClick={navigateBack}
          >
            <ArrowBackIcon fontSize="small" />
            <span>Claimable Tokens list</span>
          </button>

          <button
            type="button"
            onClick={handleClaimAll}
            disabled={rows.length === 0 || isClaimingAll || claimMutation.isPending}
            className={cn(
              'px-4 py-2 text-sm font-semibold',
              'rounded-none',
              'border border-[rgba(0,0,0,0.25)]',
              'bg-[#6EE7F5] text-[#003B4A]',
              'transition-opacity',
              (rows.length === 0 || isClaimingAll || claimMutation.isPending) && 'opacity-50 cursor-not-allowed'
            )}
          >
            Claim All
          </button>
        </div>
      }
      content={
        <div className="flex flex-col gap-4 pr-1">
          {rows.map(({ token, claimableAmount }) => {
            const isWaiting = !!waitingByTokenAddress?.[token.address as keyof typeof waitingByTokenAddress];
            const formatted = formatTokenAmount(claimableAmount, token.decimals).unit.toFormat(2);
            const isClaimingThis = claimingTokenAddress?.toLowerCase() === token.address.toLowerCase() || isClaimingAll;

            return (
              <div key={token.address} className="grid grid-cols-[1fr,auto,auto] items-center gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <TokenIcon
                    logoURI={token.logoURI}
                    alt={token.name}
                    size="md"
                    className={cn(
                      'w-10 h-10 rounded-full',
                      'fnx-icon-bg',
                      'border border-[var(--fnx-button-default-border)]',
                      'flex items-center justify-center flex-shrink-0 overflow-hidden'
                    )}
                  />
                  <div className="min-w-0">
                    <div className="text-xl font-semibold fnx-text-primary truncate">{token.name}</div>
                  </div>
                </div>

                <div className="text-2xl font-semibold fnx-text-primary tabular-nums">{formatted}</div>

                <button
                  type="button"
                  onClick={() => handleClaim(token.address)}
                  disabled={isWaiting || isClaimingThis || claimMutation.isPending}
                  className={cn(
                    'px-5 py-2 text-base font-medium',
                    'rounded-none',
                    'border border-[var(--fnx-button-default-border)]',
                    'bg-[var(--fnx-button-bg)] fnx-text-primary',
                    'transition-opacity',
                    (isWaiting || isClaimingThis || claimMutation.isPending) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {isWaiting ? 'Decrypting' : 'Claim'}
                </button>
              </div>
            );
          })}

          {rows.length === 0 && <div className="text-sm opacity-70 fnx-text-primary">No claimable tokens.</div>}
        </div>
      }
    />
  );
}
