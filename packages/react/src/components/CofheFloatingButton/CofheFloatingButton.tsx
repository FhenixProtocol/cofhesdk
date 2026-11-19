import { CofheFloatingButtonBase } from './CofheFloatingButtonBase';
import { CofheFloatingButtonProvider } from './CofheFloatingButtonContext';
import type { CofheFloatingButtonProps } from './types';

/**
 * @internal Demo component for now, used internally; not a supported API. Undocumented and may change in any
 * release.
 */
export const CofheFloatingButtonWithProvider: React.FC<CofheFloatingButtonProps> = (props) => {
  return (
    <CofheFloatingButtonProvider>
      <CofheFloatingButtonBase {...props} />
      {props.children}
    </CofheFloatingButtonProvider>
  );
};
