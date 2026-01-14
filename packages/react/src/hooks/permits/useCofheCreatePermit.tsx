import { FloatingButtonPage } from '@/components/FnxFloatingButton/pagesConfig/types';
import { usePortalNavigation, usePortalUI } from '@/stores';

import { useCallback } from 'react';

type Input = {
  ReasonBody?: React.FC;
};
export const useCofheCreatePermit = ({ ReasonBody }: Input) => {
  const { navigateTo, navigateBack } = usePortalNavigation();
  const { portalOpen, openPortal } = usePortalUI();

  return useCallback(() => {
    if (!portalOpen) openPortal();
    navigateTo(FloatingButtonPage.GeneratePermits, {
      pageProps: { overridingBody: ReasonBody ? <ReasonBody /> : undefined, onSuccessNavigateTo: () => navigateBack() },
      navigateParams: { skipPagesHistory: true },
    });
  }, [ReasonBody, openPortal, portalOpen, navigateBack, navigateTo]);
};
