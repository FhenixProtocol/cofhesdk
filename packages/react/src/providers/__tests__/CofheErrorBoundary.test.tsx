// @vitest-environment happy-dom
import React, { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { CofheErrorBoundary } from '../errors';
import { ErrorBoundary } from 'react-error-boundary';
import type { FallbackProps } from 'react-error-boundary';
import { CofhesdkError, CofhesdkErrorCode } from '@cofhe/sdk';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { shouldPassToErrorBoundary } from '../errors';

function makeHandledCofheError(msg = 'permit missing') {
  return new CofhesdkError({ code: CofhesdkErrorCode.PermitNotFound, message: msg });
}

const HandledFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => (
  <div data-testid="handled-fallback">
    Handled: {error?.message}
    <button onClick={() => resetErrorBoundary()} aria-label="reset">
      reset
    </button>
  </div>
);

const errorFallbacks = [
  {
    checkFn: (e: unknown) =>
      e instanceof CofhesdkError && (e as CofhesdkError).code === CofhesdkErrorCode.PermitNotFound,
    component: HandledFallback,
  },
] as any; // satisfy prop type without importing internal types

function ThrowSync({ error }: { error: unknown }) {
  // Throw during render
  if (error) throw error;
  return <div>ok</div>;
}

function QueryError({ errorToThrow }: { errorToThrow: unknown }) {
  const { status } = useQuery({
    queryKey: ['t'],
    queryFn: async () => {
      throw errorToThrow;
    },
    // Ensure escalation logic mirrors production behavior in tests
    throwOnError: (e) => shouldPassToErrorBoundary(e),
  });
  return <div data-testid="query-status">{status}</div>;
}

function withQueryClient(ui: React.ReactElement, client?: QueryClient) {
  const q =
    client ??
    new QueryClient({
      defaultOptions: {
        queries: {
          retry: 0,
          throwOnError: (e) => shouldPassToErrorBoundary(e),
        },
      },
    });
  return <QueryClientProvider client={q}>{ui}</QueryClientProvider>;
}

describe('CofheErrorBoundary', () => {
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  beforeEach(() => {
    consoleErrorSpy.mockClear();
    consoleWarnSpy.mockClear();
  });

  afterEach(() => {
    // nothing
  });

  it('handles synchronous render errors that match a known handler', () => {
    render(
      <CofheErrorBoundary errorFallbacks={errorFallbacks}>
        <ThrowSync error={makeHandledCofheError('need permit')} />
      </CofheErrorBoundary>
    );
    expect(screen.getByTestId('handled-fallback')).toBeInTheDocument();
    expect(screen.getByText(/need permit/)).toBeInTheDocument();
  });

  it('re-throws synchronous render errors it does not know how to handle (pass-through)', () => {
    const Outer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <ErrorBoundary FallbackComponent={() => <div data-testid="outer-fallback">outer</div>}>{children}</ErrorBoundary>
    );
    render(
      <Outer>
        <CofheErrorBoundary errorFallbacks={errorFallbacks}>
          <ThrowSync error={new Error('boom')} />
        </CofheErrorBoundary>
      </Outer>
    );
    // Unknown error should bubble past CofheErrorBoundary to the outer boundary
    expect(screen.getByTestId('outer-fallback')).toBeInTheDocument();
  });

  it('captures unhandled promise rejections that are known and renders fallback', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    render(
      <CofheErrorBoundary errorFallbacks={errorFallbacks}>
        <div>child</div>
      </CofheErrorBoundary>
    );
    // wait a tick for the effect to subscribe the listener
    await new Promise((r) => setTimeout(r, 0));
    const handler = addSpy.mock.calls.find(([type]) => type === 'unhandledrejection')?.[1] as
      | ((e: any) => void)
      | undefined;
    expect(handler).toBeTruthy();
    const err = makeHandledCofheError('async permit');
    await act(async () => {
      handler?.({ reason: err, preventDefault() {}, stopPropagation() {} } as any);
    });
    await waitFor(() => expect(screen.getByTestId('handled-fallback')).toBeInTheDocument());
    // ensure the intended error instance was reported to console.warn by our handler
    const warnWithErr = consoleWarnSpy.mock.calls.some(
      (args) =>
        typeof args[0] === 'string' &&
        args[0].includes('observed UnhandledRejection that is handled by CofheSDK') &&
        args[1] === err
    );
    expect(warnWithErr).toBe(true);
  });

  it('does not intercept unhandled promise rejections it cannot handle (pass-through)', async () => {
    render(
      <CofheErrorBoundary errorFallbacks={errorFallbacks}>
        <div>child</div>
      </CofheErrorBoundary>
    );
    // wait a tick for the effect to subscribe the listener
    await new Promise((r) => setTimeout(r, 0));
    const unknown = new Error('unknown async');
    const externalListener = (e: any) => {
      console.error('[external-unhandled]', e?.reason);
    };
    window.addEventListener('unhandledrejection', externalListener as any);
    const evt = new Event('unhandledrejection') as any;
    evt.reason = unknown;
    expect((evt as Event).defaultPrevented).toBe(false);
    window.dispatchEvent(evt);
    // the SDK should not warn for unknown errors
    const hasSDKWarn = consoleWarnSpy.mock.calls.some(
      (args) =>
        typeof args[0] === 'string' && args[0].includes('observed UnhandledRejection that is handled by CofheSDK')
    );
    expect(hasSDKWarn).toBe(false);
    // ensure the unknown error bubbled and was logged by our external listener
    const hasExternalLog = consoleErrorSpy.mock.calls.some(
      (args) => args[0] === '[external-unhandled]' && args[1] === unknown
    );
    expect(hasExternalLog).toBe(true);
    expect((evt as Event).defaultPrevented).toBe(false);
    expect(screen.queryByTestId('handled-fallback')).toBeNull();
    window.removeEventListener('unhandledrejection', externalListener as any);
  });

  it('does escalate _known_ react-query errors to the ErrorBoundary via throwOnError and shows fallback', async () => {
    await act(async () => {
      render(
        <CofheErrorBoundary errorFallbacks={errorFallbacks}>
          {withQueryClient(<QueryError errorToThrow={makeHandledCofheError('rq permit')} />)}
        </CofheErrorBoundary>
      );
    });
    await waitFor(() => expect(screen.getByTestId('handled-fallback')).toBeInTheDocument());
  });

  it('does not escalate _unknown_ react-query errors (pass-through), query holds error state', async () => {
    await act(async () => {
      render(
        <CofheErrorBoundary errorFallbacks={errorFallbacks}>
          {withQueryClient(<QueryError errorToThrow={new Error('rq unknown')} />)}
        </CofheErrorBoundary>
      );
    });
    await waitFor(() => expect(screen.getByTestId('query-status')).toBeInTheDocument());
    expect(screen.getByTestId('query-status').textContent).toBe('error');
    expect(screen.queryByTestId('handled-fallback')).toBeNull();
  });
});
