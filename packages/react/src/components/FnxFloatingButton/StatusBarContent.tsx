import { MdOutlineSettings } from 'react-icons/md';
import { IoIosCheckmarkCircleOutline, IoIosCloseCircleOutline, IoIosTime } from 'react-icons/io';
import { useMemo } from 'react';
import { cn } from '@/utils';
import { useFnxFloatingButtonContext } from './FnxFloatingButtonContext';
import { FloatingButtonPage } from './pagesConfig/types';
import { FhenixLogoIcon } from '../FhenixLogoIcon';
import type { FnxStatus, FnxStatusVariant } from './types';
import { AnimatedZStack } from '../primitives/AnimatedZStack';
import { usePortalNavigation, usePortalStatuses } from '@/stores';
import { useCofheConnection } from '@/hooks';
import { CLAIMS_AVAILABLE_STATUS_ID } from '@/hooks/useWatchClaimablesStatus';
import {
  STATUS_ID_MISSING_PERMIT,
  STATUS_ID_PERMIT_EXPIRED,
  STATUS_ID_PERMIT_EXPIRING_SOON,
  STATUS_ID_PERMIT_SHARED,
} from '@/hooks/useWatchPermitStatus';

const ConnectionStatus: React.FC = () => {
  const { theme } = useFnxFloatingButtonContext();
  const { navigateTo } = usePortalNavigation();
  const { connected } = useCofheConnection();

  return (
    <div className="fnx-panel w-full h-full flex px-4 items-center justify-between">
      {/* Logo Icon */}
      <FhenixLogoIcon theme={theme} className="w-10 h-10" />

      {/* Status */}
      <div className="flex items-center gap-1 ml-auto mr-2">
        {connected ? (
          <>
            <IoIosCheckmarkCircleOutline className="text-green-500" />
            <span className="font-medium" aria-live="polite">
              Connected
            </span>
          </>
        ) : (
          <>
            <IoIosCloseCircleOutline className="text-red-500" />
            <span className="font-medium" aria-live="polite">
              Disconnected
            </span>
          </>
        )}
      </div>

      {/* Settings Icon */}
      <button
        onClick={() => navigateTo(FloatingButtonPage.Settings)}
        className={cn('p-1 rounded fnx-hover-overlay transition-colors', 'fnx-text-primary')}
      >
        <MdOutlineSettings className="w-4 h-4" />
      </button>
    </div>
  );
};

const statusTextColorMap: Record<FnxStatusVariant, string> = {
  error: 'text-red-500',
  warning: 'text-yellow-500',
  info: 'text-blue-500',
};

const statusBorderColorMap: Record<FnxStatusVariant, string> = {
  error: 'border-red-500',
  warning: 'border-yellow-500',
  info: 'border-blue-500',
};

const ActiveStatusContent: React.FC<{ status: FnxStatus }> = ({ status }) => {
  const { theme } = useFnxFloatingButtonContext();

  return (
    <div
      className={cn(
        'fnx-panel w-full h-full flex px-4 items-center justify-between',
        statusBorderColorMap[status.variant]
      )}
    >
      {/* Logo Icon */}
      <FhenixLogoIcon theme={theme} className="w-10 h-10" />

      {/* Status Info */}
      <div className="flex flex-col ml-2 mr-auto">
        <h3 className={cn('text-sm font-medium', statusTextColorMap[status.variant])}>{status.title}</h3>
        {status.description != null && (
          <p className={cn('text-xs', statusTextColorMap[status.variant])}>{status.description}</p>
        )}
      </div>

      {/* Action Button */}
      {status.action != null && (
        <button
          onClick={status.action?.onClick}
          className={cn('p-1 rounded fnx-hover-overlay transition-colors', 'fnx-text-primary')}
        >
          {status.action.label}
        </button>
      )}
    </div>
  );
};

const STATUSES_ORDER = new Map<string, number>(
  [
    // first always goes "claims available" as claiming doesn't require a permit
    CLAIMS_AVAILABLE_STATUS_ID,

    // next goes all permit related statuses
    STATUS_ID_MISSING_PERMIT,
    STATUS_ID_PERMIT_EXPIRED,
    STATUS_ID_PERMIT_EXPIRING_SOON,
    STATUS_ID_PERMIT_SHARED,

    // next everything else can be sorted by time or just left in the order they were added
  ]
    .reverse()
    .map((id, index) => [id, index])
);

function sortStatuses(a: FnxStatus, b: FnxStatus): number {
  const aIndex = STATUSES_ORDER.get(a.id) ?? -1;
  const bIndex = STATUSES_ORDER.get(b.id) ?? -1;

  if (aIndex === -1 && bIndex === -1) {
    // If both statuses are not in the predefined order, keep their original order
    return 0;
  }
  if (aIndex === -1) {
    // If only a is not in the predefined order, b should come first
    return 1;
  }
  if (bIndex === -1) {
    // If only b is not in the predefined order, a should come first
    return -1;
  }
  // If both statuses are in the predefined order, sort by their index
  return aIndex - bIndex;
}

export const StatusBarContent: React.FC = () => {
  const { statuses } = usePortalStatuses();

  const sortedStatuses = useMemo(() => statuses.sort(sortStatuses), [statuses]);

  return (
    <AnimatedZStack>
      {/* Connection status showing connection state and chain */}
      <ConnectionStatus />

      {/* Active errors or warnings to be resolved */}
      {sortedStatuses.map((status) => (
        <ActiveStatusContent key={status.id} status={status} />
      ))}
    </AnimatedZStack>
  );
};
