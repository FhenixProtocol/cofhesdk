import { FaCheck, FaRegCopy } from 'react-icons/fa6';
import CloseIcon from '@mui/icons-material/Close';
import { usePermitDetailsPage } from '@/hooks/permits/index.js';
import { PageContainer } from '@/components/FnxFloatingButton/components/PageContainer';
import { PortalModal, type PortalModalStateMap } from './types';
import { useCopyFeedback } from '@/hooks/useCopyFeedback';
import { Button } from '../components';
import { InfoModalButton } from './InfoModalButton';
import { usePortalModals, usePortalToasts } from '@/stores';
import type { PermitType } from '@cofhe/sdk/permits';
import { PermitCard } from '../components/PermitCard';
import { truncateAddress } from '@/utils';
import { useCallback, useState } from 'react';
import { useCofheRemovePermit } from '@/hooks';

const PermitTypeLabel: Record<PermitType, string> = {
  self: 'Self',
  sharing: 'Delegated',
  recipient: 'Imported',
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
  const { permit, expirationInfo, handleViewAs, isActivePermit, isShareablePermit, handleCopy, isCopyComplete } =
    usePermitDetailsPage(hash);
  const { openModal } = usePortalModals();
  const { addToast } = usePortalToasts();
  const removePermit = useCofheRemovePermit();

  const [confirmDelete, setConfirmDelete] = useState(false);

  const handlePermitSelect = useCallback(() => {
    onClose();
    handleViewAs();
    addToast({
      variant: 'success',
      title: `Permit selected (${permit?.name})`,
      description:
        permit?.type === 'self'
          ? 'Now viewing own encrypted data.'
          : `Now viewing ${truncateAddress(permit?.issuer, 4, 4)}'s encrypted data.`,
    });
  }, [handleViewAs, onClose, addToast, permit]);

  const handlePermitShare = useCallback(() => {
    handleCopy();
    addToast({
      variant: 'success',
      title: 'Permit data copied',
      description: 'Copied data can be sent to recipient.',
    });
  }, [handleCopy, addToast]);

  const handlePermitDelete = useCallback(async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await removePermit(hash);
    } catch (error) {
      addToast({
        variant: 'error',
        title: 'Failed to delete permit',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    onClose();
    addToast({
      variant: 'success',
      title: 'Permit deleted',
      description: 'Permit deleted successfully.',
    });
  }, [confirmDelete, hash, onClose, addToast, removePermit]);

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
              className="flex items-center gap-2 text-base font-semibold tracking-tight text-[#0E2F3F] transition-opacity hover:opacity-80 dark:text-white"
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
            <p className="flex flex-row gap-2 text-sm">
              Type: <b>{PermitTypeLabel[permit.type]}</b>
              <InfoModalButton onClick={() => openModal(PortalModal.PermitTypeExplanation, { type: permit.type })} />
            </p>

            <p className="text-sm">
              Expires in: <b>{expirationInfo.label}</b>
            </p>

            {permit.type === 'self' && (
              <p className="text-sm">
                To select this permit for usage, click the <b>"SELECT"</b> button below. When this permit is active, you
                will be able to view your own encrypted data.
              </p>
            )}
            {permit.type === 'sharing' && (
              <p className="text-sm">
                To share this permit with <b>recipient</b>, click the <b>"SHARE"</b> button below to copy the permit
                data to your clipboard. Share the copied permit data with <b>recipient</b> to grant them access to your
                encrypted data.
                <br />
                <br />
                <i>
                  <b>Note:</b> The copied permit data is not sensitive and can be sent to recipient via any
                  communication channel.
                </i>
              </p>
            )}
            {permit.type === 'recipient' && (
              <p className="text-sm">
                To select this imported permit for usage, click the <b>"SELECT"</b> button below. When this permit is
                active, you will be able to view <b>issuer</b>'s ({truncateAddress(permit.issuer, 4, 4)}) encrypted
                data.
              </p>
            )}
          </div>
        )
      }
      footer={
        <div className="flex flex-row gap-3 w-full">
          {isShareablePermit && (
            <Button variant="primary" onClick={handlePermitShare}>
              {isCopyComplete ? <FaCheck /> : <FaRegCopy />}
              {isCopyComplete ? 'COPIED' : 'SHARE'}
            </Button>
          )}
          {!isShareablePermit && (
            <Button
              variant="primary"
              label={isActivePermit ? 'ALREADY ACTIVE' : 'SELECT'}
              onClick={handlePermitSelect}
              disabled={isActivePermit}
            />
          )}
          <Button label={confirmDelete ? 'CONFIRM' : 'DELETE'} onClick={handlePermitDelete} variant="error" />
          <Button label="CLOSE" onClick={onClose} variant="ghost" />
        </div>
      }
    />
  );
};
