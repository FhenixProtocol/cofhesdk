import { FaCheck, FaRegCopy } from 'react-icons/fa6';
import { CloseIcon } from '@/components/Icons';
import { usePermitDetailsPage, useShareOnChain, useRemoveShare } from '@/hooks/permits/index.js';
import { PageContainer } from '@/components/CofheFloatingButton/components/PageContainer';
import { PortalModal, type PortalModalStateMap } from './types';
import { Button } from '../components';
import { InfoModalButton } from './InfoModalButton';
import { usePortalModals, usePortalToasts } from '@/stores';
import type { PermitType } from '@cofhe/sdk/permits';
import { PermitCard } from '../components/PermitCard';
import { truncateAddress } from '@/utils';
import { useCallback, useState } from 'react';

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
      footer={<Button label="CLOSE" onClick={onClose} variant="ghost" />}
    />
  );
};

export const PermitDetailsModal: React.FC<PortalModalStateMap[PortalModal.PermitDetails]> = ({ hash, onClose }) => {
  const {
    permit,
    expirationInfo,
    isActivePermit,
    isShareablePermit,
    handleSelectActivePermit,
    handleCopySharablePermitData,
    handleRemovePermit,
    isCopyComplete,
  } = usePermitDetailsPage(hash);
  const { openModal } = usePortalModals();
  const { addToast } = usePortalToasts();

  const [confirmDelete, setConfirmDelete] = useState(false);
  // set after a successful on-chain share this session — enables retracting it
  const [postedShareId, setPostedShareId] = useState<`0x${string}` | null>(null);

  const shareOnChain = useShareOnChain({
    onError: (error) => addToast({ variant: 'error', title: 'On-chain share failed', description: error.message }),
  });
  const cancelShare = useRemoveShare({
    onSuccess: () => {
      setPostedShareId(null);
      addToast({ variant: 'success', title: 'On-chain share retracted' });
    },
    onError: (error) => addToast({ variant: 'error', title: 'Retract failed', description: error.message }),
  });

  const handleShareOnChain = useCallback(async () => {
    if (permit == null) return;
    const { shareId } = await shareOnChain.mutateAsync(permit).catch(() => ({ shareId: null }) as never);
    if (shareId) {
      setPostedShareId(shareId);
      addToast({
        variant: 'success',
        title: 'Shared on-chain',
        description: 'The recipient will see this share in any cofhesdk-enabled app.',
      });
    }
  }, [permit, shareOnChain, addToast]);

  const handlePermitSelect = useCallback(() => {
    handleSelectActivePermit();
    onClose();
  }, [handleSelectActivePermit, onClose]);

  const handlePermitShare = useCallback(() => {
    handleCopySharablePermitData();
  }, [handleCopySharablePermitData]);

  const handlePermitDelete = useCallback(async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    handleRemovePermit();
    onClose();
  }, [confirmDelete, onClose, handleRemovePermit]);

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
              <span>ACP</span>
            </button>
          }
        />
      }
      content={
        permit != null && (
          <div className="flex flex-col gap-3">
            <p className="flex flex-row gap-2 text-sm">
              Type: <b>{PermitTypeLabel[permit.type]}</b>
              <InfoModalButton onClick={() => openModal(PortalModal.PermitTypeInfo, { type: permit.type })} />
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
          {isShareablePermit && postedShareId == null && (
            <Button
              variant="primary"
              disabled={shareOnChain.isPending}
              aria-busy={shareOnChain.isPending}
              label={shareOnChain.isPending ? 'SHARING…' : 'SHARE ON-CHAIN'}
              onClick={handleShareOnChain}
            />
          )}
          {isShareablePermit && postedShareId != null && (
            <Button
              disabled={cancelShare.isPending}
              aria-busy={cancelShare.isPending}
              label={cancelShare.isPending ? 'RETRACTING…' : 'RETRACT SHARE'}
              onClick={() => cancelShare.mutate(postedShareId)}
            />
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
