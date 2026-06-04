import { isCofhePublicStatus } from '@/components/CofheFloatingButton/internalTypes';
import type { CofheStatus } from '@/components/CofheFloatingButton/types';
import { usePortalStatuses } from '@/stores/portalStatuses';
import { useMemo } from 'react';

/**
 * Returns the public consumer-facing status list.
 *
 * Only statuses with the public intent-based action shape are exposed here.
 * Internal callback-action statuses remain widget-only and are filtered out.
 */
export const useCofheStatuses = (): readonly CofheStatus[] => {
  const statuses = usePortalStatuses((state) => state.statuses);

  return useMemo(() => statuses.filter(isCofhePublicStatus), [statuses]);
};
