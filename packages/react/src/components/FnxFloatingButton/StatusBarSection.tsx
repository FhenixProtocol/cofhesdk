import SettingsIcon from '@mui/icons-material/Settings';
import { GLOW_SHADOW } from './FnxFloatingButton.js';
import logoBlack from './assets/logo-black.png';

interface StatusBarSectionProps {
  isExpanded: boolean;
  expandedWidth: number;
  gapSize: number;
  size: number;
  isLeftSide: boolean;
  backgroundColor: string;
  borderRadius: number;
  onSettingsClick: () => void;
  darkMode: boolean;
}

export const StatusBarSection: React.FC<StatusBarSectionProps> = ({
  isExpanded,
  expandedWidth,
  gapSize,
  size,
  isLeftSide,
  backgroundColor,
  borderRadius,
  onSettingsClick,
  darkMode,
}) => {
  
  const textColor = darkMode ? '#ffffff' : '#000000';

  return (
    <div
      className="flex"
      style={{
        width: `${expandedWidth + gapSize}px`,
        height: `${size}px`,
        // Pull panel back so it starts from button center
        marginLeft: isLeftSide ? `-${size / 2}px` : undefined,
        marginRight: !isLeftSide ? `-${size / 2}px` : undefined,
        // Allow clicks to pass through when collapsed
        pointerEvents: isExpanded ? 'auto' : 'none',
        // Align bar to correct side
        justifyContent: isLeftSide ? 'flex-end' : 'flex-start',
      }}
    >
      <div
        className="flex items-center transition-all duration-300 ease-in-out"
        style={{
          width: `${expandedWidth}px`,
          height: `${size}px`,
          backgroundColor,
          color: textColor,
          borderRadius: `${borderRadius}px`,
          boxShadow: GLOW_SHADOW,
          // Slide animation
          transform: isExpanded
            ? 'translateX(0)'
            : isLeftSide
              ? `translateX(-${expandedWidth}px)`
              : `translateX(${expandedWidth}px)`,
          opacity: isExpanded ? 1 : 0,
        }}
      >
        <div className="flex items-center justify-between w-full px-4">
          {/* Logo */}
          <img 
            src={logoBlack} 
            alt="Fhenix" 
            style={{ 
              height: `${size * 0.4}px`,
              objectFit: 'contain',
            }} 
          />
          
          {/* Status */}
          <div 
            className="text-sm px-3 py-2 text-gray-900"
            style={{
              backgroundColor: '#FFF8E1',
              borderRadius: `${size * 0.2}px`,
              border: '1px solid rgba(0, 0, 0, 0.5)',
            }}
          >
            <span className="opacity-70">Status:</span> <span className="font-medium">Connected</span>
          </div>
          
          {/* Settings Icon */}
          <button
            onClick={onSettingsClick}
            className={`p-1 rounded hover:bg-white hover:bg-opacity-10 transition-colors ${
              darkMode ? 'text-gray-100' : 'text-gray-900'
            }`}
          >
            <SettingsIcon style={{ fontSize: 20 }} />
          </button>
        </div>
      </div>
    </div>
  );
};

