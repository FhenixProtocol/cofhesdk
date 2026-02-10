import { useCofheActivePermit } from '@/hooks';
import { usePortalNavigation, usePortalStatuses, usePortalUI } from '@/stores';
import { truncateHash } from '@/utils';
import { type Permit } from '@cofhe/sdk/permits';
import { useEffect, useRef } from 'react';
import { FloatingButtonPage } from '../components/FnxFloatingButton/pagesConfig/types';
import { usePortalPersisted } from '@/stores/portalPersisted';
import { useCofheAccount } from './useCofheConnection';

const STATUS_ID_MISSING_PERMIT = 'missing-permit';
const STATUS_ID_PERMIT_EXPIRED = 'permit-expired';
const STATUS_ID_PERMIT_EXPIRING_SOON = 'permit-expiring-soon';
const STATUS_ID_PERMIT_SHARED = 'permit-shared';

export const showMissingPermitStatus = () => {
  usePortalStatuses.getState().addStatus({
    id: STATUS_ID_MISSING_PERMIT,
    variant: 'error',
    title: 'Missing permit',
    description: 'Select or create a new permit',
    action: {
      label: 'FIX',
      onClick: () => {
        usePortalUI.getState().openPortal();
        usePortalNavigation.getState().replace(FloatingButtonPage.Permits);
      },
    },
  });
};

export const hideMissingPermitStatus = () => {
  usePortalStatuses.getState().removeStatus(STATUS_ID_MISSING_PERMIT);
};

export const showPermitExpiredStatus = () => {
  usePortalStatuses.getState().addStatus({
    id: STATUS_ID_PERMIT_EXPIRED,
    variant: 'error',
    title: 'Permit expired',
    description: 'Select or create a new permit',
    action: {
      label: 'FIX',
      onClick: () => {
        usePortalUI.getState().openPortal();
        usePortalNavigation.getState().replace(FloatingButtonPage.Permits);
      },
    },
  });
};
export const hidePermitExpiredStatus = () => {
  usePortalStatuses.getState().removeStatus(STATUS_ID_PERMIT_EXPIRED);
};

export const showPermitExpiringSoonStatus = (permit: Permit) => {
  usePortalStatuses.getState().addStatus({
    id: STATUS_ID_PERMIT_EXPIRING_SOON,
    variant: 'warning',
    title: 'Permit expiring soon',
    description: `Expires at ${new Date(permit.expiration * 1000).toLocaleTimeString()}`,
    action: {
      label: 'FIX',
      onClick: () => {
        usePortalUI.getState().openPortal();
        usePortalNavigation.getState().replace(FloatingButtonPage.Permits);
      },
    },
  });
};
export const hidePermitExpiringSoonStatus = () => {
  usePortalStatuses.getState().removeStatus(STATUS_ID_PERMIT_EXPIRING_SOON);
};

export const showPermitSharedStatus = (permit: Permit) => {
  usePortalStatuses.getState().addStatus({
    id: STATUS_ID_PERMIT_SHARED,
    variant: 'info',
    title: 'Imported permit active',
    description: `Viewing ${truncateHash(permit.issuer, 4, 4)}'s data`,
  });
};
export const hidePermitSharedStatus = () => {
  usePortalStatuses.getState().removeStatus(STATUS_ID_PERMIT_SHARED);
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
  const account = useCofheAccount();

  useEffect(() => {
    const updateStatuses = (permit: Permit | undefined) => {
      const hasCreatedFirstPermit = usePortalPersisted.getState().hasCreatedFirstPermit;
      const missingPermitStatusShown = usePortalStatuses.getState().hasStatus(STATUS_ID_MISSING_PERMIT);
      const expiredStatusShown = usePortalStatuses.getState().hasStatus(STATUS_ID_PERMIT_EXPIRED);
      const expiringSoonStatusShown = usePortalStatuses.getState().hasStatus(STATUS_ID_PERMIT_EXPIRING_SOON);
      const sharedStatusShown = usePortalStatuses.getState().hasStatus(STATUS_ID_PERMIT_SHARED);

      if (permit == null) {
        if (hasCreatedFirstPermit && !missingPermitStatusShown && account) {
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
  }, [activePermit, account]);
};
