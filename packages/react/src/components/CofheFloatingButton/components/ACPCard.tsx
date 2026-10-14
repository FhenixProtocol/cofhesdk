import { FaCheck, FaRegCopy } from 'react-icons/fa6';
import { zeroAddress } from 'viem';
import { cn, formatExpirationLabel, truncateAddress } from '@/utils';
import { useCopyFeedback } from '@/hooks/useCopyFeedback';
import { type ACP, type ACPType } from '@cofhe/sdk/acps';
import { ACPStripedBackground } from '@/components/StripedBackground';
import { useCofheActiveACPHash, useCofheACP } from '@/hooks/useCofheACPs';
import { useMemo } from 'react';

const ACPTypeLabel: Record<ACPType, string> = {
  self: 'Self',
  sharing: 'Delegated',
  recipient: 'Imported',
};

const CopyButton: React.FC<{ hash: string }> = ({ hash }) => {
  const { copiedKeys, copyWithFeedback } = useCopyFeedback();

  return (
    <button type="button" onClick={() => copyWithFeedback(hash, hash)}>
      {copiedKeys.has(hash) ? <FaCheck /> : <FaRegCopy />}
    </button>
  );
};

export const BaseACPCard: React.FC<{ acp: ACP; className?: string; header?: React.ReactNode }> = ({
  acp,
  className,
  header,
}) => {
  const activeACPHash = useCofheActiveACPHash();
  const expirationInfo = formatExpirationLabel(acp.expiration);

  const metadataTags = useMemo(() => {
    const isActiveACP = acp.hash === activeACPHash;
    const tags: string[] = [];
    if (expirationInfo.expired) tags.push('expired');
    if (expirationInfo.expiringSoon) tags.push('expiring soon');
    if (isActiveACP) tags.push('active');
    return tags;
  }, [expirationInfo.expired, expirationInfo.expiringSoon, activeACPHash, acp]);

  return (
    <div
      className={cn(
        'relative gap-3 border border-[#0E2F3F]/15 bg-[#F8FAFB] p-3 py-4 font-mono text-xs text-[#0E2F3F] dark:border-white/10 dark:bg-[#121212] dark:text-white/80',
        className
      )}
    >
      <ACPStripedBackground
        variant={expirationInfo.expired ? 'error' : expirationInfo.expiringSoon ? 'warning' : acp.type}
        className="absolute inset-0 z-[1]"
      />
      <div className="relative z-[2] flex flex-1 flex-col gap-3">
        {header}
        <pre className="whitespace-pre-wrap break-words text-left">
          <b>-- {ACPTypeLabel[acp.type].toUpperCase()} ACP --</b>
          <br />
          Name: <b>{acp.name}</b>
          <br />
          Issuer: <b>{truncateAddress(acp.issuer, 6, 6)}</b> <CopyButton hash={acp.issuer} />
          <br />
          Expiration:{' '}
          <b>
            {acp.expiration} <i>({expirationInfo.label})</i>
          </b>
          <br />
          {acp.recipient != null && acp.recipient !== zeroAddress && (
            <>
              Recipient: <b>{truncateAddress(acp.recipient, 6, 6)}</b> <CopyButton hash={acp.recipient} />
              <br />
            </>
          )}
          {acp.revokerContract != null && acp.revokerContract !== zeroAddress && (
            <>
              Revoker:
              <br />
              {'  '}Contract: <b>{truncateAddress(acp.revokerContract, 6, 6)}</b>{' '}
              <CopyButton hash={acp.revokerContract} />
              <br />
              {'  '}Data: <b>{acp.revokerData}</b>
              <br />
            </>
          )}
          {metadataTags.length > 0 && <br />}
          {metadataTags.map((tag) => (
            <b key={tag}>
              -- {tag.toUpperCase()} --
              <br />
            </b>
          ))}
        </pre>
      </div>
    </div>
  );
};

export const ACPCard: React.FC<{ hash: string; className?: string; header?: React.ReactNode }> = ({
  hash,
  className,
  header,
}) => {
  const acp = useCofheACP(hash);

  if (acp == null) {
    return (
      <div
        className={cn(
          'flex flex-col gap-3 border border-[#0E2F3F]/15 bg-[#F8FAFB] p-3 py-4 font-mono text-xs text-[#0E2F3F] dark:border-white/10 dark:bg-[#121212] dark:text-white/80',
          className
        )}
      >
        {header}
        <pre className="whitespace-pre-wrap break-words text-left italic p-10">ACP not found.</pre>
      </div>
    );
  }

  return <BaseACPCard acp={acp} className={className} header={header} />;
};
