import React from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('@cofhe/react SSR smoke', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('imports the public entrypoint without browser globals', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect((globalThis as { window?: unknown }).window).toBeUndefined();
    expect((globalThis as { document?: unknown }).document).toBeUndefined();

    const entry = await import('./index');

    expect(entry.CofheProvider).toBeTypeOf('function');
    expect(entry.createCofheConfig).toBeTypeOf('function');
    expect(entry.useInternalQueryClient).toBeTypeOf('function');
  }, 20000);

  it('creates config and renders a provider tree during SSR', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const [{ createCofheConfig }, { QueryProvider }] = await Promise.all([
      import('./config'),
      import('./providers/QueryProvider'),
    ]);

    expect(() => createCofheConfig({ supportedChains: [] })).not.toThrow();

    const html = renderToString(
      <QueryProvider>
        <div>ssr-smoke</div>
      </QueryProvider>
    );

    expect(html).toContain('ssr-smoke');
    expect(warnSpy).toHaveBeenCalledWith('using no-op server-side SSR storage');
  });
});
