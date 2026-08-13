import { FaCheck, FaRegCopy } from 'react-icons/fa6';
import { CloseIcon } from '@/components/Icons';
import { useACPDetailsPage, useShareOnChain, useRemoveShare } from '@/hooks/acps/index.js';
import { PageContainer } from '@/components/CofheFloatingButton/components/PageContainer';
import { PortalModal, type PortalModalStateMap } from './types';
import { Button } from '../components';
import { InfoModalButton } from './InfoModalButton';
import { usePortalModals, usePortalToasts } from '@/stores';
import type { ACPType } from '@cofhe/sdk/acps';
import { ACPCard } from '../components/ACPCard';
import { truncateAddress } from '@/utils';
import { useCallback, useState } from 'react';

const ACPTypeLabel: Record<ACPType, string> = {
  self: 'Self',
  sharing: 'Delegated',
  recipient: 'Imported',
};

const NoACPFoundModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <PageContainer
      header={
        <div className="flex items-center gap-2 text-base font-semibold tracking-tight text-[#0E2F3F] transition-opacity hover:opacity-80 dark:text-white">
          No acp found
        </div>
      }
      content={
        <div className="flex flex-col gap-3">
          <p>No acp found</p>
        </div>
      }
      footer={<Button label="CLOSE" onClick={onClose} variant="ghost" />}
    />
  );
};

export const ACPDetailsModal: React.FC<PortalModalStateMap[PortalModal.ACPDetails]> = ({ hash, onClose }) => {
  const {
    acp,
    expirationInfo,
    isActiveACP,
    isShareableACP,
    handleSelectActiveACP,
    handleCopySharableACPData,
    handleRemoveACP,
    isCopyComplete,
  } = useACPDetailsPage(hash);
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
    if (acp == null) return;
    const { shareId } = await shareOnChain.mutateAsync(acp).catch(() => ({ shareId: null }) as never);
    if (shareId) {
      setPostedShareId(shareId);
      addToast({
        variant: 'success',
        title: 'Shared on-chain',
        description: 'The recipient will see this share in any cofhesdk-enabled app.',
      });
    }
  }, [acp, shareOnChain, addToast]);

  const handleACPSelect = useCallback(() => {
    handleSelectActiveACP();
    onClose();
  }, [handleSelectActiveACP, onClose]);

  const handleACPShare = useCallback(() => {
    handleCopySharableACPData();
  }, [handleCopySharableACPData]);

  const handleACPDelete = useCallback(async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    handleRemoveACP();
    onClose();
  }, [confirmDelete, onClose, handleRemoveACP]);

  if (acp == null) {
    return <NoACPFoundModal onClose={onClose} />;
  }

  return (
    <PageContainer
      isModal
      header={
        <ACPCard
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
        acp != null && (
          <div className="flex flex-col gap-3">
            <p className="flex flex-row gap-2 text-sm">
              Type: <b>{ACPTypeLabel[acp.type]}</b>
              <InfoModalButton onClick={() => openModal(PortalModal.ACPTypeInfo, { type: acp.type })} />
            </p>

            <p className="text-sm">
              Expires in: <b>{expirationInfo.label}</b>
            </p>

            {acp.type === 'self' && (
              <p className="text-sm">
                To select this acp for usage, click the <b>"SELECT"</b> button below. When this acp is active, you will
                be able to view your own encrypted data.
              </p>
            )}
            {acp.type === 'sharing' && (
              <p className="text-sm">
                To share this acp with <b>recipient</b>, click the <b>"SHARE"</b> button below to copy the acp data to
                your clipboard. Share the copied acp data with <b>recipient</b> to grant them access to your encrypted
                data.
                <br />
                <br />
                <i>
                  <b>Note:</b> The copied acp data is not sensitive and can be sent to recipient via any communication
                  channel.
                </i>
              </p>
            )}
            {acp.type === 'recipient' && (
              <p className="text-sm">
                To select this imported acp for usage, click the <b>"SELECT"</b> button below. When this acp is active,
                you will be able to view <b>issuer</b>'s ({truncateAddress(acp.issuer, 4, 4)}) encrypted data.
              </p>
            )}
          </div>
        )
      }
      footer={
        <div className="flex flex-row gap-3 w-full">
          {isShareableACP && (
            <Button variant="primary" onClick={handleACPShare}>
              {isCopyComplete ? <FaCheck /> : <FaRegCopy />}
              {isCopyComplete ? 'COPIED' : 'SHARE'}
            </Button>
          )}
          {isShareableACP && postedShareId == null && (
            <Button
              variant="primary"
              disabled={shareOnChain.isPending}
              aria-busy={shareOnChain.isPending}
              label={shareOnChain.isPending ? 'SHARING…' : 'SHARE ON-CHAIN'}
              onClick={handleShareOnChain}
            />
          )}
          {isShareableACP && postedShareId != null && (
            <Button
              disabled={cancelShare.isPending}
              aria-busy={cancelShare.isPending}
              label={cancelShare.isPending ? 'RETRACTING…' : 'RETRACT SHARE'}
              onClick={() => cancelShare.mutate(postedShareId)}
            />
          )}
          {!isShareableACP && (
            <Button
              variant="primary"
              label={isActiveACP ? 'ALREADY ACTIVE' : 'SELECT'}
              onClick={handleACPSelect}
              disabled={isActiveACP}
            />
          )}
          <Button label={confirmDelete ? 'CONFIRM' : 'DELETE'} onClick={handleACPDelete} variant="error" />
          <Button label="CLOSE" onClick={onClose} variant="ghost" />
        </div>
      }
    />
  );
};
