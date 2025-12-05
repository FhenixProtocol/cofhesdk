import type { BaseProps } from '../../types/component-types.js';
import { cn } from '../../utils/cn.js';
import { FloatingIcon } from './FloatingIcon.js';
import { StatusBarSection } from './StatusBarSection.js';
import { StatusBarContent } from './StatusBarContent.js';
import { ContentSection } from './ContentSection.js';
import { FnxFloatingButtonProvider, useFnxFloatingButtonContext } from './FnxFloatingButtonContext.js';
import { PermitSelectionProvider } from './pages/permits/PermitSelectionContext.js';

export type FloatingButtonPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type FloatingButtonSize = 'small' | 'medium' | 'large';
export type FloatingButtonPositionType = 'fixed' | 'absolute';

// TODOS:
// - Get svgs instead of pngs
// - Define configuration that needs to move to global react config
// - Improve expand animation so it will roll out from the floating button

export interface FnxFloatingButtonProps extends BaseProps {
  /** Position of the floating button */
  position?: FloatingButtonPosition;
  
  /** Allow predefined sizes */
  size?: FloatingButtonSize;

  buttonClassName?: string;
  statusBarClassName?: string;
  contentSectionClassName?: string;

  /** Click handler */
  onClick?: () => void;
  /** Z-index value (default: 9999) */
  zIndex?: number;
  /** Position type: 'fixed' stays on screen, 'absolute' positions within parent (default: 'fixed') */
  positionType?: FloatingButtonPositionType;
  /** Dark mode for the button (independent of page theme) */
  darkMode?: boolean;
  /** Chain switch handler - called when user selects a different chain in the network dropdown */
  onChainSwitch?: (chainId: number) => Promise<void>;
}

const positionStyles: Record<FloatingButtonPosition, string> = {
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
};

const FnxFloatingButtonInner: React.FC<FnxFloatingButtonProps> = ({
  className,
  testId,
  size = 'large',
  onClick,
  zIndex = 9999,
  positionType = 'fixed',
  buttonClassName,
  statusBarClassName,
  contentSectionClassName,
}) => {
  const {
    effectivePosition,
    isTopSide,
    isLeftSide,
    handleClick,
    darkMode,
  } = useFnxFloatingButtonContext();

  return (
    <div
      data-testid={testId}
      className={cn(
        'fnx-floating-button',
        darkMode && 'dark',
        size,
        positionType,
        'flex',
        positionStyles[effectivePosition],
        // bottom-* opens UP (popup above), top-* opens DOWN (popup below)
        isTopSide ? 'flex-col-reverse items-start' : 'flex-col items-start',
        `z-[${zIndex}]`,
        className
      )}
    >
      <PermitSelectionProvider>
        <ContentSection
          className={contentSectionClassName}
        />
      </PermitSelectionProvider>

      {/* Button and Bar Row */}
      <div className={cn('flex items-center', isLeftSide ? 'flex-row' : 'flex-row-reverse')}>
        <FloatingIcon
          onClick={() => handleClick(onClick)}
          className={buttonClassName}
        />

        <StatusBarSection
          className={statusBarClassName}
        >
          <StatusBarContent />
        </StatusBarSection>
      </div>
    </div>
  );
};

export const FnxFloatingButton: React.FC<FnxFloatingButtonProps> = (props) => {
  return (
    <FnxFloatingButtonProvider 
      darkMode={props.darkMode ?? false} 
      position={props.position}
      onChainSwitch={props.onChainSwitch}
    >
      <FnxFloatingButtonInner {...props} />
    </FnxFloatingButtonProvider>
  );
};
