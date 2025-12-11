import { CofhesdkError, CofhesdkErrorCode } from '@cofhe/sdk';
import { useMemo } from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';

export function shouldPassToErrorBoundary(_error: unknown): boolean {
  // TODO: f.x. permit -> need to be passed here in order to redirect
  if (_error instanceof CofhesdkError) {
    if (_error.code === CofhesdkErrorCode.PermitNotFound) return true;
  }
  return false;
}

type ErrorFallback = {
  checkFn: (error: unknown) => boolean;
  component: React.FC<FallbackProps>;
};

function constructFallbackRouter(errorFallbacks: ErrorFallback[]): React.FC<FallbackProps> {
  const fallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => {
    for (const { checkFn, component: Component } of errorFallbacks) {
      if (checkFn(error)) {
        return <Component error={error} resetErrorBoundary={resetErrorBoundary} />;
      }
    }
    // if none matched - it' means there's logic error
    throw new Error("Error couldn't be handled:" + error?.message);
  };

  return fallback;
}

export const CofheErrorBoundary: React.FC<{ children: React.ReactNode; errorFallbacks: ErrorFallback[] }> = ({
  children,
  errorFallbacks,
}) => {
  const FallbackRouter = useMemo(() => constructFallbackRouter(errorFallbacks), [errorFallbacks]);
  return (
    <ErrorBoundary
      // FallbackRouter will route to appropriate component based on the error type
      FallbackComponent={FallbackRouter}
      onError={(error, info) => {
        console.error('[cofhesdk][ErrorBoundary] error:', error, info);
      }}
    >
      {children}
    </ErrorBoundary>
  );
};
