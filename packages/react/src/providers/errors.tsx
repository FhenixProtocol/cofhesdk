import { CofhesdkError, CofhesdkErrorCode } from '@cofhe/sdk';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';

export function shouldPassToErrorBoundary(_error: unknown): boolean {
  // TODO: f.x. permit -> need to be passed here in order to redirect
  if (_error instanceof CofhesdkError) {
    if (_error.code === CofhesdkErrorCode.PermitNotFound) return true;
  }
  return false;
}

const Fallback: React.FC<FallbackProps> = () => {
  // only whitelisted errors will reach here (refer to `shouldPassToErrorBoundary`)
  // f.x. if it's Permit error - redirect to Permit Creation screen
  return <div>TODO: redirect to error screen</div>;
};

export const CofheErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary
    FallbackComponent={Fallback}
    onError={(error, info) => {
      // Centralized logging without rendering a fallback UI
      console.error('[cofhesdk][ErrorBoundary] error:', error, info);
    }}
  >
    {children}
  </ErrorBoundary>
);
