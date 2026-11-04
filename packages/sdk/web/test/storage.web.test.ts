import { describe, expect, it, vi } from 'vitest';
import { createIndexedDbStorage, withFallback } from '../storage';

const failing = (message: string) => ({
  getItem: vi.fn().mockRejectedValue(new Error(message)),
  setItem: vi.fn().mockRejectedValue(new Error(message)),
  removeItem: vi.fn().mockRejectedValue(new Error(message)),
});

const memory = () => {
  const items = new Map<string, unknown>();
  return {
    items,
    getItem: vi.fn(async (name: string) => items.get(name) ?? null),
    setItem: vi.fn(async (name: string, value: unknown) => {
      items.set(name, value);
    }),
    removeItem: vi.fn(async (name: string) => {
      items.delete(name);
    }),
  };
};

describe('createIndexedDbStorage', () => {
  // One database per test. A storage keeps its connection open, and deleting a database with an
  // open connection blocks the next open on the same name.
  let n = 0;
  const freshStorage = () => createIndexedDbStorage(`cofhesdk-test-${Date.now()}-${n++}`);

  it('stores, reads back and removes a value', async () => {
    const storage = freshStorage();
    expect(await storage.getItem('k')).toBeNull();
    await storage.setItem('k', { fhe: { 1: { 0: 'key' } } });
    expect(await storage.getItem('k')).toEqual({ fhe: { 1: { 0: 'key' } } });
    await storage.removeItem('k');
    expect(await storage.getItem('k')).toBeNull();
  });

  it('holds a value the size of a CRS', async () => {
    const storage = freshStorage();
    const big = 'a'.repeat(8_000_000);
    await storage.setItem('crs', big);
    expect(((await storage.getItem('crs')) as string).length).toBe(8_000_000);
  });
});

describe('withFallback', () => {
  it('uses the primary while it works', async () => {
    const primary = memory();
    const fallback = memory();
    const storage = withFallback(primary, fallback, 'switching');
    await storage.setItem('k', 1);
    expect(await storage.getItem('k')).toBe(1);
    expect(fallback.getItem).not.toHaveBeenCalled();
  });

  it('switches to the fallback on the first error, retries that call there, and warns once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const primary = failing('iframe not ready');
    const fallback = memory();
    const onFallback = vi.fn();
    const storage = withFallback(primary, fallback, 'switching', onFallback);

    expect(await storage.getItem('k')).toBeNull();
    await storage.setItem('k', 2);
    expect(await storage.getItem('k')).toBe(2);

    expect(primary.getItem).toHaveBeenCalledTimes(1);
    expect(primary.setItem).not.toHaveBeenCalled();
    expect(fallback.setItem).toHaveBeenCalledWith('k', 2);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toBe('switching');
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(onFallback.mock.calls[0][0]).toMatchObject({ operation: 'getItem', error: expect.any(Error) });
    warn.mockRestore();
  });

  it('lets a fallback error through, so the caller can fall back further', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = withFallback(failing('hub down'), failing('idb blocked'), 'switching');
    await expect(storage.getItem('k')).rejects.toThrow('idb blocked');
    vi.restoreAllMocks();
  });
});
