import { MdOutlineSettings } from 'react-icons/md';
import { IoIosCheckmarkCircleOutline } from 'react-icons/io';
import { cn } from '@/utils';
import { useFnxFloatingButtonContext } from './FnxFloatingButtonContext';
import { FloatingButtonPage } from './pagesConfig/types';
import { FhenixLogoIcon } from '../FhenixLogoIcon';
import type { FnxStatus, FnxStatusVariant } from './types';
import { AnimatedZStack } from '../primitives/AnimatedZStack';
import { usePortalNavigation, usePortalStatuses } from '@/stores';

const ConnectionStatus: React.FC = () => {
  const { theme } = useFnxFloatingButtonContext();
  const { navigateTo } = usePortalNavigation();

  return (
    <div className="fnx-panel w-full h-full flex px-4 items-center justify-between">
      {/* Logo Icon */}
      <FhenixLogoIcon theme={theme} className="w-10 h-10" />

      {/* Status */}
      <div className="flex items-center gap-1 ml-auto mr-2">
        <IoIosCheckmarkCircleOutline className="text-green-500" />
        <span className="font-medium">Connected*</span>
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

export const StatusBarContent: React.FC = () => {
  const { statuses } = usePortalStatuses();

  return (
    <AnimatedZStack>
      {/* Connection status showing connection state and chain */}
      <ConnectionStatus />

      {/* Active errors or warnings to be resolved */}
      {statuses.map((status) => (
        <ActiveStatusContent key={status.id} status={status} />
      ))}
    </AnimatedZStack>
  );
};
