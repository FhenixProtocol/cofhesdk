import { cn } from '@/utils';
import { useMemo } from 'react';

import { useFnxFloatingButtonContext } from './FnxFloatingButtonContext';
import { pages } from './pagesConfig/const';
import { type PageState } from './pagesConfig/types';
import { AnimatePresence, motion } from 'motion/react';

interface ContentSectionProps {
  overriddingPage?: PageState;
}

export const ContentSection: React.FC<ContentSectionProps> = ({ overriddingPage }) => {
  const { currentPage: pageFromContext, contentExpanded, isTopSide } = useFnxFloatingButtonContext();
  const currentPage = overriddingPage ?? pageFromContext;

  const content = useMemo(() => {
    const PageComp = pages[currentPage.page];
    const props = currentPage.props ?? {};
    return <PageComp {...props} />;
  }, [currentPage]);

  return (
    <AnimatePresence>
      {contentExpanded && (
        <motion.div
          className="fnx-content-panel relative flex w-full p-4"
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
