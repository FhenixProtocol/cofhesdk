import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { usePermitDetailsPage } from '@/hooks/permits/index.js';
import { PageContainer } from '@/components/FnxFloatingButton/components/PageContainer';
import { PortalModal, type PortalModalStateMap } from './types';
import { zeroAddress } from 'viem';
import { truncateAddress } from '@/utils';
import { useCopyFeedback } from '@/hooks/useCopyFeedback';

const CopyButton: React.FC<{ hash: string }> = ({ hash }) => {
  const { copiedKeys, copyWithFeedback } = useCopyFeedback();

  return (
    <button type="button" onClick={() => copyWithFeedback(hash, hash)}>
      {copiedKeys.has(hash) ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
    </button>
  );
};

export const PermitDetailsModal: React.FC<PortalModalStateMap[PortalModal.PermitDetails]> = ({ hash, onClose }) => {
  const { permit, expirationInfo, expirationDate, handleBack, handleViewAs, isActivePermit } =
    usePermitDetailsPage(hash);

  return (
    <PageContainer
      header={
        <div className="gap-3 -mt-4 -ml-4 -mr-4 border border-[#0E2F3F]/15 bg-[#F8FAFB] p-3 font-mono text-xs text-[#0E2F3F] dark:border-white/10 dark:bg-[#121212] dark:text-white/80">
          <button
            className="flex items-center gap-2 text-base font-semibold tracking-tight text-[#0E2F3F] transition-opacity hover:opacity-80 dark:text-white"
            onClick={handleBack}
            type="button"
          >
            <CloseIcon fontSize="small" />
            <span>Permit</span>
          </button>
          {permit == null && <p>No permit found</p>}
          {permit != null && (
            <pre className="max-h-60 whitespace-pre-wrap break-words text-left">
              Name: {permit.name}
              <br />
              Issuer: {truncateAddress(permit.issuer, 6, 6)} <CopyButton hash={permit.issuer} />
              <br />
              Expiration: {permit.expiration} ({expirationDate})
              <br />
              {permit.recipient != null && permit.recipient !== zeroAddress && (
                <>
                  Recipient: {permit.recipient}
                  <br />
                </>
              )}
              {permit.validatorContract != null && permit.validatorContract !== zeroAddress && (
                <>
                  Validator:
                  <br />
                  {'  '}Contract: {truncateAddress(permit.validatorContract, 6, 6)}{' '}
                  <CopyButton hash={permit.validatorContract} />
                  <br />
                  {'  '}ID: {permit.validatorId}
                  <br />
                </>
              )}
            </pre>
          )}
        </div>
      }
      content={
        <div className="flex flex-colgap-3">
          {/* <div className="flex items-center justify-between text-sm font-semibold text-[#0E2F3F] dark:text-white">
              {isShareablePermit ? (
                <button
                  type="button"
                  className="rounded-md border border-[#0E2F3F]/30 p-1.5 text-[#0E2F3F] transition-colors hover:bg-[#0E2F3F]/10 dark:border-white/30 dark:text-white dark:hover:bg-white/10"
                  onClick={handleCopy}
                  aria-label={isCopyComplete ? 'Copied permit data' : 'Copy permit data'}
                  title={isCopyComplete ? 'Copied permit data' : 'Copy permit data'}
                >
                  {isCopyComplete ? (
                    <CheckIcon fontSize="small" color="success" />
                  ) : (
                    <ContentCopyIcon fontSize="small" />
                  )}
                </button>
              ) : null}
            </div> */}

          <div className="rounded-xl border border-[#0E2F3F]/15 bg-[#EEF6F8] p-4 dark:border-white/10 dark:bg-[#102027]">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#0E2F3F]/70 dark:text-white/70">
              Expiring in
            </p>
            <p
              className={`mt-1 text-2xl font-semibold ${
                expirationInfo.expired ? 'text-[#D14324]' : 'text-[#0E2F3F] dark:text-white'
              }`}
            >
              {expirationInfo.label}
            </p>
            {expirationDate ? (
              <p className="mt-1 text-xs text-[#0E2F3F]/70 dark:text-white/70">
                {expirationInfo.expired ? 'Expired on' : 'Expires on'} {expirationDate}
              </p>
            ) : null}
          </div>
        </div>
      }
      footer={
        <button
          type="button"
          className="w-full rounded-xl border border-[#68D8EB] bg-[#A8F3FB] px-4 py-3 text-base font-semibold text-[#00314E] transition-colors hover:bg-[#90edf7] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#1F6B7D] dark:bg-[#114C5A] dark:text-white dark:hover:bg-[#0f3f4b]"
          onClick={handleViewAs}
          disabled={isActivePermit}
        >
          {isActivePermit ? 'Active permit' : 'View as'}
        </button>
      }
    />
  );
};
