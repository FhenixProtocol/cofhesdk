import { usePortalStatuses } from '@/stores';

import { useEffect } from 'react';

import { useCofheClaimableTokens } from './useCofheClaimableTokens';

const CLAIMS_AVAILABLE_STATUS_ID = 'claims-available';
export const showClaimsAvailableStatus = () => {
  usePortalStatuses.getState().addStatus({
    id: CLAIMS_AVAILABLE_STATUS_ID,
    variant: 'info',
    title: '', // TODO: no title per design
    description: `You have unclaimed encrypted tokens`,
  });
};
export const hideClaimsAvailableStatus = () => {
  usePortalStatuses.getState().removeStatus(CLAIMS_AVAILABLE_STATUS_ID);
};

export const useWatchClaimablesStatus = () => {
  const { totalTokensClaimable } = useCofheClaimableTokens();

  useEffect(() => {
    const claimsAvailableStatusShown = usePortalStatuses.getState().hasStatus(CLAIMS_AVAILABLE_STATUS_ID);
    if (totalTokensClaimable > 0 && !claimsAvailableStatusShown) {
      showClaimsAvailableStatus();
    }
  }, [totalTokensClaimable]);
};
