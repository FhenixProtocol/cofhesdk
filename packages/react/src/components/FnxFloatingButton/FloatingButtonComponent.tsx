import { cn } from '@/utils';
import CloseIcon from '@mui/icons-material/Close';
import { useFnxFloatingButtonContext } from './FnxFloatingButtonContext';
import { FhenixLogoIcon } from '../FhenixLogoIcon';

export const FloatingButtonComponent: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const { portalOpen, theme, status } = useFnxFloatingButtonContext();

  return (
    <button
      onClick={onClick}
      className={cn(
        'fnx-panel fnx-floating-icon',
        'w-12 h-12',
        'flex items-center justify-center cursor-pointer flex-shrink-0',
        'focus:outline-none',
        status != null && status.variant === 'error' && 'border-red-500',
        status != null && status.variant === 'warning' && 'border-yellow-500'
      )}
    >
      <div className="flex items-center justify-center">
        {portalOpen && <CloseIcon className="w-6 h-6" />}
        {!portalOpen && <FhenixLogoIcon theme={theme} className="w-10 h-10" />}
      </div>
    </button>
  );
};
