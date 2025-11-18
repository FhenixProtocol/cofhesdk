import { useState } from 'react';
import { cn } from '../../utils/cn.js';
import fhenixIconBlack from './assets/fhenix-icon-black.png';
import fhenixIconWhite from './assets/fhenix-icon-white.png';
import CloseIcon from '@mui/icons-material/Close';

interface FloatingIconProps {
  onClick: () => void;
  className?: string;
  isExpanded: boolean;
  darkMode: boolean;
}

export const FloatingIcon: React.FC<FloatingIconProps> = ({
  onClick,
  className,
  isExpanded,
  darkMode,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Show X when expanded, otherwise show custom icon or fhenix logo
  const displayIcon = isExpanded ? (
    <CloseIcon className="fnx-icon-close" />
  ) : (
    <img 
      src={darkMode ? fhenixIconWhite : fhenixIconBlack} 
      alt="Fhenix" 
      className="fnx-icon-image"
    />
  );

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'fnx-floating-icon fnx-glow',
        darkMode && 'dark',
        'transition-all duration-200 ease-in-out',
        'flex items-center justify-center cursor-pointer flex-shrink-0',
        'hover:scale-105 active:scale-95',
        'focus:outline-none',
        className
      )}
    >
      <div
        className="fnx-icon-inner flex items-center justify-center"
        data-hovered={isHovered}
      >
        {displayIcon}
      </div>
    </button>
  );
};

