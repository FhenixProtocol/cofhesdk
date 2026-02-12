import { FaCheck, FaRegCopy } from 'react-icons/fa6';
import { zeroAddress } from 'viem';
import { cn, formatExpirationLabel, truncateAddress } from '@/utils';
import { useCopyFeedback } from '@/hooks/useCopyFeedback';
import { PermitUtils, type Permit, type PermitType } from '@cofhe/sdk/permits';
import { PermitStripedBackground } from '@/components/StripedBackground';
import { useCofheActivePermitHash, useCofhePermit } from '@/hooks/useCofhePermits';
import { useMemo } from 'react';

const PermitTypeLabel: Record<PermitType, string> = {
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

export const BasePermitCard: React.FC<{ permit: Permit; className?: string; header?: React.ReactNode }> = ({
  permit,
  className,
  header,
}) => {
  const activePermitHash = useCofheActivePermitHash();
  const expirationInfo = formatExpirationLabel(permit.expiration);

  const metadataTags = useMemo(() => {
    const isActivePermit = PermitUtils.getHash(permit) === activePermitHash;
    const tags: string[] = [];
    if (expirationInfo.expired) tags.push('expired');
    if (expirationInfo.expiringSoon) tags.push('expiring soon');
    if (isActivePermit) tags.push('active');
    return tags;
  }, [expirationInfo.expired, expirationInfo.expiringSoon, activePermitHash, permit]);

  return (
    <div
      className={cn(
        'relative gap-3 border border-[#0E2F3F]/15 bg-[#F8FAFB] p-3 py-4 font-mono text-xs text-[#0E2F3F] dark:border-white/10 dark:bg-[#121212] dark:text-white/80',
        className
      )}
    >
      <PermitStripedBackground
        variant={expirationInfo.expired ? 'error' : expirationInfo.expiringSoon ? 'warning' : permit.type}
        className="absolute inset-0 z-[1]"
      />
      <div className="relative z-[2] flex flex-1 flex-col gap-3">
        {header}
        <pre className="whitespace-pre-wrap break-words text-left">
          <b>-- {PermitTypeLabel[permit.type].toUpperCase()} PERMIT --</b>
          <br />
          Name: <b>{permit.name}</b>
          <br />
          Issuer: <b>{truncateAddress(permit.issuer, 6, 6)}</b> <CopyButton hash={permit.issuer} />
          <br />
          Expiration:{' '}
          <b>
            {permit.expiration} <i>({expirationInfo.label})</i>
          </b>
          <br />
          {permit.recipient != null && permit.recipient !== zeroAddress && (
            <>
              Recipient: <b>{truncateAddress(permit.recipient, 6, 6)}</b> <CopyButton hash={permit.recipient} />
              <br />
            </>
          )}
          {permit.validatorContract != null && permit.validatorContract !== zeroAddress && (
            <>
              Validator:
              <br />
              {'  '}Contract: <b>{truncateAddress(permit.validatorContract, 6, 6)}</b>{' '}
              <CopyButton hash={permit.validatorContract} />
              <br />
              {'  '}ID: <b>{permit.validatorId}</b>
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

export const PermitCard: React.FC<{ hash: string; className?: string; header?: React.ReactNode }> = ({
  hash,
  className,
  header,
}) => {
  const permit = useCofhePermit(hash);

  if (permit == null) {
    return (
      <div
        className={cn(
          'flex flex-col gap-3 border border-[#0E2F3F]/15 bg-[#F8FAFB] p-3 py-4 font-mono text-xs text-[#0E2F3F] dark:border-white/10 dark:bg-[#121212] dark:text-white/80',
          className
        )}
      >
        {header}
        <pre className="whitespace-pre-wrap break-words text-left italic p-10">Permit not found.</pre>
      </div>
    );
  }

  return <BasePermitCard permit={permit} className={className} header={header} />;
};
