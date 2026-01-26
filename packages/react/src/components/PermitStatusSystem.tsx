import { useCofheActivePermit } from '@/hooks';
import { usePortalNavigation, usePortalStatuses, usePortalUI } from '@/stores';
import { truncateHash } from '@/utils';
import { type Permit } from '@cofhe/sdk/permits';
import { useEffect, useRef } from 'react';
import { FloatingButtonPage } from './FnxFloatingButton/pagesConfig/types';

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
    description: `Viewing data with ${truncateHash(permit.recipient, 4, 4)}`,
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
export const PermitStatusSystem = () => {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiredStatusShownRef = useRef(false);
  const expiringSoonStatusShownRef = useRef(false);
  const sharedStatusShownRef = useRef(false);
  const activePermit = useCofheActivePermit();

  useEffect(() => {
    const updateStatuses = (permit: Permit | undefined) => {
      if (permit == null) {
        if (expiredStatusShownRef.current) {
          hidePermitExpiredStatus();
          expiredStatusShownRef.current = false;
        }
        if (expiringSoonStatusShownRef.current) {
          hidePermitExpiringSoonStatus();
          expiringSoonStatusShownRef.current = false;
        }
        if (sharedStatusShownRef.current) {
          hidePermitSharedStatus();
          sharedStatusShownRef.current = false;
        }
        return;
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const expiration = permit.expiration;

      console.log('timestamp', timestamp);
      console.log('expiration', expiration);

      // Expired status
      const isExpired = expiration < timestamp;
      if (isExpired && !expiredStatusShownRef.current) {
        showPermitExpiredStatus();
        expiredStatusShownRef.current = true;
      }
      if (!isExpired && expiredStatusShownRef.current) {
        hidePermitExpiredStatus();
        expiredStatusShownRef.current = false;
      }

      // Expiring soon status
      const isExpiringSoon = expiration - timestamp < 1 * 60 * 60;
      if (!isExpired && isExpiringSoon && !expiringSoonStatusShownRef.current) {
        showPermitExpiringSoonStatus(permit);
        expiringSoonStatusShownRef.current = true;
      }
      if ((!isExpiringSoon && expiringSoonStatusShownRef.current) || isExpired) {
        hidePermitExpiringSoonStatus();
        expiringSoonStatusShownRef.current = false;
      }

      // Shared status
      const isShared = permit.type === 'sharing';
      if (isShared && !sharedStatusShownRef.current) {
        showPermitSharedStatus(permit);
        sharedStatusShownRef.current = true;
      }
      if (!isShared && sharedStatusShownRef.current) {
        hidePermitSharedStatus();
        sharedStatusShownRef.current = false;
      }
    };

    updateStatuses(activePermit?.permit);
    intervalRef.current = setInterval(() => {
      if (!activePermit) return;
      updateStatuses(activePermit.permit);
    }, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [activePermit]);

  return null;
};
