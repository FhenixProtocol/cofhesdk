import { useState } from 'react';
import { cn } from '../../utils/cn.js';
import { GLOW_SHADOW } from './FnxFloatingButton.js';
import fhenixIcon from './assets/fhenix-icon.png';
import CloseIcon from '@mui/icons-material/Close';

interface FloatingIconProps {
  size: number;
  backgroundColor: string;
  borderRadius: number;
  onClick: () => void;
  className?: string;
  isExpanded: boolean;
  darkMode: boolean;
}

export const FloatingIcon: React.FC<FloatingIconProps> = ({
  size,
  backgroundColor,
  borderRadius,
  onClick,
  className,
  isExpanded,
  darkMode,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const iconColor = darkMode ? '#ffffff' : '#000000';

  // Show X when expanded, otherwise show custom icon or fhenix logo
  const displayIcon = isExpanded ? (
    <CloseIcon style={{ fontSize: size * 0.5, color: iconColor }} />
  ) : (
    <img 
      src={fhenixIcon} 
      alt="Fhenix" 
      style={{ 
        width: `${size * 0.6}px`, 
        height: `${size * 0.6}px`,
        objectFit: 'contain',
      }} 
    />
  );

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'transition-all duration-200 ease-in-out',
        'flex items-center justify-center cursor-pointer flex-shrink-0',
        'hover:scale-105 active:scale-95',
        'focus:outline-none',
        className
      )}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor,
        color: iconColor,
        border: 'none',
        borderRadius: `${borderRadius}px`,
        position: 'relative',
        zIndex: 1,
        boxShadow: GLOW_SHADOW,
      }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          transform: isHovered ? 'scale(1.1)' : 'scale(1)',
          transition: 'transform 0.2s ease-in-out',
        }}
      >
        {displayIcon}
      </div>
    </button>
  );
};

