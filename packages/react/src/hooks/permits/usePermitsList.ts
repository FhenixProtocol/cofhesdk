import { useCallback, useMemo } from 'react';
import { type Permit } from '@cofhe/sdk/permits';
import { useCofheAllPermits, useCofheRemovePermit } from '../useCofhePermits';
import { useCopyFeedback } from '../useCopyFeedback';
import { FloatingButtonPage } from '@/components/FnxFloatingButton/pagesConfig/types';
import { usePortalStore } from '@/stores/portalStore';

export type PermitStatus = 'active' | 'expired';

export type QuickActionId = 'generate' | 'receive';

export const usePermitsList = () => {
  const allPermits = useCofheAllPermits();
  const removePermit = useCofheRemovePermit();
  const { navigateBack, navigateTo } = usePortalStore();
  const { isCopied, copyWithFeedback } = useCopyFeedback();

  const generatedPermits = useMemo<{ permit: Permit; hash: string }[]>(() => {
    return allPermits.filter(({ permit }) => permit.type !== 'recipient');
  }, [allPermits]);

  const receivedPermits = useMemo<{ permit: Permit; hash: string }[]>(() => {
    return allPermits.filter(({ permit }) => permit.type === 'recipient');
  }, [allPermits]);

  const handleQuickAction = useCallback(
    (actionId: QuickActionId) => {
      if (actionId === 'generate') {
        navigateTo(FloatingButtonPage.GeneratePermits, {});
        return;
      }
      if (actionId === 'receive') {
        navigateTo(FloatingButtonPage.ReceivePermits);
      }
    },
    [navigateTo]
  );

  const handlePermitSelect = useCallback(
    (permitId: string) => {
      navigateTo(FloatingButtonPage.PermitDetails, { pageProps: { selectedPermitHash: permitId } });
    },
    [navigateTo]
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
