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
import { PermitCard } from '../components/PermitCard';

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
        <PermitCard
          hash={hash}
          className="-mt-4 -ml-4 -mr-4"
          header={
            <button
              className="flex items-center gap-2 text-base font-semibold tracking-tight text-[#0E2F3F] transition-opacity hover:opacity-80 dark:text-white mb-3"
              onClick={onClose}
              type="button"
            >
              <CloseIcon fontSize="small" />
              <span>Permit</span>
            </button>
          }
        />
      }
      content={
        permit != null && (
          <div className="flex flex-col gap-3">
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
