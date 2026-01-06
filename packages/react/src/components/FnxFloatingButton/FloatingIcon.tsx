import { cn } from '@/utils';
import CloseIcon from '@mui/icons-material/Close';
import { useFnxFloatingButtonContext } from './FnxFloatingButtonContext';
import { FhenixLogoIcon } from '../FhenixLogoIcon';

export const FloatingIcon: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const { isExpanded, theme } = useFnxFloatingButtonContext();

  return (
    <button
      onClick={onClick}
      className={cn(
        'fnx-floating-icon',
        'transition-all duration-200 ease-in-out',
        'flex items-center justify-center cursor-pointer flex-shrink-0',
        'focus:outline-none'
      )}
    >
      <div className="fnx-icon-inner flex items-center justify-center">
        {isExpanded && <CloseIcon className="fnx-icon-close" />}
        {!isExpanded && <FhenixLogoIcon theme={theme} className="w-10 h-10" />}
      </div>
    </button>
  );
};
