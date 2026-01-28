import { cn } from '@/utils';
import CloseIcon from '@mui/icons-material/Close';
import { useFnxFloatingButtonContext } from './FnxFloatingButtonContext';
import { FhenixLogoIcon } from '../FhenixLogoIcon';
import { usePortalUI, usePortalStatuses } from '@/stores';
import type { FnxStatusVariant } from './types';

const statusVariantStyles: Record<FnxStatusVariant, string> = {
  error: 'border-red-500',
  warning: 'border-yellow-500',
  info: 'border-blue-500',
};

export const FloatingButtonComponent: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const { theme } = useFnxFloatingButtonContext();
  const { statuses } = usePortalStatuses();
  const { portalOpen } = usePortalUI();

  const topStatusVariant = statuses[statuses.length - 1]?.variant;

  return (
    <button
      onClick={onClick}
      className={cn(
        'fnx-panel fnx-floating-icon',
        'w-12 h-12',
        'flex items-center justify-center cursor-pointer flex-shrink-0',
        'focus:outline-none',
        statusVariantStyles[topStatusVariant]
      )}
    >
      <div className="flex items-center justify-center">
        {portalOpen && <CloseIcon className="w-6 h-6" />}
        {!portalOpen && <FhenixLogoIcon theme={theme} className="w-10 h-10" />}
      </div>
    </button>
  );
};
