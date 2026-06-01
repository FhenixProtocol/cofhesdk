import React from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

const usePersistentQueriesSubscription = vi.fn();

vi.mock('./queryUtils', () => ({
  usePersistentQueriesSubscription,
}));

describe('QueryProvider', () => {
  afterEach(() => {
    usePersistentQueriesSubscription.mockReset();
  });

  it('wires persistence for the internally created QueryClient', async () => {
    const { QueryProvider } = await import('./QueryProvider');

    renderToString(
      <QueryProvider>
        <div>content</div>
      </QueryProvider>
    );

    expect(usePersistentQueriesSubscription).toHaveBeenCalledTimes(1);
    expect(usePersistentQueriesSubscription).toHaveBeenCalledWith({
      queryClient: expect.any(QueryClient),
      overridingQueryClient: undefined,
    });
  });

  it('passes through an overriding QueryClient to the persistence hook', async () => {
    const { QueryProvider } = await import('./QueryProvider');
    const overridingQueryClient = new QueryClient();

    renderToString(
      <QueryProvider queryClient={overridingQueryClient}>
        <div>content</div>
      </QueryProvider>
    );

    expect(usePersistentQueriesSubscription).toHaveBeenCalledTimes(1);
    expect(usePersistentQueriesSubscription).toHaveBeenCalledWith({
      queryClient: overridingQueryClient,
      overridingQueryClient,
    });
  });
});
