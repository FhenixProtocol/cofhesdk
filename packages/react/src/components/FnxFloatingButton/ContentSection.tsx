import { cn } from '../../utils/cn';
import { useState, useEffect, useRef, useMemo } from 'react';

import { useFnxFloatingButtonContext } from './FnxFloatingButtonContext';
import { pages } from './pagesConfig/const';
import { type PageState } from './pagesConfig/types';

const CONTENT_TRANSITION_DURATION = 150; // Duration in milliseconds for content fade transition

interface ContentSectionProps {
  contentPadding?: number;
  // intended for a case like: bring user to Generate Permit page, without affecting the history stack
  overriddingPage?: PageState;
}

export const ContentSection: React.FC<ContentSectionProps> = ({ contentPadding = 16, overriddingPage }) => {
  const { currentPage: pageFromContext, contentExpanded, isLeftSide } = useFnxFloatingButtonContext();
  const currentPage = overriddingPage ?? pageFromContext;

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayedContent, setDisplayedContent] = useState(() => {
    const PageComp = pages[currentPage.page];
    const props = currentPage.props ?? {};
    return <PageComp {...props} />;
  });
  const [contentHeight, setContentHeight] = useState<number>(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // React to dynamic size changes inside the active page (e.g., toggling fields)
  useEffect(() => {
    if (!contentExpanded) return;
    const el = contentRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newHeight = entry.contentRect.height + contentPadding * 2;
        setContentHeight((prev) => (prev !== newHeight ? newHeight : prev));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [contentExpanded, contentPadding]);

  // Update content when page changes
  useEffect(() => {
    function renderPage() {
      const PageComp = pages[currentPage.page];
      const props = currentPage.props ?? {};
      setDisplayedContent(<PageComp {...props} />);
      setIsTransitioning(false);
    }
    if (!contentExpanded) {
      setIsTransitioning(true);
      setTimeout(() => {
        renderPage();
      }, CONTENT_TRANSITION_DURATION);
    } else {
      renderPage();
    }
  }, [currentPage, contentExpanded]);

  return (
    <div className="fnx-content-container flex" data-left={isLeftSide} data-open={contentExpanded}>
      <div
        className="fnx-content-panel"
        data-open={contentExpanded}
        style={
          {
            '--fnx-content-height': contentExpanded ? `${contentHeight}px` : undefined,
            '--fnx-content-padding': `${contentPadding}px`,
          } as React.CSSProperties
        }
      >
        <div ref={contentRef} className="fnx-content-inner" data-transitioning={isTransitioning}>
          {displayedContent}
        </div>
      </div>
    </div>
  );
};
