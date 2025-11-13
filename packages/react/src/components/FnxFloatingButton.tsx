import { useState } from 'react';
import type { BaseProps } from '../types/component-types.js';
import { cn } from '../utils/cn.js';

export type FloatingButtonPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface FnxFloatingButtonProps extends BaseProps {
  /** Position of the floating button */
  position?: FloatingButtonPosition;
  /** Icon to display in the button (React node) */
  icon?: React.ReactNode;
  /** Size of the button in pixels */
  size?: number;
  /** Background color */
  backgroundColor?: string;
  /** Icon color */
  iconColor?: string;
  /** Click handler */
  onClick?: () => void;
  /** Hover tooltip text */
  title?: string;
  /** Z-index value (default: 9999) */
  zIndex?: number;
  /** Position type: 'fixed' stays on screen, 'absolute' positions within parent (default: 'fixed') */
  positionType?: 'fixed' | 'absolute';
  /** Enable expandable panel (default: false) */
  expandable?: boolean;
  /** Width of the expanded panel in pixels (default: 250) */
  expandedWidth?: number;
  /** Show popup panel above/below (default: false) */
  showPopup?: boolean;
  /** Popup panel width in pixels (default: 350) */
  popupWidth?: number;
  /** Popup panel height in pixels (default: 250) */
  popupHeight?: number;
  /** Delay before showing popup in ms (default: 500) */
  popupDelay?: number;
}

const positionStyles: Record<FloatingButtonPosition, string> = {
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
};

export const FnxFloatingButton: React.FC<FnxFloatingButtonProps> = ({
  className,
  testId,
  position = 'bottom-right',
  icon,
  size = 56,
  backgroundColor = '#3b82f6',
  iconColor = '#ffffff',
  onClick,
  title,
  zIndex = 9999,
  positionType = 'fixed',
  expandable = false,
  expandedWidth = 250,
  showPopup = false,
  popupWidth = 350,
  popupHeight = 250,
  popupDelay = 500,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPopupPanel, setShowPopupPanel] = useState(false);

  const isLeftSide = position.includes('left');
  const isTopSide = position.includes('top');
  const borderRadius = size * 0.37;

  const handleClick = () => {
    if (expandable) {
      const newExpandedState = !isExpanded;
      
      // Handle popup delay
      if (showPopup) {
        if (newExpandedState) {
          // Opening: bar first, then popup after delay
          setIsExpanded(true);
          setTimeout(() => {
            setShowPopupPanel(true);
          }, popupDelay);
        } else {
          // Closing: popup first, then bar after popup animation
          setShowPopupPanel(false);
          setTimeout(() => {
            setIsExpanded(false);
          }, 300); // Wait for popup close animation (300ms)
        }
      } else {
        setIsExpanded(newExpandedState);
      }
    }
    onClick?.();
  };

  const gapSize = 36; // Gap between button and panel content

  return (
    <div
      data-testid={testId}
      className={cn(
        positionType === 'fixed' ? 'fixed' : 'absolute',
        'flex',
        positionStyles[position],
        // bottom-* opens UP (popup above), top-* opens DOWN (popup below)
        isTopSide ? 'flex-col-reverse items-start' : 'flex-col items-start'
      )}
      style={{
        zIndex,
      }}
    >
      {/* Popup Panel */}
      {showPopup && (
        <div
          className={cn(
            'transition-all duration-300 ease-in-out overflow-hidden',
            // bottom-* has popup above (mb-3), top-* has popup below (mt-3)
            isTopSide ? 'mt-3' : 'mb-3',
            'flex',
            isLeftSide ? 'justify-start' : 'justify-end'
          )}
          style={{
            width: `${expandedWidth + gapSize + size / 2 }px`,
            height: showPopupPanel ? `${popupHeight}px` : '0px',
            opacity: showPopupPanel ? 1 : 0,
          }}
        >
          <div
            style={{
              width: `${popupWidth}px`,
              height: '100%',
              backgroundColor,
              borderRadius: `${borderRadius}px`,
              padding: '16px',
            }}
          >
            {/* Popup content goes here */}
          </div>
        </div>
      )}

      {/* Button and Bar Row */}
      <div
        className={cn(
          'flex items-center',
          isLeftSide ? 'flex-row' : 'flex-row-reverse'
        )}
      >
      {/* Rounded Square Button */}
      <button
        title={title}
        onClick={handleClick}
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
        }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            transform: isHovered ? 'scale(1.1)' : 'scale(1)',
            transition: 'transform 0.2s ease-in-out',
          }}
        >
          {icon}
        </div>
      </button>

      {/* Expandable Panel (Bar) */}
      {expandable && (
        <div
          className="overflow-hidden flex"
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
              color: iconColor,
              borderRadius: `${borderRadius}px`,
              // Slide animation
              transform: isExpanded 
                ? 'translateX(0)' 
                : isLeftSide 
                  ? `translateX(-${expandedWidth}px)` 
                  : `translateX(${expandedWidth}px)`,
              opacity: isExpanded ? 1 : 0,
            }}
          >
            {/* Bar content */}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

