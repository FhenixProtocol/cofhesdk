import { cn } from '../../utils/cn.js';
import { useState, useEffect, useRef } from 'react';
import { GLOW_SHADOW } from './FnxFloatingButton.js';

interface ContentSectionProps {
  showPopupPanel: boolean;
  isTopSide: boolean;
  isLeftSide: boolean;
  expandedWidth: number;
  gapSize: number;
  size: number;
  backgroundColor: string;
  borderRadius: number;
  children?: React.ReactNode;
}

export const ContentSection: React.FC<ContentSectionProps> = ({
  showPopupPanel,
  isTopSide,
  isLeftSide,
  expandedWidth,
  gapSize,
  size,
  backgroundColor,
  borderRadius,
  children,
}) => {
  // Calculate popup width to match the full bar container width
  const popupWidth = expandedWidth + gapSize + size / 2;
  
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayedContent, setDisplayedContent] = useState(children);
  const [contentHeight, setContentHeight] = useState<number>(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // Measure content height automatically
  useEffect(() => {
    if (contentRef.current && showPopupPanel) {
      const height = contentRef.current.clientHeight + borderRadius * 1.5;
      setContentHeight(height);
    }
  }, [displayedContent, showPopupPanel, borderRadius]);

  // Animate content changes
  useEffect(() => {
    if (!showPopupPanel) return;
    
    // Fade out old content
    setIsTransitioning(true);
    
    setTimeout(() => {
      // Swap content
      setDisplayedContent(children);
      // Fade in new content
      setIsTransitioning(false);
    }, 150);
  }, [children, showPopupPanel]);

  return (
    <div
      className={cn(
        // bottom-* has popup above (mb-3), top-* has popup below (mt-3)
        isTopSide ? 'mt-3' : 'mb-3',
        'flex',
        isLeftSide ? 'justify-start' : 'justify-end'
      )}
      style={{
        width: `${popupWidth}px`,
        overflow: 'visible',
      }}
    >
      <div
        className="transition-all duration-300 ease-in-out"
        style={{
          width: `${popupWidth}px`,
          height: showPopupPanel ? `${contentHeight}px` : '0px',
          opacity: showPopupPanel ? 1 : 0,
          backgroundColor,
          borderRadius: `${borderRadius}px`,
          padding: showPopupPanel ? '16px' : '0px',
          boxShadow: showPopupPanel ? GLOW_SHADOW : 'none',
        }}
      >
        <div
          ref={contentRef}
          className="transition-opacity duration-150"
          style={{
            opacity: isTransitioning ? 0 : 1,
            overflow: 'hidden',
          }}
        >
          {displayedContent}
        </div>
      </div>
    </div>
  );
};

