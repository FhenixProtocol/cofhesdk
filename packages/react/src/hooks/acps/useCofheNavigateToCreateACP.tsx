import type { GenerateACPPageProps } from '@/components/CofheFloatingButton/pages/acps/GenerateACPPage/types';
import { FloatingButtonPage } from '@/components/CofheFloatingButton/pagesConfig/types';
import { usePortalNavigation, usePortalUI } from '@/stores';

import { useCallback } from 'react';

type Input = {
  cause?: GenerateACPPageProps['cause'];
};
export const useCofheNavigateToCreateACP = () => {
  const { navigateTo, navigateBack } = usePortalNavigation();
  const { portalOpen, openPortal } = usePortalUI();

  return useCallback(
    ({ cause }: Input = {}) => {
      if (!portalOpen) openPortal();
      navigateTo(FloatingButtonPage.GenerateACPs, {
        pageProps: { cause, onSuccessNavigateTo: () => navigateBack() },
        navigateParams: { skipPagesHistory: true },
      });
    },
    [openPortal, portalOpen, navigateBack, navigateTo]
  );
};
