import {
  FnxFloatingButtonBase,
  type FnxFloatingButtonProps,
} from '@/components/FnxFloatingButton/FnxFloatingButtonBase';
import { FloatingButtonPage, type PageState } from '@/components/FnxFloatingButton/pagesConfig/types';
import { CofhesdkError, CofhesdkErrorCode } from '@cofhe/sdk';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { useMemo } from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { useFnxFloatingButtonContext } from '@/components/FnxFloatingButton/FnxFloatingButtonContext';

// only whitelisted errors will reach error boundary (refer to `shouldPassToErrorBoundary`)
const FALLBACK_BY_ERROR_TYPE: ErrorFallbackDefinition[] = [
  {
    // if it's Permit error - redirect to Permit Creation screen
    checkFn: (error: unknown) => error instanceof CofhesdkError && error.code === CofhesdkErrorCode.PermitNotFound,
    componentConstructor: ({ floatingButtonProps }) => {
      const Component: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => {
        const { setEnableBackgroundDecryption } = useFnxFloatingButtonContext();
        const overriddingPage = useMemo<PageState>(
          () => ({
            page: FloatingButtonPage.GeneratePermits,
            props: {
              headerMessage: <div>{(error as Error)?.message}</div>,
              // resetting error boundary will re-render previously failed components (i.e. the normal aka {children}, non-fallback flow), so essentially will navigate the user back
              onSuccessNavigateTo: () => resetErrorBoundary(),
              onCancel: () => {
                setEnableBackgroundDecryption(false);
                resetErrorBoundary();
              },
              onBack: () => {
                setEnableBackgroundDecryption(false);
                resetErrorBoundary();
              },
            },
          }),
          [error, resetErrorBoundary, setEnableBackgroundDecryption]
        );
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

type OverridingPageConstructor<T extends FloatingButtonPage> = (fallbackProps: FallbackProps) => PageState<T>;

function constructFloatingButtonFallback<T extends FloatingButtonPage>(
  props: FnxFloatingButtonProps,
  overriddingPageConstructor: OverridingPageConstructor<T>
): React.FC<FallbackProps> {
  return ({ resetErrorBoundary, error }) => {
    const overriddingPage = useMemo(
      () => overriddingPageConstructor({ error, resetErrorBoundary }),
      [error, resetErrorBoundary]
    );
    return <FnxFloatingButtonBase {...props} overriddingPage={overriddingPage} />;
  };
}

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
