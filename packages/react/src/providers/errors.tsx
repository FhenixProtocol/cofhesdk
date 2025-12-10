import { CofhesdkError, CofhesdkErrorCode } from '@cofhe/sdk';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';

export function shouldPassToErrorBoundary(_error: unknown): boolean {
  // TODO: f.x. permit -> need to be passed here in order to redirect
  if (_error instanceof CofhesdkError) {
    if (_error.code === CofhesdkErrorCode.PermitNotFound) return true;
  }
  return false;
}

const DEFAULT_ERROR_HANDLERS: ErrorFallback[] = [
  {
    checkFn: (error: unknown) => true,
    component: (props: FallbackProps) => <DefaultFallback {...props} />,
  },
];

type ErrorFallback = {
  checkFn: (error: unknown) => boolean;
  component: React.FC<FallbackProps>;
};

const DefaultFallback: React.FC<FallbackProps> = ({ error }) => {
  if (!shouldPassToErrorBoundary(error)) {
    throw new Error('Error not handled by DefaultFallback and should not reach here');
  }
  return <pre>{JSON.stringify(error, null, 2)}</pre>;
};

export const CofheErrorBoundary: React.FC<{ children: React.ReactNode; errorFallbacks: ErrorFallback[] }> = ({
  children,
  errorFallbacks,
}) => {
  const mergedErrorFallbacks = [...(errorFallbacks || []), ...DEFAULT_ERROR_HANDLERS];
  const fallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => {
    for (const ef of mergedErrorFallbacks) {
      if (ef.checkFn(error)) {
        const Component = ef.component;
        return <Component error={error} resetErrorBoundary={resetErrorBoundary} />;
      }
    }
    // Fallback to default
    return <DefaultFallback error={error} resetErrorBoundary={resetErrorBoundary} />;
  };
  return (
    <ErrorBoundary
      FallbackComponent={fallback}
      onError={(error, info) => {
        // Centralized logging without rendering a fallback UI
        console.error('[cofhesdk][ErrorBoundary] error:', error, info);
      }}
    >
      {children}
    </ErrorBoundary>
  );
};
