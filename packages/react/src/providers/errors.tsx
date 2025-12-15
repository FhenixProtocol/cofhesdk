import { FnxFloatingButtonBase } from '@/components/FnxFloatingButton/FnxFloatingButtonBase';
import { FloatingButtonPage, type PageState } from '@/components/FnxFloatingButton/pagesConfig/types';
import { CofhesdkError, CofhesdkErrorCode } from '@cofhe/sdk';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { useMemo } from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { ErrorCause, getErrorCause } from '@/utils/index';
import type { FnxFloatingButtonProps } from '@/components/FnxFloatingButton/types';

export const CREATE_PERMITT_BODY_BY_ERROR_CAUSE: Record<ErrorCause, React.FC> = {
  [ErrorCause.AttemptToFetchConfidentialBalance]: () =>
    'In order to fetch confidential token balance, need to generate a new permit.',
};

// only whitelisted errors will reach error boundary (refer to `shouldPassToErrorBoundary`)
const FALLBACK_BY_ERROR_TYPE: ErrorFallbackDefinition[] = [
  {
    // if it's Permit error - redirect to Permit Creation screen
    checkFn: (error: unknown) => error instanceof CofhesdkError && error.code === CofhesdkErrorCode.PermitNotFound,
    componentConstructor: ({ floatingButtonProps }) => {
      const Component: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => {
        const overriddingPage = useMemo<PageState>(() => {
          const errorCause = getErrorCause(error);
          const OverridingBodyComponent = errorCause ? CREATE_PERMITT_BODY_BY_ERROR_CAUSE[errorCause] : undefined;
          return {
            page: FloatingButtonPage.GeneratePermits,
            props: {
              overridingBody: (
                <div>{OverridingBodyComponent ? <OverridingBodyComponent /> : (error as Error)?.message}</div>
              ),
              // resetting error boundary will re-render previously failed components (i.e. the normal aka {children}, non-fallback flow), so essentially will navigate the user back
              onSuccessNavigateTo: () => resetErrorBoundary(),
              onCancel: () => {
                resetErrorBoundary();
              },
              onBack: () => {
                resetErrorBoundary();
              },
            },
          };
        }, [error, resetErrorBoundary]);
        return <FnxFloatingButtonBase {...floatingButtonProps} overriddingPage={overriddingPage} />;
      };
      return Component;
    },
  },
];

type ErrorFallback = {
  checkFn: (error: unknown) => boolean;
  component: React.FC<FallbackProps>;
};

type ErrorFallbackDefinition = {
  checkFn: (error: unknown) => boolean;
  componentConstructor: (deps: { floatingButtonProps: FnxFloatingButtonProps }) => React.FC<FallbackProps>;
};

export function constructErrorFallbacksWithFloatingButtonProps(props: FnxFloatingButtonProps): ErrorFallback[] {
  return FALLBACK_BY_ERROR_TYPE.map(({ checkFn, componentConstructor }) => ({
    checkFn,
    component: componentConstructor({ floatingButtonProps: props }),
  }));
}

export function shouldPassToErrorBoundary(_error: unknown): boolean {
  // only if there's a matching defined handler, pass to error boundary
  return FALLBACK_BY_ERROR_TYPE.some(({ checkFn }) => checkFn(_error));
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
    <QueryErrorResetBoundary>
      {({ reset: queryReset }) => (
        <ErrorBoundary
          onReset={queryReset}
          // FallbackRouter will route to appropriate component based on the error type and code
          FallbackComponent={FallbackRouter}
          onError={(error, info) => {
            console.error('[cofhesdk][ErrorBoundary] error:', error, info);
          }}
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
};
