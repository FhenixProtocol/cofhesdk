import { FnxFloatingButtonBase } from '@/components/FnxFloatingButton/FnxFloatingButtonBase';
import { type PageState } from '@/components/FnxFloatingButton/pagesConfig/types';
import { CofhesdkError, CofhesdkErrorCode } from '@cofhe/sdk';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { ErrorBoundary, useErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { ErrorCause, getErrorCause } from '@/utils/index';
import type { FnxFloatingButtonProps } from '@/components/FnxFloatingButton/types';
import { FloatingButtonPage } from '@/components/FnxFloatingButton/pagesConfig/types';
import { usePortalUI } from '@/stores';

class CofheFallbackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CofheFallbackError';
  }
}

export const CREATE_PERMITT_BODY_BY_ERROR_CAUSE: Record<ErrorCause, React.FC> = {
  [ErrorCause.AttemptToFetchConfidentialBalance]: () =>
    'In order to fetch confidential token balance, need to generate a new permit.',
  [ErrorCause.AttemptToFetchCustomData]: () => 'In order to fetch custom data, need to generate a new permit.',
};

// only whitelisted errors will reach error boundary (refer to `shouldPassToErrorBoundary`)
const FALLBACK_BY_ERROR_TYPE: ErrorFallbackDefinition[] = [
  {
    // if it's Permit error - redirect to Permit Creation screen
    checkFn: (error: unknown) => error instanceof CofhesdkError && error.code === CofhesdkErrorCode.PermitNotFound,
    componentConstructor: ({ floatingButtonProps, restOfTheChildren }) => {
      const Component: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => {
        const { portalOpen, openPortal } = usePortalUI();
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
        useEffect(() => {
          if (!portalOpen) openPortal();
        }, [openPortal, portalOpen]);
        return (
          <>
            <FnxFloatingButtonBase {...floatingButtonProps} overriddingPage={overriddingPage} />
            {restOfTheChildren}
          </>
        );
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
  componentConstructor: (deps: {
    floatingButtonProps: FnxFloatingButtonProps;
    restOfTheChildren: React.ReactNode;
  }) => React.FC<FallbackProps>;
};

export function constructErrorFallbacksWithFloatingButtonProps(
  props: FnxFloatingButtonProps,
  restOfTheChildren: React.ReactNode
): ErrorFallback[] {
  return FALLBACK_BY_ERROR_TYPE.map(({ checkFn, componentConstructor }) => ({
    checkFn,
    component: componentConstructor({ floatingButtonProps: props, restOfTheChildren }),
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
    // if none matched - it' means there's logic error.
    // we'll re-throw the error, which will result into the original logs as if there was no error boundary + error log about the fallback error
    throw new CofheFallbackError("Error couldn't be handled:" + error?.message);
  };

  return fallback;
}

const UncaughtPromisesHandler = function UncaughtPromisesHandler() {
  const { showBoundary } = useErrorBoundary();
  // Listen for unhandled promise rejections ("Uncaught (in promise)") not caught by ErrorBoundary
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onUnhandled = (event: PromiseRejectionEvent) => {
      // if we can't handle it - ignore
      if (!shouldPassToErrorBoundary(event.reason)) return;

      // if we do handle it - no need to log it further
      event.preventDefault();
      event.stopPropagation();

      try {
        // eslint-disable-next-line no-console
        console.warn('[observed UnhandledRejection that is handled by CofheSDK]', event.reason);
        // Show fallback without rethrowing during render
        showBoundary(event.reason);
        // eslint-disable-next-line no-empty
      } catch {}
    };
    window.addEventListener('unhandledrejection', onUnhandled);
    return () => {
      window.removeEventListener('unhandledrejection', onUnhandled);
    };
  }, [showBoundary]);
  return null;
};

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
          <UncaughtPromisesHandler />
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
};
