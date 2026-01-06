import { cn } from '@/utils';
import { FloatingButtonComponent } from './FloatingButtonComponent';
import { StatusBarSection } from './StatusBarSection';
import { StatusBarContent } from './StatusBarContent';
import { ContentSection } from './ContentSection';
import { useFnxFloatingButtonContext } from './FnxFloatingButtonContext';
import type { FloatingButtonPosition, FnxFloatingButtonProps } from './types';
import { ToastsSection } from './ToastsSection';

// TODOS:
// - Get svgs instead of pngs
// - Define configuration that needs to move to global react config
// - Improve expand animation so it will roll out from the floating button

const positionStyles: Record<FloatingButtonPosition, string> = {
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
};

export const FnxFloatingButtonBase: React.FC<FnxFloatingButtonProps> = ({
  className,
  testId,
  zIndex = 9999,
  positionType = 'fixed',
  overriddingPage,
}) => {
  const { effectivePosition, isTopSide, isLeftSide, handleClick, theme } = useFnxFloatingButtonContext();
  const darkMode = theme === 'dark';

  return (
    <div
      data-testid={testId}
      className={cn(
        'fnx-floating-button',
        darkMode && 'dark',
        positionType,
        'flex gap-3',
        positionStyles[effectivePosition],
        // bottom-* opens UP (popup above), top-* opens DOWN (popup below)
        isTopSide ? 'flex-col-reverse items-start' : 'flex-col items-start',
        `z-[${zIndex}]`,
        className
      )}
    >
      <ToastsSection />

      <ContentSection overriddingPage={overriddingPage} />

      {/* Button and Bar Row */}
      <div className={cn('flex w-full gap-2 items-center', isLeftSide ? 'flex-row' : 'flex-row-reverse')}>
        <FloatingButtonComponent onClick={() => handleClick()} />

        <StatusBarSection>
          <StatusBarContent />
        </StatusBarSection>
      </div>
    </div>
  );
};
