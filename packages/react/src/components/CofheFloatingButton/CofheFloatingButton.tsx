import { CofheFloatingButtonBase } from './CofheFloatingButtonBase';
import { CofheFloatingButtonProvider } from './CofheFloatingButtonContext';
import type { CofheFloatingButtonProps } from './types';

export const CofheFloatingButtonWithProvider: React.FC<CofheFloatingButtonProps> = (props) => {
  return (
    <CofheFloatingButtonProvider>
      <CofheFloatingButtonBase {...props} />
      {props.children}
    </CofheFloatingButtonProvider>
  );
};
