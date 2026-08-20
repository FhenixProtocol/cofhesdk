import { useCallback, useMemo } from 'react';
import { type ACP } from '@cofhe/sdk/acps';
import { useCofheActiveACP, useCofheAllACPs } from '../useCofheACPs';
import { FloatingButtonPage } from '@/components/CofheFloatingButton/pagesConfig/types';
import { useCofheNavigateToCreateACP } from './useCofheNavigateToCreateACP';
import { usePortalModals, usePortalNavigation } from '@/stores';
import { PortalModal } from '@/components/CofheFloatingButton/modals/types';

export type ACPStatus = 'active' | 'valid' | 'expired';
export type ACPActionId = 'generate' | 'delegate' | 'import';

export const useACPsList = () => {
  const allACPs = useCofheAllACPs();
  const activeACP = useCofheActiveACP();
  const { navigateTo } = usePortalNavigation();
  const { openModal } = usePortalModals();

  const activeACPHash = useMemo(() => {
    return activeACP?.acp.hash;
  }, [activeACP?.acp.hash]);

  const selfACPs = useMemo<ACP[]>(() => {
    return allACPs.filter((acp) => acp.type === 'self');
  }, [allACPs]);

  const delegatedACPs = useMemo<ACP[]>(() => {
    return allACPs.filter((acp) => acp.type === 'sharing');
  }, [allACPs]);

  const importedACPs = useMemo<ACP[]>(() => {
    return allACPs.filter((acp) => acp.type === 'recipient');
  }, [allACPs]);

  const navigateToGenerateACP = useCofheNavigateToCreateACP();

  const handleACPAction = useCallback(
    (actionId: ACPActionId) => {
      if (actionId === 'generate') {
        navigateToGenerateACP();
        return;
      }
      if (actionId === 'delegate') {
        navigateTo(FloatingButtonPage.DelegateACPs, {});
        return;
      }
      if (actionId === 'import') {
        navigateTo(FloatingButtonPage.ReceiveACPs);
      }
    },
    [navigateTo, navigateToGenerateACP]
  );

  const handleOpenACP = useCallback(
    (hash: string) => {
      openModal(PortalModal.ACPDetails, { hash });
    },
    [openModal]
  );

  return {
    activeACPHash,
    selfACPs,
    delegatedACPs,
    importedACPs,
    handleACPAction,
    handleOpenACP,
  };
};
