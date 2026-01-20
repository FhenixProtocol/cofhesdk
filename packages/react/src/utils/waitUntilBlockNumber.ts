import type { PublicClient } from 'viem';

export type WaitUntilBlockNumberOptions = {
  pollingInterval?: number;
  signal?: AbortSignal;
};

function abortError(message = 'Aborted') {
  // Keep it compatible across environments (DOMException may not exist in Node).
  const err = new Error(message);
  (err as any).name = 'AbortError';
  return err;
}

/**
 * Resolves once the chain reaches `targetBlockNumber`.
 *
 * Uses `watchBlockNumber` so it does not poll, and respects AbortSignal (e.g. from TanStack Query).
 */
export async function waitUntilBlockNumber(
  publicClient: PublicClient,
  targetBlockNumber: bigint,
  options: WaitUntilBlockNumberOptions = {}
): Promise<bigint> {
  if (options.signal?.aborted) throw abortError();

  const current = await publicClient.getBlockNumber();
  if (current >= targetBlockNumber) return current;

  return await new Promise<bigint>((resolve, reject) => {
    let settled = false;

    const cleanup = (unwatch?: () => void) => {
      if (settled) return;
      settled = true;
      unwatch?.();
      if (options.signal) options.signal.removeEventListener('abort', onAbort);
    };

    const onAbort = () => {
      cleanup(unwatch);
      reject(abortError());
    };

    if (options.signal) options.signal.addEventListener('abort', onAbort, { once: true });

    const unwatch = publicClient.watchBlockNumber({
      pollingInterval: options.pollingInterval,
      emitOnBegin: true,
      onBlockNumber: (blockNumber) => {
        if (blockNumber >= targetBlockNumber) {
          cleanup(unwatch);
          resolve(blockNumber);
        }
      },
      onError: (err) => {
        cleanup(unwatch);
        reject(err);
      },
    });
  });
}
