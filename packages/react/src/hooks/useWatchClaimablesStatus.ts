import { usePortalStatuses } from '@/stores';
import { COFHE_STATUS_IDS } from '@/components/CofheFloatingButton/types';

import { useEffect } from 'react';

import { useCofheClaimableTokens } from './useCofheClaimableTokens';

export const showClaimsAvailableStatus = () => {
  usePortalStatuses.getState().addStatus({
    id: COFHE_STATUS_IDS.claimsAvailable,
    variant: 'info',
    title: '', // TODO: no title per design
    description: `You have unclaimed encrypted tokens`,
    action: {
      label: 'VIEW',
      intent: 'open-claimable-tokens',
    },
  });
};
export const hideClaimsAvailableStatus = () => {
  usePortalStatuses.getState().removeStatus(COFHE_STATUS_IDS.claimsAvailable);
};

export const useWatchClaimablesStatus = () => {
  const { totalTokensClaimable } = useCofheClaimableTokens();

  useEffect(() => {
    const claimsAvailableStatusShown = usePortalStatuses.getState().hasStatus(COFHE_STATUS_IDS.claimsAvailable);
    if (totalTokensClaimable > 0 && !claimsAvailableStatusShown) {
      showClaimsAvailableStatus();
    }

    if (totalTokensClaimable === 0 && claimsAvailableStatusShown) {
      hideClaimsAvailableStatus();
    }
  }, [totalTokensClaimable]);
};
