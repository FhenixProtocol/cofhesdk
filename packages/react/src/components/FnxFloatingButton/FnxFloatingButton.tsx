import { CofheErrorBoundary, constructErrorFallbacksWithFloatingButtonProps } from '@/providers/errors';
import { FnxFloatingButtonBase, type FnxFloatingButtonProps } from './FnxFloatingButtonBase';
import { FnxFloatingButtonProvider } from './FnxFloatingButtonContext';

export const FnxFloatingButton: React.FC<FnxFloatingButtonProps> = (props) => {
  return (
    <FnxFloatingButtonProvider
      darkMode={props.darkMode ?? false}
      position={props.position}
      onSelectChain={props.onSelectChain}
    >
      <CofheErrorBoundary errorFallbacks={constructErrorFallbacksWithFloatingButtonProps(props)}>
        <FnxFloatingButtonBase {...props} />
      </CofheErrorBoundary>
    </FnxFloatingButtonProvider>
  );
};
