import { useMemo } from 'react';
import { ArrowBackIcon } from '@/components/Icons';
import { PageContainer } from '@/components/CofheFloatingButton/components/PageContainer.js';
import { Button } from '@/components/CofheFloatingButton/components/Button.js';
import { useCofheShareLabels, useIncomingShares, useImportFromChain, useRemoveShare } from '@/hooks/acps/index.js';
import type { CofheShareLabel } from '@/hooks/acps/index.js';
import { usePortalNavigation, usePortalToasts } from '@/stores';
import { FloatingButtonPage } from '@/components/CofheFloatingButton/pagesConfig/types.js';
import { formatExpirationLabel, truncateAddress } from '@/utils';
import { decodeShareMetadata, type IncomingShare, type ShareLabelAbis } from '@cofhe/sdk/acps';
import { parseAbi } from 'viem';

/** Names for the confidential-token reads and events a label most often points at (ERC-7984). */
const CONFIDENTIAL_TOKEN_ABI = parseAbi([
  'function confidentialBalanceOf(address account) view returns (bytes32)',
  'event ConfidentialTransfer(address indexed from, address indexed to, bytes32 indexed amount)',
]);

/** The token ABI for every contract a share's labels name; null when it has no (readable) labels. */
const tokenAbisFor = (share: IncomingShare): ShareLabelAbis | undefined => {
  if (share.metadata === '0x') return undefined;
  try {
    const contracts = decodeShareMetadata(share.metadata, share.handles).flatMap((l) =>
      l.kind === 'unlabelled' ? [] : [l.contract]
    );
    return Object.fromEntries(contracts.map((c) => [c, CONFIDENTIAL_TOKEN_ABI]));
  } catch {
    return undefined;
  }
};

const CHECK_MARK: Record<CofheShareLabel['check'], string> = {
  verified: '✓',
  mismatch: '✗',
  unverifiable: '?',
  skipped: '·',
  pending: '…',
};

const labelText = (label: CofheShareLabel): string => {
  switch (label.kind) {
    case 'stored':
      return `${label.function?.name ?? label.selector} @ ${label.block}`;
    case 'event':
      return `${label.event?.name ?? label.selector} @ ${label.block}, log ${label.logIndex}`;
    case 'unlabelled':
      return 'unlabelled';
  }
};

/** What each shared value is, as the issuer labelled it, and whether the chain confirms it. */
const ShareLabels: React.FC<{ share: IncomingShare }> = ({ share }) => {
  const abis = useMemo(() => tokenAbisFor(share), [share]);
  const { labels, error } = useCofheShareLabels(share, { abis });
  if (error) return <div className="italic">Labels unreadable: {error.message}</div>;
  if (labels == null) return null;
  return (
    <ul className="flex flex-col gap-0.5">
      {labels.map((label) => (
        <li key={label.index} title={label.check}>
          {CHECK_MARK[label.check]} {labelText(label)}
        </li>
      ))}
    </ul>
  );
};

const ShareRow: React.FC<{ share: IncomingShare }> = ({ share }) => {
  const { navigateTo } = usePortalNavigation();
  const { addToast } = usePortalToasts();

  const importMutation = useImportFromChain({
    onSuccess: () => {
      addToast({
        variant: 'success',
        title: 'Share imported',
        description: 'The imported ACP is now your active acp.',
      });
      navigateTo(FloatingButtonPage.ACPs);
    },
    onError: (error) => {
      addToast({ variant: 'error', title: 'Import failed', description: error.message });
    },
  });

  const dismissMutation = useRemoveShare({
    onSuccess: () => {
      addToast({ variant: 'success', title: 'Share dismissed' });
    },
    onError: (error) => {
      addToast({ variant: 'error', title: 'Dismiss failed', description: error.message });
    },
  });

  const expirationInfo = formatExpirationLabel(share.expiration);
  const busy = importMutation.isPending || dismissMutation.isPending;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[#0E2F3F]/15 bg-[#F8FAFB] p-3 font-mono text-xs text-[#0E2F3F] dark:border-white/10 dark:bg-[#121212] dark:text-white/80">
      <div>
        From: <b>{truncateAddress(share.issuer, 6, 6)}</b>
      </div>
      <div>
        Expires in: <b>{expirationInfo.label}</b>
      </div>
      <ShareLabels share={share} />
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button
          variant="primary"
          disabled={busy}
          aria-busy={importMutation.isPending}
          label={importMutation.isPending ? 'Importing…' : 'Import'}
          onClick={() => importMutation.mutate(share)}
        />
        <Button
          disabled={busy}
          aria-busy={dismissMutation.isPending}
          label={dismissMutation.isPending ? 'Dismissing…' : 'Dismiss'}
          onClick={() => dismissMutation.mutate(share.shareId)}
        />
      </div>
    </div>
  );
};

/**
 * Recipient POV: on-chain shares addressed to the connected account.
 * Import signs the share with the connected wallet and activates the ACP;
 * Dismiss removes the entry from the registry (declining, or cleanup after import).
 */
export const IncomingSharesPage: React.FC = () => {
  const { navigateBack } = usePortalNavigation();
  const incoming = useIncomingShares();

  return (
    <PageContainer
      header={
        <button
          className="flex items-center gap-2 text-base font-semibold text-[#0E2F3F] transition-opacity hover:opacity-80 dark:text-white"
          type="button"
          onClick={navigateBack}
        >
          <ArrowBackIcon fontSize="small" />
          <span>Incoming shares</span>
        </button>
      }
      content={
        <div className="flex w-full flex-col gap-3">
          <p className="text-sm leading-relaxed text-[#355366] dark:text-white/80">
            ACPs shared with you on-chain. Importing signs the share with your wallet and grants you access to the
            issuer's encrypted data.
          </p>

          {incoming.isLoading && <div className="text-xs italic">Loading shares…</div>}
          {incoming.isError && (
            <div role="alert" className="text-error text-xs">
              Failed to load shares: {incoming.error.message}
            </div>
          )}
          {incoming.data != null && incoming.data.length === 0 && (
            <div className="text-xs italic">No incoming shares.</div>
          )}
          {incoming.data?.map((share) => <ShareRow key={share.shareId} share={share} />)}
        </div>
      }
    />
  );
};
