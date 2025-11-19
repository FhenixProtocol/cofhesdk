import SettingsIcon from '@mui/icons-material/Settings';
import logoBlack from './assets/logo-black.png';
import logoWhite from './assets/logo-white.png';
import { cn } from '../../utils/cn.js';
import { useFnxFloatingButtonContext } from './FnxFloatingButtonContext.js';

interface StatusBarSectionProps {
  className?: string;
  isExpanded: boolean;
  isLeftSide: boolean;
}

export const StatusBarSection: React.FC<StatusBarSectionProps> = ({
  className,
  isExpanded,
  isLeftSide,
}) => {
  const { darkMode, navigateToSettings } = useFnxFloatingButtonContext();
  return (
    <div
      className={cn(className, 'fnx-status-bar-container flex')}
      data-left={isLeftSide}
      data-expanded={isExpanded}
    >
      <div
        className={cn(
          'fnx-status-bar fnx-glow flex items-center',
          darkMode && 'dark'
        )}
        data-expanded={isExpanded}
        data-left={isLeftSide}
      >
        <div className="flex items-center justify-between w-full px-4">
          {/* Logo */}
          <img 
            src={darkMode ? logoWhite : logoBlack } 
            alt="Fhenix" 
            className="fnx-status-logo"
          />
          {/* Status */}
          <div className="fnx-status-badge-inline fnx-text-status text-sm px-3 py-2">
            <span className="opacity-70">Status:</span> <span className="font-medium">Connected</span>
          </div>
          
          {/* Settings Icon */}
          <button
            onClick={navigateToSettings}
            className="fnx-text-primary p-1 rounded hover:bg-white hover:bg-opacity-10 transition-colors"
          >
            <SettingsIcon className="fnx-settings-icon" />
          </button>
        </div>
      </div>
    </div>
  );
};

