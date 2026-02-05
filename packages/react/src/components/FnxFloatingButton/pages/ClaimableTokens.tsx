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
import { Button } from '../components';
import type { Address } from 'viem';
import { assert } from 'ts-essentials';
export function ClaimableTokens() {
  // TODO: or show multichain, with switching?

  const chainsClaimableTokens = useCofheClaimableTokens();
  const claimableByTokenAddress = chainsClaimableTokens.claimableByTokenAddress;
  const unshieldingInProgressByTokenAddress = chainsClaimableTokens.isUnshieldingInProgressByTokenAddress;
  const waitingByTokenAddress = chainsClaimableTokens.isWaitingForDecryptionByTokenAddress;
  const isClaimingByTokenAddress = chainsClaimableTokens.isClaimingByTokenAddress;
  const { navigateBack } = usePortalNavigation();

  const chainId = useCofheChainId();
  const allTokens = useCofheTokens(chainId);
  const claimMutation = useCofheTokenClaimUnshielded();

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
    assert(row, 'token not found for claim');

    await claimMutation.mutateAsync({ token: row.token, amount: row.claimableAmount });
  };

  return (
    <PageContainer
      header={
        <div className="flex items-center gap-3">
          <button
            className="flex items-center gap-2 text-xl font-semibold text-[#0E2F3F] transition-opacity hover:opacity-80 dark:text-white"
            type="button"
            onClick={navigateBack}
          >
            <ArrowBackIcon fontSize="small" />
          </button>
          <span>Claimable Tokens list</span>
        </div>
      }
      content={
        <div className="flex flex-col gap-4 pr-1">
          {rows.map(({ token, claimableAmount }) => {
            const isDecrypting = waitingByTokenAddress?.[token.address] ?? false;
            const isUnshielding =
              unshieldingInProgressByTokenAddress?.[token.address.toLowerCase() as Address] ?? false;
            const formatted = formatTokenAmount(claimableAmount, token.decimals, 5).formatted;
            const isClaimingThis = isClaimingByTokenAddress[token.address.toLowerCase() as Address] ?? false;

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

                <Button
                  type="button"
                  onClick={() => handleClaim(token.address)}
                  disabled={isUnshielding || isDecrypting || isClaimingThis || claimMutation.isPending}
                >
                  {isDecrypting ? 'Decrypting' : isUnshielding ? 'Unshielding' : 'Claim'}
                </Button>
              </div>
            );
          })}

          {rows.length === 0 && <div className="text-sm opacity-70 fnx-text-primary">No claimable tokens.</div>}
        </div>
      }
    />
  );
}
