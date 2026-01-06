import { cn } from '@/utils';
import CloseIcon from '@mui/icons-material/Close';
import { useFnxFloatingButtonContext } from './FnxFloatingButtonContext';
import { FhenixLogoIcon } from '../FhenixLogoIcon';

export const FloatingButtonComponent: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const { isOpen, theme } = useFnxFloatingButtonContext();

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-12 h-12',
        'fnx-floating-icon',
        'transition-all duration-200 ease-in-out',
        'flex items-center justify-center cursor-pointer flex-shrink-0',
        'focus:outline-none'
      )}
    >
      <div className="flex items-center justify-center">
        {isOpen && <CloseIcon className="w-6 h-6" />}
        {!isOpen && <FhenixLogoIcon theme={theme} className="w-10 h-10" />}
      </div>
    </button>
  );
};
