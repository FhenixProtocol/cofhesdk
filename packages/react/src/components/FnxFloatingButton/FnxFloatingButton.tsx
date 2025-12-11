import { CofheErrorBoundary } from '@/providers/errors';
import { FnxFloatingButtonBase, type FnxFloatingButtonProps } from './FnxFloatingButtonBase';
import { FnxFloatingButtonProvider } from './FnxFloatingButtonContext';
import { constructErrorFallbacksWithFloatingButtonProps } from '@/providers/error-fallbacks';

export const FnxFloatingButton: React.FC<FnxFloatingButtonProps> = (props) => {
  return (
    <FnxFloatingButtonProvider
      darkMode={props.darkMode ?? false}
      position={props.position}
      onSelectChain={props.onSelectChain}
    >
      <CofheErrorBoundary
        errorFallbacks={
          // only whitelisted errors will reach here (refer to `shouldPassToErrorBoundary`)
          // f.x. if it's Permit error - redirect to Permit Creation screen
          constructErrorFallbacksWithFloatingButtonProps(props)
        }
      >
        <FnxFloatingButtonBase {...props} />
      </CofheErrorBoundary>
    </FnxFloatingButtonProvider>
  );
};
