import { describe, expect, it, vi } from 'vitest';
import { createDecryptLimiter } from '../decrypt/decryptLimiter.js';
import { CofheErrorCode } from '../error.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe('createDecryptLimiter', () => {
  it('runs at most `max` tasks at a time, in call order', async () => {
    const limit = createDecryptLimiter(2);
    const gates = [deferred<number>(), deferred<number>(), deferred<number>()];
    const started = vi.fn();
    const run = (i: number) =>
      limit(() => {
        started(i);
        return gates[i].promise;
      }, 'decrypt');

    const all = Promise.all([run(0), run(1), run(2)]);
    await Promise.resolve();
    expect(started.mock.calls.map(([i]) => i)).toEqual([0, 1]);

    gates[0].resolve(10);
    await Promise.resolve();
    await Promise.resolve();
    expect(started.mock.calls.map(([i]) => i)).toEqual([0, 1, 2]);

    gates[1].resolve(11);
    gates[2].resolve(12);
    await expect(all).resolves.toEqual([10, 11, 12]);
  });

  it('a task aborted while waiting never starts and frees its place in the queue', async () => {
    const limit = createDecryptLimiter(1);
    const gate = deferred<number>();
    const controller = new AbortController();
    const started = vi.fn();

    const first = limit(() => gate.promise, 'decrypt');
    const second = limit(async () => started('second'), 'decrypt', controller.signal);
    const third = limit(async () => started('third'), 'decrypt');

    controller.abort();
    await expect(second).rejects.toMatchObject({ code: CofheErrorCode.Aborted });
    expect(started).not.toHaveBeenCalled();

    gate.resolve(1);
    await expect(first).resolves.toBe(1);
    await third;
    expect(started).toHaveBeenCalledWith('third');
    expect(started).not.toHaveBeenCalledWith('second');
  });

  it('a signal that already fired rejects before the task is queued', async () => {
    const limit = createDecryptLimiter(1);
    const controller = new AbortController();
    controller.abort();
    const task = vi.fn(async () => 1);

    await expect(limit(task, 'sealOutput', controller.signal)).rejects.toMatchObject({ code: CofheErrorCode.Aborted });
    expect(task).not.toHaveBeenCalled();
  });

  it('a failed task releases its slot', async () => {
    const limit = createDecryptLimiter(1);
    await expect(limit(async () => Promise.reject(new Error('boom')), 'decrypt')).rejects.toThrow('boom');
    await expect(limit(async () => 2, 'decrypt')).resolves.toBe(2);
  });
});
