import { useCallback, useMemo } from 'react';
import { type Permit } from '@cofhe/sdk/permits';
import { useCofheActivePermit, useCofheAllPermits } from '../useCofhePermits';
import { FloatingButtonPage } from '@/components/FnxFloatingButton/pagesConfig/types';
import { useCofheNavigateToCreatePermit } from './useCofheNavigateToCreatePermit';
import { usePortalModals, usePortalNavigation } from '@/stores';
import { PortalModal } from '@/components/FnxFloatingButton/modals/types';

export type PermitStatus = 'active' | 'valid' | 'expired';
export type PermitActionId = 'generate' | 'delegate' | 'import';

export const usePermitsList = () => {
  const allPermits = useCofheAllPermits();
  const activePermit = useCofheActivePermit();
  const { navigateTo } = usePortalNavigation();
  const { openModal } = usePortalModals();

  const activePermitHash = useMemo(() => {
    return activePermit?.permit.hash;
  }, [activePermit?.permit.hash]);

  const selfPermits = useMemo<Permit[]>(() => {
    return allPermits.filter((permit) => permit.type === 'self');
  }, [allPermits]);

  const delegatedPermits = useMemo<Permit[]>(() => {
    return allPermits.filter((permit) => permit.type === 'sharing');
  }, [allPermits]);

  const importedPermits = useMemo<Permit[]>(() => {
    return allPermits.filter((permit) => permit.type === 'recipient');
  }, [allPermits]);

  const navigateToGeneratePermit = useCofheNavigateToCreatePermit();

  const handlePermitAction = useCallback(
    (actionId: PermitActionId) => {
      if (actionId === 'generate') {
        navigateToGeneratePermit();
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
    [navigateTo, navigateToGeneratePermit]
  );

  const handleOpenPermit = useCallback(
    (hash: string) => {
      openModal(PortalModal.PermitDetails, { hash });
    },
    [openModal]
  );

  return {
    activePermitHash,
    selfPermits,
    delegatedPermits,
    importedPermits,
    handlePermitAction,
    handleOpenPermit,
  };
};
