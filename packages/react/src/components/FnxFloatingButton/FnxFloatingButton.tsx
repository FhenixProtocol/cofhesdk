import { FnxFloatingButtonBase } from './FnxFloatingButtonBase';
import { FnxFloatingButtonProvider } from './FnxFloatingButtonContext';
import type { FnxFloatingButtonProps } from './types';

export const FnxFloatingButtonWithProvider: React.FC<FnxFloatingButtonProps> = (props) => {
  return (
    <FnxFloatingButtonProvider>
      <FnxFloatingButtonBase {...props} />
      {props.children}
    </FnxFloatingButtonProvider>
  );
};
