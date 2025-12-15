import { MdOutlineSettings } from 'react-icons/md';
import { IoIosCheckmarkCircleOutline } from 'react-icons/io';
import { cn } from '../../utils/cn';
import logoBlack from './assets/fhenix-icon-black.png';
import logoWhite from './assets/fhenix-icon-white.png';
import { useFnxFloatingButtonContext } from './FnxFloatingButtonContext';
import { FloatingButtonPage } from './pagesConfig/types';

export const StatusBarContent: React.FC = () => {
  const { darkMode, navigateTo } = useFnxFloatingButtonContext();

  return (
    <>
      {/* Logo */}
      <img src={darkMode ? logoWhite : logoBlack} alt="Fhenix" className="fnx-status-logo" />
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
