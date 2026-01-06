import { MdOutlineSettings } from 'react-icons/md';
import { IoIosCheckmarkCircleOutline } from 'react-icons/io';
import { cn } from '@/utils';
import { useFnxFloatingButtonContext } from './FnxFloatingButtonContext';
import { FloatingButtonPage } from './pagesConfig/types';
import { FhenixLogoIcon } from '../FhenixLogoIcon';

export const StatusBarContent: React.FC = () => {
  const { theme, navigateTo } = useFnxFloatingButtonContext();

  return (
    <>
      {/* Logo */}
      <FhenixLogoIcon theme={theme} className="w-10 h-10" />
      {/* Status */}
      <div className="flex items-center gap-1 ml-auto mr-2">
        <span className="text-green-500">
          <IoIosCheckmarkCircleOutline />
        </span>
        <span className="font-medium">Connected*</span>
      </div>

      {/* Settings Icon */}
      <button
        onClick={() => navigateTo(FloatingButtonPage.Settings)}
        className={cn('p-1 rounded fnx-hover-overlay transition-colors', 'fnx-text-primary')}
      >
        <MdOutlineSettings className="w-4 h-4" />
      </button>
    </>
  );
};
