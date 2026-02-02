import { useCallback, useMemo } from 'react';
import { type Permit } from '@cofhe/sdk/permits';
import { useCofheActivePermit, useCofheAllPermits, useCofheRemovePermit } from '../useCofhePermits';
import { useCopyFeedback } from '../useCopyFeedback';
import { FloatingButtonPage } from '@/components/FnxFloatingButton/pagesConfig/types';
import { usePortalNavigation } from '@/stores';
import { useCofheNavigateToCreatePermit } from './useCofheNavigateToCreatePermit';
import { usePortalModals, usePortalNavigation } from '@/stores';
import { PortalModal } from '@/components/FnxFloatingButton/modals/types';

export type PermitStatus = 'active' | 'valid' | 'expired';
export type QuickActionId = 'generate' | 'delegate' | 'import';

export const usePermitsList = () => {
  const allPermits = useCofheAllPermits();
  const removePermit = useCofheRemovePermit();
  const activePermit = useCofheActivePermit();
  const { navigateBack, navigateTo } = usePortalNavigation();
  const { openModal } = usePortalModals();
  const { isCopied, copyWithFeedback } = useCopyFeedback();

  const activePermitHash = useMemo(() => {
    return activePermit?.hash;
  }, [activePermit?.hash]);

  const generatedPermits = useMemo<{ permit: Permit; hash: string }[]>(() => {
    return allPermits.filter(({ permit }) => permit.type !== 'recipient');
  }, [allPermits]);

  const receivedPermits = useMemo<{ permit: Permit; hash: string }[]>(() => {
    return allPermits.filter(({ permit }) => permit.type === 'recipient');
  }, [allPermits]);

  const navigateToGeneratePermit = useCofheNavigateToCreatePermit();

  const handleQuickAction = useCallback(
    (actionId: QuickActionId) => {
      if (actionId === 'generate') {
        navigateToGeneratePermit();
        return;
      }
      if (actionId === 'delegate') {
        navigateTo(FloatingButtonPage.GeneratePermits, {});
        return;
      }
      if (actionId === 'import') {
        navigateTo(FloatingButtonPage.ReceivePermits);
      }
    },
    [navigateTo, navigateToGeneratePermit]
  );

  const handlePermitSelect = useCallback(
    (permitId: string) => {
      openModal(PortalModal.PermitDetails, { hash: permitId });
    },
    [openModal]
  );

  const handleDelete = useCallback(
    (permitId: string) => {
      removePermit(permitId);
    },
    [removePermit]
  );

  const handleCopy = useCallback(
    (permitId: string) => {
      const permit = allPermits.find((p) => p.hash === permitId);
      if (!permit) return;
      const { type, issuer, recipient, issuerSignature, expiration, validatorContract, validatorId } = permit.permit;
      const textToCopy = JSON.stringify(
        {
          type,
          issuer,
          recipient,
          issuerSignature,
          expiration,
          validatorContract,
          validatorId,
        },
        null,
        2
      );
      void copyWithFeedback(permitId, textToCopy);
    },
    [allPermits, copyWithFeedback]
  );

  return {
    activePermitHash,
    generatedPermits,
    receivedPermits,
    isCopied,
    handleQuickAction,
    handleCopy,
    handleDelete,
    handlePermitSelect,
    navigateBack,
  };
};
