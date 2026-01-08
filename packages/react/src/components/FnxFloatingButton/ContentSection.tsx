import { useEffect, useMemo, useRef } from 'react';

import { useFnxFloatingButtonContext } from './FnxFloatingButtonContext';
import { type PageState } from './pagesConfig/types';
import { AnimatePresence, motion } from 'motion/react';
import { pages } from './pagesConfig/const';
import { AnimatedZStack } from '../primitives/AnimatedZStack';

interface ContentSectionProps {
  overriddingPage?: PageState;
}

const ContentRenderer: React.FC<{ page: PageState }> = ({ page }) => {
  const { setContentHeight } = useFnxFloatingButtonContext();
  const contentRef = useRef<HTMLDivElement>(null);

  const content = useMemo(() => {
    const PageComp = pages[page.page];
    const props = page.props ?? {};
    return <PageComp {...props} />;
  }, [page]);

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
  }, [page.page, setContentHeight]);

  return (
    <div className="absolute flex top-0 left-0 w-full p-4" ref={contentRef}>
      {content}
    </div>
  );
};

const ModalRenderer: React.FC<{ page: PageState }> = ({ page }) => {
  const { setContentHeight } = useFnxFloatingButtonContext();
  const contentRef = useRef<HTMLDivElement>(null);

  const content = useMemo(() => {
    const PageComp = pages[page.page];
    const props = page.props ?? {};
    return <PageComp {...props} />;
  }, [page]);

  useEffect(() => {
    if (!contentRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height;
        setContentHeight(`${page.page}-modal`, height);
      }
    });

    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [page.page, setContentHeight]);

  return (
    <div className="absolute flex top-0 left-0 w-full p-4" ref={contentRef}>
      {content}
    </div>
  );
};

export const ContentSection: React.FC<ContentSectionProps> = ({ overriddingPage }) => {
  const {
    currentPage: pageFromContext,
    contentPanelOpen,
    isTopSide,
    maxContentHeight,
    statuses,
    modalStack,
  } = useFnxFloatingButtonContext();
  const currentPage = overriddingPage ?? pageFromContext;

  return (
    <AnimatePresence>
      {contentPanelOpen && (
        <motion.div
          className="relative flex w-full"
          initial={{ opacity: 0, y: isTopSide ? -10 : 10 }}
          animate={{ opacity: 1, y: 0, height: `${maxContentHeight}px`, maxHeight: `${maxContentHeight}px` }}
          exit={{ opacity: 0, y: isTopSide ? -10 : 10 }}
        >
          <AnimatedZStack>
            <div className="fnx-panel relative flex w-full h-full overflow-y-auto">
              <ContentRenderer page={currentPage} />
            </div>
            {modalStack.map((modal) => {
              return (
                <div className="fnx-panel relative flex w-full h-full overflow-y-auto" key={modal.page}>
                  <ModalRenderer page={modal} />
                </div>
              );
            })}
          </AnimatedZStack>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
