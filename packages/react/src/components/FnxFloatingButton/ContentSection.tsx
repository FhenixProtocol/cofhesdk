import { cn } from '../../utils/cn.js';
import { useState, useEffect, useRef } from 'react';

const CONTENT_TRANSITION_DURATION = 150; // Duration in milliseconds for content fade transition

interface ContentSectionProps {
  className?: string;
  showPopupPanel: boolean;
  isTopSide: boolean;
  isLeftSide: boolean;
  contentPadding?: number;
  children?: React.ReactNode;
}

export const ContentSection: React.FC<ContentSectionProps> = ({
  className,
  showPopupPanel,
  isTopSide,
  isLeftSide,
  contentPadding = 16,
  children,
}) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayedContent, setDisplayedContent] = useState(children);
  const [contentHeight, setContentHeight] = useState<number>(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // Measure content height automatically
  useEffect(() => {
    if (contentRef.current && showPopupPanel) {
      // Add padding top and bottom (2 * padding)
      const height = contentRef.current.clientHeight + (contentPadding * 2);
      setContentHeight(height);
    }
  }, [displayedContent, showPopupPanel, contentPadding]);

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
    }, CONTENT_TRANSITION_DURATION);
  }, [children, showPopupPanel]);

  return (
    <div
      className={cn(
        className,
        'fnx-content-container',
        // bottom-* has popup above (mb-3), top-* has popup below (mt-3)
        isTopSide ? 'mt-3' : 'mb-3',
        'flex'
      )}
      data-left={isLeftSide}
    >
      <div
        className={cn(
          'fnx-content-panel',
          showPopupPanel && 'fnx-glow'
        )}
        data-open={showPopupPanel}
        style={{
          '--fnx-content-height': showPopupPanel ? `${contentHeight}px` : undefined,
          '--fnx-content-padding': `${contentPadding}px`,
        } as React.CSSProperties}
      >
        <div
          ref={contentRef}
          className="fnx-content-inner"
          data-transitioning={isTransitioning}
        >
          {displayedContent}
        </div>
      </div>
    </div>
  );
};

