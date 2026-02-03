import { FaCheck, FaRegCopy, FaShare } from 'react-icons/fa6';
import { usePermitDetailsPage } from '@/hooks/permits/index.js';
import { zeroAddress } from 'viem';
import { cn, truncateAddress } from '@/utils';
import { useCopyFeedback } from '@/hooks/useCopyFeedback';

const CopyButton: React.FC<{ hash: string }> = ({ hash }) => {
  const { copiedKeys, copyWithFeedback } = useCopyFeedback();

  return (
    <button type="button" onClick={() => copyWithFeedback(hash, hash)}>
      {copiedKeys.has(hash) ? <FaCheck /> : <FaRegCopy />}
    </button>
  );
};

export const PermitCard: React.FC<{ hash: string; className?: string; header?: React.ReactNode }> = ({
  hash,
  className,
  header,
}) => {
  const { permit, expirationDate } = usePermitDetailsPage(hash);

  if (permit == null) {
    return (
      <div
        className={cn(
          'gap-3 border border-[#0E2F3F]/15 bg-[#F8FAFB] p-3 py-4 font-mono text-xs text-[#0E2F3F] dark:border-white/10 dark:bg-[#121212] dark:text-white/80',
          className
        )}
      >
        {header}
        <div className="flex flex-col size-3"></div>
        <pre className="whitespace-pre-wrap break-words text-left italic p-10">Permit not found.</pre>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'gap-3 border border-[#0E2F3F]/15 bg-[#F8FAFB] p-3 py-4 font-mono text-xs text-[#0E2F3F] dark:border-white/10 dark:bg-[#121212] dark:text-white/80',
        className
      )}
    >
      {header}
      <div className="flex flex-col size-3"></div>
      <pre className="whitespace-pre-wrap break-words text-left">
        Name: <b>{permit.name}</b>
        <br />
        Issuer: <b>{truncateAddress(permit.issuer, 6, 6)}</b> <CopyButton hash={permit.issuer} />
        <br />
        Expiration:
        <br />
        {'  '}
        Timestamp: <b>{permit.expiration}</b>
        <br />
        {'  '}
        <i>
          <b>({expirationDate})</b>
        </i>
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
      </pre>
    </div>
  );
};
