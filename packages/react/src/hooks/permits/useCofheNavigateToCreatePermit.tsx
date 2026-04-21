import type { GeneratePermitPageProps } from '@/components/CofheFloatingButton/pages/permits/GeneratePermitPage/types';
import { FloatingButtonPage } from '@/components/CofheFloatingButton/pagesConfig/types';
import { usePortalNavigation, usePortalUI } from '@/stores';

import { useCallback } from 'react';

type Input = {
  cause?: GeneratePermitPageProps['cause'];
};
export const useCofheNavigateToCreatePermit = () => {
  const { navigateTo, navigateBack } = usePortalNavigation();
  const { portalOpen, openPortal } = usePortalUI();

  return useCallback(
    ({ cause }: Input = {}) => {
      if (!portalOpen) openPortal();
      navigateTo(FloatingButtonPage.GeneratePermits, {
        pageProps: { cause, onSuccessNavigateTo: () => navigateBack() },
        navigateParams: { skipPagesHistory: true },
      });
    },
    [openPortal, portalOpen, navigateBack, navigateTo]
  );
};
