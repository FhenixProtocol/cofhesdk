import { useCofheActiveACP } from '@/hooks';
import { COFHE_STATUS_IDS } from '@/components/CofheFloatingButton/types';
import { usePortalStatuses } from '@/stores';
import { usePortalPersisted } from '@/stores/portalPersisted';
import { truncateHash } from '@/utils';
import { type ACP } from '@cofhe/sdk/acps';
import { useEffect, useRef } from 'react';
import { useCofheIsConnected } from './useCofheConnection';

export const showMissingACPStatus = () => {
  usePortalStatuses.getState().addStatus({
    id: COFHE_STATUS_IDS.missingACP,
    variant: 'error',
    title: 'Missing acp',
    description: 'Select or create a new acp',
    action: {
      label: 'FIX',
      intent: 'open-acps',
    },
  });
};

export const hideMissingACPStatus = () => {
  usePortalStatuses.getState().removeStatus(COFHE_STATUS_IDS.missingACP);
};

export const showACPExpiredStatus = () => {
  usePortalStatuses.getState().addStatus({
    id: COFHE_STATUS_IDS.acpExpired,
    variant: 'error',
    title: 'ACP expired',
    description: 'Select or create a new acp',
    action: {
      label: 'FIX',
      intent: 'open-acps',
    },
  });
};
export const hideACPExpiredStatus = () => {
  usePortalStatuses.getState().removeStatus(COFHE_STATUS_IDS.acpExpired);
};

export const showACPExpiringSoonStatus = (acp: ACP) => {
  usePortalStatuses.getState().addStatus({
    id: COFHE_STATUS_IDS.acpExpiringSoon,
    variant: 'warning',
    title: 'ACP expiring soon',
    description: `Expires at ${new Date(acp.expiration * 1000).toLocaleTimeString()}`,
    action: {
      label: 'FIX',
      intent: 'open-acps',
    },
  });
};
export const hideACPExpiringSoonStatus = () => {
  usePortalStatuses.getState().removeStatus(COFHE_STATUS_IDS.acpExpiringSoon);
};

export const showACPSharedStatus = (acp: ACP) => {
  usePortalStatuses.getState().addStatus({
    id: COFHE_STATUS_IDS.acpShared,
    variant: 'info',
    title: 'Imported acp active',
    description: `Viewing ${truncateHash(acp.issuer, 4, 4)}'s data`,
  });
};
export const hideACPSharedStatus = () => {
  usePortalStatuses.getState().removeStatus(COFHE_STATUS_IDS.acpShared);
};

/**
 * Watches the user's active acp and displays statuses if:
 * - Warning - acp will expire in less that 1 hour
 * - Error - acp has expired
 * - Info - using a shared acp
 */
export const useWatchACPStatus = () => {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeACP = useCofheActiveACP();
  const connected = useCofheIsConnected();

  useEffect(() => {
    const updateStatuses = (acp: ACP | undefined) => {
      const hasCreatedFirstACP = usePortalPersisted.getState().hasCreatedFirstACP;
      const missingACPStatusShown = usePortalStatuses.getState().hasStatus(COFHE_STATUS_IDS.missingACP);
      const expiredStatusShown = usePortalStatuses.getState().hasStatus(COFHE_STATUS_IDS.acpExpired);
      const expiringSoonStatusShown = usePortalStatuses.getState().hasStatus(COFHE_STATUS_IDS.acpExpiringSoon);
      const sharedStatusShown = usePortalStatuses.getState().hasStatus(COFHE_STATUS_IDS.acpShared);

      if (acp == null) {
        if (hasCreatedFirstACP && !missingACPStatusShown && connected) {
          showMissingACPStatus();
        }
        if (expiredStatusShown) {
          hideACPExpiredStatus();
        }
        if (expiringSoonStatusShown) {
          hideACPExpiringSoonStatus();
        }
        if (sharedStatusShown) {
          hideACPSharedStatus();
        }
        return;
      }

      if (acp != null && missingACPStatusShown) {
        hideMissingACPStatus();
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const expiration = acp.expiration;

      // Expired status
      const isExpired = expiration < timestamp;
      if (isExpired && !expiredStatusShown) {
        showACPExpiredStatus();
      }
      if (!isExpired && expiredStatusShown) {
        hideACPExpiredStatus();
      }

      // Expiring soon status
      const isExpiringSoon = expiration - timestamp < 1 * 60 * 60;
      if (!isExpired && isExpiringSoon && !expiringSoonStatusShown) {
        showACPExpiringSoonStatus(acp);
      }
      if ((!isExpiringSoon && expiringSoonStatusShown) || isExpired) {
        hideACPExpiringSoonStatus();
      }

      // Shared status
      const isShared = acp.type === 'recipient';
      if (isShared && !sharedStatusShown) {
        showACPSharedStatus(acp);
      }
      if (!isShared && sharedStatusShown) {
        hideACPSharedStatus();
      }
    };

    updateStatuses(activeACP?.acp);
    intervalRef.current = setInterval(() => {
      updateStatuses(activeACP?.acp);
    }, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [activeACP, connected]);
};
