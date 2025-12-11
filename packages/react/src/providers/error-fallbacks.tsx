import {
  FnxFloatingButtonBase,
  type FnxFloatingButtonProps,
} from '@/components/FnxFloatingButton/FnxFloatingButton.js';
import { FloatingButtonPage } from '@/components/FnxFloatingButton/FnxFloatingButtonContext.js';
import { CofhesdkError, CofhesdkErrorCode } from '@cofhe/sdk';
import type { FallbackProps } from 'react-error-boundary';

export type ErrorFallback = {
  checkFn: (error: unknown) => boolean;
  component: React.FC<FallbackProps>;
};

export function constructErrorFallbacksWithFloatingButtonProps(props: FnxFloatingButtonProps): ErrorFallback[] {
  return [
    {
      checkFn: (error: unknown) => error instanceof CofhesdkError && error.code === CofhesdkErrorCode.PermitNotFound,
      component: ({ resetErrorBoundary, error }) => {
        return (
          <FnxFloatingButtonBase
            {...props}
            overriddingPage={{
              // page, header message are essential, the rest is scaffold
              page: FloatingButtonPage.GeneratePermits,
              props: {
                headerMessage: <div>{error.message}</div>,
                // resetting error boundary will re-render previously failed components (i.e. the normal aka {children}, non-fallback flow), so essentially will navigate the user back
                onSuccessNavigateTo: () => resetErrorBoundary(),
              },
            }}
          />
        );
      },
    },
  ];
}
