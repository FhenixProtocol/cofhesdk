import { useCallback, useMemo } from 'react';
import { ValidationUtils, type Permit } from '@cofhe/sdk/permits';
import { useCofheAllPermits, useCofheRemovePermit } from '../useCofhePermits.js';
import {
  FloatingButtonPage,
  useFnxFloatingButtonContext,
} from '../../components/FnxFloatingButton/FnxFloatingButtonContext.js';
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

  const handlePermitSelect = useCallback(
    (permitId: string) => {
      navigateTo(FloatingButtonPage.PermitDetails, { selectedPermitHash: permitId });
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
