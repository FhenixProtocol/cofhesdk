import { usePortalModals, usePortalNavigation, usePortalStatuses } from '@/stores';

import { useEffect } from 'react';

import { useCofheClaimableTokens } from './useCofheClaimableTokens';
import { PortalModal } from '@/components/FnxFloatingButton/modals/types';
import { FloatingButtonPage } from '@/components/FnxFloatingButton/pagesConfig/types';

const CLAIMS_AVAILABLE_STATUS_ID = 'claims-available';
type Input = {
  onClickClaim: () => void;
};
export const showClaimsAvailableStatus = ({ onClickClaim }: Input) => {
  usePortalStatuses.getState().addStatus({
    id: CLAIMS_AVAILABLE_STATUS_ID,
    variant: 'info',
    title: '', // TODO: no title per design
    description: `You have unclaimed encrypted tokens`,
    action: {
      label: 'Claim',
      onClick: onClickClaim,
    },
  });
};
export const hideClaimsAvailableStatus = () => {
  usePortalStatuses.getState().removeStatus(CLAIMS_AVAILABLE_STATUS_ID);
};

export const useWatchClaimablesStatus = () => {
  const { totalTokensClaimable } = useCofheClaimableTokens();
  const { navigateTo } = usePortalNavigation();

  useEffect(() => {
    const claimsAvailableStatusShown = usePortalStatuses.getState().hasStatus(CLAIMS_AVAILABLE_STATUS_ID);
    if (totalTokensClaimable > 0 && !claimsAvailableStatusShown) {
      showClaimsAvailableStatus({
        onClickClaim: () => navigateTo(FloatingButtonPage.ClaimableTokens),
      });
    }
  }, [navigateTo, totalTokensClaimable]);
};
