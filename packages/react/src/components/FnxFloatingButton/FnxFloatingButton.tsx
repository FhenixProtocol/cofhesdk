import { CofheErrorBoundary, constructErrorFallbacksWithFloatingButtonProps } from '@/providers/errors';
import { FnxFloatingButtonBase } from './FnxFloatingButtonBase';
import { FnxFloatingButtonProvider } from './FnxFloatingButtonContext';
import type { FnxFloatingButtonProps } from './types';

export const FnxFloatingButtonWithProvider: React.FC<FnxFloatingButtonProps> = (props) => {
  return (
    <FnxFloatingButtonProvider
      darkMode={props.darkMode ?? false}
      position={props.position}
      // TODO: remove?
      // onSelectChain={props.onSelectChain}
    >
      <CofheErrorBoundary errorFallbacks={constructErrorFallbacksWithFloatingButtonProps(props, props.children)}>
        <FnxFloatingButtonBase {...props} />
        {props.children}
      </CofheErrorBoundary>
    </FnxFloatingButtonProvider>
  );
};
