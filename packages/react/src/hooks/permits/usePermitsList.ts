import { useCallback, useMemo } from 'react';
import { type Permit } from '@cofhe/sdk/permits';
import { useCofheActivePermit, useCofheAllPermits, useCofheRemovePermit } from '../useCofhePermits';
import { useCopyFeedback } from '../useCopyFeedback';
import { FloatingButtonPage } from '@/components/FnxFloatingButton/pagesConfig/types';
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

  const selfPermits = useMemo<{ permit: Permit; hash: string }[]>(() => {
    return allPermits.filter(({ permit }) => permit.type === 'self');
  }, [allPermits]);

  const delegatedPermits = useMemo<{ permit: Permit; hash: string }[]>(() => {
    return allPermits.filter(({ permit }) => permit.type === 'sharing');
  }, [allPermits]);

  const importedPermits = useMemo<{ permit: Permit; hash: string }[]>(() => {
    return allPermits.filter(({ permit }) => permit.type === 'recipient');
  }, [allPermits]);

  const handleQuickAction = useCallback(
    (actionId: QuickActionId) => {
      if (actionId === 'generate') {
        navigateTo(FloatingButtonPage.GeneratePermits, {});
        return;
      }
      if (actionId === 'delegate') {
        navigateTo(FloatingButtonPage.DelegatePermits, {});
        return;
      }
      if (actionId === 'import') {
        navigateTo(FloatingButtonPage.ReceivePermits);
      }
    },
    [navigateTo]
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
    selfPermits,
    delegatedPermits,
    importedPermits,
    isCopied,
    handleQuickAction,
    handleCopy,
    handleDelete,
    handlePermitSelect,
    navigateBack,
  };
};
