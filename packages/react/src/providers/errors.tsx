import { CofhesdkError, CofhesdkErrorCode } from '@cofhe/sdk';
import { useMemo } from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import type { ErrorFallback } from './error-fallbacks';

export function shouldPassToErrorBoundary(_error: unknown): boolean {
  if (_error instanceof CofhesdkError) {
    if (_error.code === CofhesdkErrorCode.PermitNotFound) return true;
  }
  return false;
}

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
      // FallbackRouter will route to appropriate component based on the error type and code
      FallbackComponent={FallbackRouter}
      onError={(error, info) => {
        console.error('[cofhesdk][ErrorBoundary] error:', error, info);
      }}
    >
      {children}
    </ErrorBoundary>
  );
};
