import type { CofheStatus } from '@/components/CofheFloatingButton/types';
import { usePortalStatuses } from '@/stores/portalStatuses';

export const useCofheStatuses = (): readonly CofheStatus[] => {
  return usePortalStatuses((state) =>
    state.statuses.map((status) => {
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
    })
  );
};
