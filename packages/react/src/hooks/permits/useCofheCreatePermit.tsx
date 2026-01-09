import { useFnxFloatingButtonContext } from '@/components/FnxFloatingButton/FnxFloatingButtonContext';
import { FloatingButtonPage } from '@/components/FnxFloatingButton/pagesConfig/simpleTypes';

import { useCallback } from 'react';

type Input = {
  ReasonBody?: React.FC;
};
export const useCofheCreatePermit = ({ ReasonBody }: Input) => {
  const { navigateTo, navigateBack, openPortal, portalOpen } = useFnxFloatingButtonContext();

  return useCallback(() => {
    if (!portalOpen) openPortal();
    navigateTo(FloatingButtonPage.GeneratePermits, {
      pageProps: { overridingBody: ReasonBody ? <ReasonBody /> : undefined, onSuccessNavigateTo: () => navigateBack() },
      navigateParams: { skipPagesHistory: true },
    });
  }, [ReasonBody, openPortal, portalOpen, navigateBack, navigateTo]);
};
