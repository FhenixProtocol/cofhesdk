import { useFnxFloatingButtonContext } from '@/components/FnxFloatingButton/FnxFloatingButtonContext';
import { FloatingButtonPage } from '@/components/FnxFloatingButton/pagesConfig/types';
import { useCallback } from 'react';

type Input = {
  ReasonBody?: React.FC;
};
export const useCofheCreatePermit = ({ ReasonBody }: Input) => {
  const { navigateTo, navigateBack, expandPanel, isExpanded } = useFnxFloatingButtonContext();

  return useCallback(() => {
    if (!isExpanded) expandPanel();
    navigateTo(FloatingButtonPage.GeneratePermits, {
      pageProps: { overridingBody: ReasonBody ? <ReasonBody /> : undefined, onSuccessNavigateTo: () => navigateBack() },
      navigateParams: { skipPagesHistory: true },
    });
  }, [ReasonBody, expandPanel, isExpanded, navigateBack, navigateTo]);
};
