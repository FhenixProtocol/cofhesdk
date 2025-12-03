import SettingsIcon from '@mui/icons-material/Settings';
import logoBlack from './assets/logo-black.png';
import logoWhite from './assets/logo-white.png';
import { useFnxFloatingButtonContext, FloatingButtonPage } from './FnxFloatingButtonContext.js';

export const StatusBarContent: React.FC = () => {
  const { darkMode, navigateTo } = useFnxFloatingButtonContext();

  return (
    <>
      {/* Logo */}
      <img 
        src={darkMode ? logoWhite : logoBlack} 
        alt="Fhenix" 
        className="fnx-status-logo"
      />
      {/* Status */}
      <div className="fnx-status-badge-inline fnx-text-status text-sm px-3 py-2">
        <span className="opacity-70">Status:</span> <span className="font-medium">Connected</span>
      </div>
      
      {/* Settings Icon */}
      <button
        onClick={() => navigateTo(FloatingButtonPage.Settings)}
        className="fnx-text-primary p-1 rounded hover:bg-white hover:bg-opacity-10 transition-colors"
      >
        <SettingsIcon className="fnx-settings-icon" />
      </button>
    </>
  );
};

