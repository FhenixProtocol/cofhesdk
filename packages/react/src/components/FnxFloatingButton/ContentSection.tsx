
import { useEffect, useMemo, useRef } from 'react';

import { useFnxFloatingButtonContext } from './FnxFloatingButtonContext';
import { type PageState } from './pagesConfig/types';
import { AnimatePresence, motion } from 'motion/react';
import { pages } from './pagesConfig/const';

interface ContentSectionProps {
  overriddingPage?: PageState;
}

export const ContentSection: React.FC<ContentSectionProps> = ({ overriddingPage }) => {
  const { currentPage: pageFromContext, contentPanelOpen, isTopSide, setContentHeight } = useFnxFloatingButtonContext();
  const currentPage = overriddingPage ?? pageFromContext;
  const contentRef = useRef<HTMLDivElement>(null);

  const content = useMemo(() => {
    const PageComp = pages[currentPage.page];
    const props = currentPage.props ?? {};
    return <PageComp {...props} />;
  }, [currentPage]);

  useEffect(() => {
    if (!contentRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height;
        setContentHeight('content', height);
      }
    });

    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [currentPage.page, setContentHeight]);

  return (
    <AnimatePresence>
      {contentPanelOpen && (
        <motion.div
          ref={contentRef}
          className="fnx-panel relative flex w-full p-4"
          initial={{ opacity: 0, y: isTopSide ? -10 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: isTopSide ? -10 : 10 }}
        >
          {content}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
