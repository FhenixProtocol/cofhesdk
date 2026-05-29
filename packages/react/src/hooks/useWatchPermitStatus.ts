import { useCofheActivePermit } from '@/hooks';
import { COFHE_STATUS_IDS } from '@/components/CofheFloatingButton/types';
import { usePortalStatuses } from '@/stores';
import { usePortalPersisted } from '@/stores/portalPersisted';
import { truncateHash } from '@/utils';
import { type Permit } from '@cofhe/sdk/permits';
import { useEffect, useRef } from 'react';
import { useCofheIsConnected } from './useCofheConnection';

export const showMissingPermitStatus = () => {
  usePortalStatuses.getState().addStatus({
    id: COFHE_STATUS_IDS.missingPermit,
    variant: 'error',
    title: 'Missing permit',
    description: 'Select or create a new permit',
    action: {
      label: 'FIX',
      intent: 'open-permits',
    },
  });
};

export const hideMissingPermitStatus = () => {
  usePortalStatuses.getState().removeStatus(COFHE_STATUS_IDS.missingPermit);
};

export const showPermitExpiredStatus = () => {
  usePortalStatuses.getState().addStatus({
    id: COFHE_STATUS_IDS.permitExpired,
    variant: 'error',
    title: 'Permit expired',
    description: 'Select or create a new permit',
    action: {
      label: 'FIX',
      intent: 'open-permits',
    },
  });
};
export const hidePermitExpiredStatus = () => {
  usePortalStatuses.getState().removeStatus(COFHE_STATUS_IDS.permitExpired);
};

export const showPermitExpiringSoonStatus = (permit: Permit) => {
  usePortalStatuses.getState().addStatus({
    id: COFHE_STATUS_IDS.permitExpiringSoon,
    variant: 'warning',
    title: 'Permit expiring soon',
    description: `Expires at ${new Date(permit.expiration * 1000).toLocaleTimeString()}`,
    action: {
      label: 'FIX',
      intent: 'open-permits',
    },
  });
};
export const hidePermitExpiringSoonStatus = () => {
  usePortalStatuses.getState().removeStatus(COFHE_STATUS_IDS.permitExpiringSoon);
};

export const showPermitSharedStatus = (permit: Permit) => {
  usePortalStatuses.getState().addStatus({
    id: COFHE_STATUS_IDS.permitShared,
    variant: 'info',
    title: 'Imported permit active',
    description: `Viewing ${truncateHash(permit.issuer, 4, 4)}'s data`,
  });
};
export const hidePermitSharedStatus = () => {
  usePortalStatuses.getState().removeStatus(COFHE_STATUS_IDS.permitShared);
};

/**
 * Watches the user's active permit and displays statuses if:
 * - Warning - permit will expire in less that 1 hour
 * - Error - permit has expired
 * - Info - using a shared permit
 */
export const useWatchPermitStatus = () => {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activePermit = useCofheActivePermit();
  const connected = useCofheIsConnected();

  useEffect(() => {
    const updateStatuses = (permit: Permit | undefined) => {
      const hasCreatedFirstPermit = usePortalPersisted.getState().hasCreatedFirstPermit;
      const missingPermitStatusShown = usePortalStatuses.getState().hasStatus(COFHE_STATUS_IDS.missingPermit);
      const expiredStatusShown = usePortalStatuses.getState().hasStatus(COFHE_STATUS_IDS.permitExpired);
      const expiringSoonStatusShown = usePortalStatuses.getState().hasStatus(COFHE_STATUS_IDS.permitExpiringSoon);
      const sharedStatusShown = usePortalStatuses.getState().hasStatus(COFHE_STATUS_IDS.permitShared);

      if (permit == null) {
        if (hasCreatedFirstPermit && !missingPermitStatusShown && connected) {
          showMissingPermitStatus();
        }
        if (expiredStatusShown) {
          hidePermitExpiredStatus();
        }
        if (expiringSoonStatusShown) {
          hidePermitExpiringSoonStatus();
        }
        if (sharedStatusShown) {
          hidePermitSharedStatus();
        }
        return;
      }

      if (permit != null && missingPermitStatusShown) {
        hideMissingPermitStatus();
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const expiration = permit.expiration;

      // Expired status
      const isExpired = expiration < timestamp;
      if (isExpired && !expiredStatusShown) {
        showPermitExpiredStatus();
      }
      if (!isExpired && expiredStatusShown) {
        hidePermitExpiredStatus();
      }

      // Expiring soon status
      const isExpiringSoon = expiration - timestamp < 1 * 60 * 60;
      if (!isExpired && isExpiringSoon && !expiringSoonStatusShown) {
        showPermitExpiringSoonStatus(permit);
      }
      if ((!isExpiringSoon && expiringSoonStatusShown) || isExpired) {
        hidePermitExpiringSoonStatus();
      }

      // Shared status
      const isShared = permit.type === 'recipient';
      if (isShared && !sharedStatusShown) {
        showPermitSharedStatus(permit);
      }
      if (!isShared && sharedStatusShown) {
        hidePermitSharedStatus();
      }
    };

    updateStatuses(activePermit?.permit);
    intervalRef.current = setInterval(() => {
      updateStatuses(activePermit?.permit);
    }, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [activePermit, connected]);
};
