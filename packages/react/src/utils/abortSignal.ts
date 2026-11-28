/**
 * One signal that fires when any of `signals` does, for a fetch that answers to two callers: the
 * consumer's own `AbortSignal` and React Query's, which fires when the query is cancelled.
 * Returns the only live signal as is, `undefined` when there is none.
 */
export function anySignal(signals: ReadonlyArray<AbortSignal | undefined>): AbortSignal | undefined {
  const live = signals.filter((signal): signal is AbortSignal => signal !== undefined);
  if (live.length === 0) return undefined;
  if (live.length === 1) return live[0];
  const controller = new AbortController();
  for (const signal of live) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}
