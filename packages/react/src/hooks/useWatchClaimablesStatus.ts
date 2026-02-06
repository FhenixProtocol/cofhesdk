import { usePortalNavigation, usePortalStatuses, usePortalUI } from '@/stores';

import { useEffect } from 'react';

import { useCofheClaimableTokens } from './useCofheClaimableTokens';
import { FloatingButtonPage } from '@/components/FnxFloatingButton/pagesConfig/types';

const CLAIMS_AVAILABLE_STATUS_ID = 'claims-available';
type Input = {
  onClick: () => void;
};
export const showClaimsAvailableStatus = ({ onClick }: Input) => {
  usePortalStatuses.getState().addStatus({
    id: CLAIMS_AVAILABLE_STATUS_ID,
    variant: 'info',
    title: '', // TODO: no title per design
    description: `You have unclaimed encrypted tokens`,
    action: {
      label: 'VIEW',
      onClick,
    },
  });
};
export const hideClaimsAvailableStatus = () => {
  usePortalStatuses.getState().removeStatus(CLAIMS_AVAILABLE_STATUS_ID);
};

export const useWatchClaimablesStatus = () => {
  const { totalTokensClaimable } = useCofheClaimableTokens();
  const { navigateTo } = usePortalNavigation();
  const { openPortal } = usePortalUI();

  useEffect(() => {
    const claimsAvailableStatusShown = usePortalStatuses.getState().hasStatus(CLAIMS_AVAILABLE_STATUS_ID);
    if (totalTokensClaimable > 0 && !claimsAvailableStatusShown) {
      showClaimsAvailableStatus({
        onClick: () => {
          openPortal();
          navigateTo(FloatingButtonPage.ClaimableTokens);
        },
      });
    }
  }, [navigateTo, openPortal, totalTokensClaimable]);
};
