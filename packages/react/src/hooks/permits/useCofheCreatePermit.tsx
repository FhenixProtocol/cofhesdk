import { FloatingButtonPage } from '@/components/FnxFloatingButton/pagesConfig/types';
import { usePortalStore } from '@/stores/portalStore';

import { useCallback } from 'react';

type Input = {
  ReasonBody?: React.FC;
};
export const useCofheCreatePermit = ({ ReasonBody }: Input) => {
  const { navigateTo, navigateBack, openPortal, portalOpen } = usePortalStore();

  return useCallback(() => {
    if (!portalOpen) openPortal();
    navigateTo(FloatingButtonPage.GeneratePermits, {
      pageProps: { overridingBody: ReasonBody ? <ReasonBody /> : undefined, onSuccessNavigateTo: () => navigateBack() },
      navigateParams: { skipPagesHistory: true },
    });
  }, [ReasonBody, openPortal, portalOpen, navigateBack, navigateTo]);
};
