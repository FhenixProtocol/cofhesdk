import { useCofheActivePermit } from '@/hooks';
import { usePortalNavigation, usePortalStatuses, usePortalUI } from '@/stores';
import { truncateHash } from '@/utils';
import { type Permit } from '@cofhe/sdk/permits';
import { useEffect, useRef } from 'react';
import { FloatingButtonPage } from '../components/FnxFloatingButton/pagesConfig/types';
import { usePortalPersisted } from '@/stores/portalPersisted';

export const showMissingPermitStatus = () => {
  usePortalStatuses.getState().addStatus({
    id: 'missing-permit',
    variant: 'error',
    title: 'Missing permit',
    description: 'Select or create a new permit',
    action: {
      label: 'FIX',
      onClick: () => {
        usePortalUI.getState().openPortal();
        usePortalNavigation.getState().navigateTo(FloatingButtonPage.Permits);
      },
    },
  });
};

export const hideMissingPermitStatus = () => {
  usePortalStatuses.getState().removeStatus('missing-permit');
};

export const showPermitExpiredStatus = () => {
  usePortalStatuses.getState().addStatus({
    id: 'permit-expired',
    variant: 'error',
    title: 'Permit expired',
    description: 'Select or create a new permit',
    action: {
      label: 'FIX',
      onClick: () => {
        usePortalUI.getState().openPortal();
        usePortalNavigation.getState().navigateTo(FloatingButtonPage.Permits);
      },
    },
  });
};
export const hidePermitExpiredStatus = () => {
  usePortalStatuses.getState().removeStatus('permit-expired');
};

export const showPermitExpiringSoonStatus = (permit: Permit) => {
  usePortalStatuses.getState().addStatus({
    id: 'permit-expiring-soon',
    variant: 'warning',
    title: 'Permit expiring soon',
    description: `Expires at ${new Date(permit.expiration * 1000).toLocaleTimeString()}`,
    action: {
      label: 'FIX',
      onClick: () => {
        usePortalUI.getState().openPortal();
        usePortalNavigation.getState().navigateTo(FloatingButtonPage.Permits);
      },
    },
  });
};
export const hidePermitExpiringSoonStatus = () => {
  usePortalStatuses.getState().removeStatus('permit-expiring-soon');
};

export const showPermitSharedStatus = (permit: Permit) => {
  usePortalStatuses.getState().addStatus({
    id: 'permit-shared',
    variant: 'info',
    title: 'Shared permit active',
    description: `Viewing data of ${truncateHash(permit.issuer, 4, 4)}`,
  });
};
export const hidePermitSharedStatus = () => {
  usePortalStatuses.getState().removeStatus('permit-shared');
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

  useEffect(() => {
    const updateStatuses = (permit: Permit | undefined) => {
      const hasCreatedFirstPermit = usePortalPersisted.getState().hasCreatedFirstPermit;
      const missingPermitStatusShown = usePortalStatuses.getState().hasStatus('missing-permit');
      const expiredStatusShown = usePortalStatuses.getState().hasStatus('permit-expired');
      const expiringSoonStatusShown = usePortalStatuses.getState().hasStatus('permit-expiring-soon');
      const sharedStatusShown = usePortalStatuses.getState().hasStatus('permit-shared');

      if (permit == null) {
        if (hasCreatedFirstPermit && !missingPermitStatusShown) {
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
  }, [activePermit]);
};
