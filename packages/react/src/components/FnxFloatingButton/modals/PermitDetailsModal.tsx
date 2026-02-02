import { FaCheck, FaRegCopy, FaShare } from 'react-icons/fa6';
import CloseIcon from '@mui/icons-material/Close';
import { usePermitDetailsPage } from '@/hooks/permits/index.js';
import { PageContainer } from '@/components/FnxFloatingButton/components/PageContainer';
import { PortalModal, type PortalModalStateMap } from './types';
import { zeroAddress } from 'viem';
import { truncateAddress } from '@/utils';
import { useCopyFeedback } from '@/hooks/useCopyFeedback';
import { Button } from '../components';
import { InfoModalButton } from './InfoModalButton';
import { usePortalModals } from '@/stores';
import type { PermitType } from '@cofhe/sdk/permits';

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

const NoPermitFoundModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <PageContainer
      header={
        <div className="flex items-center gap-2 text-base font-semibold tracking-tight text-[#0E2F3F] transition-opacity hover:opacity-80 dark:text-white">
          No permit found
        </div>
      }
      content={
        <div className="flex flex-col gap-3">
          <p>No permit found</p>
        </div>
      }
    />
  );
};

export const PermitDetailsModal: React.FC<PortalModalStateMap[PortalModal.PermitDetails]> = ({ hash, onClose }) => {
  const {
    permit,
    expirationInfo,
    expirationDate,
    handleViewAs,
    isActivePermit,
    isShareablePermit,
    handleCopy,
    isCopyComplete,
  } = usePermitDetailsPage(hash);
  const { openModal } = usePortalModals();

  if (permit == null) {
    return <NoPermitFoundModal onClose={onClose} />;
  }

  return (
    <PageContainer
      isModal
      header={
        <div className="gap-3 -mt-4 -ml-4 -mr-4 border border-[#0E2F3F]/15 bg-[#F8FAFB] p-3 py-4 font-mono text-xs text-[#0E2F3F] dark:border-white/10 dark:bg-[#121212] dark:text-white/80">
          <button
            className="flex items-center gap-2 text-base font-semibold tracking-tight text-[#0E2F3F] transition-opacity hover:opacity-80 dark:text-white mb-3"
            onClick={onClose}
            type="button"
          >
            <CloseIcon fontSize="small" />
            <span>Permit</span>
          </button>
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
      }
      content={
        permit != null && (
          <div className="flex flex-col gap-3">
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

            <p className="text-sm">
              Type: <b>{PermitTypeLabel[permit.type]}</b>{' '}
              <InfoModalButton onClick={() => openModal(PortalModal.PermitTypeExplanation, { type: permit.type })} />
            </p>

            <p className="text-sm">
              Expires in: <b>{expirationInfo.label}</b>
            </p>
          </div>
        )
      }
      footer={
        <div className="flex flex-row gap-3 w-full">
          {isShareablePermit && (
            <Button onClick={handleCopy}>
              {isCopyComplete ? <FaCheck /> : <FaRegCopy />}
              {isCopyComplete ? 'COPIED' : 'SHARE'}
            </Button>
          )}
          {!isShareablePermit && <Button label="USE" onClick={handleViewAs} disabled={isActivePermit} />}
        </div>
      }
    />
  );
};
