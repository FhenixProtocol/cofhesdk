import { describe, expect, it, vi, afterEach } from 'vitest';

describe('@cofhe/sdk/web SSR smoke', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('imports and creates config in a Node SSR environment', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect((globalThis as { window?: unknown }).window).toBeUndefined();
    expect((globalThis as { document?: unknown }).document).toBeUndefined();

    const web = await import('../index');
    const config = web.createCofheConfig({ supportedChains: [] });

    expect(web.hasDOM).toBe(false);
    expect(config.environment).toBe('web');
    expect(config.fheKeyStorage).not.toBeNull();
    expect(() => web.createCofheClient(config)).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith('using no-op server-side SSR storage');
  });
});
