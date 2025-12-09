import { useCallback, useMemo } from 'react';
import { ValidationUtils, type Permit } from '@cofhe/sdk/permits';
import { useCofheAllPermits, useCofheRemovePermit } from '../useCofhePermits.js';
import { FloatingButtonPage, useFnxFloatingButtonContext } from '../../components/FnxFloatingButton/FnxFloatingButtonContext.js';
import { useCopyFeedback } from '../useCopyFeedback.js';

export type PermitStatus = 'active' | 'expired';
export type PermitAction = 'copy' | 'delete';

export interface PermitRow {
  id: string;
  name: string;
  status: PermitStatus;
  actions: PermitAction[];
}

export type QuickActionId = 'generate' | 'receive';

export const usePermitsList = () => {
  const allPermits = useCofheAllPermits();
  const removePermit = useCofheRemovePermit();
  const { navigateBack, navigateTo } = useFnxFloatingButtonContext();
  const { isCopied, copyWithFeedback } = useCopyFeedback();

  const generatedPermits = useMemo<PermitRow[]>(() => {
    return allPermits
      .filter(({ permit }) => permit.type !== 'recipient')
      .map(({ hash, permit }) => {
        const status: PermitStatus = ValidationUtils.isExpired(permit) ? 'expired' : 'active';
        const actions: PermitAction[] = [];
        if (status === 'active') {
          if (permit.type === 'sharing') actions.push('copy');
        }
        actions.push('delete');
        return {
          id: hash,
          name: permit.name,
          status,
          actions,
        };
      });
  }, [allPermits]);

  const receivedPermits = useMemo<PermitRow[]>(() => {
    return allPermits
      .filter(({ permit }) => permit.type === 'recipient')
      .map(({ hash, permit }) => {
        const status: PermitStatus = ValidationUtils.isExpired(permit) ? 'expired' : 'active';
        return {
          id: hash,
          name: permit.name,
          status,
          actions: ['delete'],
        };
      });
  }, [allPermits]);

  const handleQuickAction = useCallback(
    (actionId: QuickActionId) => {
      if (actionId === 'generate') {
        navigateTo(FloatingButtonPage.GeneratePermits);
        return;
      }
      if (actionId === 'receive') {
        navigateTo(FloatingButtonPage.ReceivePermits);
      }
    },
    [navigateTo]
  );

  const handleGeneratedPermitAction = useCallback(
    (action: PermitAction, permitId: string) => {
      if (action === 'delete') {
        removePermit(permitId);
        return;
      }

      if (action === 'copy') {
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
        return;
      }

      if (action === 'refresh') {
        // TODO: implement refresh flow when available
        return;
      }
    },
    [removePermit, allPermits, copyWithFeedback]
  );

  const handleReceivedPermitDelete = useCallback(
    (permitId: string) => {
      removePermit(permitId);
    },
    [removePermit]
  );

  return {
    generatedPermits,
    receivedPermits,
    isCopied,
    handleQuickAction,
    handleGeneratedPermitAction,
    handleReceivedPermitDelete,
    navigateBack,
  };
};
