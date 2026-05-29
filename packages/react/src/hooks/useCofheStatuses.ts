import type { CofheStatus } from '@/components/CofheFloatingButton/types';
import { usePortalStatuses } from '@/stores/portalStatuses';
import { useMemo } from 'react';

export const useCofheStatuses = (): readonly CofheStatus[] => {
  const statuses = usePortalStatuses((state) => state.statuses);

  return useMemo(
    () =>
      statuses.map((status) => {
        return {
          id: status.id,
          variant: status.variant,
          title: status.title,
          description: status.description,
          action:
            status.action != null && 'intent' in status.action
              ? {
                  label: status.action.label,
                  intent: status.action.intent,
                }
              : undefined,
        };
      }),
    [statuses]
  );
};
